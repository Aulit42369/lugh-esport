// Fusion de la synchronisation du navigateur (shared/synchro.js) : nouvelles fiches, fiches modifiées, suppressions
// appliquées seulement si elles sont plus récentes que la fiche locale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionnerSynchro } from '../shared/synchro.js';

const locales = (fiches) => ({ strats: new Map(fiches.map((f) => [f._id, f])), membres: new Map() });

test('synchro : fiches nouvelles et modifiées appliquées, fiche identique ignorée, collection inconnue sans effet', () => {
  const d = locales([{ _id: 'a', rev: 1, nom: 'A' }, { _id: 'b', rev: 2, nom: 'B' }]);
  assert.equal(fusionnerSynchro(d, { docs: { strats: [{ _id: 'b', rev: 2, nom: 'B' }] } }), false, 'rien de neuf');
  assert.equal(fusionnerSynchro(d, { docs: { strats: [{ _id: 'a', rev: 5, nom: 'A2' }, { _id: 'c', rev: 6, nom: 'C' }], inconnue: [{ _id: 'x', rev: 7 }] } }), true);
  assert.deepEqual([...d.strats.values()].map((f) => `${f._id}:${f.nom}`), ['a:A2', 'b:B', 'c:C']);
  assert.equal(fusionnerSynchro(d, {}), false, 'réponse vide');
});

test('synchro : suppression appliquée si plus récente que la fiche locale, ignorée sinon', () => {
  const d = locales([{ _id: 'a', rev: 3 }, { _id: 'b', rev: 9 }]);
  assert.equal(fusionnerSynchro(d, { suppressions: [{ coll: 'strats', id: 'a', rev: 4 }, { coll: 'strats', id: 'b', rev: 8 }] }), true);
  assert.deepEqual([...d.strats.keys()], ['b'], 'b a été recréée après sa suppression : elle reste');
  assert.equal(fusionnerSynchro(d, { suppressions: [{ coll: 'strats', id: 'absente', rev: 10 }, { coll: 'inconnue', id: 'b', rev: 10 }] }), false);
});

test('synchro : fiche supprimée puis recréée avec le même identifiant dans le même intervalle de 20 s → affichée', () => {
  const d = locales([{ _id: 'a', rev: 3, nom: 'ancienne' }]);
  const change = fusionnerSynchro(d, {
    docs: { strats: [{ _id: 'a', rev: 11, nom: 'recréée' }] },
    suppressions: [{ coll: 'strats', id: 'a', rev: 10 }],
  });
  assert.equal(change, true);
  assert.equal(d.strats.get('a')?.nom, 'recréée');
  // Recréée puis supprimée de nouveau : la suppression (plus récente) l'emporte.
  fusionnerSynchro(d, { suppressions: [{ coll: 'strats', id: 'a', rev: 12 }] });
  assert.equal(d.strats.has('a'), false);
});
