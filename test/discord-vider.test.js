// À l'arrêt du serveur, les annonces planning en attente (regroupement de 2 min) partent tout de suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerNotifications } from '../src/notifications/discord.js';
import { semaineIso, dateCivile } from '../shared/temps.js';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABCDEF-123456';

test('vider() envoie immédiatement le planning en attente', async () => {
  const fuseau = 'Europe/Paris';
  const semaine = semaineIso(dateCivile(new Date(), fuseau));
  const docs = {
    'reglages/discord': { _id: 'discord', webhook: WEBHOOK, evenements: {} },
    [`planning/${semaine}`]: { blocs: [{ jour: 1, debut: '20:00', fin: '22:00', titre: 'Scrim A', type: 'scrim' }] },
  };
  let ecoute;
  const envois = [];
  const n = creerNotifications({
    stockage: { lire: async (coll, id) => docs[`${coll}/${id}`] ?? null },
    depot: { ecouter: (f) => { ecoute = f; }, journaliser: async () => {} },
    config: { fuseau },
    definition: () => ({ nom: 'Valorant', court: 'VAL', typesBlocTous: [] }),
    journal: { error() {} },
    fetchImpl: async (url, opts) => { envois.push(JSON.parse(opts.body).content); return { ok: true }; },
    delaiPlanningMs: 60_000,
  });
  await ecoute('planning', { _id: semaine });
  assert.equal(envois.length, 0);
  await n.vider();
  assert.equal(envois.length, 1);
  assert.match(envois[0], /Scrim A/);
  await n.vider();
  assert.equal(envois.length, 1, 'rien à renvoyer');
  n.arreter();
});
