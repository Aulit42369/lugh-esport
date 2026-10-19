// Forme des documents d'organisation d'un jeu : adversaires, présences, absences, chiffres, bibliothèque,
// recrutement et avis. Mêmes règles que schemas.js : champs inconnus ignorés, limites strictes, listes du jeu.

import {
  texte, entier, decimal, booleen, choix, identifiant, lien, date, heure, tableau, objet, dictionnaire, avecControle, chaineTwitch, MOTIFS,
} from './validation.js';
import {
  STATUTS_PRESENCE, TYPES_BIBLIO, CATEGORIES_RESSOURCE, STATUTS_CANDIDAT, AVIS, ids,
} from './referentiel.js';
import { idsDe, mot } from './jeux/definition.js';
import { minutes } from './temps.js';

const slug = (o) => identifiant(MOTIFS.slug, o);
const membre = (o) => identifiant(MOTIFS.membre, o);
const choixDe = (liste, o) => choix(idsDe(liste), o);

export function formesPlus(def) {
  const idsChecklist = idsDe(def.checklistMatch);
  const formatParDefaut = idsDe(def.formats).includes('bo3') ? 'bo3' : def.formats[0].id;

  // Points forts, points faibles et bans habituels de l'adversaire : des maps (veto de maps) ou des personnages (draft).
  const adversaires = objet({
    nom: texte({ max: 40, requis: true }),
    tag: texte({ max: 6 }),
    circuit: texte({ max: 80 }),
    prochainMatch: objet({
      date: date(),
      heure: heure(),
      format: choixDe(def.formats, { defaut: formatParDefaut }),
      nousCommencons: booleen({ defaut: true }),
    }),
    fortes: tableau(slug({ requis: true }), { max: 10 }),
    faibles: tableau(slug({ requis: true }), { max: 10 }),
    bans: tableau(slug({ requis: true }), { max: 10 }),
    debuts: texte({ max: 1000, multi: true }),
    setups: texte({ max: 1000, multi: true }),
    tendances: texte({ max: 1000, multi: true }),
    joueursCles: texte({ max: 500, multi: true }),
    vods: tableau(lien({ requis: true }), { max: 10 }),
    planVeto: texte({ max: 600, multi: true }),
    checklist: idsChecklist.length
      ? dictionnaire(new RegExp(`^(${idsChecklist.join('|')})$`), booleen(), { max: idsChecklist.length })
      : dictionnaire(/^$/, booleen(), { max: 0 }),
  });

  const presences = objet({
    semaine: identifiant(MOTIFS.semaine, { requis: true }),
    blocId: identifiant(MOTIFS.bloc, { requis: true }),
    jour: entier({ min: 1, max: 7, requis: true }),
    debut: heure({ requis: true }),
    titre: texte({ max: 60 }),
    statuts: dictionnaire(MOTIFS.membre, choix(ids(STATUTS_PRESENCE), { requis: true }), { max: 20 }),
    note: texte({ max: 300, multi: true }),
  });

  const absences = avecControle(objet({
    membreId: membre({ requis: true }),
    date: date({ requis: true }),
    debut: heure(),
    fin: heure(),
    raison: texte({ max: 120 }),
  }), (v, erreur) => {
    if (v.debut && v.fin && minutes(v.fin) <= minutes(v.debut)) erreur('la fin doit être après le début');
  });

  // Chiffres de la semaine : un champ par chiffre suivi dans ce jeu (archivés compris, pour l'historique).
  const mesures = objet({
    rang: choixDe(def.rangs),
    valeurs: objet(Object.fromEntries(def.chiffres.map((c) => [c.id, decimal({ min: c.min, max: c.max, decimales: c.decimales ?? 2 })]))),
    parties: entier({ min: 0, max: 300, defaut: null }),
    note: texte({ max: 200 }),
  });

  const bibliotheque = avecControle(objet({
    type: choix(ids(TYPES_BIBLIO), { requis: true }),
    titre: texte({ max: 80, requis: true }),
    lien: lien(),
    map: slug(),
    personnage: slug(),
    camp: choixDe(def.camps),
    site: texte({ max: 20 }),
    categorie: choix(ids(CATEGORIES_RESSOURCE)),
    description: texte({ max: 500, multi: true }),
  }), (v, erreur) => {
    if (v.type === 'astuce' && def.aPool && !v.map) erreur(`il faut une ${mot(def, 'carte')} pour ce ${mot(def, 'astuce')}`);
    if (v.type === 'ressource' && !v.lien) erreur('une ressource a besoin d’un lien');
  });

  const candidats = objet({
    pseudo: texte({ max: 24, requis: true }),
    idJeu: texte({ max: 60 }),
    roleJeu: choixDe(def.roles),
    rang: choixDe(def.rangs),
    personnages: texte({ max: 120 }),
    twitch: chaineTwitch(),
    disponibilites: texte({ max: 200 }),
    source: texte({ max: 120 }),
    notes: texte({ max: 1000, multi: true }),
    statut: choix(ids(STATUTS_CANDIDAT), { defaut: 'propose' }),
    membreId: membre(),
  });

  const votes = objet({
    avis: choix(ids(AVIS), { requis: true }),
    commentaire: texte({ max: 300 }),
  });

  return { adversaires, presences, absences, mesures, bibliotheque, candidats, votes };
}
