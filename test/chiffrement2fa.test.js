// Clés de double authentification chiffrées (LUGH_CLE_2FA) : chiffrement, conversion des anciennes clés en clair,
// connexion avec une clé chiffrée, refus propre sans la bonne clé ; usage unique de LUGH_REINITIALISER_2FA par pose.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, client, creerCompte, compteGlobal, horloge, silencieux, MDP, MDP_ADMIN } from './simulation.js';
import { hotp, depuisBase32, pasDe, nouveauSecret, nouveauxCodesSecours } from '../src/auth/totp.js';
import { creerCoffre, estChiffre } from '../src/auth/chiffrement.js';
import { creerApp } from '../src/app.js';
import { creerFabriqueMemoire } from '../src/stockage/memoire.js';
import { lireConfig } from '../src/config.js';
import { amorcer } from '../src/domaine/amorcage.js';

const CLE = 'a1'.repeat(32);
const AUTRE_CLE = 'b2'.repeat(32);
const codeA = (secret, quand) => hotp(depuisBase32(secret), pasDe(quand.getTime()));
const ENV = { LUGH_MODE: 'simulation', LUGH_ADMIN_ID: 'chef', LUGH_ADMIN_MDP: MDP_ADMIN, ANTHROPIC_API_KEY: '' };

async function lancer(fabrique, env = {}) {
  const config = lireConfig({ ...ENV, ...env });
  const app = await creerApp({ config, fabrique, maintenant: horloge(), journal: silencieux, automatismes: false });
  return { app, config };
}

test('coffre : chiffrement AES-256-GCM versionné, IV aléatoire, clé absente ou fausse → null', () => {
  const coffre = creerCoffre(CLE);
  const secret = nouveauSecret();
  const a = coffre.chiffrer(secret);
  const b = coffre.chiffrer(secret);
  assert.match(a, /^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.ok(estChiffre(a) && !a.includes(secret));
  assert.notEqual(a, b, 'IV différent à chaque chiffrement');
  assert.equal(coffre.dechiffrer(a), secret);
  assert.equal(coffre.chiffrer(a), a, 'jamais chiffrée deux fois');
  assert.equal(coffre.dechiffrer(secret), secret, 'ancienne clé en clair lue telle quelle');
  assert.equal(creerCoffre(AUTRE_CLE).dechiffrer(a), null, 'clé fausse');
  assert.equal(creerCoffre('').dechiffrer(a), null, 'clé absente');
  assert.equal(creerCoffre('').chiffrer(secret), secret, 'sans clé : en clair, comme avant');
  const altere = `${a.slice(0, -4)}AAA=`;
  assert.equal(coffre.dechiffrer(altere), null, 'chiffré modifié refusé');
  assert.equal(coffre.dechiffrer('v1:pas:du:base64!'), null);
});

test('configuration : LUGH_CLE_2FA invalide refusée, absente signalée en production', () => {
  assert.ok(lireConfig({ ...ENV, LUGH_CLE_2FA: 'trop-courte' }).erreurs.some((e) => e.includes('LUGH_CLE_2FA')));
  const ok = lireConfig({ ...ENV, LUGH_CLE_2FA: CLE.toUpperCase() });
  assert.deepEqual(ok.erreurs, []);
  assert.equal(ok.cle2fa, CLE);
  const prod = lireConfig({ MONGODB_URI: 'mongodb://x', LUGH_ADMIN_ID: 'chef', LUGH_ADMIN_MDP: MDP_ADMIN });
  assert.ok(prod.avertissements.some((a) => a.includes('LUGH_CLE_2FA absente')));
  assert.ok(!lireConfig({ MONGODB_URI: 'mongodb://x', LUGH_CLE_2FA: CLE }).avertissements.some((a) => a.includes('LUGH_CLE_2FA')));
});

test('conversion au démarrage : plus aucune clé en clair dans la base, alerte si la clé change', async () => {
  const fabrique = creerFabriqueMemoire();
  const premier = await lancer(fabrique);
  await amorcer({ ...premier.app.services, journal: silencieux });
  const global = fabrique.base('lugh');
  const [chef] = await global.lister('comptes', { identifiant: 'chef' });
  const secret = nouveauSecret();
  const enAttente = nouveauSecret();
  await global.ecrire('comptes', { ...chef, deuxFacteurs: { secret, dernierPas: -1, secours: [] }, deuxFacteursEnAttente: { secret: enAttente, expire: '2099-01-01T00:00:00.000Z' } });
  premier.app.arreter();

  const deuxieme = await lancer(fabrique, { LUGH_CLE_2FA: CLE });
  const brut = JSON.stringify(await global.lister('comptes'));
  assert.ok(!brut.includes(secret) && !brut.includes(enAttente), 'aucune clé en clair après conversion');
  const [apres] = await global.lister('comptes', { identifiant: 'chef' });
  assert.ok(estChiffre(apres.deuxFacteurs.secret) && estChiffre(apres.deuxFacteursEnAttente.secret));
  assert.equal(creerCoffre(CLE).dechiffrer(apres.deuxFacteurs.secret), secret);
  assert.ok(!deuxieme.config.avertissements.some((a) => a.includes('illisible')));
  deuxieme.app.arreter();

  for (const env of [{}, { LUGH_CLE_2FA: AUTRE_CLE }]) {
    const sans = await lancer(fabrique, env);
    assert.ok(sans.config.avertissements.some((a) => a.startsWith('2 clé(s) de double authentification illisible(s)')), JSON.stringify(env));
    sans.app.arreter();
  }
  const [inchange] = await global.lister('comptes', { identifiant: 'chef' });
  assert.equal(inchange.deuxFacteurs.secret, apres.deuxFacteurs.secret, 'une clé illisible n’est jamais écrasée');
});

test('connexion et activation avec LUGH_CLE_2FA : la clé reste chiffrée, l’ancienne clé en clair est convertie', async () => {
  const sim = await demarrer({ env: { LUGH_CLE_2FA: CLE } });
  try {
    // Compte resté en clair (écrit après le démarrage) : converti à sa première connexion.
    const secret = nouveauSecret();
    const compte = await creerCompte(sim, { identifiant: 'ancien', acces: {} });
    await sim.global.ecrire('comptes', { ...compte, deuxFacteurs: { secret, dernierPas: -1, secours: nouveauxCodesSecours(2).empreintes } });
    const c = client(sim.base);
    const r = await c.post('/api/auth/connexion', { identifiant: 'ancien', mdp: MDP, code: codeA(secret, sim.maintenant()) });
    assert.equal(r.statut, 200, r.texte);
    const stocke = await compteGlobal(sim, 'ancien');
    assert.ok(estChiffre(stocke.deuxFacteurs.secret) && !JSON.stringify(stocke).includes(secret));

    // Nouvelle activation : clé en attente puis clé active chiffrées ; la connexion suivante marche.
    const admin = await adminPret(sim);
    const prepa = await admin.post('/api/auth/2fa/preparer');
    const neuf = prepa.json.secret.replace(/\s/g, '');
    assert.ok(estChiffre((await compteGlobal(sim, 'chef')).deuxFacteursEnAttente.secret));
    assert.equal((await admin.post('/api/auth/2fa/activer', { code: codeA(neuf, sim.maintenant()) })).statut, 200);
    const chef = await compteGlobal(sim, 'chef');
    assert.ok(estChiffre(chef.deuxFacteurs.secret) && !JSON.stringify(chef).includes(neuf));
    sim.maintenant.avancer(60_000);
    const re = await client(sim.base).post('/api/auth/connexion', { identifiant: 'chef', mdp: sim.mdpAdmin, code: codeA(neuf, sim.maintenant()) });
    assert.equal(re.statut, 200, re.texte);
    sim.maintenant.avancer(30_000);
    const codes = await admin.post('/api/auth/2fa/codes', { code: codeA(neuf, sim.maintenant()) });
    assert.equal(codes.statut, 200, codes.texte);
    assert.ok(estChiffre((await compteGlobal(sim, 'chef')).deuxFacteurs.secret), 'toujours chiffrée après renouvellement');
  } finally {
    await sim.arreter();
  }
});

test('clé chiffrée sans LUGH_CLE_2FA (ou avec une autre) : connexion refusée proprement, pas de plantage', async () => {
  for (const env of [{}, { LUGH_CLE_2FA: AUTRE_CLE }]) {
    const sim = await demarrer({ env });
    try {
      const secret = nouveauSecret();
      const compte = await creerCompte(sim, { identifiant: 'bloque', acces: {} });
      await sim.global.ecrire('comptes', { ...compte, deuxFacteurs: { secret: creerCoffre(CLE).chiffrer(secret), dernierPas: -1, secours: [] } });
      const r = await client(sim.base).post('/api/auth/connexion', { identifiant: 'bloque', mdp: MDP, code: codeA(secret, sim.maintenant()) });
      assert.equal(r.statut, 503, JSON.stringify(env));
      assert.match(r.json.erreur.message, /LUGH_CLE_2FA/);
      assert.equal((await client(sim.base).get('/api/sante')).statut, 200, 'le serveur répond toujours');
    } finally {
      await sim.arreter();
    }
  }
});

test('LUGH_REINITIALISER_2FA : une fois par pose ; retirée puis reposée, elle resert', async () => {
  const fabrique = creerFabriqueMemoire();
  const global = fabrique.base('lugh');
  const premier = await lancer(fabrique);
  await amorcer({ ...premier.app.services, journal: silencieux });
  premier.app.arreter();
  const poser2fa = async () => {
    const [chef] = await global.lister('comptes', { identifiant: 'chef' });
    await global.ecrire('comptes', { ...chef, deuxFacteurs: { secret: nouveauSecret(), dernierPas: -1, secours: [] } });
  };
  const aLa2fa = async () => !!(await global.lister('comptes', { identifiant: 'chef' }))[0].deuxFacteurs;

  await poser2fa();
  (await lancer(fabrique, { LUGH_REINITIALISER_2FA: 'chef' })).app.arreter();
  assert.equal(await aLa2fa(), false, 'première pose : remise à zéro');

  await poser2fa();
  const encore = await lancer(fabrique, { LUGH_REINITIALISER_2FA: 'chef' });
  // Un changement des paramètres de la structure ne doit pas effacer la note d'usage unique.
  await encore.app.services.parametres.ecrire({ exiger2fa: false }, null);
  encore.app.arreter();
  (await lancer(fabrique, { LUGH_REINITIALISER_2FA: 'chef' })).app.arreter();
  assert.equal(await aLa2fa(), true, 'variable toujours posée : les redémarrages suivants ne refont rien');

  (await lancer(fabrique)).app.arreter();
  assert.equal((await global.lire('parametres', 'structure')).reinitialisation2fa, undefined, 'variable retirée : note effacée');
  (await lancer(fabrique, { LUGH_REINITIALISER_2FA: 'chef' })).app.arreter();
  assert.equal(await aLa2fa(), false, 'nouvelle pose : nouvelle remise à zéro');
});
