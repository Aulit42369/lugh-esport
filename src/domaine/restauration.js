// Sauvegarde et restauration des données d'un jeu, avec un point de restauration automatique : juste avant
// d'appliquer une restauration, l'état actuel du jeu est gardé (un seul point par jeu, dans la base générale),
// ce qui permet d'annuler une restauration faite par erreur. Annuler crée à son tour un point : on peut revenir.

import { erreurs } from '../http/outils.js';
import { profilCompteJeu } from '../auth/acces.js';
import { EDITABLES, QUOTAS } from './collections.js';
import { champsMetier, nettoyer } from './depot.js';
import { MOTIFS } from '../../shared/validation.js';
import { accesEspace } from '../../shared/roles.js';
import { definitionEffective } from '../../shared/jeux/definition.js';
import { validerReglagesJeu, reglagesVides } from '../../shared/jeux/reglages-jeu.js';
import { schemasPour } from '../../shared/schemas.js';
import { MARQUE } from '../../shared/marque.js';

// Collections restaurables (les comptes, la méta, les réglages Discord et le journal ne sont jamais touchés).
export const RESTAURABLES = [
  'equipe', 'membres', 'mapsEquipe', 'strats', 'planning', 'objectifs', 'scrims', 'vods', 'vodNotes', 'dispos',
  'adversaires', 'presences', 'absences', 'mesures', 'bibliotheque', 'candidats', 'votes', 'seances', 'tournois', 'partenaires',
];
export const FORMAT_SAUVEGARDE = { format: MARQUE.id, version: 2 };

const MOTIF_DISPO = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])_m-[a-z0-9]{10}$/;
const OCTETS_MORCEAU = 4 * 1024 * 1024; // bien sous la limite de 16 Mo d'un document MongoDB

function idValide(coll, id) {
  if (typeof id !== 'string' || id.length > 120) return false;
  if (Object.hasOwn(EDITABLES, coll)) return EDITABLES[coll].id(id);
  if (coll === 'votes') return MOTIFS.vote.test(id);
  if (coll === 'mesures') return MOTIFS.mesure.test(id);
  if (coll === 'absences') return MOTIFS.absence.test(id);
  if (coll === 'vodNotes') return MOTIFS.note.test(id);
  if (coll === 'dispos') return MOTIF_DISPO.test(id);
  return false;
}

// Champs techniques hors schéma : déduits de l'identifiant ou contrôlés, jamais recopiés tels quels du fichier.
function champsTechniques(coll, id, doc) {
  const coupure = id.indexOf('_');
  const [avant, apres] = coupure > 0 ? [id.slice(0, coupure), id.slice(coupure + 1)] : ['', ''];
  if (coll === 'mesures') return { membreId: avant, semaine: apres };
  if (coll === 'dispos') return { semaine: avant, membreId: apres };
  if (coll === 'votes') return { cible: avant, compteId: apres };
  if (coll === 'vodNotes') return doc.auteur === 'systeme' || MOTIFS.compte.test(String(doc.auteur || '')) ? { auteur: doc.auteur } : null;
  return {};
}

// Sauvegarde complète d'un jeu (fichier téléchargé par « Exporter »).
export async function sauvegardeDuJeu(s, e) {
  const { donnees } = await e.depot.toutCharger();
  const comptes = (await s.global.lister('comptes')).filter((c) => accesEspace(c, e.id)).map((c) => profilCompteJeu(c, e.id, false));
  return {
    ...FORMAT_SAUVEGARDE, espace: e.id, modele: e.doc.modele, nomJeu: e.def.nom, exporteLe: s.maintenant().toISOString(), comptes, ...donnees,
  };
}

// ——— Point de restauration ———

async function enregistrerPoint(s, e, { compte, source }) {
  const morceaux = [];
  let fiches = 0;
  const reglages = await e.stockage.lire('jeu', 'reglages');
  for (const coll of RESTAURABLES) {
    let lot = [];
    let taille = 0;
    for (const doc of (await e.stockage.lister(coll)).map(nettoyer)) {
      const octets = Buffer.byteLength(JSON.stringify(doc));
      if (lot.length && taille + octets > OCTETS_MORCEAU) {
        morceaux.push({ coll, docs: lot });
        lot = [];
        taille = 0;
      }
      lot.push(doc);
      taille += octets;
      fiches += 1;
    }
    if (lot.length) morceaux.push({ coll, docs: lot });
  }
  await s.global.supprimerPlusieurs('restaurations', { jeu: e.id });
  for (const [n, m] of morceaux.entries()) {
    await s.global.ecrire('restaurations', { _id: `${e.id}:${m.coll}:${n}`, jeu: e.id, type: 'morceau', coll: m.coll, docs: m.docs });
  }
  await s.global.ecrire('restaurations', {
    _id: e.id,
    jeu: e.id,
    type: 'entete',
    le: s.maintenant().toISOString(),
    par: compte?._id || 'systeme',
    source: String(source || '').slice(0, 40),
    fiches,
    reglages: reglages ? nettoyer(reglages) : null,
  });
}

// Restauration interrompue (redéploiement, coupure) : le drapeau reste levé et l'interface le signale.
async function marquerEnCours(s, e, valeur) {
  const entete = await s.global.lire('restaurations', e.id);
  if (entete) await s.global.ecrire('restaurations', { ...entete, enCours: valeur });
}

// Ce que l'interface montre du point de restauration d'un jeu (null s'il n'y en a pas).
export async function lirePoint(s, e) {
  const entete = await s.global.lire('restaurations', e.id);
  if (!entete) return null;
  const par = entete.par && entete.par !== 'systeme' ? await s.global.lire('comptes', entete.par) : null;
  return { le: entete.le, par: par?.nomAffiche || '', source: entete.source || '', fiches: entete.fiches || 0, interrompue: !!entete.enCours && !enCours.has(e.id) };
}

async function sauvegardeDuPoint(s, e) {
  const entete = await s.global.lire('restaurations', e.id);
  if (!entete) return null;
  // Sans réglages au moment du point, le jeu suivait son modèle : on y revient (réglages vides), sans garder ceux
  // de la sauvegarde qu'on annule.
  const reglages = entete.reglages || { _id: 'reglages', ...reglagesVides() };
  const sauvegarde = { ...FORMAT_SAUVEGARDE, espace: e.id, modele: e.doc.modele, nomJeu: e.def.nom, exporteLe: entete.le, jeu: [reglages] };
  for (const coll of RESTAURABLES) sauvegarde[coll] = [];
  const morceaux = (await s.global.lister('restaurations', { jeu: e.id })).filter((d) => d.type === 'morceau')
    .sort((a, b) => Number(a._id.split(':')[2]) - Number(b._id.split(':')[2]));
  for (const m of morceaux) if (Array.isArray(sauvegarde[m.coll])) sauvegarde[m.coll].push(...m.docs);
  return sauvegarde;
}

// ——— Restauration ———

// Remplace les données de l'équipe de CE jeu par celles d'une sauvegarde de ce même jeu (les comptes, la méta et le
// webhook ne bougent pas). Tout est contrôlé avant la première écriture ; une fiche invalide est ignorée.
// Une sauvegarde sans réglages laisse les réglages actuels en place.
// Une restauration (ou son annulation) à la fois par jeu : deux en même temps détruiraient le point de restauration.
const enCours = new Set();

export async function restaurer(s, e, sauvegarde, compte, options = {}) {
  if (enCours.has(e.id)) throw erreurs.conflit('Une restauration de ce jeu est déjà en cours : attends qu’elle se termine.');
  enCours.add(e.id);
  try {
    return await appliquer(s, e, sauvegarde, compte, options);
  } finally {
    enCours.delete(e.id);
  }
}

async function appliquer(s, e, sauvegarde, compte, { source = '' } = {}) {
  if (sauvegarde?.format !== FORMAT_SAUVEGARDE.format || sauvegarde.version !== FORMAT_SAUVEGARDE.version) {
    throw erreurs.requete(`Ce fichier n’est pas une sauvegarde de ${MARQUE.nom}.`);
  }
  if (sauvegarde.espace !== e.id || sauvegarde.modele !== e.doc.modele) {
    throw erreurs.requete(`Cette sauvegarde vient d’un autre jeu (${String(sauvegarde.nomJeu || sauvegarde.espace || '?').slice(0, 40)}).`);
  }
  const bilan = { restaures: 0, ignores: 0, supprimes: 0, details: [] };
  const ignorer = (coll, id) => {
    bilan.ignores += 1;
    if (bilan.details.length < 10) bilan.details.push(`${coll} ${String(id).slice(0, 40)}`);
  };

  // Réglages du jeu de la sauvegarde : ils décident de la forme des autres fiches, donc ils sont lus en premier.
  let reglages = null;
  const docReglages = Array.isArray(sauvegarde.jeu) ? sauvegarde.jeu.find((d) => d?._id === 'reglages') : null;
  if (docReglages) {
    const v = validerReglagesJeu(e.modele, champsMetier(docReglages));
    if (v.ok) reglages = v.valeur;
    else ignorer('jeu', 'reglages');
  }
  const def = reglages ? definitionEffective(e.modele, reglages, { id: e.id, nom: e.doc.nom, court: e.doc.court, couleur: e.doc.couleur }) : e.def;
  const { validerDocument } = schemasPour(def);

  const valides = {};
  const presents = {};
  for (const coll of RESTAURABLES) {
    if (!Array.isArray(sauvegarde[coll])) continue;
    valides[coll] = [];
    presents[coll] = new Set();
    for (const doc of sauvegarde[coll]) {
      const id = doc?._id;
      if (typeof id === 'string' && id.length <= 120) presents[coll].add(id);
      const v = idValide(coll, id) ? validerDocument(coll, champsMetier(doc)) : { ok: false };
      const techniques = v.ok ? champsTechniques(coll, id, doc) : null;
      if (!v.ok || !techniques) {
        ignorer(coll, id);
        continue;
      }
      valides[coll].push({ id, valeur: { ...v.valeur, ...techniques } });
    }
    if (valides[coll].length > QUOTAS[coll]) throw erreurs.requete(`Sauvegarde refusée : ${valides[coll].length} fiches « ${coll} », ${QUOTAS[coll]} au maximum.`);
  }
  // Avis rattachés à un candidat qui n'existera plus : ignorés.
  if (valides.votes) {
    const sujets = new Set(valides.candidats ? valides.candidats.map((d) => d.id) : (await e.stockage.lister('candidats')).map((d) => d._id));
    valides.votes = valides.votes.filter((d) => {
      if (sujets.has(d.valeur.cible)) return true;
      ignorer('votes', d.id);
      return false;
    });
  }

  // Tout est contrôlé : l'état actuel devient le point de restauration, puis la sauvegarde est appliquée.
  await enregistrerPoint(s, e, { compte, source: source || sauvegarde.exporteLe || '' });
  await marquerEnCours(s, e, true);
  if (reglages) {
    await e.depot.enregistrer('jeu', 'reglages', reglages, compte, { silencieux: true });
    await e.rechargerDefinition();
  }
  for (const [coll, docs] of Object.entries(valides)) {
    for (const actuel of await e.stockage.lister(coll)) {
      if (!presents[coll].has(actuel._id) && await e.depot.supprimer(coll, actuel._id, compte)) bilan.supprimes += 1;
    }
    for (const d of docs) {
      await e.depot.enregistrer(coll, d.id, d.valeur, compte, { silencieux: true });
      bilan.restaures += 1;
    }
  }
  await marquerEnCours(s, e, false);
  return bilan;
}

// Remet le jeu dans l'état d'avant la dernière restauration (l'état actuel devient le nouveau point).
export async function annulerDerniereRestauration(s, e, compte) {
  const sauvegarde = await sauvegardeDuPoint(s, e);
  if (!sauvegarde) throw erreurs.introuvable('Aucune restauration à annuler pour ce jeu.');
  return restaurer(s, e, sauvegarde, compte, { source: 'annulation' });
}
