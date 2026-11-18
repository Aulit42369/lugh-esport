// Identité administrative de la structure, suivi des obligations et autorisations des joueurs : formes validées.
// Rien de personnel ici : pas d'adresse, pas de nom de dirigeant, pas d'âge. L'adresse de contact est publique
// (page « Données et confidentialité ») : une adresse de la structure, pas une adresse personnelle.

import { objet, texte, entier, choix, date, booleen, lien } from '../validation.js';
import { STATUTS_SUIVI } from './obligations.js';

const MOTIF_RNA = /^W\d{9}$/;
const MOTIF_SIRET = /^\d{14}$/;
const MOTIF_SIREN = /^\d{9}$/;
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
  // Forme juridique : l'association d'abord, la société (SAS) le jour du passage. Les obligations, les documents et
  // les livres des comptes suivent (contexteStructure).
  forme: choix(['association', 'societe'], { defaut: 'association' }),
  passagePrevu: booleen(),
  seuilPassage: entier({ min: 1, max: 1_000_000, defaut: 12_000 }), // € de recettes commerciales sur 12 mois
  associationMaintenue: booleen({ defaut: true }), // l'association continue à côté de la société
  societeNom: texte({ max: 80 }),
  societeForme: choix(['SAS', 'SASU'], { defaut: 'SAS' }),
  siren: texte({ max: 9, motif: MOTIF_SIREN, message: '9 chiffres (extrait Kbis)' }),
  societeDate: date(),
  // Vitrine publique (page d'accueil du site) : présentation de l'équipe et lien « Postuler » (invitation Discord,
  // formulaire…). Sans lien, le bouton renvoie vers le contact public ; sans contact, pas de bouton.
  presentation: texte({ max: 600, multi: true }),
  postuler: lien(),
});

// Ce que la forme juridique implique : sections d'obligations visibles, livres des comptes, documents.
export function contexteStructure(i = {}) {
  const societe = i.forme === 'societe';
  return {
    forme: societe ? 'societe' : 'association',
    societe,
    association: !societe || i.associationMaintenue !== false,
    passage: societe || !!i.passagePrevu,
    seuilPassage: Number.isInteger(i.seuilPassage) ? i.seuilPassage : 12_000,
  };
}

// Nom public de la structure (responsable des données) : l'association, la société une fois créée, ou les deux si
// l'association continue à côté.
export function nomPublic(i = {}) {
  if (i.forme !== 'societe' || !i.societeNom) return i.nom || '';
  return i.associationMaintenue !== false && i.nom ? `${i.nom} et ${i.societeNom}` : i.societeNom;
}

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
  // Moins de 15 ans : ce qui repose sur le consentement (photo, vitrine) demande aussi l'accord du jeune (page Administratif).
  moins15: booleen(),
  accordJeune: date(),
  note: texte({ max: 200 }),
});

// Un joueur à surveiller : mineur sans l'une des autorisations.
export const manques = (a) => (a?.mineur
  ? [!a.parentale && 'autorisation parentale', !a.image && 'droit à l’image', a.moins15 && !a.accordJeune && 'accord du jeune'].filter(Boolean)
  : []);

// Vitrine publique : pseudo et photo seulement si la fiche d'autorisations existe et dit « majeur », ou « mineur »
// avec le droit à l'image (et, avant 15 ans, l'accord du jeune en plus de celui des parents). Sans fiche : rien.
export const vitrineAutorisee = (a) => !!a && (!a.mineur || (!!a.image && (!a.moins15 || !!a.accordJeune)));

export const exerciceValide = entier({ min: 2000, max: 2100 });
