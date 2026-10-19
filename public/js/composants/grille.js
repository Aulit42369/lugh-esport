// Semaine : navigation d'une semaine à l'autre et agenda des blocs, jour par jour.
// Les types de blocs viennent du jeu affiché : blocs communs à tous les jeux et blocs propres au jeu (aim, laning…).

import { h } from '../ui.js';
import { icone } from '../icones.js';
import { doc } from '../etat.js';
import * as J from '../jeu.js';
import { nomMap } from './jetons.js';
import { JOURS, PUBLICS_BLOC, libelle } from '/shared/referentiel.js';
import { TYPES_SANS_APPEL } from '/shared/jeux/commun.js';
import { joursDe, decalerSemaine, numeroSemaine, formatDateCourte, minutes, dureeLisible, formatJour } from '/shared/temps.js';

export function libelleSemaine(semaine) {
  const j = joursDe(semaine);
  return `Semaine ${numeroSemaine(semaine)}, du ${formatDateCourte(j[0].iso)} au ${formatDateCourte(j[6].iso)}`;
}

export function navSemaine(semaine, courante, surChangement) {
  return h('div', { class: 'nav-semaine' },
    h('button', { type: 'button', class: 'btn btn--icone', 'aria-label': 'Semaine précédente', onclick: () => surChangement(decalerSemaine(semaine, -1)) }, icone('gauche')),
    h('div', { class: 'nav-semaine__texte' },
      h('strong', {}, `Semaine ${numeroSemaine(semaine)}`),
      h('span', {}, libelleSemaine(semaine).replace(/^Semaine \d+, /, ''))),
    h('button', { type: 'button', class: 'btn btn--icone', 'aria-label': 'Semaine suivante', onclick: () => surChangement(decalerSemaine(semaine, 1)) }, icone('droite')),
    semaine !== courante ? h('button', { type: 'button', class: 'btn btn--discret btn--petit', onclick: () => surChangement(courante) }, 'Revenir à cette semaine') : null);
}

export function trierBlocs(blocs) {
  return [...blocs].sort((a, b) => a.jour - b.jour || minutes(a.debut) - minutes(b.debut));
}

// Titre affiché d'un bloc : son titre, sinon le nom de son type dans ce jeu.
export const titreBloc = (b) => b.titre || J.nomTypeBloc(b.type);

// Séance collective : ni travail chacun de son côté, ni échauffement, sport ou repos (mêmes règles que l'appel).
export const estCollective = (b) => b.pour !== 'individuel' && !TYPES_SANS_APPEL.has(b.type);

export function publicDuBloc(b) {
  if (b.pour === 'choix') {
    const noms = (b.membres || []).map((id) => doc('membres', id)?.pseudo).filter(Boolean);
    return noms.length ? noms.join(', ') : 'Membres choisis';
  }
  return libelle(PUBLICS_BLOC, b.pour);
}

export function dureeBloc(b) {
  return minutes(b.fin) - minutes(b.debut);
}

// ——— Familles de blocs (couleur du liseré, toujours doublée du nom du type) ———
// Blocs communs : famille fixe. Blocs propres au jeu : « équipe » ou « perso » selon l'usage qu'en font
// les ébauches du jeu (un bloc surtout prévu chacun de son côté est un entraînement individuel).

export const FAMILLES_BLOC = [
  { id: 'match', nom: 'Scrims et matchs' },
  { id: 'equipe', nom: 'Travail d’équipe' },
  { id: 'analyse', nom: 'VOD et débriefs' },
  { id: 'perso', nom: 'Travail individuel et forme' },
  { id: 'neutre', nom: 'Autres' },
];

const FAMILLES_COMMUNES = {
  scrim: 'match', match: 'match', theorie: 'equipe', vod: 'analyse', debrief: 'analyse',
  echauffement: 'perso', classe: 'perso', physique: 'perso', repos: 'neutre', autre: 'neutre',
};

const famillesParDefinition = new WeakMap();

function famillesDuJeu(def) {
  if (!def) return {};
  if (!famillesParDefinition.has(def)) {
    const usage = {};
    for (const e of def.ebauches || []) {
      for (const b of e.blocs || []) {
        const u = usage[b.type] || (usage[b.type] = { seul: 0, groupe: 0 });
        if (b.pour === 'individuel') u.seul += 1;
        else u.groupe += 1;
      }
    }
    const familles = {};
    for (const t of def.typesBloc || []) {
      const u = usage[t.id];
      familles[t.id] = u && u.seul > u.groupe ? 'perso' : 'equipe';
    }
    famillesParDefinition.set(def, familles);
  }
  return famillesParDefinition.get(def);
}

export function familleBloc(type) {
  return FAMILLES_COMMUNES[type] || famillesDuJeu(J.def())[type] || 'neutre';
}

// Légende des couleurs présentes dans une liste de blocs.
export function legendeBlocs(blocs) {
  const presentes = new Set(blocs.map((b) => familleBloc(b.type)));
  const familles = FAMILLES_BLOC.filter((f) => presentes.has(f.id));
  if (familles.length < 2) return null;
  return h('ul', { class: 'legende-blocs', 'aria-label': 'Couleurs des blocs' },
    familles.map((f) => h('li', { class: `legende-blocs__item bloc--f-${f.id}` }, f.nom)),
    blocs.some((b) => b.pour === 'individuel') ? h('li', { class: 'legende-blocs__item legende-blocs__item--seul' }, 'Pointillés : chacun de son côté') : null);
}

// semaine : identifiant ISO pour afficher les dates, ou null pour la semaine type.
// decorer(bloc) → { haut: [éléments au-dessus de l'heure], bas: [actions sous le bloc], classes: [] }, facultatif.
export function agenda(blocs, { semaine = null, aujourdhui = null, surClic = null, decorer = null } = {}) {
  const dates = semaine ? joursDe(semaine) : null;
  const tries = trierBlocs(blocs);
  return h('div', { class: 'agenda' }, JOURS.map((j) => {
    const duJour = tries.filter((b) => b.jour === j.n);
    const iso = dates?.[j.n - 1].iso;
    return h('section', { class: ['agenda__jour', iso && iso === aujourdhui && 'agenda__jour--aujourdhui'], 'aria-label': j.nom },
      h('h3', { class: 'agenda__titre' },
        h('span', {}, j.nom),
        dates ? h('span', { class: 'agenda__date' }, formatJour(dates[j.n - 1].civ).replace(/^\S+\s/, '')) : null),
      duJour.length
        ? duJour.map((b) => blocAgenda(b, surClic, decorer?.(b) || {}))
        : h('p', { class: 'agenda__vide' }, 'Libre'));
  }));
}

function blocAgenda(b, surClic, { haut = [], bas = [], classes: extra = [] }) {
  const contenu = [
    ...haut,
    h('span', { class: 'bloc__heure' }, `${b.debut}–${b.fin}`),
    h('span', { class: 'bloc__titre' }, titreBloc(b)),
    h('span', { class: 'bloc__meta' }, [J.nomTypeBloc(b.type), b.map && J.aCartes() ? nomMap(b.map) : null, publicDuBloc(b), dureeLisible(dureeBloc(b))].filter(Boolean).join(', ')),
  ];
  const classes = ['bloc', `bloc--f-${familleBloc(b.type)}`, b.pour === 'individuel' && 'bloc--individuel', ...extra];
  const actions = bas.filter(Boolean);
  if (!actions.length) {
    return surClic
      ? h('button', { type: 'button', class: classes, onclick: () => surClic(b) }, contenu)
      : h('div', { class: classes }, contenu);
  }
  // Bloc avec actions (compte rendu…) : la carte devient un conteneur, jamais un bouton dans un bouton.
  return h('div', { class: [...classes, 'bloc--actions'] },
    surClic ? h('button', { type: 'button', class: 'bloc__ouvrir', onclick: () => surClic(b) }, contenu) : h('div', { class: 'bloc__ouvrir' }, contenu),
    h('div', { class: 'bloc__pied' }, actions));
}

// ——— Comptes rendus de séance (identifiant <semaine>_<bloc>, comme une présence) ———

export const SANS_COMPTE_RENDU = new Set(['repos', 'echauffement']);
export const idSeance = (semaine, blocId) => `${semaine}_${blocId}`;

const RUBRIQUES_COMPTE_RENDU = [
  { cle: 'travaille', nom: 'Travaillé' },
  { cle: 'positif', nom: 'Ce qui a marché' },
  { cle: 'aRevoir', nom: 'À revoir' },
  { cle: 'suite', nom: 'Pour la prochaine fois' },
];

// Lecture d'un compte rendu : les rubriques remplies, dans l'ordre.
export function contenuCompteRendu(cr) {
  return h('dl', { class: 'compte-rendu' }, RUBRIQUES_COMPTE_RENDU.filter((r) => cr?.[r.cle]).map((r) => [
    h('dt', {}, r.nom),
    h('dd', { class: 'texte-multi' }, cr[r.cle]),
  ]));
}
