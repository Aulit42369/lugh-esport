// Petite courbe d'évolution, une seule série par graphique (petits multiples), sans rien supposer du jeu :
// l'appelant donne les points, le format des valeurs et d'éventuelles lignes de référence (objectif, repère).
// Ligne 2 px, points 8 px, grille discrète, dernière valeur en tête, info au survol, au toucher ou au clavier ;
// les valeurs exactes restent dans le tableau voisin.

import { h, svg } from '../ui.js';

const L = 320;
const H = 132;
const M = { haut: 18, bas: 26, droite: 10 };

const formats = new Map();
// Nombre à la française : « 21,5 », « 30 000 ». decimales = nombre exact de chiffres après la virgule.
export function nombre(n, decimales = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const d = Math.max(0, Math.min(4, decimales));
  if (!formats.has(d)) formats.set(d, new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return formats.get(d).format(n);
}

// Pas « rond » (1, 2, 2,5 ou 5 × 10^k) d'au moins pasMin ; entier si pasMin ≥ 1.
function pasRond(brut, pasMin) {
  const cible = Math.max(brut, pasMin, 1e-6);
  const puissance = 10 ** Math.floor(Math.log10(cible));
  const multiples = pasMin >= 1 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  for (const m of multiples) {
    const pas = m * puissance;
    if (pas >= cible - 1e-9 && (pasMin < 1 || Number.isInteger(pas))) return pas;
  }
  return 10 * puissance;
}

const decimalesDe = (pas) => (Number.isInteger(pas) ? 0 : Math.min(4, String(pas).split('.')[1]?.length || 0));

function graduations(min, max, pasMin) {
  const pas = pasRond((max - min) / 4, pasMin);
  const d = decimalesDe(pas);
  const liste = [];
  for (let v = Math.ceil(min / pas - 1e-9) * pas; v <= max + 1e-9; v += pas) liste.push(Number(v.toFixed(d)));
  return { liste, decimales: d };
}

// points : [{ etiquette, valeur }] ; format : nombre → texte (bulle, résumé, axe par défaut) ;
// lignes : [{ valeur, libelle, ton: 'objectif' | 'repere' }] ; seuil : ancienne forme d'une ligne d'objectif ;
// plancher / plafond : bornes possibles des valeurs (l'axe ne les dépasse pas) ; pasMin : écart minimal entre
// graduations (1 pour des valeurs entières) ; etiquettesAxe : nombre → texte court ; suffixeAxe : ajouté aux graduations ;
// ecart(dernier, precedent) → texte sous la dernière valeur.
export function courbe({
  titre, points, format = (v) => nombre(v, 2), lignes = [], seuil = null, plancher = null, plafond = null,
  pasMin = 0, etiquettesAxe = null, suffixeAxe = '', ecart = null,
}) {
  const refs = [...lignes, ...(seuil ? [{ ...seuil, ton: 'objectif' }] : [])].filter((l) => typeof l?.valeur === 'number');
  const valides = points.map((p, i) => ({ ...p, i })).filter((p) => typeof p.valeur === 'number');
  const derniere = valides.at(-1);
  const avant = valides.at(-2);
  const tete = h('figcaption', { class: 'courbe__tete' },
    h('span', { class: 'courbe__titre' }, titre),
    derniere ? h('span', { class: 'courbe__valeur' },
      h('strong', {}, format(derniere.valeur)),
      h('span', { class: 'courbe__ecart' }, [avant && ecart ? ecart(derniere.valeur, avant.valeur) : null, derniere.etiquette].filter(Boolean).join(' · '))) : null);
  const conteneur = h('figure', { class: 'courbe courbe--perf' }, tete);
  if (valides.length < 2) {
    conteneur.append(h('p', { class: 'texte-3 petit courbe__vide' }, valides.length ? 'Une seule semaine saisie : la courbe apparaît dès la deuxième.' : 'Pas encore de chiffres.'));
    return conteneur;
  }

  const valeurs = valides.map((p) => p.valeur).concat(refs.map((l) => l.valeur));
  let min = Math.min(...valeurs);
  let max = Math.max(...valeurs);
  const marge = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
  min -= marge;
  max += marge;
  if (typeof plancher === 'number') min = Math.max(min, plancher);
  if (typeof plafond === 'number') max = Math.min(max, plafond);
  if (max - min < 1e-9) max = min + 1;
  const { liste: ticks, decimales } = graduations(min, max, pasMin);
  const texteAxe = (t) => (etiquettesAxe ? etiquettesAxe(t) : `${nombre(t, decimales)}${suffixeAxe}`);
  // Marge gauche selon la plus longue graduation (police de 14 px dans un dessin de 320 px de large).
  const gauche = Math.min(78, Math.max(30, Math.max(...ticks.map((t) => texteAxe(t).length)) * 7.6 + 10));
  const x = (i) => gauche + (points.length > 1 ? i / (points.length - 1) : 0.5) * (L - gauche - M.droite);
  const y = (v) => H - M.bas - ((v - min) / (max - min)) * (H - M.haut - M.bas);
  const coords = points.map((p, i) => (typeof p.valeur === 'number' ? [x(i), y(p.valeur)] : null));
  // Les semaines sans chiffres ne coupent pas la ligne : seuls les points saisis portent un rond.
  const d = valides.map((p, k) => `${k ? 'L' : 'M'}${coords[p.i][0].toFixed(1)} ${coords[p.i][1].toFixed(1)}`).join('');

  // Étiquette d'une ligne de référence : premier emplacement libre (à gauche ou à droite, au-dessus ou au-dessous
  // de la ligne) qui ne recouvre ni la courbe ni une autre étiquette.
  const trace = [];
  valides.forEach((p, k) => {
    const [x0, y0] = coords[p.i];
    const suivant = valides[k + 1] && coords[valides[k + 1].i];
    const pas = suivant ? Math.ceil(Math.abs(suivant[0] - x0) / 4) : 1;
    for (let s = 0; s < pas; s += 1) trace.push(suivant ? [x0 + ((suivant[0] - x0) * s) / pas, y0 + ((suivant[1] - y0) * s) / pas] : [x0, y0]);
  });
  const prises = [];
  const placer = (texte, yl) => {
    const largeur = texte.length * 6.6 + 4;
    const boite = (c) => {
      const x0 = c['text-anchor'] === 'end' ? c.x - largeur : c.x;
      return { x0, x1: x0 + largeur, y0: c.y - 12, y1: c.y + 3 };
    };
    const libre = (b) => b.y0 >= 0 && b.y1 <= H - M.bas + 2
      && !trace.some(([px, py]) => px >= b.x0 - 5 && px <= b.x1 + 5 && py >= b.y0 - 5 && py <= b.y1 + 5)
      && !prises.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
    const choix = [
      { x: gauche + 4, y: yl - 5 }, { x: L - M.droite - 2, y: yl - 5, 'text-anchor': 'end' },
      { x: gauche + 4, y: yl + 14 }, { x: L - M.droite - 2, y: yl + 14, 'text-anchor': 'end' },
    ].find((c) => libre(boite(c))) || { x: gauche + 4, y: yl - 5 };
    prises.push(boite(choix));
    return choix;
  };

  const repereX = svg('line', { class: 'courbe__repere', x1: 0, x2: 0, y1: M.haut, y2: H - M.bas, visibility: 'hidden' });
  const bulle = h('div', { class: 'courbe__bulle', hidden: true });
  const resume = `${titre} : de ${format(valides[0].valeur)} (${valides[0].etiquette}) à ${format(derniere.valeur)} (${derniere.etiquette})`;
  const dessin = svg('svg', { viewBox: `0 0 ${L} ${H}`, class: 'courbe__svg', role: 'img', 'aria-label': resume },
    ticks.map((t) => svg('g', { class: 'courbe__grille' },
      svg('line', { x1: gauche, x2: L - M.droite, y1: y(t), y2: y(t) }),
      svg('text', { x: gauche - 6, y: y(t) + 4, 'text-anchor': 'end' }, texteAxe(t)))),
    refs.filter((l) => l.valeur >= min && l.valeur <= max).map((l) => svg('g', { class: `courbe__reference courbe__reference--${l.ton === 'repere' ? 'repere' : 'objectif'}` },
      svg('line', { x1: gauche, x2: L - M.droite, y1: y(l.valeur), y2: y(l.valeur) }),
      l.libelle ? svg('text', placer(l.libelle, y(l.valeur)), l.libelle) : null)),
    svg('text', { class: 'courbe__axe', x: gauche, y: H - 6 }, points[0].etiquette),
    svg('text', { class: 'courbe__axe', x: L - M.droite, y: H - 6, 'text-anchor': 'end' }, points.at(-1).etiquette),
    repereX,
    svg('path', { class: 'courbe__ligne', d }),
    coords.map((c) => (c ? svg('circle', { class: 'courbe__point', cx: c[0], cy: c[1], r: 4 }) : null)));

  const zone = h('div', { class: 'courbe__zone', tabindex: '0', 'aria-label': `${resume}. Flèches gauche et droite pour lire chaque semaine.` }, dessin, bulle);
  let actif = -1;
  const montrer = (i) => {
    actif = i;
    const [cx] = coords[i];
    repereX.setAttribute('x1', cx);
    repereX.setAttribute('x2', cx);
    repereX.setAttribute('visibility', 'visible');
    bulle.hidden = false;
    bulle.textContent = `${points[i].etiquette} : ${format(points[i].valeur)}`;
    // La bulle reste dans le cadre de la courbe, même sur les premiers et derniers points.
    const largeur = zone.clientWidth || 1;
    const demi = (bulle.offsetWidth || 0) / 2;
    const px = Math.max(demi, Math.min(largeur - demi, (cx / L) * largeur));
    bulle.style.left = `${px}px`;
  };
  const cacher = () => {
    actif = -1;
    repereX.setAttribute('visibility', 'hidden');
    bulle.hidden = true;
  };
  // Point saisi le plus proche d'une semaine (une semaine sans chiffres renvoie au point voisin).
  const proche = (i) => valides.reduce((best, p) => (Math.abs(p.i - i) < Math.abs(best.i - i) ? p : best), valides[0]).i;
  const suivrePointeur = (e) => {
    const rect = dessin.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / (rect.width || 1)) * L;
    const i = Math.round(((px - gauche) / (L - gauche - M.droite)) * (points.length - 1));
    montrer(proche(Math.max(0, Math.min(points.length - 1, i))));
  };
  zone.addEventListener('pointermove', suivrePointeur);
  zone.addEventListener('pointerdown', suivrePointeur);
  zone.addEventListener('pointerleave', cacher);
  zone.addEventListener('focus', () => montrer(derniere.i));
  zone.addEventListener('blur', cacher);
  zone.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const k = Math.max(0, valides.findIndex((p) => p.i === actif));
    const suivant = valides[Math.max(0, Math.min(valides.length - 1, k + (e.key === 'ArrowRight' ? 1 : -1)))];
    montrer(suivant.i);
  });
  conteneur.append(zone);
  return conteneur;
}
