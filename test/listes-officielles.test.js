// Listes officielles Valorant (valorant-api.com) : comparaison avec la méta et alerte « À traiter », sans réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ecartListesOfficielles } from '../shared/listes-officielles.js';
import { listesOfficielles } from '../src/meta/listes-officielles.js';
import { attendreQue, pause } from './simulation.js';
import { creerStockageMemoire } from '../src/stockage/memoire.js';
import { creerDepot } from '../src/domaine/depot.js';
import { creerAutomatismes } from '../src/domaine/automatismes.js';

const meta = {
  patch: '13.08',
  personnages: [{ id: 'jett', nom: 'Jett' }, { id: 'kayo', nom: 'KAY/O' }, { id: 'vieux', nom: 'Vieil Agent' }],
  maps: [{ id: 'ascent', nom: 'Ascent' }, { id: 'bind', nom: 'Bind' }],
};

test('écart : agent manquant, agent en trop, carte manquante, KAY/O reconnu malgré la ponctuation', () => {
  const e = ecartListesOfficielles({ agents: ['Jett', 'KAY/O', 'Hush'], cartes: ['Ascent', 'Bind', 'Lotus'] }, meta);
  assert.deepEqual(e.agents.manquants, ['Hush']);
  assert.deepEqual(e.agents.enTrop, ['Vieil Agent']);
  assert.deepEqual(e.cartes.manquants, ['Lotus']);
  assert.deepEqual(e.cartes.enTrop, []);
  assert.equal(e.vide, false);
  assert.equal(ecartListesOfficielles({ agents: ['Jett', 'KAY/O', 'Vieil Agent'], cartes: ['Ascent', 'Bind'] }, meta).vide, true);
});

test('lecture : seules les cartes de partie classique sont gardées, une réponse trop courte est refusée', async () => {
  const agents = Array.from({ length: 12 }, (_, i) => ({ displayName: `A${i}` }));
  const cartes = [...Array.from({ length: 6 }, (_, i) => ({ displayName: `C${i}`, tacticalDescription: 'A/B' })), { displayName: 'Entraînement', tacticalDescription: null }];
  const faux = (a, c) => async (url) => ({ ok: true, json: async () => ({ data: url.includes('/agents') ? a : c }) });
  const r = await listesOfficielles(faux(agents, cartes));
  assert.equal(r.agents.length, 12);
  assert.equal(r.cartes.length, 6);
  await assert.rejects(listesOfficielles(faux(agents.slice(0, 3), cartes)), /trop courtes/);
});

test('automatisme : une suggestion « À traiter » une seule fois, sans toucher à la méta ; un échec réessaie 3 h plus tard', async () => {
  const stockage = creerStockageMemoire();
  const depot = creerDepot({ stockage, journal: { error() {} } });
  await depot.initialiser();
  await stockage.ecrire('meta', { _id: 'courante', ...meta });
  let t = new Date('2026-11-18T10:00:00Z');
  let appels = 0;
  let panne = true;
  const agents = [...meta.personnages.map((p) => p.nom), 'Hush', ...Array.from({ length: 10 }, (_, i) => `X${i}`)].filter((n) => n !== 'Vieil Agent');
  const cartes = ['Ascent', 'Bind', 'Lotus', 'M1', 'M2', 'M3'];
  const fetchListes = async (url) => {
    appels += 1;
    if (panne) throw new Error('réseau coupé');
    return { ok: true, json: async () => ({ data: url.includes('/agents') ? agents.map((displayName) => ({ displayName })) : cartes.map((displayName) => ({ displayName, tacticalDescription: 'x' })) }) };
  };
  const erreurs = [];
  const auto = creerAutomatismes({
    depot, stockage, config: { fuseau: 'Europe/Paris', claude: { cle: '' } }, actualisation: {}, definition: () => ({ id: 'valorant' }),
    maintenant: () => t, journal: { error: (...x) => erreurs.push(x) }, fetchListes,
  });
  auto.verifier();
  await attendreQue(() => erreurs.length, { message: 'échec journalisé' });
  assert.equal((await stockage.lister('suggestions', {})).length, 0);

  panne = false;
  t = new Date(t.getTime() + 3600_000 + 120_000); // 1 h plus tard : trop tôt pour réessayer
  const avant = appels;
  auto.verifier();
  await pause(50);
  assert.equal(appels, avant, 'pas de nouvel essai avant 3 h');

  t = new Date(t.getTime() + 2 * 3600_000); // 3 h après l'échec
  auto.verifier();
  await attendreQue(async () => (await stockage.lister('suggestions', {})).length === 1, { message: 'suggestion créée' });
  const [s] = await stockage.lister('suggestions', {});
  assert.match(s.texte, /Hush/);
  assert.match(s.texte, /Vieil Agent/);
  assert.match(s.texte, /Lotus/);
  assert.equal(s.statut, 'nouvelle');
  assert.equal((await stockage.lire('meta', 'courante')).personnages.length, 3, 'méta intacte');

  t = new Date(t.getTime() + 25 * 3600_000); // lendemain : même écart, pas de doublon
  auto.verifier();
  await pause(80);
  assert.equal((await stockage.lister('suggestions', {})).length, 1);
});
