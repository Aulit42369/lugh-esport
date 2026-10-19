// Forme des documents d'organisation ajoutés en 2.0 : comptes rendus de séance, tournois, partenaires de scrim.
// Mêmes règles que schemas.js : champs inconnus ignorés, limites strictes.

import { texte, entier, choix, identifiant, lien, date, heure, tableau, objet, avecControle, MOTIFS } from './validation.js';
import { STATUTS_TOURNOI, STATUTS_PARTENAIRE, INCIDENTS_PARTENAIRE, ids } from './referentiel.js';
import { idsDe } from './jeux/definition.js';

const membre = (o) => identifiant(MOTIFS.membre, o);

export function formesOrganisation(def) {
  // Compte rendu d'une séance du planning (identifiant <semaine>_<bloc>) : ce qui a été travaillé, en une minute.
  const seances = objet({
    semaine: identifiant(MOTIFS.semaine, { requis: true }),
    blocId: identifiant(MOTIFS.bloc, { requis: true }),
    jour: entier({ min: 1, max: 7, requis: true }),
    debut: heure({ requis: true }),
    type: choix(idsDe(def.typesBlocTous)),
    titre: texte({ max: 60 }),
    travaille: texte({ max: 600, multi: true, requis: true }),
    positif: texte({ max: 400, multi: true }),
    aRevoir: texte({ max: 400, multi: true }),
    suite: texte({ max: 300, multi: true }),
  });

  const tournois = avecControle(objet({
    nom: texte({ max: 60, requis: true }),
    organisateur: texte({ max: 60 }),
    lien: lien(),
    format: texte({ max: 80 }),
    dateLimite: date(),
    debut: date(),
    fin: date(),
    statut: choix(ids(STATUTS_TOURNOI), { defaut: 'envisage' }),
    roster: tableau(membre({ requis: true }), { max: 16 }),
    place: entier({ min: 1, max: 999, defaut: null }),
    resultat: texte({ max: 80 }),
    notes: texte({ max: 1000, multi: true }),
  }), (v, erreur) => {
    if (v.debut && v.fin && v.fin < v.debut) erreur('la fin doit être après le début');
    if (v.dateLimite && v.debut && v.dateLimite > v.debut) erreur('la date limite d’inscription doit précéder le début');
  });

  const partenaires = objet({
    nom: texte({ max: 40, requis: true }),
    tag: texte({ max: 6 }),
    niveau: texte({ max: 40 }),
    contact: texte({ max: 80 }),
    lien: lien(),
    creneaux: texte({ max: 120 }),
    statut: choix(ids(STATUTS_PARTENAIRE), { defaut: 'actif' }),
    notes: texte({ max: 600, multi: true }),
    incidents: tableau(objet({
      date: date({ requis: true }),
      type: choix(ids(INCIDENTS_PARTENAIRE), { requis: true }),
      note: texte({ max: 120 }),
    }), { max: 100 }),
  });

  return { seances, tournois, partenaires };
}
