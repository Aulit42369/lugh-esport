// Écritures simultanées : une écriture partielle (« lu », visite) n'écrase jamais une autre modification de la même fiche ;
// suppression et enregistrement d'une même fiche passent un par un ; la semaine automatique ne remplace jamais une semaine.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, compteConnecte, attendreQue, pause } from './simulation.js';
import { creerStockageMemoire } from '../src/stockage/memoire.js';
import { creerDepot } from '../src/domaine/depot.js';
import { creerAutomatismes } from '../src/domaine/automatismes.js';

// Retient la première écriture dans une collection jusqu'à ouverture de la porte : la requête a déjà lu la fiche,
// une autre requête passe pendant ce temps, puis l'écriture retenue repart (avec ce qu'elle avait lu).
function retenirEcriture(stockage, coll) {
  let ouvrir;
  const porte = new Promise((ok) => { ouvrir = ok; });
  const etat = { arrivee: false, ouvrir: () => ouvrir() };
  for (const methode of ['ecrire', 'modifier']) {
    const original = stockage[methode];
    stockage[methode] = async (c, ...reste) => {
      if (c === coll && !etat.arrivee) {
        etat.arrivee = true;
        await porte;
      }
      return original(c, ...reste);
    };
  }
  return etat;
}

test('écriture partielle : seuls les chemins donnés changent, rien n’est créé, chemin MongoDB invalide refusé', async () => {
  const st = creerStockageMemoire();
  await st.ecrire('annonces', { _id: 'a', titre: 'T', lus: { x: '1' } });
  assert.equal(await st.modifier('annonces', 'a', { 'lus.y': '2', 'visites.lol.dernier': '3' }), true);
  assert.deepEqual(await st.lire('annonces', 'a'), { _id: 'a', titre: 'T', lus: { x: '1', y: '2' }, visites: { lol: { dernier: '3' } } });
  assert.equal(await st.modifier('annonces', 'absente', { titre: 'X' }), false);
  assert.equal(await st.lire('annonces', 'absente'), null, 'pas de création');
  for (const chemin of ['$set', 'lus.', '.x', 'a..b', 'lus.$x']) await assert.rejects(st.modifier('annonces', 'a', { [chemin]: 1 }), /Chemin invalide/);
  await assert.rejects(st.modifier('annonces', 'a', { 'titre.x': 1 }), /Chemin invalide/, 'pas dans un texte');
});

async function annonceEtDeuxLecteurs() {
  const sim = await demarrer({ jeux: ['valorant'] });
  const admin = await adminPret(sim);
  const a = await compteConnecte(sim, { identifiant: 'aaa', nomAffiche: 'A', acces: { valorant: 'joueur' } });
  const b = await compteConnecte(sim, { identifiant: 'bbb', nomAffiche: 'B', acces: { valorant: 'joueur' } });
  const id = (await admin.post('/api/admin/annonces', { titre: 'Scrim', texte: 'Jeudi 20 h.', discord: false })).json.annonce._id;
  return { sim, admin, a, b, id };
}

test('deux « lu » simultanés sur la même annonce : les deux sont gardés', async () => {
  const { sim, a, b, id } = await annonceEtDeuxLecteurs();
  try {
    const porte = retenirEcriture(sim.global, 'annonces');
    const luA = a.post(`/api/annonces/${id}/lu`);
    await attendreQue(() => porte.arrivee, { message: 'lu de A retenu' });
    assert.equal((await b.post(`/api/annonces/${id}/lu`)).statut, 200);
    porte.ouvrir();
    assert.equal((await luA).statut, 200);
    assert.deepEqual(Object.keys((await sim.global.lire('annonces', id)).lus).sort(), [a.id, b.id].sort());
  } finally {
    await sim.arreter();
  }
});

test('un « lu » simultané n’annule pas la correction de l’annonce, et la correction n’efface pas le « lu »', async () => {
  const { sim, admin, a, b, id } = await annonceEtDeuxLecteurs();
  try {
    const porte = retenirEcriture(sim.global, 'annonces');
    const lu = a.post(`/api/annonces/${id}/lu`);
    await attendreQue(() => porte.arrivee, { message: 'lu retenu' });
    assert.equal((await admin.put(`/api/admin/annonces/${id}`, { titre: 'Scrim (21 h)', texte: 'Jeudi 21 h.' })).statut, 200);
    porte.ouvrir();
    assert.equal((await lu).statut, 200);
    const apres = await sim.global.lire('annonces', id);
    assert.deepEqual([apres.titre, apres.texte, Object.keys(apres.lus)], ['Scrim (21 h)', 'Jeudi 21 h.', [a.id]]);

    // Correction pendant un « lu » de B : le « lu » de B reste ; « relire » remet ensuite tout à zéro.
    const porte2 = retenirEcriture(sim.global, 'annonces');
    const correction = admin.put(`/api/admin/annonces/${id}`, { titre: 'Scrim (22 h)', texte: 'Jeudi 22 h.' });
    await attendreQue(() => porte2.arrivee, { message: 'correction retenue' });
    assert.equal((await b.post(`/api/annonces/${id}/lu`)).statut, 200);
    porte2.ouvrir();
    assert.equal((await correction).statut, 200);
    assert.deepEqual(Object.keys((await sim.global.lire('annonces', id)).lus).sort(), [a.id, b.id].sort());
    assert.equal((await admin.put(`/api/admin/annonces/${id}`, { titre: 'Scrim', texte: 'Annulé.', relire: true })).statut, 200);
    assert.deepEqual((await sim.global.lire('annonces', id)).lus, {});
  } finally {
    await sim.arreter();
  }
});

test('une visite simultanée n’annule pas la désactivation du compte ni le retrait d’un accès', async () => {
  const sim = await demarrer({ jeux: ['valorant', 'lol'] });
  try {
    const admin = await adminPret(sim);
    const j = await compteConnecte(sim, { identifiant: 'joueuse', nomAffiche: 'J', acces: { valorant: 'joueur', lol: 'joueur' } });
    const porte = retenirEcriture(sim.global, 'comptes');
    const visite = j.get('/api/e/valorant/donnees');
    await attendreQue(() => porte.arrivee, { message: 'visite retenue' });
    const corps = { nomAffiche: 'J', admin: false, actif: false, acces: { valorant: { metiers: ['joueur'] } } };
    assert.equal((await admin.put(`/api/admin/comptes/${j.id}`, corps)).statut, 200);
    porte.ouvrir();
    assert.equal((await visite).statut, 200);
    const c = await sim.global.lire('comptes', j.id);
    assert.equal(c.actif, false, 'toujours désactivé');
    assert.deepEqual(Object.keys(c.acces), ['valorant'], 'accès à lol toujours retiré');
    assert.ok(c.visites?.valorant?.dernier, 'la visite est notée quand même');
  } finally {
    await sim.arreter();
  }
});

test('dépôt : une suppression attend l’enregistrement en cours de la même fiche (même verrou)', async () => {
  const stockage = creerStockageMemoire();
  const depot = creerDepot({ stockage, journal: { error() {} } });
  await depot.initialiser();
  await depot.enregistrer('strats', 's-aaaaaaaaaa', { nom: 'A' }, null);
  const lire = stockage.lire;
  stockage.lire = async (...args) => { const d = await lire(...args); await pause(20); return d; };
  // Enregistrement lent puis suppression : sans verrou, la suppression passait avant et l'enregistrement recréait la fiche.
  const ecriture = depot.enregistrer('strats', 's-aaaaaaaaaa', { nom: 'A2' }, null);
  const suppression = depot.supprimer('strats', 's-aaaaaaaaaa', null);
  await Promise.all([ecriture, suppression]);
  assert.equal(await depot.lire('strats', 's-aaaaaaaaaa'), null, 'supprimée en dernier, comme demandé');
  const { suppressions } = await depot.depuis(0);
  assert.equal(suppressions.length, 1);
});

test('semaine automatique : créée seulement si elle n’existe pas, jamais par-dessus une semaine écrite entre-temps', async () => {
  const stockage = creerStockageMemoire();
  const depot = creerDepot({ stockage, journal: { error() {} } });
  await depot.initialiser();
  await depot.enregistrer('planning', 'modele', { blocs: [{ id: 'b-aaaaaaaaaa', jour: 1, debut: '20:00', fin: '22:00', type: 'scrim' }] }, null);
  const t = new Date('2026-10-21T10:00:00Z'); // semaine 2026-W43
  const erreurs = [];
  const auto = () => creerAutomatismes({
    depot, stockage, config: { fuseau: 'Europe/Paris', claude: { cle: '' } }, actualisation: {}, maintenant: () => t, journal: { error: (...x) => erreurs.push(x) },
  });
  // Un coach écrit la semaine juste après le contrôle « elle n'existe pas » de l'automatisme.
  const lire = stockage.lire;
  let coach = null;
  stockage.lire = async (coll, id) => {
    const d = await lire(coll, id);
    if (coll === 'planning' && id === '2026-W43' && !d && !coach) {
      coach = depot.enregistrer('planning', '2026-W43', { blocs: [], note: 'du coach', ebauche: '' }, null);
      await coach;
    }
    return d;
  };
  auto().verifier();
  await attendreQue(() => coach, { message: 'semaine du coach écrite' });
  await pause(30);
  assert.equal((await lire('planning', '2026-W43')).note, 'du coach', 'semaine du coach gardée');
  assert.deepEqual(erreurs, [], 'le refus 409 est ignoré sans erreur');
  stockage.lire = lire;

  await depot.supprimer('planning', '2026-W43', null);
  auto().verifier();
  await attendreQue(async () => (await stockage.lire('planning', '2026-W43'))?.blocs?.length === 1, { message: 'semaine créée' });
});
