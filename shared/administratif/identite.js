// Identité administrative de la structure, suivi des obligations et autorisations des joueurs : formes validées.
// Rien de personnel ici : pas d'adresse, pas de nom de dirigeant, pas d'âge. L'adresse de contact est publique
// (page « Données et confidentialité ») : une adresse de la structure, pas une adresse personnelle.

import { objet, texte, entier, choix, date, booleen } from '../validation.js';
import { STATUTS_SUIVI } from './obligations.js';

const MOTIF_RNA = /^W\d{9}$/;
const MOTIF_SIRET = /^\d{14}$/;
const MOTIF_CONTACT = /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/;

export const identite = objet({
  nom: texte({ max: 80 }),
  sigle: texte({ max: 20 }),
  rna: texte({ max: 10, motif: MOTIF_RNA, message: 'W suivi de 9 chiffres (récépissé de déclaration)' }),
  siret: texte({ max: 14, motif: MOTIF_SIRET, message: '14 chiffres' }),
  contact: texte({ max: 120, motif: MOTIF_CONTACT, message: 'une adresse e-mail ou un lien https://' }),
  referent: texte({ max: 60 }),
  dateCreation: date(),
  assurance: texte({ max: 80 }),
});

export const suiviPoint = objet({
  statut: choix(STATUTS_SUIVI.map((s) => s.id), { requis: true }),
  le: date(),
  note: texte({ max: 300, multi: true }),
});

// Autorisations d'un joueur du roster (par jeu) : jamais d'âge, seulement « mineur » et les dates de réception.
export const autorisation = objet({
  mineur: booleen(),
  parentale: date(),
  image: date(),
  note: texte({ max: 200 }),
});

// Un joueur à surveiller : mineur sans l'une des deux autorisations.
export const manques = (a) => (a?.mineur ? [!a.parentale && 'autorisation parentale', !a.image && 'droit à l’image'].filter(Boolean) : []);

export const exerciceValide = entier({ min: 2000, max: 2100 });
