// Sécurité HTTP : en-têtes et CSP, protection CSRF, champs inconnus ignorés, liens https, aucun mot de passe haché
// dans les réponses, compression, fichiers statiques, requêtes mal formées, limite de débit.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import {
  demarrer, adminPret, compteConnecte, client, requeteBrute, connecterEtChanger, stratPour, MDP,
} from './simulation.js';
import { nouvelId } from '../shared/validation.js';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

let sim;
let admin;
let coach;
before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol'] });
  admin = await adminPret(sim);
  coach = await compteConnecte(sim, { identifiant: 'coach', acces: { valorant: ['headcoach'] } });
});
after(() => sim.arreter());

test('en-têtes de sécurité et CSP stricte sur les pages, les fichiers et l’API, erreurs comprises', async () => {
  for (const chemin of ['/', '/api/sante', '/js/app.js', '/shared/roles.js', '/api/inconnue', '/page-inconnue']) {
    const r = await requeteBrute(sim.base, chemin);
    assert.equal(r.entetes['content-security-policy'], CSP, chemin);
    assert.equal(r.entetes['x-content-type-options'], 'nosniff', chemin);
    assert.equal(r.entetes['x-frame-options'], 'DENY', chemin);
    assert.equal(r.entetes['referrer-policy'], 'no-referrer', chemin);
    assert.equal(r.entetes['cross-origin-opener-policy'], 'same-origin', chemin);
    assert.equal(r.entetes['cross-origin-resource-policy'], 'same-origin', chemin);
    assert.match(r.entetes['permissions-policy'], /camera=\(\), microphone=\(\), geolocation=\(\)/, chemin);
    assert.equal(r.entetes['strict-transport-security'], undefined, 'pas de HSTS en local');
  }
  assert.equal((await requeteBrute(sim.base, '/api/sante')).entetes['cache-control'], 'no-store', 'l’API n’est jamais mise en cache');

  const render = await demarrer({ env: { RENDER: 'true' } });
  try {
    assert.equal((await requeteBrute(render.base, '/')).entetes['strict-transport-security'], 'max-age=31536000');
    const r = await client(render.base).post('/api/auth/connexion', { identifiant: 'chef', mdp: 'mot-de-passe-de-lugh-1' });
    assert.match(r.setCookie, /; Secure/, 'sur Render, cookie réservé à https');
  } finally {
    await render.arreter();
  }
});

test('protection CSRF : écriture refusée sans en-tête X-Lugh ou depuis une autre origine ; lecture libre', async () => {
  const ecrire = (options) => coach.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: stratPour('valorant') }, options);
  const sans = await ecrire({ sansQg: true });
  assert.equal(sans.statut, 403);
  assert.match(sans.json.erreur.message, /en-tête de sécurité manquant/);
  assert.equal((await ecrire({ sansQg: true, entetes: { 'X-Lugh': '0' } })).statut, 403);
  for (const origine of ['https://pirate.example', 'null', 'pas une adresse', 'http://127.0.0.1:1']) {
    const r = await ecrire({ entetes: { Origin: origine } });
    assert.equal(r.statut, 403, origine);
    assert.match(r.json.erreur.message, /Origine refusée/);
  }
  assert.equal((await ecrire({ entetes: { Origin: sim.base } })).statut, 200, 'même site');
  assert.equal((await ecrire()).statut, 200, 'sans Origin (appli installée, anciens navigateurs)');
  assert.equal((await coach.get('/api/e/valorant/donnees', { sansQg: true })).statut, 200, 'lecture sans en-tête');
  assert.equal((await client(sim.base).post('/api/auth/connexion', { identifiant: 'coach', mdp: MDP }, { sansQg: true })).statut, 403, 'la connexion aussi');
  assert.equal((await coach.del('/api/e/valorant/c/strats/s-aaaaaaaaaa', { sansQg: true })).statut, 403);

  const publique = await demarrer({ env: { LUGH_ORIGINE: 'https://lugh.example.com/' }, jeux: ['valorant'] });
  try {
    const c = await compteConnecte(publique, { identifiant: 'coach', acces: { valorant: ['headcoach'] } });
    const avec = (origine) => c.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: stratPour('valorant') }, { entetes: { Origin: origine } });
    assert.equal((await avec('https://lugh.example.com')).statut, 200, 'adresse publique configurée');
    assert.equal((await avec(publique.base)).statut, 403, 'l’hôte de la requête ne suffit plus');
  } finally {
    await publique.arreter();
  }
});

test('champs inconnus ignorés, champs techniques jamais repris du navigateur, aucune pollution de prototype', async () => {
  const id = nouvelId('s');
  const corps = `{"valeur":{"map":"haven","camp":"att","type":"default","nom":"Propre","admin":true,"_id":"autre","rev":99999,"maj":{"par":"c-pirate"},"__proto__":{"pollue":true},"constructor":{"prototype":{"pollue":true}}}}`;
  const r = await coach.put(`/api/e/valorant/c/strats/${id}`, corps);
  assert.equal(r.statut, 200);
  const doc = r.json.doc;
  assert.deepEqual([doc._id, doc.admin, doc.maj.par, doc.pollue], [id, undefined, coach.id, undefined]);
  assert.ok(doc.rev < 99999);
  assert.equal({}.pollue, undefined, 'Object.prototype intact');
  assert.equal(Object.prototype.pollue, undefined);

  const m = await coach.put(`/api/e/valorant/c/membres/${nouvelId('m')}`, { valeur: { type: 'joueur', statut: 'titulaire', pseudo: 'Nova', motDePasse: 'secret', email: 'nova@example.com' } });
  assert.equal(m.statut, 200);
  assert.deepEqual([m.json.doc.motDePasse, m.json.doc.email], [undefined, undefined], 'aucune donnée personnelle hors du schéma');
  const piege = '<img src=x onerror=alert(1)>';
  assert.equal((await coach.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: { ...stratPour('valorant'), nom: piege } })).json.doc.nom, piege, 'texte gardé tel quel, jamais interprété');
});

test('liens : https uniquement, partout où un lien est accepté', async () => {
  const mauvais = ['javascript:alert(1)', 'http://example.com/v', 'data:text/html,x', 'notaurl', '//example.com/v', 'ftp://example.com/v'];
  const cas = [
    ['vods', () => nouvelId('v'), (lien) => ({ titre: 'V', lien })],
    ['strats', () => nouvelId('s'), (lien) => ({ ...stratPour('valorant'), video: lien })],
    ['bibliotheque', () => nouvelId('l'), (lien) => ({ type: 'ressource', titre: 'Guide', lien })],
    ['adversaires', () => nouvelId('d'), (lien) => ({ nom: 'Kraken', vods: [lien] })],
    ['scrims', () => nouvelId('x'), (lien) => ({ date: '2026-10-15', adversaire: 'A', map: 'haven', scoreNous: 13, scoreEux: 9, vod: lien })],
    ['tournois', () => nouvelId('t'), (lien) => ({ nom: 'Coupe', lien })],
    ['partenaires', () => nouvelId('e'), (lien) => ({ nom: 'Kraken', lien })],
  ];
  for (const [coll, id, valeur] of cas) {
    for (const lien of mauvais) assert.equal((await admin.put(`/api/e/valorant/c/${coll}/${id()}`, { valeur: valeur(lien) })).statut, 400, `${coll} : ${lien}`);
    assert.equal((await admin.put(`/api/e/valorant/c/${coll}/${id()}`, { valeur: valeur('https://example.com/ok') })).statut, 200, coll);
  }
});

test('aucun mot de passe haché dans aucune réponse de l’API', async () => {
  const sans = (r, quoi) => {
    assert.ok(r.statut < 300, `${quoi} : ${r.statut}`);
    assert.ok(!r.texte.includes('scrypt$') && !r.texte.includes('"hash"'), quoi);
  };
  const cree = await admin.post('/api/admin/comptes', { identifiant: 'multi', nomAffiche: 'Multi', acces: { valorant: { metiers: ['joueur'] } } });
  sans(cree, 'création par l’Administrateur général');
  const id = cree.json.compte._id;
  sans(await admin.put(`/api/admin/comptes/${id}`, { nomAffiche: 'Multi', actif: true, admin: false, acces: { valorant: { metiers: ['joueur'] }, lol: { metiers: ['joueur'] } } }), 'modification');
  const reinit = await admin.post(`/api/admin/comptes/${id}/mdp`);
  sans(reinit, 'réinitialisation');
  const multi = await connecterEtChanger(sim, 'multi', reinit.json.mdpTemporaire);
  sans(await multi.get('/api/auth/moi'), 'moi');
  const resp = await compteConnecte(sim, { identifiant: 'resp', acces: { valorant: ['responsable'] } });
  const parResp = await resp.post('/api/e/valorant/comptes', { identifiant: 'recrue', nomAffiche: 'Recrue', metiers: ['joueur'] });
  sans(parResp, 'création par le Responsable');
  sans(await resp.put(`/api/e/valorant/comptes/${parResp.json.compte._id}`, { metiers: ['joueur', 'capitaine'], nomAffiche: 'Recrue' }), 'modification par le Responsable');
  sans(await client(sim.base).post('/api/auth/connexion', { identifiant: 'coach', mdp: MDP }), 'connexion');
  for (const chemin of [
    '/api/admin/comptes', '/api/admin/journal', '/api/admin/etat', '/api/e/valorant/comptes', '/api/e/valorant/donnees',
    '/api/e/valorant/sync?rev=0', '/api/e/valorant/export', '/api/e/valorant/journal', '/api/e/valorant/etat', '/api/e/lol/donnees',
  ]) sans(await admin.get(chemin), chemin);
});

test('réponses JSON volumineuses compressées en gzip quand le navigateur l’accepte', async () => {
  const avec = await requeteBrute(sim.base, '/api/e/valorant/donnees', { entetes: { Cookie: admin.cookie, 'Accept-Encoding': 'gzip, deflate, br' } });
  assert.equal(avec.statut, 200);
  assert.equal(avec.entetes['content-encoding'], 'gzip');
  assert.equal(avec.entetes.vary, 'Accept-Encoding');
  assert.equal(Number(avec.entetes['content-length']), avec.corps.length);
  const json = JSON.parse(gunzipSync(avec.corps).toString('utf8'));
  assert.equal(json.jeu.id, 'valorant');
  assert.ok(gunzipSync(avec.corps).length > 16 * 1024);

  const sans = await requeteBrute(sim.base, '/api/e/valorant/donnees', { entetes: { Cookie: admin.cookie } });
  assert.equal(sans.entetes['content-encoding'], undefined);
  assert.equal(JSON.parse(sans.corps.toString('utf8')).jeu.id, 'valorant');
  const petit = await requeteBrute(sim.base, '/api/sante', { entetes: { 'Accept-Encoding': 'gzip' } });
  assert.equal(petit.entetes['content-encoding'], undefined, 'petite réponse : pas de compression');
  assert.deepEqual(JSON.parse(petit.corps.toString('utf8')), { ok: true });
});

test('fichiers statiques : impossible de sortir des dossiers publics ; cache par ETag', async () => {
  for (const chemin of [
    '/../src/config.js', '/shared/../src/config.js', '/%2e%2e/src/config.js', '/.env', '/.env.example', '/package.json',
    '/src/serveur.js', '/test/simulation.js', '/shared/%2e%2e/package.json', '/%2e%2e%2fpackage.json', '/js/..%2f..%2fpackage.json', '/README.md',
  ]) {
    assert.equal((await requeteBrute(sim.base, chemin)).statut, 404, chemin);
  }
  const roles = await requeteBrute(sim.base, '/shared/roles.js');
  assert.equal(roles.statut, 200);
  assert.match(roles.entetes['content-type'], /^text\/javascript/);
  const index = await requeteBrute(sim.base, '/');
  assert.equal(index.statut, 200);
  assert.match(index.entetes['content-type'], /^text\/html/);
  assert.equal((await requeteBrute(sim.base, '/', { entetes: { 'If-None-Match': index.entetes.etag } })).statut, 304);
  const tete = await requeteBrute(sim.base, '/', { methode: 'HEAD' });
  assert.equal(tete.statut, 200);
  assert.equal(tete.corps.length, 0);
});

test('requêtes mal formées : corps trop gros ou illisible, mauvais type, adresse ou méthode inconnue', async () => {
  const strat = `/api/e/valorant/c/strats/${nouvelId('s')}`;
  assert.equal((await coach.put(strat, `{"valeur":"${'a'.repeat(300_000)}"}`)).statut, 413);
  assert.equal((await coach.put(strat, '{pas du json')).statut, 400);
  assert.equal((await coach.put(strat, '[1, 2]')).statut, 400);
  assert.equal((await coach.put(strat, JSON.stringify({ valeur: stratPour('valorant') }), { entetes: { 'Content-Type': 'text/plain' } })).statut, 400);
  assert.equal((await admin.put('/api/e/valorant/reglages-jeu', `{"valeur":{},"x":"${'a'.repeat(600_000)}"}`)).statut, 413, 'Réglages : 512 Ko au plus');
  assert.equal((await coach.put('/api/e/valorant/c/__proto__/x', { valeur: {} })).statut, 404);
  assert.equal((await coach.put('/api/e/valorant/c/constructor/x', { valeur: {} })).statut, 404);
  assert.equal((await coach.put('/api/e/valorant/c/strats/..%2Fcomptes', { valeur: {} })).statut, 400);
  assert.equal((await coach.put('/api/e/valorant/c/strats/%E0%A4%A', { valeur: {} })).statut, 400, 'encodage illisible');
  assert.equal((await coach.get('/api/rien')).statut, 404);
  const methode = await coach.appel('PATCH', '/api/auth/moi', {});
  assert.equal(methode.statut, 405);
  assert.equal((await coach.get('/api/e/valorant/sync?rev=-1')).statut, 400);
});

test('limite de débit : 300 requêtes par minute et par adresse', async () => {
  const local = await demarrer();
  try {
    const meme = client(local.base, { ip: '198.51.100.7' });
    for (let i = 0; i < 300; i += 1) assert.equal((await meme.get('/api/sante')).statut, 200);
    const trop = await meme.get('/api/sante');
    assert.equal(trop.statut, 429);
    assert.equal(trop.json.erreur.code, 'trop_de_requetes');
    assert.equal((await client(local.base, { ip: '198.51.100.8' }).get('/api/sante')).statut, 200, 'une autre adresse passe');
    local.maintenant.avancer(61_000);
    assert.equal((await meme.get('/api/sante')).statut, 200, 'une minute plus tard');
  } finally {
    await local.arreter();
  }
});

test('jeton de session inventé, trop long ou d’un compte supprimé : refusé', async () => {
  const c = client(sim.base);
  for (const cookie of ['lugh_session=jeton-invente', `lugh_session=${'a'.repeat(200)}`, 'lugh_session=', 'autre=1']) {
    assert.equal((await c.get('/api/auth/moi', { entetes: { Cookie: cookie } })).statut, 401, cookie);
  }
  const passager = await compteConnecte(sim, { identifiant: 'passager', acces: { valorant: 'joueur' } });
  assert.equal((await admin.del(`/api/admin/comptes/${passager.id}`)).statut, 200);
  assert.equal((await passager.get('/api/auth/moi')).statut, 401);
});
