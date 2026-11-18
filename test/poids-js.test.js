// Budget du JavaScript initial : 150 Ko compressés (gzip) au démarrage, pour chaque profil et pour toute page
// ouverte directement par un lien (coquille + la page). Mesure : scripts/poids-js.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { poids, modulesStatiques, PROFILS, BUDGET_KO } from '../scripts/poids-js.js';

test('JS initial de chaque profil sous le budget', () => {
  for (const [nom, entrees] of Object.entries(PROFILS)) {
    const p = poids(entrees);
    assert.ok(p.gzipKo <= BUDGET_KO, `${nom} : ${p.gzipKo.toFixed(1)} Ko > ${BUDGET_KO} Ko`);
  }
});

test('toute page ouverte par un lien direct reste sous le budget', () => {
  for (const f of readdirSync(new URL('../public/js/vues/', import.meta.url))) {
    const p = poids(['/js/app.js', `/js/vues/${f}`]);
    assert.ok(p.gzipKo <= BUDGET_KO, `${f} : ${p.gzipKo.toFixed(1)} Ko > ${BUDGET_KO} Ko`);
  }
});

test('les onglets d’administration et les textes légaux ne partent pas à l’ouverture', () => {
  const coquille = modulesStatiques(['/js/app.js', '/js/vues/admin.js']);
  assert.ok(!coquille.some((m) => m.startsWith('/shared/administratif/')), 'textes légaux chargés au démarrage');
  for (const onglet of ['jeux', 'comptes', 'administratif', 'annonces', 'discord', 'service', 'structure']) {
    assert.ok(!coquille.includes(`/js/vues/admin-${onglet}.js`), `admin-${onglet}.js chargé au démarrage`);
  }
});
