// Poids du JavaScript chargé à l'ouverture, par profil : graphe des imports statiques (les import() dynamiques
// sont exclus, ils ne partent qu'à la demande), chaque fichier compressé en gzip niveau 6 comme le serveur.
// Usage : node scripts/poids-js.js   (aussi utilisé par test/poids-js.test.js)

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BUDGET_KO = 150;

// Ce qui part à l'ouverture : la coquille (app.js) + la page d'arrivée de chaque profil.
// Vérifié dans le navigateur (simulation) : un membre de deux jeux passe par « Mes jeux » puis l'accueil d'un jeu ;
// un capitaine d'un seul jeu arrive sur son accueil ; l'admin générale sur la Vue d'ensemble (onglet chargé à l'ouverture).
export const PROFILS = {
  membre: ['/js/app.js', '/js/vues/jeux.js', '/js/vues/accueil.js'],
  capitaine: ['/js/app.js', '/js/vues/accueil.js'],
  'admin générale': ['/js/app.js', '/js/vues/admin.js', '/js/vues/admin-structure.js'],
};

const fichier = (url) => join(RACINE, url.startsWith('/shared/') ? '' : 'public', url);
// import … from '…' / export … from '…' / import '…' (pas import(…))
const IMPORT = /(?:^|[;\s])(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"]([^'"]+)['"]/g;

export function modulesStatiques(entrees) {
  const vus = new Set();
  const pile = [...entrees];
  while (pile.length) {
    const url = pile.pop();
    if (vus.has(url)) continue;
    vus.add(url);
    const src = readFileSync(fichier(url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    for (const [, cible] of src.matchAll(IMPORT)) {
      pile.push(cible.startsWith('/') ? cible : resolve(dirname(url), cible).replace(/^[A-Z]:/i, '').replaceAll('\\', '/'));
    }
  }
  return [...vus];
}

export function poids(entrees) {
  const mods = modulesStatiques(entrees);
  let brut = 0;
  let gz = 0;
  for (const m of mods) {
    const b = readFileSync(fichier(m));
    brut += b.length;
    gz += gzipSync(b, { level: 6 }).length;
  }
  return { modules: mods.length, brutKo: brut / 1024, gzipKo: gz / 1024 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [nom, entrees] of Object.entries(PROFILS)) {
    const p = poids(entrees);
    console.log(`${nom.padEnd(16)} ${p.gzipKo.toFixed(1).padStart(6)} Ko gzip  (${p.modules} modules, ${p.brutKo.toFixed(0)} Ko bruts)${p.gzipKo > BUDGET_KO ? '  AU-DESSUS du budget' : ''}`);
  }
}
