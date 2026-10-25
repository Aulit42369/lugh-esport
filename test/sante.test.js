// Santé : /api/sante vérifie vraiment la base (ping, 2 s au plus) et ne révèle jamais d'adresse ni de message brut.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, client } from './simulation.js';

let sim;
let pingOrigine;
before(async () => {
  sim = await demarrer();
  pingOrigine = sim.app.services.global.ping;
});
after(() => sim.arreter());

test('base qui répond : 200 { ok: true }', async () => {
  const r = await client(sim.base).get('/api/sante');
  assert.equal(r.statut, 200);
  assert.equal(r.json.ok, true);
});

test('base en erreur : 503 { ok: false }, sans adresse ni message brut', async () => {
  sim.app.services.global.ping = async () => { throw new Error('connect ECONNREFUSED cluster0.abcde.mongodb.net:27017'); };
  try {
    const r = await client(sim.base).get('/api/sante');
    assert.equal(r.statut, 503);
    assert.deepEqual(r.json, { ok: false, base: 'injoignable' });
    assert.doesNotMatch(JSON.stringify(r.json), /mongodb|ECONNREFUSED|27017/);
  } finally {
    sim.app.services.global.ping = pingOrigine;
  }
});

test('base muette : 503 après le délai de 2 s, pas d’attente infinie', async () => {
  sim.app.services.global.ping = () => new Promise(() => {});
  try {
    const debut = Date.now();
    const r = await client(sim.base).get('/api/sante');
    assert.equal(r.statut, 503);
    assert.equal(r.json.ok, false);
    assert.ok(Date.now() - debut < 4000, 'répond en moins de 4 s');
  } finally {
    sim.app.services.global.ping = pingOrigine;
  }
  assert.equal((await client(sim.base).get('/api/sante')).statut, 200, 'la base revenue, tout repart');
});
