// Écritures personnelles d'un jeu : absences, chiffres des joueurs, avis sur les candidats, passage à l'essai.

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, exigerEspace, exigerPerm } from '../auth/acces.js';
import { champsMetier } from '../domaine/depot.js';
import { verifierQuota } from './donnees.js';
import { MOTIFS, nouvelId } from '../../shared/validation.js';
import { peut } from '../../shared/roles.js';

export function routesPerso(routeur, s) {
  const espace = [exigerConnexion(s), exigerEspace(s)];

  // Pour soi-même avec la permission « soi », pour tout le monde avec la permission « tous ».
  async function verifierCible(r, membreId, permSoi, permTous, message) {
    if (!MOTIFS.membre.test(membreId || '')) throw erreurs.requete('Membre invalide.');
    const soi = r.compte.membreId === membreId && peut(r.compte, permSoi);
    if (!soi && !peut(r.compte, permTous)) throw erreurs.interdit(message);
    if (!(await r.espace.stockage.lire('membres', membreId))) throw erreurs.introuvable('Membre introuvable.');
  }

  // ——— Absences prévues ———
  routeur.post('/api/e/:jeu/absences', ...espace, async (r) => {
    const e = r.espace;
    const v = e.schemas().validerDocument('absences', (await r.corps()).valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    await verifierCible(r, v.valeur.membreId, 'dispos.soi', 'dispos.tous', 'Tu ne peux déclarer que tes propres absences.');
    await verifierQuota(e.stockage, 'absences', null);
    const doc = await e.depot.enregistrer('absences', nouvelId('a'), v.valeur, r.compte);
    envoyerJson(r.res, 201, { doc });
  });

  routeur.delete('/api/e/:jeu/absences/:id', ...espace, async (r) => {
    if (!MOTIFS.absence.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const a = await r.espace.stockage.lire('absences', r.params.id);
    if (!a) throw erreurs.introuvable('Absence introuvable.');
    await verifierCible(r, a.membreId, 'dispos.soi', 'dispos.tous', 'Tu ne peux retirer que tes propres absences.');
    envoyerJson(r.res, 200, { ok: await r.espace.depot.supprimer('absences', a._id, r.compte) });
  });

  // ——— Chiffres hebdomadaires (les chiffres suivis dépendent du jeu) ———
  routeur.put('/api/e/:jeu/mesures/:membreId/:semaine', ...espace, async (r) => {
    const e = r.espace;
    const { membreId, semaine } = r.params;
    if (!MOTIFS.semaine.test(semaine)) throw erreurs.requete('Semaine invalide.');
    await verifierCible(r, membreId, 'mesures.soi', 'objectifs.fixer', 'Tu ne peux saisir que tes propres chiffres.');
    const v = e.schemas().validerDocument('mesures', (await r.corps()).valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const id = `${membreId}_${semaine}`;
    await verifierQuota(e.stockage, 'mesures', id);
    const doc = await e.depot.enregistrer('mesures', id, { ...v.valeur, membreId, semaine }, r.compte);
    envoyerJson(r.res, 200, { doc });
  });

  routeur.delete('/api/e/:jeu/mesures/:membreId/:semaine', ...espace, async (r) => {
    const { membreId, semaine } = r.params;
    if (!MOTIFS.semaine.test(semaine)) throw erreurs.requete('Semaine invalide.');
    await verifierCible(r, membreId, 'mesures.soi', 'objectifs.fixer', 'Tu ne peux retirer que tes propres chiffres.');
    envoyerJson(r.res, 200, { ok: await r.espace.depot.supprimer('mesures', `${membreId}_${semaine}`, r.compte) });
  });

  // ——— Avis sur les candidats : un document par personne et par candidat, aucun avis ne peut en écraser un autre ———
  async function lireCandidat(r) {
    if (!MOTIFS.candidat.test(r.params.cible)) throw erreurs.requete('Candidat invalide.');
    const sujet = await r.espace.stockage.lire('candidats', r.params.cible);
    if (!sujet) throw erreurs.introuvable('Candidat introuvable.');
    return sujet;
  }

  routeur.put('/api/e/:jeu/votes/:cible', ...espace, exigerPerm('recrutement.voter'), async (r) => {
    const e = r.espace;
    const sujet = await lireCandidat(r);
    const v = e.schemas().validerDocument('votes', (await r.corps()).valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const id = `${sujet._id}_${r.compte._id}`;
    await verifierQuota(e.stockage, 'votes', id);
    const doc = await e.depot.enregistrer('votes', id, { cible: sujet._id, compteId: r.compte._id, avis: v.valeur.avis, commentaire: v.valeur.commentaire }, r.compte);
    envoyerJson(r.res, 200, { doc });
  });

  routeur.delete('/api/e/:jeu/votes/:cible', ...espace, exigerPerm('recrutement.voter'), async (r) => {
    const sujet = await lireCandidat(r);
    envoyerJson(r.res, 200, { ok: await r.espace.depot.supprimer('votes', `${sujet._id}_${r.compte._id}`, r.compte) });
  });

  // ——— Recrutement : un candidat passe à l'essai et entre au roster ———
  routeur.post('/api/e/:jeu/candidats/:id/essai', ...espace, exigerPerm('recrutement.modifier'), async (r) => {
    const e = r.espace;
    if (!MOTIFS.candidat.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const c = await e.stockage.lire('candidats', r.params.id);
    if (!c) throw erreurs.introuvable('Candidat introuvable.');
    let membreId = c.membreId;
    if (!membreId || !(await e.stockage.lire('membres', membreId))) {
      await verifierQuota(e.stockage, 'membres', null);
      membreId = nouvelId('m');
      await e.depot.enregistrer('membres', membreId, e.schemas().documentParDefaut('membres', {
        type: 'joueur', statut: 'essai', pseudo: c.pseudo, idJeu: c.idJeu, roleJeu: c.roleJeu,
      }), r.compte);
    }
    const doc = await e.depot.enregistrer('candidats', c._id, { ...champsMetier(c), statut: 'essai', membreId }, r.compte);
    await e.depot.journaliser(r.compte, 'candidat passé à l’essai', c.pseudo);
    envoyerJson(r.res, 200, { doc, membreId });
  });
}
