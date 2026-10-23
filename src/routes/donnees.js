// Routes des données d'un jeu (/api/e/:jeu/…) : chargement, synchronisation, écritures contrôlées par métier.
// r.espace = services du jeu ; r.compte = le compte vu dans ce jeu (métiers et membre lié de ce jeu).

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, exigerEspace, exigerPerm, profilCompte, comptePublic } from '../auth/acces.js';
import { EDITABLES, QUOTAS, CASCADES } from '../domaine/collections.js';
import { champsMetier } from '../domaine/depot.js';
import { MOTIFS, nouvelId } from '../../shared/validation.js';
import { peut, permissionsDe, accesEspace } from '../../shared/roles.js';
import { STATUTS_OBJECTIF, ids } from '../../shared/referentiel.js';
import { semaineCourante, aujourdhui } from '../../shared/temps.js';

// Le recrutement (candidats, avis et commentaires du staff) n'est envoyé qu'aux comptes qui votent dessus.
export function filtrerPourCompte(collections, compte) {
  if (peut(compte, 'recrutement.voter')) return collections;
  const { candidats, votes, ...reste } = collections;
  return reste;
}

export async function verifierQuota(stockage, coll, id) {
  const max = QUOTAS[coll];
  if (!max || (id && (await stockage.lire(coll, id)))) return;
  if ((await stockage.compter(coll)) >= max) throw erreurs.conflit(`Limite atteinte (${max} fiches) : supprime ou archive d’anciennes fiches.`);
}

export function routesDonnees(routeur, s) {
  const espace = [exigerConnexion(s), exigerEspace(s)];

  function lireRevBase(corps) {
    return Number.isInteger(corps.revBase) && corps.revBase >= 0 ? corps.revBase : null;
  }

  // Visites, par jeu : une nouvelle visite commence après 2 h sans activité ; « Quoi de neuf » montre ce qui a changé
  // depuis la visite précédente dans ce jeu, et reste stable pendant toute la visite en cours.
  async function noterVisite(r) {
    const t = s.maintenant();
    const jeu = r.espace.id;
    const visite = r.compteGlobal.visites?.[jeu] || null;
    const ecart = visite ? t - new Date(visite.dernier) : Infinity;
    if (ecart < 10 * 60_000) return visite?.precedente || null;
    const frais = (await s.global.lire('comptes', r.compteGlobal._id)) || r.compteGlobal;
    const actuelle = frais.visites?.[jeu] || null;
    const suivante = ecart > 2 * 3600_000
      ? { debut: t.toISOString(), dernier: t.toISOString(), precedente: actuelle?.dernier || null }
      : { ...actuelle, dernier: t.toISOString() };
    // Écriture partielle : une modification simultanée du compte par l'admin (accès, désactivation) n'est pas annulée.
    await s.global.modifier('comptes', frais._id, { [`visites.${jeu}`]: suivante });
    return suivante.precedente || null;
  }

  async function comptesDuJeu(jeu) {
    return (await s.global.lister('comptes')).filter((c) => accesEspace(c, jeu)).map((c) => comptePublic(c, jeu));
  }

  routeur.get('/api/e/:jeu/donnees', ...espace, async (r) => {
    const e = r.espace;
    const { rev, donnees } = await e.depot.toutCharger();
    const depuis = await noterVisite(r);
    envoyerJson(r.res, 200, {
      rev,
      jeu: { id: e.id, modele: e.doc.modele, nom: e.def.nom, court: e.def.court, couleur: e.doc.couleur || '', actif: e.doc.actif !== false },
      definition: e.def,
      donnees: filtrerPourCompte(donnees, r.compte),
      comptes: await comptesDuJeu(e.id),
      compte: profilCompte(r.compteGlobal),
      metiers: r.compte.metiers,
      membreId: r.compte.membreId,
      permissions: [...permissionsDe(r.compte.metiers)],
      depuis,
      serveur: { version: s.config.version, semaine: semaineCourante(s.config.fuseau), aujourdhui: aujourdhui(s.config.fuseau), metaAuto: !!s.config.claude.cle },
    });
  });

  routeur.get('/api/e/:jeu/sync', ...espace, async (r) => {
    const depuis = Number(r.query.get('rev'));
    if (!Number.isInteger(depuis) || depuis < 0) throw erreurs.requete('Révision invalide.');
    await noterVisite(r); // une session longue reste une seule visite
    const resultat = await r.espace.depot.depuis(depuis);
    if (resultat.docs) resultat.docs = filtrerPourCompte(resultat.docs, r.compte);
    if (resultat.suppressions && !peut(r.compte, 'recrutement.voter')) {
      resultat.suppressions = resultat.suppressions.filter((x) => x.coll !== 'candidats' && x.coll !== 'votes');
    }
    envoyerJson(r.res, 200, resultat);
  });

  routeur.put('/api/e/:jeu/c/:coll/:id', ...espace, async (r) => {
    const e = r.espace;
    const { coll, id } = r.params;
    const regle = Object.hasOwn(EDITABLES, coll) ? EDITABLES[coll] : null;
    if (!regle) throw erreurs.introuvable('Collection inconnue.');
    if (!peut(r.compte, regle.perm)) throw erreurs.interdit();
    if (!regle.id(id)) throw erreurs.requete('Identifiant invalide.');
    const corps = await r.corps();
    const v = e.schemas().validerDocument(coll, corps.valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    await verifierQuota(e.stockage, coll, id);
    const doc = await e.depot.enregistrer(coll, id, v.valeur, r.compte, { revBase: lireRevBase(corps) });
    envoyerJson(r.res, 200, { doc });
  });

  routeur.delete('/api/e/:jeu/c/:coll/:id', ...espace, async (r) => {
    const e = r.espace;
    const { coll, id } = r.params;
    const regle = Object.hasOwn(EDITABLES, coll) ? EDITABLES[coll] : null;
    if (!regle || !regle.suppression) throw erreurs.introuvable('Suppression impossible ici.');
    if (!peut(r.compte, regle.perm)) throw erreurs.interdit();
    if (!regle.id(id)) throw erreurs.requete('Identifiant invalide.');
    const ok = await e.depot.supprimer(coll, id, r.compte);
    if (ok) {
      for (const { coll: enfant, champ } of CASCADES[coll] || []) {
        for (const d of await e.stockage.lister(enfant, { [champ]: id })) await e.depot.supprimer(enfant, d._id, r.compte);
      }
      if (coll === 'membres') {
        await e.depot.supprimer('objectifs', id, r.compte);
        // Autorisations (mineur, dates des papiers) : rien ne reste d'un membre disparu.
        await s.global.supprimer('autorisations', `${e.id}:${id}`);
        // Les comptes liés à ce membre dans ce jeu ne pointent plus sur une fiche disparue.
        for (const c of await s.global.lister('comptes')) {
          if (c.acces?.[e.id]?.membreId === id) await s.global.modifier('comptes', c._id, { [`acces.${e.id}.membreId`]: '' });
        }
      }
      if (['membres', 'strats', 'scrims', 'vods', 'candidats', 'adversaires', 'tournois', 'partenaires'].includes(coll)) await e.depot.journaliser(r.compte, `suppression ${coll}`, id);
    }
    envoyerJson(r.res, 200, { ok });
  });

  // Disponibilités : chacun remplit les siennes ; les coachs peuvent remplir celles de tous.
  routeur.put('/api/e/:jeu/dispos/:semaine/:membreId', ...espace, async (r) => {
    const e = r.espace;
    const { semaine, membreId } = r.params;
    if (!MOTIFS.semaine.test(semaine) || !MOTIFS.membre.test(membreId)) throw erreurs.requete('Adresse invalide.');
    const soi = r.compte.membreId === membreId && peut(r.compte, 'dispos.soi');
    if (!soi && !peut(r.compte, 'dispos.tous')) throw erreurs.interdit('Tu ne peux remplir que tes propres disponibilités.');
    if (!(await e.stockage.lire('membres', membreId))) throw erreurs.introuvable('Membre introuvable.');
    const v = e.schemas().validerDocument('dispos', (await r.corps()).valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const id = `${semaine}_${membreId}`;
    await verifierQuota(e.stockage, 'dispos', id);
    const doc = await e.depot.enregistrer('dispos', id, { ...v.valeur, semaine, membreId }, r.compte);
    envoyerJson(r.res, 200, { doc });
  });

  // Notes de VOD : une fiche par note, modifiable par son auteur ou par le staff.
  routeur.post('/api/e/:jeu/vod-notes', ...espace, exigerPerm('vod.noter'), async (r) => {
    const e = r.espace;
    const v = e.schemas().validerDocument('vodNotes', (await r.corps()).valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    if (!(await e.stockage.lire('vods', v.valeur.vodId))) throw erreurs.introuvable('VOD introuvable.');
    if (v.valeur.membre && !(await e.stockage.lire('membres', v.valeur.membre))) {
      throw erreurs.invalide([{ chemin: 'membre', message: 'membre introuvable' }]);
    }
    const id = nouvelId('n');
    await verifierQuota(e.stockage, 'vodNotes', id);
    const doc = await e.depot.enregistrer('vodNotes', id, { ...v.valeur, auteur: r.compte._id }, r.compte);
    envoyerJson(r.res, 201, { doc });
  });

  async function noteModifiable(r) {
    if (!MOTIFS.note.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const note = await r.espace.stockage.lire('vodNotes', r.params.id);
    if (!note) throw erreurs.introuvable('Note introuvable.');
    if (note.auteur !== r.compte._id && !peut(r.compte, 'vod.modifier')) {
      throw erreurs.interdit('Seul l’auteur de la note ou le staff peut la modifier.');
    }
    return note;
  }

  routeur.put('/api/e/:jeu/vod-notes/:id', ...espace, async (r) => {
    const note = await noteModifiable(r);
    const v = r.espace.schemas().validerDocument('vodNotes', { ...(await r.corps()).valeur, vodId: note.vodId });
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const doc = await r.espace.depot.enregistrer('vodNotes', note._id, { ...v.valeur, auteur: note.auteur }, r.compte);
    envoyerJson(r.res, 200, { doc });
  });

  routeur.delete('/api/e/:jeu/vod-notes/:id', ...espace, async (r) => {
    const note = await noteModifiable(r);
    envoyerJson(r.res, 200, { ok: await r.espace.depot.supprimer('vodNotes', note._id, r.compte) });
  });

  // Auto-évaluation : un joueur indique où il en est sur ses propres objectifs.
  routeur.put('/api/e/:jeu/objectifs/:membreId/auto', ...espace, async (r) => {
    const e = r.espace;
    const { membreId } = r.params;
    if (!MOTIFS.membre.test(membreId)) throw erreurs.requete('Identifiant invalide.');
    if (r.compte.membreId !== membreId || !peut(r.compte, 'objectifs.auto')) {
      throw erreurs.interdit('Tu ne peux t’auto-évaluer que sur tes propres objectifs.');
    }
    const { objectifId, auto } = await r.corps();
    if (typeof objectifId !== 'string' || !MOTIFS.objectif.test(objectifId)) throw erreurs.requete('Objectif invalide.');
    if (auto !== '' && !ids(STATUTS_OBJECTIF).includes(auto)) throw erreurs.requete('Statut invalide.');
    const { validerDocument, documentParDefaut } = e.schemas();
    const actuel = await e.stockage.lire('objectifs', membreId);
    const base = actuel ? champsMetier(actuel) : documentParDefaut('objectifs');
    const suivi = base.suivis?.[objectifId] || { statut: 'afaire', note: '' };
    base.suivis = { ...(base.suivis || {}), [objectifId]: { ...suivi, auto } };
    const v = validerDocument('objectifs', base);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const doc = await e.depot.enregistrer('objectifs', membreId, v.valeur, r.compte);
    envoyerJson(r.res, 200, { doc });
  });

  routeur.post('/api/e/:jeu/suggestions/:id/traiter', ...espace, exigerPerm('suggestions.traiter'), async (r) => {
    const e = r.espace;
    if (!MOTIFS.suggestion.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const suggestion = await e.stockage.lire('suggestions', r.params.id);
    if (!suggestion) throw erreurs.introuvable('Suggestion introuvable.');
    const { statut } = await r.corps();
    if (!['nouvelle', 'appliquee', 'ignoree'].includes(statut)) throw erreurs.requete('Statut invalide.');
    const doc = await e.depot.enregistrer('suggestions', suggestion._id, {
      ...champsMetier(suggestion),
      statut,
      traitePar: r.compte._id,
      traiteLe: s.maintenant().toISOString(),
    }, r.compte);
    envoyerJson(r.res, 200, { doc });
  });
}
