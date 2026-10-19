// QR code (ISO/IEC 18004, modèle 2) pour l'activation de la double authentification : mode octets, correction M,
// versions 1 à 15, masque choisi par la règle des pénalités. Sans dépendance. Rend une liste de lignes de « 0 »/« 1 »
// (1 = module sombre) ; l'interface la dessine en SVG avec sa zone de silence.

// Correction M : [codes de correction par bloc, [nombre de blocs, octets de données par bloc]…] par version.
const BLOCS_M = [
  null,
  [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
  [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]],
  [30, [1, 50], [4, 51]], [22, [6, 36], [2, 37]], [22, [8, 37], [1, 38]], [24, [4, 40], [5, 41]], [24, [5, 41], [5, 42]],
];
const ALIGNEMENTS = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
];
const VERSION_MAX = 15;

const capacite = (v) => BLOCS_M[v].slice(1).reduce((s, [n, d]) => s + n * d, 0);
const bit = (x, i) => ((x >>> i) & 1) !== 0;

// ——— Reed-Solomon sur GF(256), polynôme 0x11D ———
function multiplier(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function diviseur(degre) {
  const r = new Array(degre).fill(0);
  r[degre - 1] = 1;
  let racine = 1;
  for (let i = 0; i < degre; i += 1) {
    for (let j = 0; j < r.length; j += 1) {
      r[j] = multiplier(r[j], racine);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    racine = multiplier(racine, 0x02);
  }
  return r;
}

function reste(donnees, div) {
  const r = div.map(() => 0);
  for (const o of donnees) {
    const facteur = o ^ r.shift();
    r.push(0);
    div.forEach((c, i) => { r[i] ^= multiplier(c, facteur); });
  }
  return r;
}

// ——— Données : mode octets, bourrage, blocs entrelacés ———
function codewords(octets, v) {
  const bits = [];
  const ajouter = (valeur, n) => { for (let i = n - 1; i >= 0; i -= 1) bits.push((valeur >>> i) & 1); };
  ajouter(0b0100, 4);
  ajouter(octets.length, v < 10 ? 8 : 16);
  for (const o of octets) ajouter(o, 8);
  const total = capacite(v) * 8;
  ajouter(0, Math.min(4, total - bits.length));
  while (bits.length % 8) bits.push(0);
  const donnees = [];
  for (let i = 0; i < bits.length; i += 8) donnees.push(bits.slice(i, i + 8).reduce((s, b) => (s << 1) | b, 0));
  for (let p = 0xec; donnees.length < capacite(v); p ^= 0xec ^ 0x11) donnees.push(p);

  const [ec, ...groupes] = BLOCS_M[v];
  const div = diviseur(ec);
  const blocs = [];
  let k = 0;
  for (const [n, d] of groupes) {
    for (let i = 0; i < n; i += 1) {
      const bloc = donnees.slice(k, k + d);
      k += d;
      blocs.push({ d: bloc, e: reste(bloc, div) });
    }
  }
  const sortie = [];
  const max = Math.max(...blocs.map((b) => b.d.length));
  for (let i = 0; i < max; i += 1) for (const b of blocs) if (i < b.d.length) sortie.push(b.d[i]);
  for (let i = 0; i < ec; i += 1) for (const b of blocs) sortie.push(b.e[i]);
  return sortie;
}

// ——— Matrice ———
function matrice(v, data, masque) {
  const n = v * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fonction = Array.from({ length: n }, () => new Array(n).fill(false));
  const poser = (x, y, sombre) => { m[y][x] = sombre; fonction[y][x] = true; };

  for (let i = 0; i < n; i += 1) { poser(6, i, i % 2 === 0); poser(i, 6, i % 2 === 0); }
  const reperage = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) poser(x, y, d !== 2 && d !== 4);
      }
    }
  };
  reperage(3, 3); reperage(n - 4, 3); reperage(3, n - 4);
  const pos = ALIGNEMENTS[v];
  for (const [i, a] of pos.entries()) {
    for (const [j, b] of pos.entries()) {
      const coin = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0);
      if (coin) continue;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) poser(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const format = (msk) => {
    const d = msk; // correction M : bits 00
    let r = d;
    for (let i = 0; i < 10; i += 1) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) poser(8, i, bit(b, i));
    poser(8, 7, bit(b, 6)); poser(8, 8, bit(b, 7)); poser(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i += 1) poser(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i += 1) poser(n - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i += 1) poser(8, n - 15 + i, bit(b, i));
    poser(8, n - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i += 1) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i += 1) {
      const a = n - 11 + (i % 3);
      const c = Math.floor(i / 3);
      poser(a, c, bit(b, i)); poser(c, a, bit(b, i));
    }
  }
  let i = 0;
  for (let droite = n - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let vert = 0; vert < n; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = droite - j;
        const y = ((droite + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!fonction[y][x] && i < data.length * 8) {
          m[y][x] = bit(data[i >>> 3], 7 - (i & 7));
          i += 1;
        }
      }
    }
  }
  const MASQUES = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (!fonction[y][x] && MASQUES[masque](x, y)) m[y][x] = !m[y][x];
  format(masque);
  return m;
}

// Pénalités de la norme : séries de 5 modules et plus, carrés 2×2, motifs proches d'un repère, déséquilibre sombre/clair.
function penalite(m) {
  const n = m.length;
  let p = 0;
  const lignes = [...m, ...m[0].map((_, x) => m.map((l) => l[x]))];
  for (const l of lignes) {
    let serie = 1;
    for (let i = 1; i <= n; i += 1) {
      if (i < n && l[i] === l[i - 1]) serie += 1;
      else {
        if (serie >= 5) p += 3 + (serie - 5);
        serie = 1;
      }
    }
    const t = l.map((c) => (c ? 1 : 0)).join('');
    for (const motif of ['10111010000', '00001011101']) {
      for (let k = t.indexOf(motif); k >= 0; k = t.indexOf(motif, k + 1)) p += 40;
    }
  }
  for (let y = 0; y < n - 1; y += 1) {
    for (let x = 0; x < n - 1; x += 1) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  }
  const sombres = m.flat().filter(Boolean).length;
  p += (Math.ceil(Math.abs(sombres * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return p;
}

export function qrCode(texte, { masque = null } = {}) {
  const octets = [...new TextEncoder().encode(String(texte))];
  let v = 1;
  while (v <= VERSION_MAX && octets.length + (v < 10 ? 2 : 3) > capacite(v)) v += 1;
  if (v > VERSION_MAX) throw new Error('texte trop long pour un QR code');
  const data = codewords(octets, v);
  let meilleure = null;
  for (let k = 0; k < 8; k += 1) {
    if (masque !== null && k !== masque) continue;
    const m = matrice(v, data, k);
    const p = masque !== null ? 0 : penalite(m);
    if (!meilleure || p < meilleure.p) meilleure = { m, p, k };
  }
  return { version: v, masque: meilleure.k, lignes: meilleure.m.map((l) => l.map((c) => (c ? '1' : '0')).join('')) };
}
