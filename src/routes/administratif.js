// Gestion administrative de la structure (Administrateur général) : identité de l'association, suivi des obligations,
// veille légale (propositions à valider), autorisations des joueurs mineurs. Côté jeu, le Responsable coche les
// autorisations de ses joueurs (/api/e/:jeu/autorisations). La page « Données et confidentialité » lit l'identité
// publique (nom, contact) sans connexion. Le livre des comptes est dans routes/tresorerie.js.

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, exigerAdmin, exigerEspace, exigerPerm } from '../auth/acces.js';
import { valider, MOTIFS } from '../../shared/validation.js';
import {
  identite as schemaIdentite, suiviPoint, autorisation as schemaAutorisation, manques, contexteStructure, nomPublic,
} from '../../shared/administratif/identite.js';
import { tousLesPoints, sectionsVisibles } from '../../shared/administratif/obligations.js';
import { sauvegardeStructure } from '../domaine/sauvegarde-structure.js';
import { reprendre, MOT_REPRISE } from '../domaine/reprise-structure.js';

const LIMITE_SAUVEGARDE = 15 * 1024 * 1024;

export const ID_IDENTITE = 'structure-identite';
export const ID_SUIVI = 'structure-suivi';

export async function lireIdentite(global) {
  const doc = await global.lire('parametres', ID_IDENTITE);
  return valider(schemaIdentite, doc || {}).valeur;
}

export function routesAdministratif(routeur, s) {
  const admin = [exigerConnexion(s), exigerAdmin()];
  const espace = [exigerConnexion(s), exigerEspace(s)];

  // Joueurs et staff de chaque jeu actif, avec leurs autorisations (les mineurs d'abord).
  async function mineurs() {
    const toutes = await s.global.lister('autorisations');
    const jeux = [];
    for (const d of s.registre.liste().filter((x) => x.actif !== false)) {
      const e = s.registre.obtenir(d._id);
      if (!e) continue;
      const membres = await e.stockage.lister('membres');
      const parId = new Map(toutes.filter((a) => a.jeu === e.id).map((a) => [a.membreId, a]));
      jeux.push({
        id: e.id,
        nom: e.def.nom,
        membres: membres.map((m) => {
          const a = parId.get(m._id) || {};
          return { id: m._id, pseudo: m.pseudo || '', type: m.type, mineur: !!a.mineur, parentale: a.parentale || '', image: a.image || '', manques: manques(a), renseigne: !!parId.get(m._id) };
        }).sort((x, y) => Number(y.mineur) - Number(x.mineur) || x.pseudo.localeCompare(y.pseudo, 'fr')),
      });
    }
    return jeux;
  }

  // ——— Public : ce qu'affiche la page « Données et confidentialité », avant toute connexion ———
  routeur.get('/api/public/structure', async (r) => {
    const i = await lireIdentite(s.global);
    envoyerJson(r.res, 200, { nom: nomPublic(i), contact: i.contact });
  });

  // Téléchargement de la sauvegarde de la structure (même contenu que la copie hebdomadaire du Pi).
  routeur.get('/api/admin/administratif/sauvegarde', ...admin, async (r) => {
    const sauvegarde = await sauvegardeStructure(s);
    const corps = JSON.stringify(sauvegarde, null, 2);
    await s.historique.ecrire(r.compteGlobal, 'export des données de la structure');
    r.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sauvegarde.format}-${sauvegarde.exporteLe.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(corps),
    });
    r.res.end(corps);
  });

  // Reprise après sinistre : ne crée que ce qui manque (jeux, comptes, documents), ne modifie jamais l'existant.
  // { sauvegarde, apercu: true } : plan sans rien écrire ; sinon le mot RESTAURER est exigé.
  routeur.post('/api/admin/administratif/reprise', ...admin, async (r) => {
    const corps = await r.corps(LIMITE_SAUVEGARDE);
    const apercu = corps?.apercu === true;
    if (!apercu && corps?.confirmation !== MOT_REPRISE) throw erreurs.requete(`Tape ${MOT_REPRISE} pour confirmer la reprise.`);
    envoyerJson(r.res, 200, await reprendre(s, corps?.sauvegarde, r.compteGlobal, { apercu }));
  });

  routeur.get('/api/admin/administratif', ...admin, async (r) => {
    const suivi = (await s.global.lire('parametres', ID_SUIVI))?.points || {};
    const identite = await lireIdentite(s.global);
    const contexte = contexteStructure(identite);
    const veille = await s.veille.etat();
    envoyerJson(r.res, 200, {
      identite,
      contexte,
      suivi,
      // Seules les sections qui concernent la structure aujourd'hui (forme juridique, passage prévu).
      veille: { ...veille, obligations: sectionsVisibles(veille.obligations, contexte) },
      mineurs: await mineurs(),
    });
  });

  routeur.put('/api/admin/administratif/identite', ...admin, async (r) => {
    // Fusion avec l'identité enregistrée : un envoi partiel (ancien onglet, autre formulaire) n'efface rien.
    const avant = await lireIdentite(s.global);
    const corps = await r.corps();
    const v = valider(schemaIdentite, { ...avant, ...(corps && typeof corps === 'object' ? corps : {}) });
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    await s.global.ecrire('parametres', { _id: ID_IDENTITE, ...v.valeur });
    await s.historique.ecrire(r.compteGlobal, 'identité de la structure modifiée', nomPublic(v.valeur));
    if (avant.forme !== v.valeur.forme) {
      await s.historique.ecrire(r.compteGlobal, 'forme juridique changée', v.valeur.forme === 'societe' ? `société ${v.valeur.societeNom || ''}`.trim() : 'association');
    }
    envoyerJson(r.res, 200, { identite: v.valeur });
  });

  routeur.put('/api/admin/administratif/suivi/:cle', ...admin, async (r) => {
    const { obligations } = await s.veille.etat();
    const point = tousLesPoints(obligations).find((p) => `${p.section}.${p.id}` === r.params.cle);
    if (!point) throw erreurs.introuvable('Obligation inconnue.');
    const v = valider(suiviPoint, await r.corps());
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const doc = (await s.global.lire('parametres', ID_SUIVI)) || { _id: ID_SUIVI, points: {} };
    doc.points = { ...doc.points, [r.params.cle]: { ...v.valeur, par: r.compteGlobal._id, modifieLe: s.maintenant().toISOString() } };
    await s.global.ecrire('parametres', doc);
    await s.historique.ecrire(r.compteGlobal, 'obligation suivie', point.titre, v.valeur.statut);
    envoyerJson(r.res, 200, { suivi: doc.points });
  });

  // ——— Veille légale ———
  routeur.post('/api/admin/administratif/veille', ...admin, async (r) => {
    const resultat = s.veille.lancer();
    if (!resultat.lancee) {
      throw erreurs.conflit(resultat.raison === 'cle_absente'
        ? 'Clé API Claude absente : utilise la vérification manuelle (copier la consigne, coller la réponse).'
        : 'Une vérification est déjà en cours.');
    }
    await s.historique.ecrire(r.compteGlobal, 'veille légale lancée');
    envoyerJson(r.res, 202, { lancee: true });
  });

  routeur.get('/api/admin/administratif/veille/consigne', ...admin, async (r) => {
    envoyerJson(r.res, 200, { texte: await s.veille.consigneManuelle() });
  });

  routeur.post('/api/admin/administratif/veille/import', ...admin, async (r) => {
    const { texte } = (await r.corps(256 * 1024)) || {};
    if (typeof texte !== 'string' || !texte.trim()) throw erreurs.requete('Colle la réponse de Claude.');
    let resultat;
    try {
      resultat = await s.veille.importer(texte);
    } catch (e) {
      throw erreurs.invalide([{ chemin: 'texte', message: e.message }]);
    }
    await s.historique.ecrire(r.compteGlobal, 'veille légale importée', '', `${resultat.nouvelles} proposition(s)`);
    envoyerJson(r.res, 200, { ...resultat, veille: await s.veille.etat() });
  });

  routeur.post('/api/admin/administratif/veille/propositions/:id', ...admin, async (r) => {
    const { accepter } = (await r.corps()) || {};
    if (typeof accepter !== 'boolean') throw erreurs.requete();
    const p = await s.veille.decider(r.params.id, accepter, r.compteGlobal);
    if (!p) throw erreurs.introuvable('Proposition introuvable ou déjà traitée.');
    await s.historique.ecrire(r.compteGlobal, accepter ? 'veille légale : changement accepté' : 'veille légale : changement refusé', p.cle);
    envoyerJson(r.res, 200, { veille: await s.veille.etat() });
  });

  // ——— Autorisations des joueurs d'un jeu (Responsable du jeu, ou Administrateur général) ———
  routeur.get('/api/e/:jeu/autorisations', ...espace, exigerPerm('comptes.gerer'), async (r) => {
    const liste = await s.global.lister('autorisations', { jeu: r.espace.id });
    envoyerJson(r.res, 200, { autorisations: Object.fromEntries(liste.map((a) => [a.membreId, { mineur: !!a.mineur, parentale: a.parentale || '', image: a.image || '', note: a.note || '' }])) });
  });

  routeur.put('/api/e/:jeu/autorisations/:membreId', ...espace, exigerPerm('comptes.gerer'), async (r) => {
    const membreId = String(r.params.membreId || '');
    if (!MOTIFS.membre.test(membreId) || !(await r.espace.stockage.lire('membres', membreId))) throw erreurs.introuvable('Membre introuvable.');
    const v = valider(schemaAutorisation, await r.corps());
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const doc = { _id: `${r.espace.id}:${membreId}`, jeu: r.espace.id, membreId, ...v.valeur, modifieLe: s.maintenant().toISOString(), par: r.compteGlobal._id };
    await s.global.ecrire('autorisations', doc);
    await r.espace.depot.journaliser(r.compte, 'autorisations d’un joueur mises à jour', membreId);
    envoyerJson(r.res, 200, { autorisation: v.valeur, manques: manques(v.valeur) });
  });
}
