// Contenus d'entraînement d'un jeu, lus dans sa définition : objectifs, semaines types, programme individuel.

import { nouvelId } from '../validation.js';

// ——— Objectifs ———

export function objectifParId(def, id) {
  return def.objectifs.find((o) => o.id === id) || def.collectifs.find((o) => o.id === id) || null;
}

export function objectifsDuPalier(def, n, domaine = null) {
  return def.objectifs.filter((o) => o.palier === n && (!domaine || o.domaine === domaine));
}

export function collectifsDuPalier(def, n) {
  return def.collectifs.filter((o) => o.palier === n);
}

export function palierParId(def, id) {
  return def.paliers.find((p) => p.id === id) || null;
}

// ——— Semaines types ———

export function ebaucheParId(def, id) {
  return def.ebauches.find((e) => e.id === id) || null;
}

// Copie les blocs d'une ébauche avec des identifiants neufs, prêts à être enregistrés.
export function blocsDepuisEbauche(def, id) {
  const e = ebaucheParId(def, id);
  if (!e) return [];
  return e.blocs.map((bloc) => ({ ...bloc, id: nouvelId('b'), membres: [], map: '' }));
}

export function ebauchePourPalier(def, palierN) {
  const preferees = palierN <= 2 ? ['decouverte'] : palierN <= 4 ? ['progression'] : palierN === 5 ? ['competition'] : ['haut-niveau', 'competition'];
  for (const id of preferees) if (ebaucheParId(def, id)) return id;
  return def.ebauches[0]?.id || '';
}

// ——— Programme individuel ———

export function programmePour(def, palierN, roleId) {
  const n = Math.min(6, Math.max(1, Number(palierN) || 1));
  const base = def.routines[n] || { echauffement: [], hebdo: [], conseil: '' };
  return {
    palier: n,
    echauffement: base.echauffement || [],
    dureeEchauffement: (base.echauffement || []).reduce((s, e) => s + (e.duree || 0), 0),
    hebdo: base.hebdo || [],
    role: def.parRole[roleId] || [],
    conseil: base.conseil || '',
  };
}

// ——— Seuils chiffrés : un objectif dont le critère se lit dans un chiffre de la semaine ———

export function seuilAtteint(def, objectifId, derniere) {
  const s = def.seuils?.[objectifId];
  const v = derniere?.valeurs?.[s?.chiffre];
  if (!s || typeof v !== 'number') return null;
  return { atteint: s.sens === '<=' ? v <= s.seuil : v >= s.seuil, valeur: v, seuil: s.seuil, chiffre: s.chiffre };
}

// Seuil d'un chiffre le plus proche du palier du joueur (palier atteint ou suivant), pour tracer une ligne d'objectif.
export function seuilPourChiffre(def, chiffreId, palierN = 1) {
  const seuils = Object.entries(def.seuils || {})
    .filter(([, s]) => s.chiffre === chiffreId)
    .map(([id, s]) => ({ palier: Number(id.split('-')[1]), seuil: s.seuil, sens: s.sens }))
    .sort((a, b) => a.palier - b.palier);
  return seuils.find((s) => s.palier >= palierN) || seuils.at(-1) || null;
}
