// Aides communes aux pages du groupe « Jeu » (maps et compos, stratbook, bibliothèque, adversaires, méta) :
// accords avec le vocabulaire du jeu, repères des camps, options qui gardent une ancienne valeur, filtres par jeu,
// résumés de résultats selon le type de score. Tout ce qui dépend du jeu est lu dans sa définition ou sa méta.

import { h, svg } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { optionsMaps } from '../composants/jetons.js';

// ——— Mots et accords ———

// Mots féminins du vocabulaire des modèles (« la map », « la légende », « l’astuce »…) ; un mot inconnu reste au masculin.
const FEMININS = new Set(['map', 'maps', 'carte', 'cartes', 'arène', 'arènes', 'légende', 'légendes', 'astuce', 'astuces',
  'partie', 'parties', 'manche', 'manches']);

export const estFeminin = (mot) => FEMININS.has(String(mot || '').toLowerCase());
export const accord = (mot, masculin, feminin) => (estFeminin(mot) ? feminin : masculin);
export const pluriel = (n, singulier, forme = `${singulier}s`) => `${n} ${n > 1 ? forme : singulier}`;
export const guillemets = (t) => `« ${t} »`;
export const majuscule = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

// « patch 13.08 » pour un numéro de version ; sinon le texte de la méta tel quel (« mise à jour du 14 octobre 2026 »).
export function libellePatch(patch) {
  const p = String(patch || '').trim();
  if (!p) return '';
  if (/^v?\d/i.test(p)) return `patch ${p}`;
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(p) ? p[0].toLowerCase() + p.slice(1) : p;
}

// Nombre à la française (« 4,5 »), tiret long si inconnu.
export function nombre(n, decimales = 1) {
  return n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: decimales });
}

// ——— Filtres : remis à zéro quand on change de jeu (un camp ou une map d'un jeu n'existe pas dans un autre) ———

export function filtresDuJeu(filtres, defauts) {
  const jeu = E.jeu()?.id || '';
  if (filtres.jeu !== jeu) Object.assign(filtres, defauts, { jeu });
  return filtres;
}

// ——— Listes de choix ———

// Ajoute la valeur actuelle à des options qui ne la proposent plus (élément masqué, autre camp, ancienne méta) :
// un enregistrement ne doit jamais l'effacer en silence.
export function optionsAvec(options, valeur, libelle = '') {
  if (!valeur) return options;
  const toutes = options.flatMap((o) => (o.groupe ? o.options : [o]));
  if (toutes.some((o) => o.valeur === valeur)) return options;
  return [...options, { valeur, libelle: libelle || valeur }];
}

// Maps proposées dans un formulaire : pool puis hors pool ; toutes les maps de la méta quand le jeu n'a pas de pool.
export const optionsCartes = () => optionsMaps({ horsPool: true });

export const optionsCamps = (camps = J.camps()) => camps.map((c) => ({ valeur: c.id, libelle: c.nom }));

// Maps affichées comme fiches : le pool si le jeu en a un, sinon toutes les maps connues de la méta.
export function cartesSuivies() {
  const m = E.meta();
  return J.aPool() ? (m?.mapPool || []) : (m?.maps || []).map((x) => x.id);
}

export const infoMap = (id) => E.meta()?.maps?.find((m) => m.id === id) || null;

// Modes de jeu des maps (Overwatch : contrôle, escorte…) ; un mode inconnu s'affiche tel quel.
const MODES = { controle: 'Contrôle', escorte: 'Escorte', hybride: 'Hybride', push: 'Push', flashpoint: 'Flashpoint', assaut: 'Assaut', clash: 'Clash' };
export const nomMode = (mode) => (mode ? MODES[mode] || majuscule(mode) : '');

// ——— Camps : repères empruntés aux cartes de course d'orientation ———
// Triangle (départ) pour le premier camp, double cercle (arrivée) pour le second, cercle (poste) sinon.

export function repereCamp(campId) {
  const i = campId ? J.camps(true).findIndex((c) => c.id === campId) : -1;
  const forme = i === 0 ? 'depart' : i === 1 ? 'arrivee' : 'poste';
  const el = svg('svg', { class: `repere repere--${forme}`, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  if (forme === 'depart') el.append(svg('path', { d: 'M12 3.8L20.8 19.2H3.2z' }));
  else if (forme === 'arrivee') el.append(svg('circle', { cx: 12, cy: 12, r: 9 }), svg('circle', { cx: 12, cy: 12, r: 4.8 }));
  else el.append(svg('circle', { cx: 12, cy: 12, r: 8 }));
  return el;
}

export const nomCampOuDeux = (id) => (id ? J.nomCamp(id, id) : 'Les deux');

export function etiquetteCamp(id, { classe = '' } = {}) {
  return h('span', { class: ['camp', classe] }, repereCamp(id), nomCampOuDeux(id));
}

// Notes d'une fiche de map : une par camp actif (« general » quand le jeu n'a pas de camp), plus toute ancienne note
// encore remplie (camp masqué depuis) pour ne rien perdre.
export function clesNotes(notes = {}) {
  const actifs = J.camps().map((c) => c.id);
  const base = actifs.length ? actifs : ['general'];
  return [...base, ...Object.keys(notes).filter((k) => notes[k] && !base.includes(k))];
}

export const nomCleNotes = (cle) => (cle === 'general' ? 'Plan général' : J.nomCamp(cle, cle));

// ——— Résultats selon le type de score du jeu ———

// Résumé d'une ligne de statsScrims(…).parMap ou d'un bilan complet ({ total, victoires… }).
export function resumeResultats(r) {
  const joues = r?.joues ?? r?.total ?? 0;
  if (!joues) return 'Aucun résultat';
  if (J.typeScore() === 'classement') {
    const place = r.placeMoyenne ?? r.classement?.placeMoyenne;
    return `${pluriel(joues, 'partie')}, place moyenne ${nombre(place)}`;
  }
  const nuls = joues - r.victoires - r.defaites;
  return `${r.victoires}V ${r.defaites}D${nuls > 0 ? ` ${nuls}N` : ''}`;
}

// Libellé lisible d'un résultat (V, D, N), y compris en classement (top 1, milieu, bas de tableau).
export function motResultat(r) {
  if (J.typeScore() === 'classement') return { V: 'Top 1', D: 'Bas de tableau', N: 'Milieu de tableau' }[r] || '';
  return { V: 'Victoire', D: 'Défaite', N: 'Égalité' }[r] || '';
}
