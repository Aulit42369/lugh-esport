// Double authentification (TOTP) : codes RFC 6238, activation, connexion avec code ou code de secours,
// renouvellement, désactivation, obligation pour l'Administrateur général et les Responsables, remise à zéro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrer, adminPret, client, connecter, creerCompte, compteConnecte, compteGlobal, horloge, silencieux, MDP, MDP_ADMIN,
} from './simulation.js';
import {
  hotp, depuisBase32, versBase32, pasDe, nouveauSecret, verifierCode, nouveauxCodesSecours, utiliserCodeSecours, adresseOtpauth,
} from '../src/auth/totp.js';
import { creerApp } from '../src/app.js';
import { creerFabriqueMemoire } from '../src/stockage/memoire.js';
import { lireConfig } from '../src/config.js';
import { amorcer } from '../src/domaine/amorcage.js';

const MOTIF_SECOURS = /^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/;
const codeA = (secret, quand) => hotp(depuisBase32(secret), pasDe(quand.getTime()));
// Un code à 6 chiffres sûrement refusé : aucun des pas acceptés (courant et voisins) ne le donne.
function codeFaux(secret, quand) {
  const valides = [-1, 0, 1].map((d) => hotp(depuisBase32(secret), pasDe(quand.getTime()) + d));
  return ['000000', '111111', '222222', '333333'].find((c) => !valides.includes(c));
}

// Compte avec la double authentification déjà active (écrite directement en base).
async function compteAvec2fa(sim, options) {
  const secret = nouveauSecret();
  const { codes, empreintes } = nouveauxCodesSecours(3);
  const compte = await creerCompte(sim, options);
  await sim.global.ecrire('comptes', { ...compte, deuxFacteurs: { secret, depuis: sim.maintenant().toISOString(), dernierPas: -1, secours: empreintes } });
  return { compte, secret, codes };
}

async function activer(sim, c) {
  const prepa = await c.post('/api/auth/2fa/preparer');
  assert.equal(prepa.statut, 200, prepa.texte);
  const secret = prepa.json.secret.replace(/\s/g, '');
  const r = await c.post('/api/auth/2fa/activer', { code: codeA(secret, sim.maintenant()) });
  assert.equal(r.statut, 200, r.texte);
  return { secret, codes: r.json.codesSecours };
}

test('codes TOTP : vecteurs de la RFC 6238, base 32, fenêtre d’un pas, aucun code rejoué ; codes de secours', () => {
  const cle = Buffer.from('12345678901234567890');
  for (const [secondes, attendu] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']]) {
    assert.equal(hotp(cle, pasDe(secondes * 1000)), attendu, `T = ${secondes}`);
  }
  assert.equal(versBase32(cle), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(depuisBase32('gezd gnbv gy3t qojq gezd gnbv gy3t qojq'), cle, 'espaces et minuscules acceptés');
  assert.throws(() => depuisBase32('ABC1'), /clé invalide/);
  assert.match(nouveauSecret(), /^[A-Z2-7]{32}$/);

  const secret = versBase32(cle);
  const t = 1111111111 * 1000;
  const pas = pasDe(t);
  const code = (d) => hotp(cle, pas + d);
  assert.equal(verifierCode(secret, code(0), { maintenantMs: t }), pas);
  assert.equal(verifierCode(secret, code(-1), { maintenantMs: t }), pas - 1, 'horloge du téléphone un peu en retard');
  assert.equal(verifierCode(secret, code(1), { maintenantMs: t }), pas + 1);
  assert.equal(verifierCode(secret, code(2), { maintenantMs: t }), null, 'hors de la fenêtre');
  assert.equal(verifierCode(secret, code(0), { maintenantMs: t, dernierPas: pas }), null, 'déjà utilisé');
  assert.equal(verifierCode(secret, ` ${code(0).slice(0, 3)} ${code(0).slice(3)} `, { maintenantMs: t }), pas, 'espaces ignorés');
  for (const mauvais of ['12345', '1234567', 'abcdef', '', null]) assert.equal(verifierCode(secret, mauvais, { maintenantMs: t }), null);

  const { codes, empreintes } = nouveauxCodesSecours();
  assert.equal(codes.length, 10);
  assert.ok(codes.every((c) => MOTIF_SECOURS.test(c)));
  assert.ok(empreintes.every((e) => /^[0-9a-f]{64}$/.test(e)) && !empreintes.some((e) => codes.includes(e)), 'seules les empreintes sont gardées');
  const reste = utiliserCodeSecours(empreintes, codes[3].toUpperCase().replace('-', ' '));
  assert.equal(reste.length, 9);
  assert.equal(utiliserCodeSecours(reste, codes[3]), null, 'un code de secours ne sert qu’une fois');
  assert.equal(utiliserCodeSecours(empreintes, '123456'), null);
  assert.equal(adresseOtpauth({ emetteur: 'Lugh Esport', compte: 'chef', secret: 'ABCD' }), 'otpauth://totp/Lugh%20Esport:chef?secret=ABCD&issuer=Lugh%20Esport&algorithm=SHA1&digits=6&period=30');
});

test('activation : clé montrée une seule fois, premier code obligatoire, codes de secours, autres sessions fermées', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const c = await compteConnecte(sim, { identifiant: 'nova', acces: { valorant: 'joueur' } });
    const autre = await connecter(sim, 'nova');
    const prepa = await c.post('/api/auth/2fa/preparer');
    assert.equal(prepa.statut, 200);
    assert.match(prepa.json.secret, /^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/);
    assert.equal(prepa.json.emetteur, 'Lugh');
    assert.ok(Array.isArray(prepa.json.qr) && prepa.json.qr.length > 20, 'QR code dessiné par le serveur');
    const secret = prepa.json.secret.replace(/\s/g, '');
    assert.equal((await compteGlobal(sim, 'nova')).deuxFacteursEnAttente.secret, secret);
    assert.equal((await c.get('/api/auth/moi')).json.compte.deuxFacteurs.actif, false, 'pas active avant le premier code');

    const faux = await c.post('/api/auth/2fa/activer', { code: codeFaux(secret, sim.maintenant()) });
    assert.equal(faux.statut, 400);
    assert.equal(faux.json.erreur.code, 'code_2fa');
    const ok = await c.post('/api/auth/2fa/activer', { code: codeA(secret, sim.maintenant()) });
    assert.equal(ok.statut, 200);
    assert.equal(ok.json.codesSecours.length, 10);
    assert.ok(ok.json.codesSecours.every((x) => MOTIF_SECOURS.test(x)));
    assert.deepEqual(ok.json.compte.deuxFacteurs, { actif: true, depuis: sim.maintenant().toISOString(), codesRestants: 10 });
    assert.equal((await autre.get('/api/auth/moi')).statut, 401, 'les autres sessions sont fermées');
    assert.equal((await c.get('/api/auth/moi')).statut, 200);

    const stocke = await compteGlobal(sim, 'nova');
    assert.equal(stocke.deuxFacteurs.secret, secret);
    assert.equal(stocke.deuxFacteursEnAttente ?? null, null, 'effacé (null : écriture partielle)');
    assert.ok(!ok.json.codesSecours.some((x) => JSON.stringify(stocke).includes(x)), 'codes de secours jamais stockés en clair');
    assert.equal((await c.post('/api/auth/2fa/preparer')).statut, 409, 'déjà active');

    const admin = await adminPret(sim);
    for (const [qui, chemin] of [[c, '/api/auth/moi'], [admin, '/api/admin/comptes'], [admin, '/api/e/valorant/comptes'], [admin, '/api/e/valorant/export']]) {
      const r = await qui.get(chemin);
      assert.ok(!r.texte.includes(secret) && !r.texte.includes(stocke.deuxFacteurs.secours[0]), `${chemin} : la clé et les empreintes ne sortent jamais`);
    }
    assert.equal((await admin.get('/api/e/valorant/comptes')).json.comptes.find((x) => x.identifiant === 'nova').deuxFacteurs, true);

    const tard = await compteConnecte(sim, { identifiant: 'tardif', acces: { valorant: 'joueur' } });
    const p2 = (await tard.post('/api/auth/2fa/preparer')).json.secret.replace(/\s/g, '');
    sim.maintenant.avancer(11 * 60_000);
    const expire = await tard.post('/api/auth/2fa/activer', { code: codeA(p2, sim.maintenant()) });
    assert.equal(expire.statut, 409);
    assert.match(expire.json.erreur.message, /Préparation expirée/);
  } finally {
    await sim.arreter();
  }
});

test('connexion avec double authentification : code de l’application ou code de secours, chacun une seule fois', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const { secret, codes } = await compteAvec2fa(sim, { identifiant: 'protege', acces: { valorant: 'joueur' } });
    const connexion = (corps) => client(sim.base).post('/api/auth/connexion', { identifiant: 'protege', mdp: MDP, ...corps });

    const sansCode = await connexion({});
    assert.equal(sansCode.statut, 200, 'code manquant : réponse normale, sans erreur dans la console');
    assert.equal(sansCode.json.code2fa, true);
    assert.equal(sansCode.setCookie, null, 'le mot de passe seul ne suffit pas');
    const mauvaisMdp = await client(sim.base).post('/api/auth/connexion', { identifiant: 'protege', mdp: 'mauvais-mdp-xx', code: codeA(secret, sim.maintenant()) });
    assert.equal(mauvaisMdp.json.erreur.code, 'identifiants', 'le mot de passe est vérifié d’abord');
    const faux = await connexion({ code: codeFaux(secret, sim.maintenant()) });
    assert.equal(faux.statut, 401);
    assert.match(faux.json.erreur.message, /Code incorrect ou déjà utilisé/);

    const code = codeA(secret, sim.maintenant());
    const ok = await connexion({ code });
    assert.equal(ok.statut, 200);
    assert.match(ok.setCookie, /^lugh_session=/);
    assert.equal((await compteGlobal(sim, 'protege')).deuxFacteurs.dernierPas, pasDe(sim.maintenant().getTime()));
    assert.equal((await connexion({ code })).statut, 401, 'un code vu par-dessus l’épaule ne resert pas');
    sim.maintenant.avancer(30_000);
    assert.equal((await connexion({ code: codeA(secret, sim.maintenant()) })).statut, 200, 'code suivant');

    const secours = await connexion({ code: codes[0].toUpperCase() });
    assert.equal(secours.statut, 200);
    assert.equal(secours.json.compte.deuxFacteurs.codesRestants, 2);
    assert.equal((await connexion({ code: codes[0] })).statut, 401, 'code de secours déjà utilisé');
    const admin = await adminPret(sim);
    assert.ok((await admin.get('/api/admin/journal')).json.entrees.some((e) => e.action === 'connexion avec un code de secours'));

    const cible = await compteAvec2fa(sim, { identifiant: 'cible2fa', acces: {} });
    const essai = (c) => client(sim.base).post('/api/auth/connexion', { identifiant: 'cible2fa', mdp: MDP, code: c });
    for (let i = 0; i < 5; i += 1) assert.equal((await essai(codeFaux(cible.secret, sim.maintenant()))).statut, 401);
    assert.equal((await essai(codeA(cible.secret, sim.maintenant()))).statut, 429, 'un code faux compte comme un échec de connexion');
  } finally {
    await sim.arreter();
  }
});

test('codes de secours renouvelés avec un code ; désactivation avec mot de passe et code', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const c = await compteConnecte(sim, { identifiant: 'prudent', acces: { valorant: 'joueur' } });
    assert.equal((await c.post('/api/auth/2fa/codes', { code: '123456' })).statut, 409, 'pas encore active');
    assert.equal((await c.post('/api/auth/2fa/desactiver', { mdp: MDP, code: '123456' })).statut, 409);
    const { secret, codes } = await activer(sim, c);

    sim.maintenant.avancer(30_000);
    assert.equal((await c.post('/api/auth/2fa/codes', { code: codeFaux(secret, sim.maintenant()) })).statut, 400);
    const neufs = await c.post('/api/auth/2fa/codes', { code: codeA(secret, sim.maintenant()) });
    assert.equal(neufs.statut, 200);
    assert.equal(neufs.json.codesSecours.length, 10);
    assert.ok(!neufs.json.codesSecours.includes(codes[0]));
    const ancien = await client(sim.base).post('/api/auth/connexion', { identifiant: 'prudent', mdp: MDP, code: codes[0] });
    assert.equal(ancien.statut, 401, 'les anciens codes de secours ne marchent plus');

    sim.maintenant.avancer(30_000);
    const code = codeA(secret, sim.maintenant());
    assert.equal((await c.post('/api/auth/2fa/desactiver', { mdp: 'mauvais-mdp-xx', code })).statut, 400);
    assert.equal((await c.post('/api/auth/2fa/desactiver', { mdp: MDP, code: codeFaux(secret, sim.maintenant()) })).statut, 400);
    const off = await c.post('/api/auth/2fa/desactiver', { mdp: MDP, code: neufs.json.codesSecours[1] });
    assert.equal(off.statut, 200, 'un code de secours suffit aussi');
    assert.equal(off.json.compte.deuxFacteurs.actif, false);
    assert.equal((await client(sim.base).post('/api/auth/connexion', { identifiant: 'prudent', mdp: MDP })).statut, 200);
    assert.equal((await compteGlobal(sim, 'prudent')).deuxFacteurs ?? null, null);
  } finally {
    await sim.arreter();
  }
});

test('obligation de double authentification pour l’Administrateur général et les Responsables, décidée par l’Administrateur général', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const resp = await compteConnecte(sim, { identifiant: 'resp', acces: { valorant: ['responsable'] } });
    const joueur = await compteConnecte(sim, { identifiant: 'joueur', acces: { valorant: ['joueur'] } });
    const params = await admin.get('/api/admin/parametres');
    assert.equal(params.json.exiger2fa, false);
    assert.deepEqual(params.json.sansDeuxFacteurs.map((c) => c.identifiant).sort(), ['chef', 'resp'], 'Administrateur général et Responsables');

    assert.equal((await admin.put('/api/admin/parametres', { exiger2fa: 'oui' })).statut, 400);
    const sansSoi = await admin.put('/api/admin/parametres', { exiger2fa: true });
    assert.equal(sansSoi.statut, 409);
    assert.match(sansSoi.json.erreur.message, /Active d’abord la double authentification sur ton propre compte/);
    await activer(sim, admin);
    assert.deepEqual((await admin.put('/api/admin/parametres', { exiger2fa: true })).json.exiger2fa, true);
    assert.equal((await resp.put('/api/admin/parametres', { exiger2fa: false })).statut, 403);

    const bloque = await resp.get('/api/e/valorant/donnees');
    assert.equal(bloque.statut, 403);
    assert.equal(bloque.json.erreur.code, 'activer_2fa');
    assert.equal((await resp.get('/api/auth/session')).json.doitActiver2fa, true);
    assert.equal((await resp.get('/api/auth/moi')).json.doitActiver2fa, true);
    assert.equal((await joueur.get('/api/e/valorant/donnees')).statut, 200, 'un joueur n’est pas concerné');
    assert.equal((await joueur.get('/api/auth/session')).json.doitActiver2fa, false);

    await activer(sim, resp);
    assert.equal((await resp.get('/api/e/valorant/donnees')).statut, 200);
    sim.maintenant.avancer(30_000);
    const refus = await resp.post('/api/auth/2fa/desactiver', { mdp: MDP, code: '000000' });
    assert.equal(refus.statut, 409);
    assert.match(refus.json.erreur.message, /La structure exige la double authentification/);
    assert.deepEqual((await admin.get('/api/admin/parametres')).json.sansDeuxFacteurs, []);
    assert.ok((await admin.get('/api/admin/journal')).json.entrees.some((e) => e.action === 'double authentification exigée'));
  } finally {
    await sim.arreter();
  }
});

test('téléphone perdu : remise à zéro par l’Administrateur général, ou au démarrage avec LUGH_REINITIALISER_2FA', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const { compte } = await compteAvec2fa(sim, { identifiant: 'perdu', acces: { valorant: 'joueur' } });
    const joueur = await compteConnecte(sim, { identifiant: 'autre', acces: { valorant: 'joueur' } });
    assert.equal((await joueur.post(`/api/admin/comptes/${compte._id}/2fa/reinitialiser`)).statut, 403);
    assert.equal((await admin.post('/api/admin/comptes/pas-un-id/2fa/reinitialiser')).statut, 400);
    assert.equal((await admin.post('/api/admin/comptes/c-zzzzzzzzzz/2fa/reinitialiser')).statut, 404);
    const r = await admin.post(`/api/admin/comptes/${compte._id}/2fa/reinitialiser`);
    assert.equal(r.statut, 200);
    assert.equal(r.json.compte.deuxFacteurs.actif, false);
    assert.equal((await client(sim.base).post('/api/auth/connexion', { identifiant: 'perdu', mdp: MDP })).statut, 200, 'connexion sans code');
  } finally {
    await sim.arreter();
  }

  const fabrique = creerFabriqueMemoire();
  const env = { LUGH_MODE: 'simulation', LUGH_ADMIN_ID: 'chef', LUGH_ADMIN_MDP: MDP_ADMIN, ANTHROPIC_API_KEY: '' };
  const app1 = await creerApp({ config: lireConfig(env), fabrique, maintenant: horloge(), journal: silencieux, automatismes: false });
  await amorcer({ ...app1.services, journal: silencieux });
  const global = fabrique.base('lugh');
  const [chef] = await global.lister('comptes', { identifiant: 'chef' });
  await global.ecrire('comptes', { ...chef, deuxFacteurs: { secret: nouveauSecret(), dernierPas: -1, secours: [] } });
  app1.arreter();

  const config = lireConfig({ ...env, LUGH_REINITIALISER_2FA: 'Chef' });
  assert.ok(config.avertissements.some((a) => a.includes('LUGH_REINITIALISER_2FA')), 'rappel de retirer la variable');
  const app2 = await creerApp({ config, fabrique, maintenant: horloge(), journal: silencieux, automatismes: false });
  const [apres] = await global.lister('comptes', { identifiant: 'chef' });
  assert.equal(apres.deuxFacteurs, undefined);
  assert.ok((await global.lister('journal')).some((e) => e.action === 'double authentification réinitialisée au démarrage'));
  app2.arreter();
  const app3 = await creerApp({ config: lireConfig({ ...env, LUGH_REINITIALISER_2FA: 'inconnu' }), fabrique, maintenant: horloge(), journal: silencieux, automatismes: false });
  app3.arreter();
});
