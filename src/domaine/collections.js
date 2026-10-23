// Collections d'un jeu : ce que chaque collection exige pour être modifiée et combien de fiches elle peut contenir.

import { MOTIFS } from '../../shared/validation.js';

// Collections envoyées aux navigateurs (chargement initial et synchronisation).
// « jeu » contient les Réglages du jeu : quand il change, les navigateurs rechargent la définition du jeu.
export const COLLECTIONS_SYNC = [
  'jeu', 'equipe', 'membres', 'mapsEquipe', 'strats', 'planning', 'objectifs',
  'scrims', 'vods', 'vodNotes', 'dispos', 'meta', 'suggestions',
  'adversaires', 'presences', 'absences', 'mesures', 'bibliotheque', 'candidats', 'votes',
  'seances', 'tournois', 'partenaires',
];

// Collections modifiables par l'API générique /api/e/:jeu/c/:collection/:id.
export const EDITABLES = {
  equipe: { perm: 'equipe.profil', id: (id) => id === 'profil', suppression: false },
  membres: { perm: 'roster.modifier', id: (id) => MOTIFS.membre.test(id), suppression: true },
  mapsEquipe: { perm: 'maps.modifier', id: (id) => MOTIFS.slug.test(id), suppression: true },
  strats: { perm: 'strats.modifier', id: (id) => MOTIFS.strat.test(id), suppression: true },
  planning: { perm: 'planning.modifier', id: (id) => id === 'modele' || MOTIFS.semaine.test(id), suppression: true },
  objectifs: { perm: 'objectifs.fixer', id: (id) => id === 'equipe' || MOTIFS.membre.test(id), suppression: true },
  scrims: { perm: 'scrims.modifier', id: (id) => MOTIFS.scrim.test(id), suppression: true },
  vods: { perm: 'vod.modifier', id: (id) => MOTIFS.vod.test(id), suppression: true },
  adversaires: { perm: 'adversaires.modifier', id: (id) => MOTIFS.adversaire.test(id), suppression: true },
  presences: { perm: 'presences.modifier', id: (id) => MOTIFS.presence.test(id), suppression: true },
  bibliotheque: { perm: 'bibliotheque.modifier', id: (id) => MOTIFS.biblio.test(id), suppression: true },
  candidats: { perm: 'recrutement.modifier', id: (id) => MOTIFS.candidat.test(id), suppression: true },
  seances: { perm: 'presences.modifier', id: (id) => MOTIFS.seance.test(id), suppression: true },
  tournois: { perm: 'tournois.modifier', id: (id) => MOTIFS.tournoi.test(id), suppression: true },
  partenaires: { perm: 'scrims.modifier', id: (id) => MOTIFS.partenaire.test(id), suppression: true },
};

// Suppressions en cascade : documents rattachés à la fiche supprimée.
export const CASCADES = {
  vods: [{ coll: 'vodNotes', champ: 'vodId' }],
  membres: [{ coll: 'mesures', champ: 'membreId' }, { coll: 'absences', champ: 'membreId' }, { coll: 'dispos', champ: 'membreId' }],
  candidats: [{ coll: 'votes', champ: 'cible' }],
};

// Plafonds par collection d'un jeu : protègent la base gratuite (512 Mo) contre un remplissage accidentel.
export const QUOTAS = {
  equipe: 1, // une seule fiche « profil » (sans plafond, une restauration pouvait la réécrire un million de fois)
  membres: 60,
  mapsEquipe: 40,
  strats: 1500,
  planning: 400,
  objectifs: 60,
  scrims: 4000,
  vods: 1500,
  vodNotes: 20000,
  dispos: 5000,
  adversaires: 300,
  presences: 3000,
  absences: 3000,
  mesures: 5000,
  bibliotheque: 2000,
  candidats: 500,
  votes: 10000,
  seances: 3000,
  tournois: 300,
  partenaires: 300,
};

// Plafonds globaux : comptes de toute la structure, jeux (Atlas gratuit : 500 collections ; 27 par jeu et 7 pour la
// base générale, soit 412 au plus avec 15 jeux).
export const MAX_COMPTES = 300;
export const MAX_ESPACES = 15;
