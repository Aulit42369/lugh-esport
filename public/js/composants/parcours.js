// Le parcours de la semaine : chaque séance collective est un poste, reliés par le tracé doré,
// du départ (triangle, lundi) à l'arrivée (double cercle, dimanche). Version verticale sur téléphone.
// Séance collective : ni chacun de son côté, ni échauffement, sport ou repos (TYPES_SANS_APPEL), quel que soit le jeu.

import { h, svg } from '../ui.js';
import { trierBlocs, titreBloc, estCollective } from './grille.js';
import { JOURS } from '/shared/referentiel.js';
import { minutes } from '/shared/temps.js';

const L = 1000;
const H = 236;
const MARGE = 46;
const ECART_MAX = 62;

export function postesDeLaSemaine(blocs) {
  return trierBlocs(blocs).filter(estCollective);
}

// Position d'un instant de la semaine (jour 1–7, minutes) sur l'axe horizontal.
function x(jour, min) {
  return MARGE + ((jour - 1 + min / 1440) / 7) * (L - 2 * MARGE);
}

export function etatPoste(b, maintenant) {
  // maintenant : { jour, min } dans la semaine affichée, ou null si autre semaine.
  if (!maintenant) return 'a-venir';
  const fin = b.jour * 1440 + minutes(b.fin);
  const debut = b.jour * 1440 + minutes(b.debut);
  const t = maintenant.jour * 1440 + maintenant.min;
  if (t >= fin) return 'passe';
  if (t >= debut) return 'en-cours';
  return 'a-venir';
}

export function parcours(blocs, { maintenant = null, prochainId = null } = {}) {
  const postes = postesDeLaSemaine(blocs);
  return h('div', { class: 'parcours' }, parcoursLarge(postes, maintenant, prochainId), parcoursEtroit(postes, maintenant, prochainId));
}

function raccourcir(texte, max) {
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

function parcoursLarge(postes, maintenant, prochainId) {
  const milieu = H / 2 + 6;
  // Semaine chargée (plusieurs blocs par soir) : l'écart minimal entre deux postes se resserre pour tenir dans la carte.
  const ecart = Math.min(ECART_MAX, (L - 2 * MARGE) / Math.max(1, postes.length));
  const points = postes.map((b, i) => ({
    b,
    i,
    x: x(b.jour, minutes(b.debut)),
    y: milieu + (i % 2 === 0 ? -28 : 28) * (postes.length > 1 ? 1 : 0),
  }));
  // Écarte les postes trop proches pour garder les étiquettes lisibles, sans sortir de la carte.
  for (let k = 1; k < points.length; k += 1) {
    if (points[k].x - points[k - 1].x < ecart) points[k].x = points[k - 1].x + ecart;
  }
  for (let k = points.length - 1; k >= 0; k -= 1) {
    const max = k === points.length - 1 ? L - MARGE : points[k + 1].x - ecart;
    if (points[k].x > max) points[k].x = max;
  }
  const lettres = Math.max(7, Math.min(16, Math.floor((2 * ecart) / 7.5)));
  const depart = { x: MARGE - 22, y: milieu };
  const arrivee = { x: L - MARGE + 22, y: milieu };
  const trace = [depart, ...points, arrivee];
  let d = '';
  for (let k = 0; k < trace.length - 1; k += 1) {
    const a = trace[k];
    const b = trace[k + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const long = Math.hypot(dx, dy) || 1;
    const ra = k === 0 ? 14 : 15;
    const rb = k === trace.length - 2 ? 17 : 15;
    if (long <= ra + rb) continue;
    d += `M${(a.x + (dx / long) * ra).toFixed(1)} ${(a.y + (dy / long) * ra).toFixed(1)}L${(b.x - (dx / long) * rb).toFixed(1)} ${(b.y - (dy / long) * rb).toFixed(1)}`;
  }

  const graduations = JOURS.map((j) => svg('g', { class: 'parcours__jour' },
    svg('line', { x1: x(j.n, 0), y1: 18, x2: x(j.n, 0), y2: H - 14 }),
    svg('text', { x: x(j.n, 720), y: 22, 'text-anchor': 'middle' }, j.court)));

  const elements = points.map((p) => {
    const etat = etatPoste(p.b, maintenant);
    const haut = p.i % 2 === 0;
    return svg('g', { class: ['parcours__poste', `parcours__poste--${etat}`, p.b.id === prochainId && 'parcours__poste--prochain'] },
      svg('title', {}, `${JOURS[p.b.jour - 1].nom} ${p.b.debut} : ${titreBloc(p.b)}`),
      svg('circle', { cx: p.x, cy: p.y, r: 13 }),
      svg('text', { x: p.x, y: p.y + 4.5, 'text-anchor': 'middle', class: 'parcours__numero' }, String(p.i + 1)),
      svg('text', { x: p.x, y: haut ? p.y - 30 : p.y + 40, 'text-anchor': 'middle', class: 'parcours__heure' }, p.b.debut),
      svg('text', { x: p.x, y: haut ? p.y - 46 : p.y + 56, 'text-anchor': 'middle', class: 'parcours__titre' }, raccourcir(titreBloc(p.b), lettres)));
  });

  return svg('svg', {
    class: 'parcours__carte',
    viewBox: `0 0 ${L} ${H}`,
    role: 'img',
    'aria-label': postes.length ? `Parcours de la semaine : ${postes.length} séance${postes.length > 1 ? 's' : ''} collective${postes.length > 1 ? 's' : ''}` : 'Aucune séance collective cette semaine',
  },
  graduations,
  svg('path', { d, class: 'parcours__trace', pathLength: 1 }),
  svg('path', { d: `M${depart.x} ${depart.y - 14}L${depart.x + 13} ${depart.y + 9}L${depart.x - 13} ${depart.y + 9}Z`, class: 'parcours__depart' }),
  svg('circle', { cx: arrivee.x, cy: arrivee.y, r: 11, class: 'parcours__arrivee' }),
  svg('circle', { cx: arrivee.x, cy: arrivee.y, r: 17, class: 'parcours__arrivee' }),
  elements);
}

function parcoursEtroit(postes, maintenant, prochainId) {
  if (!postes.length) return h('p', { class: 'parcours__liste parcours__liste--vide' }, 'Aucune séance collective prévue.');
  return h('ol', { class: 'parcours__liste' }, postes.map((b, i) => {
    const etat = etatPoste(b, maintenant);
    return h('li', { class: ['parcours__etape', `parcours__etape--${etat}`, b.id === prochainId && 'parcours__etape--prochain'] },
      h('span', { class: 'parcours__pastille' }, String(i + 1)),
      h('span', { class: 'parcours__quand' }, `${JOURS[b.jour - 1].court} ${b.debut}`),
      h('span', {}, titreBloc(b)));
  }));
}
