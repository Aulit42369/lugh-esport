// Courbes de niveau générées (relief imaginaire, propre à chaque graine) : motif de fond.
// Algorithme des carrés marchants sur un champ d'altitude fait de bosses gaussiennes.

import { svg } from '../ui.js';

function hacher(texte) {
  let h = 2166136261;
  for (const c of String(texte)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateur(graine) {
  let a = hacher(graine);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function relief(graine, bosses) {
  const alea = generateur(graine);
  const b = Array.from({ length: bosses }, () => ({
    x: alea() * 1.2 - 0.1,
    y: alea() * 1.2 - 0.1,
    r: 0.1 + alea() * 0.28,
    a: (alea() < 0.25 ? -0.6 : 1) * (0.5 + alea()),
  }));
  return (x, y) => b.reduce((s, p) => s + p.a * Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * p.r * p.r)), 0);
}

// Segments par configuration : bords T(haut) R(droite) B(bas) L(gauche).
const CAS = [[], [['L', 'B']], [['B', 'R']], [['L', 'R']], [['T', 'R']], [['L', 'T'], ['B', 'R']], [['T', 'B']], [['L', 'T']],
  [['L', 'T']], [['T', 'B']], [['T', 'R'], ['L', 'B']], [['T', 'R']], [['L', 'R']], [['B', 'R']], [['L', 'B']], []];

function interp(v1, v2, n) {
  return v2 === v1 ? 0.5 : (n - v1) / (v2 - v1);
}

export function tracerCourbes({ largeur, hauteur, graine, colonnes = 56, niveaux = 10, bosses = 7 }) {
  const lignes = Math.max(4, Math.round((colonnes * hauteur) / largeur));
  const f = relief(graine, bosses);
  const v = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= lignes; j += 1) {
    v.push([]);
    for (let i = 0; i <= colonnes; i += 1) {
      const val = f(i / colonnes, j / lignes);
      v[j].push(val);
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  const sx = largeur / colonnes;
  const sy = hauteur / lignes;
  const normales = [];
  const maitresses = [];
  for (let k = 1; k <= niveaux; k += 1) {
    const n = min + ((max - min) * k) / (niveaux + 1);
    const sortie = k % 4 === 0 ? maitresses : normales;
    for (let j = 0; j < lignes; j += 1) {
      for (let i = 0; i < colonnes; i += 1) {
        const a = v[j][i];
        const b = v[j][i + 1];
        const c = v[j + 1][i + 1];
        const d = v[j + 1][i];
        const cas = (a > n) * 8 + (b > n) * 4 + (c > n) * 2 + (d > n);
        if (!cas || cas === 15) continue;
        const p = {
          T: [i + interp(a, b, n), j],
          R: [i + 1, j + interp(b, c, n)],
          B: [i + interp(d, c, n), j + 1],
          L: [i, j + interp(a, d, n)],
        };
        for (const [e1, e2] of CAS[cas]) {
          sortie.push(`M${(p[e1][0] * sx).toFixed(1)} ${(p[e1][1] * sy).toFixed(1)}L${(p[e2][0] * sx).toFixed(1)} ${(p[e2][1] * sy).toFixed(1)}`);
        }
      }
    }
  }
  return { normales: normales.join(''), maitresses: maitresses.join('') };
}

export function topo({ largeur = 1200, hauteur = 320, graine = 'lugh', colonnes, niveaux, bosses, classe = 'topo' } = {}) {
  const { normales, maitresses } = tracerCourbes({ largeur, hauteur, graine, colonnes, niveaux, bosses });
  return svg('svg', {
    class: classe,
    viewBox: `0 0 ${largeur} ${hauteur}`,
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': 'true',
    focusable: 'false',
  },
  svg('path', { d: normales, class: 'topo__courbe' }),
  svg('path', { d: maitresses, class: 'topo__maitresse' }));
}
