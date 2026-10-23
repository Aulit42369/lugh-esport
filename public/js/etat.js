// État partagé de l'application : compte connecté, jeux accessibles, jeu affiché (définition et données),
// synchronisation toutes les 20 secondes. Toutes les écritures passent par l'espace du jeu affiché (/api/e/<jeu>/…).

import { api } from './api.js';
import { permissionsDe } from '/shared/roles.js';
import { MARQUE } from '/shared/marque.js';
import { fusionnerSynchro } from '/shared/synchro.js';

const COLLECTIONS = ['jeu', 'equipe', 'membres', 'mapsEquipe', 'strats', 'planning', 'objectifs', 'scrims', 'vods', 'vodNotes', 'dispos',
  'meta', 'suggestions', 'adversaires', 'presences', 'absences', 'mesures', 'bibliotheque', 'candidats', 'votes',
  'seances', 'tournois', 'partenaires'];
const INTERVALLE_SYNC = 20_000;
const CLE_DERNIER_JEU = `${MARQUE.id}-dernier-jeu`;

const vide = () => Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));

const etat = {
  compte: null, // profil global : identifiant, nom, admin, accès par jeu
  jeux: [], // jeux visibles : [{ id, modele, nom, court, couleur, actif, metiers }]
  jeu: null, // jeu affiché : { id, modele, nom, court, couleur, actif }
  doitActiver2fa: false, // la structure exige la double authentification et ce compte ne l'a pas encore
  definition: null,
  rev: 0,
  donnees: vide(),
  comptes: [],
  metiers: [],
  membreId: '',
  permissions: new Set(),
  serveur: {},
  depuis: null,
};
const abonnes = new Set();
let minuterie = null;
let syncEnCours = false;

export function abonner(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

function notifier(source) {
  for (const fn of abonnes) fn(source);
}

// Adresse d'une route du jeu affiché : chemin('/mesures/x') → /api/e/<jeu>/mesures/x.
export function chemin(relatif) {
  if (!etat.jeu) throw new Error('Aucun jeu affiché.');
  return `/api/e/${encodeURIComponent(etat.jeu.id)}${relatif.startsWith('/') ? relatif : `/${relatif}`}`;
}

// ——— Session et jeux ———

export async function chargerSession() {
  const r = await api('GET', '/api/auth/moi');
  etat.compte = r.compte;
  etat.jeux = r.jeux;
  etat.doitActiver2fa = !!r.doitActiver2fa;
  return r;
}

export function dernierJeu() {
  try {
    return localStorage.getItem(CLE_DERNIER_JEU) || '';
  } catch {
    return '';
  }
}

function retenirJeu(id) {
  try {
    localStorage.setItem(CLE_DERNIER_JEU, id);
  } catch {
    // stockage indisponible : le choix ne sera simplement pas retenu
  }
}

// Charge (ou recharge) toutes les données d'un jeu.
export async function charger(jeuId = etat.jeu?.id) {
  if (!jeuId) throw new Error('Aucun jeu à charger.');
  const r = await api('GET', `/api/e/${encodeURIComponent(jeuId)}/donnees`);
  etat.jeu = r.jeu;
  etat.definition = r.definition;
  etat.rev = r.rev;
  etat.donnees = vide();
  for (const c of COLLECTIONS) etat.donnees[c] = new Map((r.donnees[c] || []).map((d) => [d._id, d]));
  etat.comptes = r.comptes;
  etat.compte = r.compte;
  etat.metiers = r.metiers;
  etat.membreId = r.membreId || '';
  etat.permissions = new Set(r.permissions);
  etat.serveur = r.serveur;
  etat.depuis = r.depuis || null;
  retenirJeu(r.jeu.id);
  notifier('charge');
  return r;
}

// Rechargement complet (comptes compris) après une opération qui touche beaucoup de fiches.
export async function rechargerTout() {
  await charger();
  notifier('local');
}

// Quitte le jeu affiché (pages générales : choix du jeu, administration, compte).
export function quitterJeu() {
  arreterSync();
  etat.jeu = null;
  etat.definition = null;
  etat.donnees = vide();
  etat.permissions = new Set();
  etat.metiers = [];
  etat.membreId = '';
}

export async function synchroniser() {
  if (syncEnCours || !etat.compte || !etat.jeu) return;
  syncEnCours = true;
  const jeu = etat.jeu.id;
  try {
    const r = await api('GET', `${chemin('/sync')}?rev=${etat.rev}`);
    if (etat.jeu?.id !== jeu) return;
    // Réglages du jeu modifiés ailleurs : la définition change, tout est rechargé.
    if (r.reinitialiser || r.docs?.jeu?.length || r.suppressions?.some((x) => x.coll === 'jeu')) {
      await charger();
      return;
    }
    const change = fusionnerSynchro(etat.donnees, r);
    etat.rev = Math.max(etat.rev, r.rev);
    if (change) notifier('sync');
  } catch {
    // Hors ligne ou serveur endormi : nouvelle tentative au prochain passage.
  } finally {
    syncEnCours = false;
  }
}

export function demarrerSync() {
  arreterSync();
  minuterie = setInterval(synchroniser, INTERVALLE_SYNC);
  document.addEventListener('visibilitychange', surVisibilite);
}

export function arreterSync() {
  clearInterval(minuterie);
  document.removeEventListener('visibilitychange', surVisibilite);
}

function surVisibilite() {
  if (document.visibilityState === 'visible') synchroniser();
}

export function reinitialiser() {
  quitterJeu();
  etat.compte = null;
  etat.jeux = [];
}

// ——— Lecture ———

export const liste = (coll) => [...(etat.donnees[coll]?.values() || [])];
export const doc = (coll, id) => etat.donnees[coll]?.get(id) || null;
export const peut = (perm) => etat.permissions.has(perm);
export const compte = () => etat.compte;
export const estAdmin = () => !!etat.compte?.admin;
export const estTresorier = () => !!etat.compte?.tresorier;
export const jeux = () => etat.jeux;
export const jeu = () => etat.jeu;
export const doitActiver2fa = () => etat.doitActiver2fa;
export const def = () => etat.definition;
export const metiers = () => etat.metiers;
export const monMembreId = () => etat.membreId;
export const serveur = () => etat.serveur;
export const depuisVisite = () => etat.depuis;
export const meta = () => doc('meta', 'courante');
export const equipe = () => doc('equipe', 'profil') || {};
export const monMembre = () => (etat.membreId ? doc('membres', etat.membreId) : null);

export function nomCompte(id) {
  if (!id || id === 'systeme') return 'l’appli (automatique)';
  const c = etat.comptes.find((x) => x._id === id);
  return c?.nomAffiche || 'un ancien compte';
}

export function compteDuMembre(membreId) {
  return etat.comptes.find((c) => c.membreId === membreId && c.actif) || null;
}

export function comptesDuJeu() {
  return etat.comptes;
}

export function definirComptes(comptes) {
  etat.comptes = comptes;
}

// Après un changement de mot de passe ou de nom : le profil global change, les droits du jeu restent.
export function majCompte(c) {
  etat.compte = c;
  notifier('compte');
}

export function definirJeux(liste_) {
  etat.jeux = liste_;
}

// ——— Écriture (dans le jeu affiché) ———

export function sansMeta(d) {
  if (!d) return {};
  const { _id, rev, maj, cree, ...reste } = d;
  return reste;
}

export function appliquer(coll, d) {
  if (!d?._id) return;
  etat.donnees[coll]?.set(d._id, d);
  notifier('local');
}

export async function enregistrer(coll, id, valeur, { revBase } = {}) {
  const corps = { valeur };
  if (revBase !== undefined) corps.revBase = revBase;
  try {
    const r = await api('PUT', chemin(`/c/${coll}/${encodeURIComponent(id)}`), corps);
    appliquer(coll, r.doc);
    return r.doc;
  } catch (err) {
    if (err.statut === 409 && err.details?.actuelle) appliquer(coll, err.details.actuelle);
    throw err;
  }
}

// Mêmes suppressions en cascade que le serveur (src/domaine/collections.js), pour un affichage immédiat.
const CASCADES_LOCALES = {
  vods: [['vodNotes', 'vodId']],
  membres: [['mesures', 'membreId'], ['absences', 'membreId'], ['dispos', 'membreId'], ['objectifs', '_id']],
  candidats: [['votes', 'cible']],
};

export async function supprimer(coll, id) {
  await api('DELETE', chemin(`/c/${coll}/${encodeURIComponent(id)}`));
  etat.donnees[coll]?.delete(id);
  for (const [enfant, champ] of CASCADES_LOCALES[coll] || []) {
    for (const d of liste(enfant)) if (d[champ] === id) etat.donnees[enfant].delete(d._id);
  }
  notifier('local');
}

export function supprimerLocal(coll, id) {
  if (etat.donnees[coll]?.delete(id)) notifier('local');
}

export function votesDe(cible) {
  return liste('votes').filter((v) => v.cible === cible);
}

export function monVote(cible) {
  return doc('votes', `${cible}_${etat.compte?._id}`);
}

// Appel d'une route du jeu affiché : appeler('PUT', '/mesures/m-…/2026-W43', corps, 'mesures').
export async function appeler(methode, relatif, corps, coll = null) {
  const r = await api(methode, chemin(relatif), corps);
  if (coll && r?.doc) appliquer(coll, r.doc);
  return r;
}

// ——— Membres ———

export function membresActifs(type = null) {
  return liste('membres')
    .filter((m) => m.statut !== 'ancien' && (!type || m.type === type))
    .sort((a, b) => (a.pseudo || '~').localeCompare(b.pseudo || '~', 'fr'));
}

const ORDRE_STATUT = { titulaire: 0, remplacant: 1, essai: 2, actif: 3, ancien: 4 };
export function joueurs() {
  return membresActifs('joueur').sort((a, b) => ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut]);
}

export function nomMembre(m) {
  if (!m) return 'Équipe';
  return m.pseudo || 'Poste à pourvoir';
}

export function palierDe(membreId) {
  return doc('objectifs', membreId)?.palier || '';
}

// Recalcule les droits si les métiers du compte dans ce jeu changent (par exemple après une modification par soi-même).
export function definirMetiers(liste_) {
  etat.metiers = liste_;
  etat.permissions = permissionsDe(liste_);
  notifier('compte');
}

// ——— Brouillons : saisies en cours hors modale, une clé par formulaire. Tant qu'il en reste un,
// la page n'est pas redessinée (synchronisation ou enregistrement ailleurs) ; elle l'est quand le dernier se ferme.

const brouillons = new Set();
export const brouillon = () => brouillons.size > 0;
export function definirBrouillon(valeur, cle = 'page') {
  const avant = brouillons.size;
  if (valeur) brouillons.add(cle);
  else brouillons.delete(cle);
  if (avant && !brouillons.size) document.dispatchEvent(new CustomEvent('lugh:modale-fermee'));
}
export function effacerBrouillons() {
  brouillons.clear();
}
