// Aides de lecture de la définition du jeu affiché (envoyée par le serveur) : listes actives, libellés,
// vocabulaire, capacités du jeu, liens internes. Les vues n'importent jamais un modèle de jeu directement.

import * as E from './etat.js';
import { actifs, trouverDans, libelleDans, mot, typesStratPour, formatParId, urlProfil } from '/shared/jeux/definition.js';
import { schemasPour } from '/shared/schemas.js';

export const def = () => E.def();

// Mot du vocabulaire du jeu : v('cartes') → « maps », v('personnage', true) → « Agent ».
export const v = (cle, majuscule = false) => mot(def(), cle, majuscule);

// Capacités du jeu
export const aPersonnages = () => !!def()?.aPersonnages;
export const aCartes = () => !!def()?.aCartes;
export const aPool = () => !!def()?.aPool;
export const typeScore = () => def()?.score?.type || 'simple';
export const typeVeto = () => def()?.veto?.type || 'aucun';
export const parCamp = () => !!def()?.personnagesParCamp;

// Listes : sans les éléments masqués (choix proposés) ; « tous » pour afficher une ancienne valeur.
export const roles = (tous = false) => (tous ? def().roles : actifs(def().roles));
export const camps = (tous = false) => (tous ? def().camps : actifs(def().camps));
export const typesStrat = (camp = '') => typesStratPour(def(), camp);
export const typesBloc = (tous = false) => (tous ? def().typesBlocTous : actifs(def().typesBlocTous));
export const rangs = (tous = false) => (tous ? def().rangs : actifs(def().rangs));
export const chiffres = (tous = false) => (tous ? def().chiffres : actifs(def().chiffres));
export const checklist = (tous = false) => (tous ? def().checklistMatch : actifs(def().checklistMatch));
export const paliers = () => def().paliers;
export const domaines = () => def().domaines;
export const formats = () => def().formats;

export const role = (id) => trouverDans(def().roles, id);
export const nomRole = (id, parDefaut = '') => libelleDans(def().roles, id, parDefaut);
export const nomCamp = (id, parDefaut = '') => libelleDans(def().camps, id, parDefaut);
export const nomTypeStrat = (id) => libelleDans(def().typesStrat, id);
export const nomTypeBloc = (id) => libelleDans(def().typesBlocTous, id);
export const nomRang = (id, parDefaut = '') => libelleDans(def().rangs, id, parDefaut);
export const rangN = (id) => trouverDans(def().rangs, id)?.n ?? null;
export const rangDeN = (n) => def().rangs.find((r) => r.n === Math.round(n)) || null;
export const palier = (id) => trouverDans(def().paliers, id);
export const nomPalier = (id) => libelleDans(def().paliers, id);
export const nomDomaine = (id) => libelleDans(def().domaines, id);
export const format = (id) => formatParId(def(), id);
export const nomFormat = (id) => formatParId(def(), id)?.nom || '';

// Classe de couleur et de symbole d'un rôle : fixée par sa place dans la liste (masqués compris), donc stable.
export function classeRole(id) {
  const i = def().roles.findIndex((r) => r.id === id);
  return i >= 0 ? `role--r${(i % 8) + 1}` : 'role--r0';
}

export const indexRole = (id) => def().roles.findIndex((r) => r.id === id);

// Lien vers le profil public d'un joueur (tracker.gg, op.gg…), ou null.
export const lienProfil = (identifiant) => urlProfil(def(), identifiant);

export const schemas = () => schemasPour(def());

// Lien interne vers une page du jeu affiché : lien('/maps/bind') → « #/valorant/maps/bind ».
export function lien(relatif = '') {
  const r = String(relatif).replace(/^#?\/?/, '');
  return `#/${E.jeu()?.id || ''}${r ? `/${r}` : ''}`;
}
