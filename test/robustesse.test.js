// Robustesse (relecture L99) : écritures simultanées sur une même fiche, restaurations simultanées, remise à zéro
// de la double authentification à usage unique, adresse IP réelle derrière le proxy, motifs de profil dangereux.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, stratPour } from './simulation.js';
import { nouvelId } from '../shared/validation.js';
import { reinitialiserAuDemarrage } from '../src/auth/deuxfacteurs.js';
import { restaurer } from '../src/domaine/restauration.js';
import { ipClient } from '../src/http/outils.js';
import { validerReglagesJeu } from '../shared/jeux/reglages-jeu.js';
import { modele } from '../shared/jeux/index.js';

test('deux enregistrements partis de la même révision : un seul passe, l’autre reçoit 409', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const id = nouvelId('s');
    const cree = await admin.put(`/api/e/valorant/c/strats/${id}`, { valeur: stratPour('valorant', 'Base') });
    const revBase = cree.json.doc.rev;
    const [a, b] = await Promise.all([
      admin.put(`/api/e/valorant/c/strats/${id}`, { valeur: stratPour('valorant', 'Version A'), revBase }),
      admin.put(`/api/e/valorant/c/strats/${id}`, { valeur: stratPour('valorant', 'Version B'), revBase }),
    ]);
    assert.deepEqual([a.statut, b.statut].sort(), [200, 409]);
  } finally {
    await sim.arreter();
  }
});

test('deux restaurations du même jeu en même temps : la seconde est refusée, le point de restauration reste juste', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const sauvegarde = JSON.parse((await admin.get('/api/e/valorant/export')).texte);
    const e = sim.espace('valorant');
    const resultats = await Promise.allSettled([restaurer(sim.services, e, sauvegarde, null), restaurer(sim.services, e, sauvegarde, null)]);
    assert.deepEqual(resultats.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
    assert.match(resultats.find((r) => r.status === 'rejected').reason.message, /déjà en cours/);
    assert.equal((await admin.get('/api/e/valorant/restauration')).json.point.interrompue, false);
  } finally {
    await sim.arreter();
  }
});

test('LUGH_REINITIALISER_2FA : une seule remise à zéro par valeur, pas à chaque réveil du serveur', async () => {
  const sim = await demarrer({ jeux: [] });
  try {
    const global = sim.global;
    const [compte] = await global.lister('comptes');
    await global.ecrire('comptes', { ...compte, deuxFacteurs: { secret: 'ABCD', secours: [] } });
    const silence = { warn() {} };
    assert.equal(await reinitialiserAuDemarrage({ global, historique: sim.services.historique, identifiant: compte.identifiant, journal: silence }), true);
    assert.equal((await global.lire('comptes', compte._id)).deuxFacteurs, undefined);
    await global.ecrire('comptes', { ...(await global.lire('comptes', compte._id)), deuxFacteurs: { secret: 'EFGH', secours: [] } });
    assert.equal(await reinitialiserAuDemarrage({ global, historique: sim.services.historique, identifiant: compte.identifiant, journal: silence }), false, 'variable oubliée : rien ne se refait');
    assert.ok((await global.lire('comptes', compte._id)).deuxFacteurs, 'la nouvelle double authentification reste');
  } finally {
    await sim.arreter();
  }
});

test('adresse IP derrière le proxy : la dernière de X-Forwarded-For (le début peut être écrit par le client)', () => {
  const req = { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.equal(ipClient(req, true), '9.9.9.9');
  assert.equal(ipClient(req, false), '10.0.0.1');
});

test('format de profil : les motifs qui peuvent figer le navigateur sont refusés', () => {
  const avec = (format) => validerReglagesJeu(modele('valorant'), { profil: { actif: true, site: 'x', modele: 'https://x.example/{id}', format } }).ok;
  assert.equal(avec('^(a|aa)+$'), false);
  assert.equal(avec('^(\\w+)*$'), false);
  assert.equal(avec('^[^#]{2,16}#[A-Za-z0-9]{2,5}$'), true);
});
