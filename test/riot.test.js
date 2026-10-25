// « Valorant · Stats de l'équipe » : inactif sans secrets, opt-in Riot Sign On (faux serveur Riot), jetons chiffrés,
// déliaison, rafraîchissement et accord retiré, limites de débit et 429, résumés sans adversaires, tableau d'équipe.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, compteConnecte, adminPret } from './simulation.js';
import { lireConfig } from '../src/config.js';
import { creerLimiteur, creerClientRiot } from '../src/riot/client.js';
import { creerFauxRiot } from '../src/riot/faux-riot.js';
import { statsEquipe, statsJoueur } from '../src/riot/agregats.js';
import { AUTORISATION_DEMO } from '../src/riot/rso.js';

// Navigation sans suivre les redirections (comme le navigateur, une étape à la fois).
async function aller(sim, c, chemin) {
  const rep = await fetch(sim.base + chemin, { redirect: 'manual', headers: { Cookie: c.cookie, 'X-Forwarded-For': '10.9.9.9' } });
  return rep.headers.get('location');
}

// Parcours complet : opt-in, autorisation (démo), retour. Rend l'adresse finale.
async function relier(sim, c, jeu = 'valorant') {
  const r = await c.post(`/api/e/${jeu}/riot/relier`, { accord: true });
  assert.equal(r.statut, 200, r.texte);
  const retour = await aller(sim, c, r.json.url);
  return aller(sim, c, retour.replace(/^https?:\/\/[^/]+/, ''));
}

describe('sans les secrets Riot', () => {
  let sim;
  before(async () => { sim = await demarrer({ jeux: ['valorant'] }); });
  after(() => sim.arreter());

  test('la fonction est inactive, masquée, et rien ne plante', async () => {
    const j = await compteConnecte(sim, { identifiant: 'nova', acces: { valorant: 'joueur' } });
    assert.deepEqual((await j.get('/api/e/valorant/riot')).json, { actif: false });
    assert.equal((await j.post('/api/e/valorant/riot/relier', { accord: true })).statut, 503);
    assert.equal((await j.get('/api/e/valorant/riot/parties')).statut, 503);
    assert.equal((await j.get('/api/e/valorant/donnees')).json.serveur.riot, false);
    assert.equal(await aller(sim, j, '/api/riot/retour?code=x&state=y'), '/#/jeux');
    assert.equal((await j.get(`${AUTORISATION_DEMO}?state=x`)).statut, 404, 'page de démo absente');
  });

  test('configuration : une variable manquante = inactif avec avertissement ; démo refusée en production', () => {
    const complet = {
      MONGODB_URI: 'mongodb://x', RIOT_API_KEY: 'RGAPI-x', RIOT_RSO_CLIENT_ID: 'id', RIOT_RSO_CLIENT_SECRET: 's',
      RIOT_RSO_REDIRECT_URI: 'https://lugh-esport.onrender.com/api/riot/retour', LUGH_CLE_RIOT: 'b'.repeat(64),
    };
    assert.equal(lireConfig(complet).riot.actif, true);
    const partiel = lireConfig({ ...complet, RIOT_RSO_CLIENT_SECRET: '' });
    assert.equal(partiel.riot.actif, false);
    assert.ok(partiel.avertissements.some((a) => a.includes('RIOT_RSO_CLIENT_SECRET')));
    assert.ok(lireConfig({ ...complet, LUGH_CLE_RIOT: 'court' }).erreurs.some((e) => e.includes('LUGH_CLE_RIOT')));
    assert.ok(lireConfig({ ...complet, RIOT_RSO_REDIRECT_URI: 'http://x/retour' }).erreurs.some((e) => e.includes('REDIRECT')));
    assert.equal(lireConfig({ MONGODB_URI: 'mongodb://x', LUGH_RIOT_DEMO: '1' }).riot.actif, false);
  });
});

describe('avec le faux serveur Riot', () => {
  let sim;
  let faux;
  const c = {};
  before(async () => {
    sim = await demarrer({ jeux: ['valorant', 'lol'], env: { LUGH_RIOT_DEMO: '1' } });
    faux = sim.services.riot.faux;
    c.vesper = await compteConnecte(sim, { identifiant: 'vesper', acces: { valorant: 'joueur', lol: 'joueur' } });
    c.kairo = await compteConnecte(sim, { identifiant: 'kairo', acces: { valorant: 'joueur' } });
    c.sans = await compteConnecte(sim, { identifiant: 'sansriot', acces: { valorant: 'joueur' } });
    c.coach = await compteConnecte(sim, { identifiant: 'coach', acces: { valorant: 'coach' } });
  });
  after(() => sim.arreter());

  test('opt-in obligatoire, puis liaison par Riot Sign On', async () => {
    assert.equal((await c.vesper.post('/api/e/valorant/riot/relier', {})).statut, 400, 'sans accord');
    assert.equal((await c.vesper.get('/api/e/lol/riot')).statut, 404, 'jeu non Valorant');
    assert.equal(await relier(sim, c.vesper), '/#/valorant/riot/relie');
    const etat = (await c.vesper.get('/api/e/valorant/riot')).json;
    assert.equal(etat.actif, true);
    assert.equal(etat.liaison.nomRiot, 'vesper#LUGH');
    const token = faux.appels.find((a) => a.url.endsWith('/token'));
    assert.match(token.entetes.Authorization, /^Basic /, 'secret client dans l’en-tête');
    assert.doesNotMatch(token.url, /secret|code=/, 'rien dans l’adresse');
    assert.ok(faux.appels.filter((a) => a.url.includes('api.riotgames.com')).every((a) => !a.url.includes('RGAPI')), 'clé jamais dans une URL');
  });

  test('jetons chiffrés au repos (AES-256-GCM), jamais renvoyés', async () => {
    const doc = await sim.global.lire('riot', c.vesper.id);
    assert.match(doc.jetons, /^v1:/);
    assert.doesNotMatch(JSON.stringify(doc), /acces-|rafr-/);
    assert.doesNotMatch((await c.vesper.get('/api/e/valorant/riot')).texte, /v1:|acces-|rafr-|puuid/);
  });

  test('state : usage unique, lié au compte, annulation = rien de partagé', async () => {
    const r = await c.kairo.post('/api/e/valorant/riot/relier', { accord: true });
    const retour = (await aller(sim, c.kairo, r.json.url)).replace(/^https?:\/\/[^/]+/, '');
    assert.equal(await aller(sim, c.sans, retour), '/#/jeux', 'state d’un autre compte refusé');
    assert.equal(await aller(sim, c.kairo, retour), '/#/jeux', 'state déjà consommé');
    const r2 = await c.kairo.post('/api/e/valorant/riot/relier', { accord: true });
    const state = new URL(r2.json.url, sim.base).searchParams.get('state');
    assert.equal(await aller(sim, c.kairo, `/api/riot/retour?error=access_denied&state=${state}`), '/#/valorant/riot/annule');
    assert.equal((await c.kairo.get('/api/e/valorant/riot')).json.liaison, null);
    assert.equal(await relier(sim, c.kairo), '/#/valorant/riot/relie');
  });

  test('un compte Riot ne se relie qu’à un seul compte Lugh', async () => {
    faux.comptes['demo-sansriot'] = { puuid: 'puuid-vesper', gameName: 'vesper', tagLine: 'LUGH' };
    assert.equal(await relier(sim, c.sans), '/#/valorant/riot/deja');
    assert.equal((await c.sans.get('/api/e/valorant/riot')).json.liaison, null);
    delete faux.comptes['demo-sansriot'];
  });

  test('mes parties : KDA, ACS, agents, cartes ; aucun autre joueur gardé', async () => {
    const r = await c.vesper.get('/api/e/valorant/riot/parties');
    assert.equal(r.statut, 200, r.texte);
    assert.ok(r.json.parties.length > 5);
    const p = r.json.parties[0];
    assert.ok(p.carte && p.agent && Number.isInteger(p.acs) && typeof p.victoire === 'boolean');
    assert.ok(r.json.parties[0].debut >= r.json.parties.at(-1).debut, 'plus récentes d’abord');
    assert.ok(r.json.stats.kda > 0 && r.json.stats.acs > 0 && r.json.stats.forme.length <= 10);
    const stocke = JSON.stringify(await sim.global.lister('riotParties'));
    assert.doesNotMatch(stocke, /adversaire|equipier|puuid/, 'ni adversaires, ni coéquipiers, ni PUUID');
  });

  test('synchro limitée à une toutes les 10 minutes', async () => {
    const avant = faux.appels.length;
    await c.vesper.get('/api/e/valorant/riot/parties');
    assert.equal(faux.appels.length, avant);
  });

  test('tableau Équipe : staff seulement, joueurs reliés seulement, sans adversaires', async () => {
    assert.equal((await c.vesper.get('/api/e/valorant/riot/equipe')).statut, 403);
    const r = await c.coach.get('/api/e/valorant/riot/equipe');
    assert.equal(r.statut, 200, r.texte);
    assert.deepEqual(r.json.joueurs.map((j) => j.nom).sort(), ['kairo', 'vesper']);
    assert.ok(r.json.cartes.length && r.json.cartes.every((x) => x.victoires === null || (x.victoires >= 0 && x.victoires <= 100)));
    assert.doesNotMatch(r.texte, /adversaire|sansriot|mmr|elo|rang/i);
  });

  test('jeton expiré : rafraîchi ; accord retiré chez Riot : liaison et données effacées', async () => {
    sim.maintenant.avancer(2 * 3600_000);
    await c.vesper.get('/api/e/valorant/riot/parties');
    assert.ok(faux.appels.some((a) => a.url.endsWith('/token') && a.corps.includes('refresh_token')));
    sim.maintenant.avancer(2 * 3600_000);
    faux.refusRafraichissement = true;
    const r = await c.vesper.get('/api/e/valorant/riot/parties');
    faux.refusRafraichissement = false;
    assert.equal(r.statut, 410);
    assert.equal(await sim.global.lire('riot', c.vesper.id), null);
    assert.equal((await sim.global.lister('riotParties', { compteId: c.vesper.id })).length, 0);
  });

  test('délier : jetons révoqués, liaison et parties supprimées', async () => {
    await c.kairo.get('/api/e/valorant/riot/parties');
    assert.ok((await sim.global.lister('riotParties', { compteId: c.kairo.id })).length);
    assert.equal((await c.kairo.del('/api/e/valorant/riot')).statut, 200);
    assert.ok(faux.revocations.includes('rafr-demo-kairo'));
    assert.equal(await sim.global.lire('riot', c.kairo.id), null);
    assert.equal((await sim.global.lister('riotParties', { compteId: c.kairo.id })).length, 0);
    assert.equal((await c.kairo.get('/api/e/valorant/riot/parties')).statut, 404);
  });

  test('compte supprimé : ses données Riot partent avec lui', async () => {
    assert.equal(await relier(sim, c.sans), '/#/valorant/riot/relie');
    await c.sans.get('/api/e/valorant/riot/parties');
    const admin = await adminPret(sim);
    assert.equal((await admin.del(`/api/admin/comptes/${c.sans.id}`)).statut, 200);
    assert.equal(await sim.global.lire('riot', c.sans.id), null);
    assert.equal((await sim.global.lister('riotParties', { compteId: c.sans.id })).length, 0);
  });
});

describe('client Riot : limites de débit et 429', () => {
  function tempsFactice() {
    let t = 0;
    const attentes = [];
    return { maintenant: () => t, attendre: async (ms) => { attentes.push(ms); t += ms; }, attentes };
  }

  test('fenêtre glissante : le 3e appel attend que la fenêtre se libère', async () => {
    const tf = tempsFactice();
    const l = creerLimiteur({ limites: [{ n: 2, ms: 1000 }], ...tf });
    await Promise.all([l.prendre(), l.prendre(), l.prendre()]);
    assert.deepEqual(tf.attentes, [1000]);
  });

  test('429 : pause de Retry-After puis nouvel essai ; trop long = erreur 429 sans bloquer', async () => {
    const tf = tempsFactice();
    const faux = creerFauxRiot();
    const client = creerClientRiot({ cle: 'RGAPI-test', fetchImpl: faux, limiteur: creerLimiteur(tf) });
    faux.forcer429 = 1;
    faux.retryAfter = '3';
    assert.ok((await client.contenu()).maps.length);
    assert.deepEqual(tf.attentes, [3000]);
    faux.forcer429 = 1;
    faux.retryAfter = '120';
    await assert.rejects(client.contenu(), (e) => e.statut === 429);
    await assert.rejects(client.contenu(), (e) => e.statut === 429, 'pause respectée pour les appels suivants');
    assert.equal(faux.appels.filter((a) => a.url.includes('contents')).length, 3, 'aucun appel pendant la pause');
  });

  test('agrégats : une partie jouée à deux compte une fois par carte', () => {
    const p = (matchId, carte, victoire, agent = 'Jett') => ({ matchId, carte, victoire, agent, k: 10, d: 5, a: 5, acs: 200 });
    const e = statsEquipe([
      { nom: 'a', parties: [p('m1', 'Bind', true), p('m2', 'Haven', false)] },
      { nom: 'b', parties: [p('m1', 'Bind', true, 'Sova')] },
    ]);
    assert.deepEqual(e.cartes, [{ carte: 'Bind', parties: 1, victoires: 100 }, { carte: 'Haven', parties: 1, victoires: 0 }]);
    assert.equal(e.joueurs[1].agents[0].nom, 'Sova');
    assert.deepEqual(statsJoueur([p('m1', 'Bind', true), p('m2', 'Bind', false)]).forme, ['V', 'D']);
    assert.equal(statsJoueur([]).kda, null);
  });
});

test('confidentialité : la page mentionne les données Riot, leur durée et leur suppression', async () => {
  const { texteConfidentialite } = await import('../shared/administratif/confidentialite.js');
  const t = JSON.stringify(texteConfidentialite({}));
  assert.match(t, /Riot/);
  assert.match(t, /90 jours/);
  assert.match(t, /Délier/);
});
