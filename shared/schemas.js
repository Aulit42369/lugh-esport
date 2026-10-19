// Forme de chaque document d'un jeu, construite à partir de sa définition (rôles, camps, types, score…).
// Le serveur valide toute écriture avec ces schémas ; l'interface s'en sert pour les valeurs par défaut.

import {
  texte, entier, decimal, booleen, choix, identifiant, lien, date, heure, tableau, objet, dictionnaire, valider, avecControle, MOTIFS,
} from './validation.js';
import {
  STATUTS_MAP, STATUTS_STRAT, PUBLICS_BLOC, TYPES_SCRIM, RESULTATS_MANCHE, STATUTS_OBJECTIF, CATEGORIES_NOTE,
  STATUTS_VOD, TYPES_MEMBRE, STATUTS_MEMBRE, FONCTIONS_STAFF, ids,
} from './referentiel.js';
import { idsDe, actifs, trouverDans, mot } from './jeux/definition.js';
import { minutes } from './temps.js';
import { formesPlus } from './schemas-plus.js';
import { formesOrganisation } from './schemas-organisation.js';

const slug = (o) => identifiant(MOTIFS.slug, o);
const membre = (o) => identifiant(MOTIFS.membre, o);
const choixDe = (liste, o) => choix(idsDe(liste), o);

function formeScrim(def) {
  const commun = {
    date: date({ requis: true }),
    heure: heure(),
    adversaire: texte({ max: 40, requis: true }),
    type: choix(ids(TYPES_SCRIM), { defaut: 'scrim' }),
    map: slug(),
    compo: tableau(slug({ requis: true }), { max: def.equipe.titulaires }),
    bien: texte({ max: 1000, multi: true }),
    corriger: texte({ max: 1000, multi: true }),
    vod: lien(),
    partenaire: identifiant(MOTIFS.partenaire), // équipe du carnet des partenaires de scrim, si elle y est
  };
  const s = def.score;
  const carte = (v, erreur) => {
    if (def.aPool && !v.map) erreur(`${mot(def, 'carte', true)} obligatoire`);
  };
  if (s.type === 'manches') {
    return avecControle(objet({
      ...commun,
      campDepart: choixDe(def.camps),
      mtNous: entier({ min: 0, max: s.miTemps, defaut: null }),
      mtEux: entier({ min: 0, max: s.miTemps, defaut: null }),
      scoreNous: entier({ min: 0, max: 99, requis: true }),
      scoreEux: entier({ min: 0, max: 99, requis: true }),
      pistols: dictionnaire(MOTIFS.slug, choix(ids(RESULTATS_MANCHE), { requis: true }), { max: 2 }),
    }), (v, erreur) => {
      carte(v, erreur);
      const mt = v.mtNous !== null && v.mtEux !== null;
      if (mt && v.mtNous + v.mtEux > s.miTemps) erreur(`une mi-temps compte ${s.miTemps} ${mot(def, 'manches')} au maximum`);
      if (mt && (v.scoreNous < v.mtNous || v.scoreEux < v.mtEux)) erreur('le score final ne peut pas être inférieur au score de la mi-temps');
      if (Object.keys(v.pistols).some((c) => !def.camps.some((x) => x.id === c))) erreur('camp inconnu pour un pistol');
    });
  }
  if (s.type === 'classement') {
    return avecControle(objet({
      ...commun,
      place: entier({ min: 1, max: 150, requis: true }),
      equipes: entier({ min: 2, max: 150, defaut: s.equipes || 20 }),
      eliminations: entier({ min: 0, max: 300, defaut: null }),
      points: decimal({ min: 0, max: 9999, decimales: 1 }),
    }), (v, erreur) => {
      carte(v, erreur);
      if (v.place && v.equipes && v.place > v.equipes) erreur('la place ne peut pas dépasser le nombre d’équipes');
    });
  }
  return avecControle(objet({
    ...commun,
    scoreNous: entier({ min: 0, max: 999, requis: true }),
    scoreEux: entier({ min: 0, max: 999, requis: true }),
  }), carte);
}

function formes(def) {
  const titulaires = def.equipe.titulaires;

  const equipe = objet({
    nom: texte({ max: 40 }),
    tag: texte({ max: 5, motif: /^[A-Z0-9]{2,5}$/, message: '2 à 5 lettres majuscules ou chiffres' }),
    devise: texte({ max: 120 }),
    palierVise: choixDe(def.paliers, { defaut: 'intermediaire' }),
    circuit: texte({ max: 80 }),
    creneaux: texte({ max: 120 }),
    objectifSaison: texte({ max: 400, multi: true }),
  });

  const membres = avecControle(objet({
    type: choix(ids(TYPES_MEMBRE), { requis: true }),
    pseudo: texte({ max: 24 }),
    idJeu: texte({ max: 60 }),
    statut: choix(ids(STATUTS_MEMBRE), { requis: true }),
    roleJeu: choixDe(def.roles),
    igl: booleen(),
    fonction: choix(ids(FONCTIONS_STAFF)),
    personnages: objet({
      principaux: tableau(slug({ requis: true }), { max: 3 }),
      secondaires: tableau(slug({ requis: true }), { max: 4 }),
      parMap: dictionnaire(MOTIFS.slug, slug(), { max: 20 }),
    }),
    forces: texte({ max: 500, multi: true }),
    axes: texte({ max: 500, multi: true }),
  }), (v, erreur) => {
    const statut = STATUTS_MEMBRE.find((s) => s.id === v.statut);
    if (statut && statut.pour !== 'tous' && statut.pour !== v.type) erreur('statut incompatible avec le type de membre');
  });

  const emplacement = objet({ personnage: slug(), membre: membre() });
  const mapsEquipe = objet({
    statut: choix(ids(STATUTS_MAP), { defaut: 'travail' }),
    preparation: entier({ min: 0, max: 100, defaut: 0 }),
    compo: tableau(emplacement, { max: titulaires }),
    compoAlt: tableau(emplacement, { max: titulaires }),
    notes: dictionnaire(MOTIFS.slug, texte({ max: 2000, multi: true }), { max: 3 }),
    priorites: texte({ max: 1000, multi: true }),
  });

  const strats = avecControle(objet({
    map: slug(),
    camp: choixDe(def.camps),
    type: choixDe(def.typesStrat, { requis: true }),
    nom: texte({ max: 60, requis: true }),
    resume: texte({ max: 300, multi: true }),
    etapes: tableau(texte({ max: 300, requis: true }), { max: 20 }),
    roles: dictionnaire(MOTIFS.membre, texte({ max: 200 }), { max: 12 }),
    utilitaires: texte({ max: 1000, multi: true }),
    statut: choix(ids(STATUTS_STRAT), { defaut: 'apprendre' }),
    video: lien(),
    lineups: tableau(identifiant(MOTIFS.biblio, { requis: true }), { max: 12 }),
  }), (v, erreur) => {
    if (def.aPool && !v.map) erreur(`${mot(def, 'carte', true)} obligatoire`);
    const type = trouverDans(def.typesStrat, v.type);
    if (type && type.camps.length && actifs(def.camps).length) {
      if (!v.camp) erreur('camp obligatoire pour ce type de strat');
      else if (!type.camps.includes(v.camp)) erreur(`une strat « ${type.nom} » ne se joue pas de ce côté`);
    }
  });

  const bloc = avecControle(objet({
    id: identifiant(MOTIFS.bloc, { requis: true }),
    jour: entier({ min: 1, max: 7, requis: true }),
    debut: heure({ requis: true }),
    fin: heure({ requis: true }),
    type: choixDe(def.typesBlocTous, { requis: true }),
    titre: texte({ max: 60 }),
    details: texte({ max: 500, multi: true }),
    pour: choix(ids(PUBLICS_BLOC), { defaut: 'equipe' }),
    membres: tableau(membre({ requis: true }), { max: 12 }),
    map: slug(),
  }), (v, erreur) => {
    if (v.debut && v.fin && minutes(v.fin) <= minutes(v.debut)) erreur('la fin doit être après le début');
  });

  const planning = objet({
    blocs: tableau(bloc, { max: 80 }),
    note: texte({ max: 500, multi: true }),
    ebauche: texte({ max: 40 }),
  });

  const suivi = objet({
    statut: choix(ids(STATUTS_OBJECTIF), { defaut: 'afaire' }),
    auto: choix(ids(STATUTS_OBJECTIF)),
    note: texte({ max: 200 }),
    le: date(),
  });

  const objectifs = objet({
    palier: choixDe(def.paliers),
    suivis: dictionnaire(MOTIFS.objectif, suivi, { max: 200 }),
    perso: tableau(objet({
      id: identifiant(MOTIFS.objectifPerso, { requis: true }),
      domaine: choixDe(def.domaines, { requis: true }),
      texte: texte({ max: 200, requis: true }),
      statut: choix(ids(STATUTS_OBJECTIF), { defaut: 'afaire' }),
      le: date(),
    }), { max: 20 }),
    focus: tableau(texte({ max: 20, requis: true }), { max: 3 }),
  });

  const vods = objet({
    titre: texte({ max: 80, requis: true }),
    lien: lien(),
    date: date(),
    map: slug(),
    scrimId: identifiant(MOTIFS.scrim),
    statut: choix(ids(STATUTS_VOD), { defaut: 'arevoir' }),
    consigne: texte({ max: 500, multi: true }),
  });

  const vodNotes = objet({
    vodId: identifiant(MOTIFS.vod, { requis: true }),
    temps: texte({ max: 8, motif: /^(\d{1,2}:)?\d{1,2}:\d{2}$/, message: 'temps au format mm:ss' }),
    membre: membre(),
    categorie: choix(ids(CATEGORIES_NOTE), { defaut: 'decision' }),
    texte: texte({ max: 500, multi: true, requis: true }),
    action: texte({ max: 200 }),
  });

  const dispos = objet({
    creneaux: dictionnaire(/^[1-7]$/, tableau(entier({ min: 10, max: 23, requis: true }), { max: 14 }), { max: 7 }),
    note: texte({ max: 200 }),
  });

  return {
    equipe, membres, mapsEquipe, strats, planning, objectifs, scrims: formeScrim(def), vods, vodNotes, dispos,
    ...formesPlus(def),
    ...formesOrganisation(def),
  };
}

const cache = new WeakMap();

// Schémas d'un jeu, construits une fois par définition.
export function schemasPour(def) {
  if (!cache.has(def)) {
    const SCHEMAS = formes(def);
    cache.set(def, {
      SCHEMAS,
      validerDocument(collection, donnees) {
        const schema = Object.hasOwn(SCHEMAS, collection) ? SCHEMAS[collection] : null;
        if (!schema) return { ok: false, erreurs: [{ chemin: collection, message: 'collection inconnue' }] };
        return valider(schema, donnees);
      },
      // Document complet avec toutes les valeurs par défaut, à partir de quelques champs.
      documentParDefaut(collection, base = {}) {
        return SCHEMAS[collection](base, '', []);
      },
    });
  }
  return cache.get(def);
}
