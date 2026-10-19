// Connexion, cookie de session, blocages, changement obligatoire du mot de passe, déconnexion, jeux visibles.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  demarrer, client, connecter, creerCompte, compteConnecte, adminPret, compteGlobal, MDP, MDP_ADMIN,
} from './simulation.js';

let sim;
before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol', 'cs2'] });
});
after(() => sim.arreter());

test('connexion : cookie de session HttpOnly, SameSite=Lax, 30 jours ; seule l’empreinte du jeton est en base', async () => {
  await creerCompte(sim, { identifiant: 'nova', acces: { valorant: 'joueur' } });
  const c = client(sim.base);
  const r = await c.post('/api/auth/connexion', { identifiant: '  NOVA ', mdp: MDP });
  assert.equal(r.statut, 200);
  assert.match(r.setCookie, /^lugh_session=[A-Za-z0-9_-]{43}; /);
  for (const attribut of [/; Path=\//, /; SameSite=Lax/, /; HttpOnly/, /; Max-Age=2592000/]) assert.match(r.setCookie, attribut);
  assert.doesNotMatch(r.setCookie, /Secure/, 'simulation en http : pas d’attribut Secure');
  const { compte } = r.json;
  assert.equal(compte.identifiant, 'nova');
  assert.equal(compte.admin, false);
  assert.deepEqual(compte.acces, { valorant: { metiers: ['joueur'], membreId: '' } });
  assert.equal(compte.derniereConnexion, sim.maintenant().toISOString());
  assert.equal('hash' in compte, false);

  const jeton = decodeURIComponent(c.cookie.split('=')[1]);
  const sessions = await sim.global.lister('sessions');
  assert.ok(sessions.some((s) => s._id === createHash('sha256').update(jeton).digest('hex')));
  assert.ok(!JSON.stringify(sessions).includes(jeton), 'le jeton en clair n’est jamais stocké');
  assert.equal((await c.get('/api/auth/moi')).statut, 200);
});

test('avec une adresse publique en https, le cookie porte aussi Secure', async () => {
  const securise = await demarrer({ env: { LUGH_ORIGINE: 'https://qg.example.com' } });
  try {
    await creerCompte(securise, { identifiant: 'nova', acces: {} });
    const r = await client(securise.base).post('/api/auth/connexion', { identifiant: 'nova', mdp: MDP });
    assert.equal(r.statut, 200);
    assert.match(r.setCookie, /; Secure/);
  } finally {
    await securise.arreter();
  }
});

test('mauvais mot de passe, identifiant inconnu, champs manquants : même réponse 401', async () => {
  await creerCompte(sim, { identifiant: 'joueur-a', acces: { valorant: 'joueur' } });
  const c = client(sim.base);
  const reponses = await Promise.all([
    c.post('/api/auth/connexion', { identifiant: 'personne', mdp: 'nimporte-quoi-1' }),
    c.post('/api/auth/connexion', { identifiant: 'joueur-a', mdp: 'nimporte-quoi-1' }),
    c.post('/api/auth/connexion', { identifiant: 'joueur-a' }),
    c.post('/api/auth/connexion', { identifiant: 'x'.repeat(25), mdp: MDP }),
    c.post('/api/auth/connexion', { identifiant: ['joueur-a'], mdp: MDP }),
  ]);
  for (const r of reponses) {
    assert.equal(r.statut, 401);
    assert.equal(r.json.erreur.code, 'identifiants');
    assert.equal(r.json.erreur.message, reponses[0].json.erreur.message);
    assert.equal(r.setCookie, null);
  }
});

test('blocage après 5 échecs sur un identifiant, même avec le bon mot de passe, levé après 15 minutes', async () => {
  const local = await demarrer();
  try {
    await creerCompte(local, { identifiant: 'cible', acces: {} });
    const c = client(local.base);
    for (let i = 0; i < 5; i += 1) assert.equal((await c.post('/api/auth/connexion', { identifiant: 'cible', mdp: 'mauvais-mdp-xx' })).statut, 401);
    const bloque = await c.post('/api/auth/connexion', { identifiant: 'cible', mdp: MDP });
    assert.equal(bloque.statut, 429);
    assert.match(bloque.json.erreur.message, /Réessaie dans 15 min/);
    // Un autre identifiant n'est pas concerné.
    await creerCompte(local, { identifiant: 'voisin', acces: {} });
    assert.equal((await c.post('/api/auth/connexion', { identifiant: 'voisin', mdp: MDP })).statut, 200);

    local.maintenant.avancer(14 * 60_000);
    assert.equal((await c.post('/api/auth/connexion', { identifiant: 'cible', mdp: MDP })).statut, 429);
    local.maintenant.avancer(60_000 + 1000);
    assert.equal((await c.post('/api/auth/connexion', { identifiant: 'cible', mdp: MDP })).statut, 200);
  } finally {
    await local.arreter();
  }
});

test('blocage après 20 échecs depuis une même adresse, quels que soient les identifiants', async () => {
  await creerCompte(sim, { identifiant: 'victime', acces: {} });
  const meme = client(sim.base, { ip: '203.0.113.9' });
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await meme.post('/api/auth/connexion', { identifiant: `inconnu${i}`, mdp: 'mauvais-mdp-xx' })).statut, 401);
  }
  assert.equal((await meme.post('/api/auth/connexion', { identifiant: 'victime', mdp: MDP })).statut, 429);
  assert.equal((await client(sim.base, { ip: '203.0.113.10' }).post('/api/auth/connexion', { identifiant: 'victime', mdp: MDP })).statut, 200);
});

test('premier démarrage : l’Administrateur général doit changer son mot de passe avant tout le reste', async () => {
  const local = await demarrer({ jeux: ['valorant'] });
  try {
    const c = await connecter(local, 'chef', MDP_ADMIN);
    assert.equal(c.compte.doitChangerMdp, true);
    assert.equal(c.compte.admin, true);
    assert.equal((await c.get('/api/auth/moi')).statut, 200, 'savoir qui on est reste possible');
    assert.deepEqual((await c.get('/api/auth/session')).json, { connecte: true, identifiant: 'chef', doitChangerMdp: true, doitActiver2fa: false });
    for (const chemin of ['/api/admin/jeux', '/api/admin/comptes', '/api/e/valorant/donnees']) {
      const r = await c.get(chemin);
      assert.equal(r.statut, 403, chemin);
      assert.equal(r.json.erreur.code, 'mdp_a_changer', chemin);
    }
    const autreSession = await connecter(local, 'chef', MDP_ADMIN);

    const refus = [
      [{ ancien: MDP_ADMIN, nouveau: 'court' }, 'mdp_refuse'],
      [{ ancien: MDP_ADMIN, nouveau: 'le-chef-de-lugh-26' }, 'mdp_refuse'], // contient l'identifiant
      [{ ancien: MDP_ADMIN, nouveau: 'azertyuiop' }, 'mdp_refuse'],
      [{ ancien: MDP_ADMIN, nouveau: MDP_ADMIN }, 'mdp_refuse'],
      [{ ancien: 'pas-le-bon-mdp', nouveau: 'Quartz-Lagune-2026' }, 'ancien_mdp'],
    ];
    for (const [corps, code] of refus) {
      const r = await c.post('/api/auth/mdp', corps);
      assert.equal(r.statut, 400, JSON.stringify(corps));
      assert.equal(r.json.erreur.code, code, JSON.stringify(corps));
    }
    const ok = await c.post('/api/auth/mdp', { ancien: MDP_ADMIN, nouveau: 'Quartz-Lagune-2026' });
    assert.equal(ok.statut, 200);
    assert.equal(ok.json.compte.doitChangerMdp, false);
    assert.equal((await c.get('/api/admin/jeux')).statut, 200, 'la session en cours continue');
    assert.equal((await c.get('/api/e/valorant/donnees')).statut, 200);
    assert.equal((await autreSession.get('/api/auth/moi')).statut, 401, 'les autres sessions sont fermées');
    assert.equal((await client(local.base).post('/api/auth/connexion', { identifiant: 'chef', mdp: MDP_ADMIN })).statut, 401);
    assert.equal((await client(local.base).post('/api/auth/connexion', { identifiant: 'chef', mdp: 'Quartz-Lagune-2026' })).statut, 200);
  } finally {
    await local.arreter();
  }
});

test('changement de mot de passe : 5 essais avec un mauvais mot de passe actuel bloquent les suivants', async () => {
  const c = await compteConnecte(sim, { identifiant: 'distrait', acces: {} });
  for (let i = 0; i < 5; i += 1) assert.equal((await c.post('/api/auth/mdp', { ancien: 'mauvais-mdp-xx', nouveau: 'Nouveau-secret-26' })).statut, 400);
  assert.equal((await c.post('/api/auth/mdp', { ancien: MDP, nouveau: 'Nouveau-secret-26' })).statut, 429);
});

test('déconnexion : cookie effacé, session supprimée côté serveur', async () => {
  const c = await compteConnecte(sim, { identifiant: 'sortant', acces: { valorant: 'joueur' } });
  const ancienCookie = c.cookie;
  const r = await c.post('/api/auth/deconnexion');
  assert.equal(r.statut, 200);
  assert.match(r.setCookie, /^lugh_session=; .*Max-Age=0/);
  assert.equal((await c.get('/api/auth/moi')).statut, 401);
  const rejoue = await client(sim.base).get('/api/auth/moi', { entetes: { Cookie: ancienCookie } });
  assert.equal(rejoue.statut, 401, 'l’ancien jeton ne sert plus');
});

test('état de la session sans erreur 401, et 401 sur les routes protégées sans session', async () => {
  const anonyme = client(sim.base);
  const s = await anonyme.get('/api/auth/session');
  assert.equal(s.statut, 200);
  assert.deepEqual(s.json, { connecte: false });
  for (const chemin of ['/api/auth/moi', '/api/e/valorant/donnees', '/api/e/valorant/sync?rev=0', '/api/admin/jeux']) {
    const r = await anonyme.get(chemin);
    assert.equal(r.statut, 401, chemin);
    assert.equal(r.json.erreur.code, 'non_connecte');
  }
  const c = await compteConnecte(sim, { identifiant: 'session-ok', acces: { valorant: 'joueur' } });
  assert.deepEqual((await c.get('/api/auth/session')).json, { connecte: true, identifiant: 'session-ok', doitChangerMdp: false, doitActiver2fa: false });
});

test('/api/auth/moi : seulement les jeux actifs où le compte a un métier ; tous pour l’Administrateur général', async () => {
  await creerCompte(sim, {
    identifiant: 'deux-jeux',
    acces: { valorant: ['joueur'], lol: ['remplacant', 'responsable'], cs2: { metiers: [], membreId: '' } },
  });
  const c = await connecter(sim, 'deux-jeux');
  const moi = (await c.get('/api/auth/moi')).json;
  assert.deepEqual(moi.jeux, [
    { id: 'valorant', modele: 'valorant', nom: 'Valorant', court: 'VAL', couleur: 'corail', actif: true, metiers: ['joueur'] },
    { id: 'lol', modele: 'lol', nom: 'League of Legends', court: 'LoL', couleur: 'sarcelle', actif: true, metiers: ['responsable', 'remplacant'] },
  ]);
  assert.deepEqual(Object.keys(moi.compte.acces), ['valorant', 'lol'], 'entrée sans métier ni membre : ignorée');

  const admin = await adminPret(sim);
  assert.equal((await admin.put('/api/admin/jeux/lol', { actif: false })).statut, 200);
  try {
    assert.deepEqual((await c.get('/api/auth/moi')).json.jeux.map((j) => j.id), ['valorant'], 'jeu désactivé : masqué');
    const vuParAdmin = (await admin.get('/api/auth/moi')).json.jeux;
    assert.deepEqual(vuParAdmin.map((j) => [j.id, j.actif]), [['valorant', true], ['lol', false], ['cs2', true]]);
    assert.ok(vuParAdmin.every((j) => j.metiers.includes('responsable')), 'Responsable partout');
  } finally {
    await admin.put('/api/admin/jeux/lol', { actif: true });
  }
});

test('compte désactivé : déconnecté aussitôt, connexion refusée', async () => {
  const c = await compteConnecte(sim, { identifiant: 'desactive', acces: { valorant: 'joueur' } });
  assert.equal((await c.get('/api/e/valorant/donnees')).statut, 200);
  const compte = await compteGlobal(sim, 'desactive');
  await sim.global.ecrire('comptes', { ...compte, actif: false });
  assert.equal((await c.get('/api/e/valorant/donnees')).statut, 401);
  assert.equal(await sim.global.compter('sessions', { compteId: compte._id }), 0, 'sa session est supprimée');
  assert.equal((await client(sim.base).post('/api/auth/connexion', { identifiant: 'desactive', mdp: MDP })).statut, 401);
});

test('session : prolongée par l’activité, expirée après 30 jours sans visite', async () => {
  const local = await demarrer({ jeux: ['valorant'] });
  try {
    const c = await compteConnecte(local, { identifiant: 'regulier', acces: { valorant: 'joueur' } });
    local.maintenant.avancer(20 * 86_400_000);
    assert.equal((await c.get('/api/auth/moi')).statut, 200, 'jour 20 : prolongée de 30 jours');
    local.maintenant.avancer(25 * 86_400_000);
    assert.equal((await c.get('/api/auth/moi')).statut, 200, 'jour 45 : toujours valable');
    local.maintenant.avancer(31 * 86_400_000);
    assert.equal((await c.get('/api/auth/moi')).statut, 401, '31 jours sans visite : expirée');
    assert.equal(await local.global.compter('sessions'), 0);
  } finally {
    await local.arreter();
  }
});
