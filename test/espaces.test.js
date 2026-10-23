// Espaces de jeu : activation depuis le catalogue, désactivation, « Autre jeu », plafond de 15 jeux ;
// séparation stricte des accès, métiers par jeu ; comptes gérés par l'Administrateur général et par le Responsable du jeu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrer, adminPret, compteConnecte, creerCompte, connecter, connecterEtChanger, compteGlobal, activerJeu, stratPour, MDP,
} from './simulation.js';
import { ORDRE } from '../shared/jeux/index.js';
import { nouvelId } from '../shared/validation.js';

const MOTIF_MDP_TEMPORAIRE = /^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/;

// Un serveur avec l'Administrateur général prêt et des jeux activés par l'API.
async function monde({ jeux = ['valorant', 'lol'] } = {}) {
  const sim = await demarrer();
  const admin = await adminPret(sim);
  for (const modele of jeux) assert.equal((await activerJeu(admin, modele)).id, modele);
  return { sim, admin };
}

async function journal(admin, filtre = {}) {
  const entrees = (await admin.get('/api/admin/journal')).json.entrees;
  return entrees.filter((e) => Object.entries(filtre).every(([k, v]) => e[k] === v));
}

// ——— Jeux ———

test('activer un jeu du catalogue prépare son espace : base, roster, méta, maps, semaine type', async () => {
  const sim = await demarrer();
  const admin = await adminPret(sim);
  try {
    const liste = await admin.get('/api/admin/jeux');
    assert.deepEqual(liste.json.catalogue.map((m) => m.id), ORDRE);
    assert.deepEqual(liste.json.jeux, []);
    assert.equal(liste.json.max, 15);

    const r = await admin.post('/api/admin/jeux', { modele: 'valorant' });
    assert.equal(r.statut, 201);
    assert.deepEqual(r.json.jeu, { id: 'valorant', nom: 'Valorant', modele: 'valorant', couleur: 'corail', actif: true });
    assert.deepEqual(r.json.jeux.map(({ id, actif, ordre, comptes }) => ({ id, actif, ordre, comptes })), [{ id: 'valorant', actif: true, ordre: 1, comptes: 0 }]);
    assert.ok(sim.fabrique.noms().includes('lugh_valorant'), 'une base par jeu');

    const d = (await admin.get('/api/e/valorant/donnees')).json;
    assert.deepEqual(d.jeu, { id: 'valorant', modele: 'valorant', nom: 'Valorant', court: 'VAL', couleur: 'corail', actif: true });
    assert.deepEqual(d.metiers, ['responsable']);
    const joueurs = d.donnees.membres.filter((m) => m.type === 'joueur');
    assert.deepEqual(joueurs.filter((m) => m.statut === 'titulaire').map((m) => m.roleJeu), ['duelliste', 'initiateur', 'controleur', 'sentinelle', 'flex']);
    assert.deepEqual(joueurs.filter((m) => m.statut === 'remplacant').map((m) => m.roleJeu), ['flex', 'flex']);
    assert.deepEqual(d.donnees.membres.filter((m) => m.type === 'staff').map((m) => m.fonction).sort(), ['analyste', 'headcoach']);
    const [meta] = d.donnees.meta;
    assert.deepEqual([meta.patch, meta.schema, meta.statut, meta.declencheur], ['13.08', 2, 'ok', 'initial']);
    assert.deepEqual(d.donnees.mapsEquipe.map((m) => m._id).sort(), [...meta.mapPool].sort());
    const modele = d.donnees.planning.find((p) => p._id === 'modele');
    assert.equal(modele.ebauche, 'progression');
    assert.ok(modele.blocs.length > 5);
    assert.deepEqual(d.donnees.equipe.map((x) => x._id), ['profil']);
    assert.equal((await journal(admin, { action: 'jeu créé', jeu: 'valorant' })).length, 1);

    // Chaque modèle prépare ce qui a du sens pour lui.
    for (const modeleId of ['lol', 'rl', 'apex']) assert.equal((await admin.post('/api/admin/jeux', { modele: modeleId })).statut, 201);
    const fiches = async (jeu) => (await admin.get(`/api/e/${jeu}/donnees`)).json.donnees;
    const lol = await fiches('lol');
    assert.deepEqual(lol.mapsEquipe.map((m) => m._id), ['general'], 'LoL : une compo générale, pas de map pool');
    assert.deepEqual(lol.membres.filter((m) => m.statut === 'titulaire').map((m) => m.roleJeu), ['top', 'jungle', 'mid', 'adc', 'support']);
    const rl = await fiches('rl');
    assert.deepEqual(rl.mapsEquipe, [], 'Rocket League : ni maps ni personnages');
    assert.equal(rl.membres.filter((m) => m.type === 'joueur').length, 4, '3 titulaires et 1 remplaçant');
    assert.deepEqual((await fiches('apex')).mapsEquipe.map((m) => m._id).sort(), ['edistrict', 'stormpoint', 'worldsedge']);
  } finally {
    await sim.arreter();
  }
});

test('désactiver puis réactiver un jeu garde toutes ses données', async () => {
  const { sim, admin } = await monde({ jeux: ['valorant'] });
  try {
    const id = nouvelId('s');
    assert.equal((await admin.put(`/api/e/valorant/c/strats/${id}`, { valeur: stratPour('valorant', 'À garder') })).statut, 200);
    const membresAvant = (await sim.membres('valorant')).length;

    const off = await admin.put('/api/admin/jeux/valorant', { actif: false });
    assert.equal(off.statut, 200);
    assert.equal(off.json.jeux[0].actif, false);
    const on = await admin.post('/api/admin/jeux', { modele: 'valorant' });
    assert.equal(on.statut, 200, 'réactivation : pas une création');
    assert.equal(on.json.jeu.actif, true);
    assert.equal((await sim.espace('valorant').stockage.lire('strats', id)).nom, 'À garder');
    assert.equal((await sim.membres('valorant')).length, membresAvant, 'aucun poste recréé');

    // Activer un jeu déjà actif ne fait rien et n'est pas noté comme une réactivation.
    assert.equal((await admin.post('/api/admin/jeux', { modele: 'valorant' })).statut, 200);
    assert.equal((await journal(admin, { action: 'jeu désactivé', jeu: 'valorant' })).length, 1);
    assert.equal((await journal(admin, { action: 'jeu réactivé', jeu: 'valorant' })).length, 1);
  } finally {
    await sim.arreter();
  }
});

test('suppression définitive : seulement un jeu désactivé, nom tapé ; base, accès, annonces et point de restauration nettoyés', async () => {
  const { sim, admin } = await monde({ jeux: ['valorant', 'lol'] });
  try {
    const id = nouvelId('s');
    await admin.put(`/api/e/lol/c/strats/${id}`, { valeur: stratPour('lol', 'Disparaîtra') });
    const seul = await creerCompte(sim, { identifiant: 'seullol', acces: { lol: ['joueur'] } });
    const deux = await creerCompte(sim, { identifiant: 'deuxjeux', acces: { lol: ['coach'], valorant: ['coach'] } });
    const pourLol = (await admin.post('/api/admin/annonces', { titre: 'LoL seul', texte: 'x', jeux: ['lol'], discord: false })).json;
    const pourDeux = (await admin.post('/api/admin/annonces', { titre: 'Les deux', texte: 'x', jeux: ['lol', 'valorant'], discord: false })).json;
    const pourTous = (await admin.post('/api/admin/annonces', { titre: 'Tous', texte: 'x', jeux: [], discord: false })).json;
    await sim.global.ecrire('restaurations', { _id: 'lol', jeu: 'lol', type: 'entete' });
    const base = `${sim.config.base}_lol`;
    assert.ok(sim.fabrique.noms().includes(base));

    assert.equal((await admin.post('/api/admin/jeux/lol/supprimer', { confirmation: 'League of Legends' })).statut, 409, 'actif : refusé');
    await admin.put('/api/admin/jeux/lol', { actif: false });
    const faux = await admin.post('/api/admin/jeux/lol/supprimer', { confirmation: 'LoL' });
    assert.equal(faux.statut, 400);
    assert.match(faux.json.erreur.details[0].message, /League of Legends/);
    assert.equal((await admin.post('/api/admin/jeux/inconnu/supprimer', { confirmation: 'x' })).statut, 404);

    const ok = await admin.post('/api/admin/jeux/lol/supprimer', { confirmation: '  league of  legends ' });
    assert.equal(ok.statut, 200);
    assert.deepEqual(ok.json.bilan, { acces: 2, sansJeu: 1, annoncesModifiees: 1, annoncesSupprimees: 1 });
    assert.deepEqual(ok.json.jeux.map((j) => j.id), ['valorant']);
    assert.equal(sim.espace('lol'), null);
    assert.ok(!sim.fabrique.noms().includes(base), 'base du jeu effacée');
    assert.equal(await sim.global.lire('espaces', 'lol'), null);
    assert.equal(await sim.global.lire('restaurations', 'lol'), null);
    assert.deepEqual(Object.keys((await compteGlobal(sim, 'seullol')).acces), []);
    assert.deepEqual(Object.keys((await compteGlobal(sim, 'deuxjeux')).acces), ['valorant']);
    assert.equal(await sim.global.lire('annonces', pourLol.annonce._id), null, 'annonce qui ne visait que ce jeu supprimée');
    assert.deepEqual((await sim.global.lire('annonces', pourDeux.annonce._id)).jeux, ['valorant']);
    assert.deepEqual((await sim.global.lire('annonces', pourTous.annonce._id)).jeux, []);
    assert.equal((await admin.get('/api/e/lol/donnees')).statut, 404);
    assert.equal((await journal(admin, { action: 'jeu supprimé définitivement' })).length, 1);
    assert.ok(seul && deux);

    // Recréé plus tard : un espace neuf, sans les anciennes données.
    assert.equal((await admin.post('/api/admin/jeux', { modele: 'lol' })).statut, 201);
    assert.equal(await sim.espace('lol').stockage.lire('strats', id), null);
  } finally {
    await sim.arreter();
  }
});

test('un jeu désactivé disparaît pour tous sauf l’Administrateur général, comme un jeu inconnu', async () => {
  const { sim, admin } = await monde();
  try {
    const joueur = await compteConnecte(sim, { identifiant: 'nova', acces: { valorant: 'joueur', lol: 'joueur' } });
    const inconnu = await joueur.get('/api/e/inconnu/donnees');
    assert.equal(inconnu.statut, 404);
    await admin.put('/api/admin/jeux/valorant', { actif: false });

    for (const r of [
      await joueur.get('/api/e/valorant/donnees'),
      await joueur.get('/api/e/valorant/sync?rev=0'),
      await joueur.post('/api/e/valorant/absences', { valeur: {} }),
    ]) {
      assert.equal(r.statut, 404);
      assert.deepEqual(r.json, inconnu.json, 'même réponse que pour un jeu qui n’existe pas');
    }
    assert.deepEqual((await joueur.get('/api/auth/moi')).json.jeux.map((j) => j.id), ['lol']);
    const vu = await admin.get('/api/e/valorant/donnees');
    assert.equal(vu.statut, 200);
    assert.equal(vu.json.jeu.actif, false);

    await admin.put('/api/admin/jeux/valorant', { actif: true });
    assert.equal((await joueur.get('/api/e/valorant/donnees')).statut, 200);
  } finally {
    await sim.arreter();
  }
});

test('« Autre jeu » : identifiant tiré du nom et définitif ; identifiants réservés, pris ou invalides refusés', async () => {
  const { sim, admin } = await monde({ jeux: ['valorant'] });
  try {
    const r = await admin.post('/api/admin/jeux', { modele: 'autre', nom: '  Marvel   Rivals ' });
    assert.equal(r.statut, 201);
    assert.deepEqual(r.json.jeu, { id: 'marvelrivals', nom: 'Marvel Rivals', modele: 'autre', couleur: 'sable', actif: true });
    assert.equal(r.json.jeux.find((j) => j.id === 'marvelrivals').court, 'MARV');
    assert.ok(sim.fabrique.noms().includes('lugh_marvelrivals'));
    const accents = await admin.post('/api/admin/jeux', { modele: 'autre', nom: 'Échecs Été 2' });
    assert.equal(accents.json.jeu.id, 'echecsete2');

    const refus = [
      [{ modele: 'autre', nom: 'Valorant' }, 409, /réservé au modèle Valorant/],
      [{ modele: 'autre', nom: 'Mon CS', id: 'cs2' }, 409, /réservé/],
      [{ modele: 'autre', nom: 'Marvel Rivals' }, 409, /existe déjà/],
      [{ modele: 'autre', nom: 'X' }, 400, null],
      [{ modele: 'autre', nom: '!!!' }, 400, null],
      [{ modele: 'autre', nom: 'Jeu', id: 'Avec-Majuscules' }, 400, null],
      [{ modele: 'tetris' }, 400, /Modèle de jeu inconnu/],
      [{ modele: '__proto__' }, 400, /Modèle de jeu inconnu/],
      [{}, 400, /Modèle de jeu inconnu/],
    ];
    for (const [corps, statut, message] of refus) {
      const x = await admin.post('/api/admin/jeux', corps);
      assert.equal(x.statut, statut, JSON.stringify(corps));
      if (message) assert.match(x.json.erreur.message, message);
    }

    // Seul le nom change ensuite : l'identifiant (nom de la base) reste.
    const renomme = await admin.put('/api/admin/jeux/marvelrivals', { nom: 'Marvel Rivals FR', court: 'MRFR' });
    assert.deepEqual(renomme.json.jeux.find((j) => j.id === 'marvelrivals').nom, 'Marvel Rivals FR');
    const d = (await admin.get('/api/e/marvelrivals/donnees')).json;
    assert.deepEqual([d.jeu.nom, d.jeu.court, d.definition.nom, d.definition.modele], ['Marvel Rivals FR', 'MRFR', 'Marvel Rivals FR', 'autre']);
    assert.equal((await admin.put('/api/admin/jeux/inexistant', { nom: 'X' })).statut, 404);
  } finally {
    await sim.arreter();
  }
});

test('couleur de chaque jeu : celle de son modèle, une teinte libre pour « Autre jeu », changeable dans la palette seulement', async () => {
  const { sim, admin } = await monde();
  try {
    assert.deepEqual((await admin.get('/api/admin/jeux')).json.jeux.map((j) => [j.id, j.couleur]), [['valorant', 'corail'], ['lol', 'sarcelle']]);
    assert.equal((await admin.post('/api/admin/jeux', { modele: 'autre', nom: 'Marvel Rivals' })).json.jeu.couleur, 'sable', 'première teinte qu’aucun modèle n’utilise');

    const couleurDe = async (id) => (await admin.get('/api/admin/jeux')).json.jeux.find((j) => j.id === id).couleur;
    assert.equal((await admin.put('/api/admin/jeux/lol', { couleur: 'violet' })).statut, 200);
    assert.equal(await couleurDe('lol'), 'violet');
    for (const hors of ['#ff00ff', 'fuchsia', '', 42]) await admin.put('/api/admin/jeux/lol', { couleur: hors });
    assert.equal(await couleurDe('lol'), 'violet', 'hors palette : ignorée');
    const d = (await admin.get('/api/e/lol/donnees')).json;
    assert.deepEqual([d.jeu.couleur, d.definition.couleur], ['violet', 'violet']);
    assert.equal((await admin.get('/api/auth/moi')).json.jeux.find((j) => j.id === 'lol').couleur, 'violet');

    // Teinte du modèle déjà prise : le nouveau jeu reçoit une teinte libre.
    await admin.put('/api/admin/jeux/valorant', { couleur: 'azur' });
    assert.equal((await admin.post('/api/admin/jeux', { modele: 'rl' })).json.jeu.couleur, 'menthe');
    await admin.put('/api/admin/jeux/rl', { actif: false });
    assert.equal((await admin.post('/api/admin/jeux', { modele: 'rl' })).json.jeu.couleur, 'menthe', 'réactivé avec sa couleur');
  } finally {
    await sim.arreter();
  }
});

test('15 jeux au plus (limite de la base gratuite) ; réactiver reste possible à la limite', async () => {
  const sim = await demarrer();
  const admin = await adminPret(sim);
  try {
    for (const id of ORDRE.filter((x) => x !== 'autre')) await sim.creerJeu(id);
    for (let i = 1; i <= 6; i += 1) await sim.creerJeu('autre', { id: `jeu${i}`, nom: `Jeu ${i}` });
    assert.equal((await admin.get('/api/admin/jeux')).json.jeux.length, 15);
    const refus = await admin.post('/api/admin/jeux', { modele: 'autre', nom: 'Seizième jeu' });
    assert.equal(refus.statut, 409);
    assert.match(refus.json.erreur.message, /15 jeux au maximum/);
    await assert.rejects(sim.creerJeu('autre', { id: 'jeu16', nom: 'Jeu 16' }), /15 jeux au maximum/);

    await admin.put('/api/admin/jeux/cs2', { actif: false });
    assert.equal((await admin.post('/api/admin/jeux', { modele: 'cs2' })).statut, 200);
    assert.equal((await admin.get('/api/admin/jeux')).json.jeux.length, 15);
  } finally {
    await sim.arreter();
  }
});

// ——— Séparation des jeux ———

test('séparation stricte : sans accès à un jeu, chaque adresse de ce jeu répond « introuvable »', async () => {
  const { sim } = await monde();
  try {
    const respVal = await compteConnecte(sim, { identifiant: 'resp-val', acces: { valorant: ['responsable'] } });
    const inconnu = (await respVal.get('/api/e/inexistant/donnees')).json;
    const s = nouvelId('s');
    const appels = [
      ['GET', '/api/e/lol/donnees'], ['GET', '/api/e/lol/sync?rev=0'],
      ['PUT', `/api/e/lol/c/strats/${s}`, { valeur: stratPour('lol') }], ['DELETE', `/api/e/lol/c/strats/${s}`],
      ['POST', '/api/e/lol/absences', { valeur: {} }], ['PUT', '/api/e/lol/mesures/m-aaaaaaaaaa/2026-W43', { valeur: {} }],
      ['PUT', '/api/e/lol/dispos/2026-W43/m-aaaaaaaaaa', { valeur: {} }], ['POST', '/api/e/lol/vod-notes', { valeur: {} }],
      ['GET', '/api/e/lol/comptes'], ['POST', '/api/e/lol/comptes', { identifiant: 'intrus', nomAffiche: 'I', metiers: ['joueur'] }],
      ['GET', '/api/e/lol/reglages-jeu'], ['PUT', '/api/e/lol/reglages-jeu', { valeur: {} }], ['GET', '/api/e/lol/reglages'],
      ['GET', '/api/e/lol/export'], ['POST', '/api/e/lol/restaurer', { format: 'lugh', version: 2 }],
      ['POST', '/api/e/lol/meta/actualiser'], ['GET', '/api/e/lol/meta/consigne'], ['GET', '/api/e/lol/journal'], ['GET', '/api/e/lol/etat'],
    ];
    for (const [methode, chemin, corps] of appels) {
      const r = await respVal.appel(methode, chemin, corps);
      assert.equal(r.statut, 404, `${methode} ${chemin}`);
      assert.deepEqual(r.json, inconnu, `${methode} ${chemin} : même réponse qu’un jeu inexistant`);
    }
    assert.equal(await sim.espace('lol').stockage.compter('strats'), 0);
    assert.equal(await compteGlobal(sim, 'intrus'), null);
  } finally {
    await sim.arreter();
  }
});

test('les métiers sont propres à chaque jeu ; les autres comptes ne se voient qu’à travers le jeu partagé', async () => {
  const { sim } = await monde();
  try {
    const poly = await compteConnecte(sim, { identifiant: 'polyvalent', nomAffiche: 'Poly', acces: { valorant: ['coach'], lol: ['invite'] } });
    const v = (await poly.get('/api/e/valorant/donnees')).json;
    const l = (await poly.get('/api/e/lol/donnees')).json;
    assert.deepEqual(v.metiers, ['coach']);
    assert.ok(v.permissions.includes('strats.modifier'));
    assert.deepEqual(l.metiers, ['invite']);
    assert.deepEqual(l.permissions, []);
    assert.equal((await poly.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: stratPour('valorant') })).statut, 200);
    assert.equal((await poly.put(`/api/e/lol/c/strats/${nouvelId('s')}`, { valeur: stratPour('lol') })).statut, 403);

    const coachVal = await compteConnecte(sim, { identifiant: 'coach-val', acces: { valorant: ['coach'] } });
    assert.equal((await coachVal.put(`/api/e/lol/c/strats/${nouvelId('s')}`, { valeur: stratPour('lol') })).statut, 404, 'coach à Valorant, personne à LoL');

    const vuDansValorant = v.comptes.find((c) => c.nomAffiche === 'Poly');
    assert.deepEqual(vuDansValorant.metiers, ['coach']);
    assert.deepEqual(l.comptes.find((c) => c.nomAffiche === 'Poly').metiers, ['invite']);
    assert.ok(!(await coachVal.get('/api/e/valorant/donnees')).json.comptes.some((c) => 'identifiant' in c || 'acces' in c || 'hash' in c));
    assert.ok(!l.comptes.some((c) => c._id === coachVal.id), 'un compte sans accès à LoL n’apparaît pas dans LoL');
  } finally {
    await sim.arreter();
  }
});

// ——— Comptes gérés par le Responsable du jeu ———

test('Responsable du jeu : il ne voit et ne crée que des comptes de son jeu', async () => {
  const { sim } = await monde();
  try {
    const resp = await compteConnecte(sim, { identifiant: 'resp-val', acces: { valorant: ['responsable', 'joueur'] } });
    await creerCompte(sim, { identifiant: 'seul-lol', acces: { lol: ['joueur'] } });
    await creerCompte(sim, { identifiant: 'deux-jeux', acces: { valorant: ['joueur'], lol: ['capitaine'] } });

    const liste = (await resp.get('/api/e/valorant/comptes')).json.comptes;
    const parId = Object.fromEntries(liste.map((c) => [c.identifiant, c]));
    assert.deepEqual(Object.keys(parId).sort(), ['chef', 'deux-jeux', 'resp-val']);
    assert.deepEqual(parId['deux-jeux'].metiers, ['joueur'], 'seulement ses métiers dans ce jeu');
    assert.equal(parId['deux-jeux'].gerable, false);
    assert.equal(parId['resp-val'].gerable, true);
    assert.equal(parId.chef.admin, true);
    assert.equal(parId.chef.gerable, false);
    assert.ok(liste.every((c) => !('acces' in c) && !('hash' in c)));

    const cree = await resp.post('/api/e/valorant/comptes', {
      identifiant: 'recrue', nomAffiche: 'Recrue', metiers: ['joueur'], acces: { lol: { metiers: ['responsable'] } }, admin: true,
    });
    assert.equal(cree.statut, 201);
    assert.match(cree.json.mdpTemporaire, MOTIF_MDP_TEMPORAIRE);
    assert.deepEqual([cree.json.compte.metiers, cree.json.compte.gerable, cree.json.compte.doitChangerMdp], [['joueur'], true, true]);
    const stocke = await compteGlobal(sim, 'recrue');
    assert.deepEqual(stocke.acces, { valorant: { metiers: ['joueur'], membreId: '' } }, 'aucun accès à un autre jeu');
    assert.equal(stocke.admin, false);

    const recrue = await connecter(sim, 'recrue', cree.json.mdpTemporaire);
    assert.equal((await recrue.get('/api/e/valorant/donnees')).json.erreur.code, 'mdp_a_changer');
    assert.equal((await recrue.post('/api/auth/mdp', { ancien: cree.json.mdpTemporaire, nouveau: MDP })).statut, 200);
    assert.equal((await recrue.get('/api/e/valorant/donnees')).statut, 200);

    assert.equal((await resp.post('/api/e/valorant/comptes', { identifiant: 'x-metier', nomAffiche: 'X', metiers: ['dieu'] })).statut, 400);
    assert.equal((await resp.post('/api/e/valorant/comptes', { identifiant: 'x-vide', nomAffiche: 'X', metiers: [] })).statut, 400);
    assert.equal((await resp.post('/api/e/valorant/comptes', { identifiant: 'Pas Valide', nomAffiche: 'X', metiers: ['joueur'] })).statut, 400);
    for (const chemin of ['/api/admin/comptes', '/api/admin/jeux', '/api/admin/journal', '/api/admin/etat']) {
      assert.equal((await resp.get(chemin)).statut, 403, chemin);
    }
    const entrees = (await resp.get('/api/e/valorant/journal')).json.entrees;
    assert.ok(entrees.some((e) => e.action === 'compte créé' && e.cible === 'recrue'));
    assert.ok(entrees.every((e) => e.jeu === 'valorant'), 'journal de son jeu seulement');
  } finally {
    await sim.arreter();
  }
});

test('compte présent dans un autre jeu : le Responsable change ses métiers ou retire son accès, rien de plus', async () => {
  const { sim, admin } = await monde();
  try {
    const resp = await compteConnecte(sim, { identifiant: 'resp-val', acces: { valorant: ['responsable'] } });
    const deux = await creerCompte(sim, { identifiant: 'deux-jeux', nomAffiche: 'Deux', acces: { valorant: ['joueur'], lol: ['joueur'] } });
    const url = `/api/e/valorant/comptes/${deux._id}`;

    assert.equal((await resp.post(`${url}/mdp`)).statut, 403, 'mot de passe');
    assert.equal((await resp.put(url, { metiers: ['joueur'], nomAffiche: 'Renommé', actif: true })).statut, 403, 'nom');
    assert.equal((await resp.put(url, { metiers: ['joueur'], nomAffiche: 'Deux', actif: false })).statut, 403, 'désactivation');
    assert.equal((await resp.del(url)).statut, 403, 'suppression');
    const intact = await compteGlobal(sim, 'deux-jeux');
    assert.deepEqual([intact.nomAffiche, intact.actif, intact.hash], ['Deux', true, deux.hash]);

    const metiers = await resp.put(url, { metiers: ['capitaine', 'joueur'], nomAffiche: 'Deux', actif: true });
    assert.equal(metiers.statut, 200);
    assert.deepEqual(metiers.json.compte.metiers, ['capitaine', 'joueur']);
    assert.deepEqual((await compteGlobal(sim, 'deux-jeux')).acces.lol, { metiers: ['joueur'], membreId: '' }, 'LoL intact');

    assert.equal((await resp.del(`${url}/acces`)).statut, 200);
    assert.deepEqual(Object.keys((await compteGlobal(sim, 'deux-jeux')).acces), ['lol']);
    const lui = await connecter(sim, 'deux-jeux');
    assert.deepEqual((await lui.get('/api/auth/moi')).json.jeux.map((j) => j.id), ['lol'], 'son compte et son autre jeu restent');
    assert.ok(!(await resp.get('/api/e/valorant/comptes')).json.comptes.some((c) => c._id === deux._id));
    assert.equal((await resp.put(url, { metiers: ['joueur'] })).statut, 404);

    // L'Administrateur général peut tout faire ; un Responsable des deux jeux aussi.
    const reinit = await admin.post(`/api/admin/comptes/${deux._id}/mdp`);
    assert.equal(reinit.statut, 200);
    assert.match(reinit.json.mdpTemporaire, MOTIF_MDP_TEMPORAIRE);
    await creerCompte(sim, { identifiant: 'autre-deux', acces: { valorant: ['joueur'], lol: ['joueur'] } });
    const autre = await compteGlobal(sim, 'autre-deux');
    const respDeux = await compteConnecte(sim, { identifiant: 'resp-deux', acces: { valorant: ['responsable'], lol: ['responsable'] } });
    assert.equal((await respDeux.post(`/api/e/valorant/comptes/${autre._id}/mdp`)).statut, 200);
    assert.equal((await resp.post(`/api/e/valorant/comptes/${autre._id}/mdp`)).statut, 403);

    // Jamais un Administrateur général.
    const chef = `/api/e/valorant/comptes/${admin.id}`;
    assert.equal((await resp.put(chef, { metiers: ['responsable'], nomAffiche: 'chef', actif: true })).statut, 403);
    assert.equal((await resp.post(`${chef}/mdp`)).statut, 403);
    assert.equal((await resp.del(chef)).statut, 403);
    assert.equal((await resp.del(`${chef}/acces`)).statut, 403);
  } finally {
    await sim.arreter();
  }
});

test('« Compte existant » : la personne garde son compte et son mot de passe, et reçoit l’accès au jeu', async () => {
  const { sim, admin } = await monde();
  try {
    const respLol = await compteConnecte(sim, { identifiant: 'resp-lol', acces: { lol: ['responsable'] } });
    const mistral = await creerCompte(sim, { identifiant: 'mistral', nomAffiche: 'Mistral', acces: { valorant: ['joueur'] } });
    const [membreLol] = await sim.joueurs('lol');
    const demande = { identifiant: 'mistral', nomAffiche: 'Autre nom', metiers: ['remplacant'], membreId: membreLol._id };

    const sansCase = await respLol.post('/api/e/lol/comptes', demande);
    assert.equal(sansCase.statut, 409);
    assert.match(sansCase.json.erreur.message, /Compte existant/);
    const avec = await respLol.post('/api/e/lol/comptes', { ...demande, existant: true });
    assert.equal(avec.statut, 200);
    assert.equal(avec.json.mdpTemporaire, undefined, 'aucun nouveau mot de passe');
    assert.deepEqual([avec.json.compte.metiers, avec.json.compte.membreId, avec.json.compte.gerable], [['remplacant'], membreLol._id, false]);
    const apres = await compteGlobal(sim, 'mistral');
    assert.deepEqual(apres.acces, { valorant: { metiers: ['joueur'], membreId: '' }, lol: { metiers: ['remplacant'], membreId: membreLol._id } });
    assert.deepEqual([apres.nomAffiche, apres.hash], ['Mistral', mistral.hash]);
    const lui = await connecter(sim, 'mistral');
    assert.deepEqual((await lui.get('/api/auth/moi')).json.jeux.map((j) => j.id), ['valorant', 'lol']);

    assert.match((await respLol.post('/api/e/lol/comptes', { ...demande, membreId: '', existant: true })).json.erreur.message, /déjà accès/);
    assert.equal((await respLol.post('/api/e/lol/comptes', { identifiant: 'personne', nomAffiche: 'P', metiers: ['joueur'], existant: true })).statut, 404);

    // Compte sans aucun jeu (ancien membre) : le Responsable ne peut pas se l'approprier, l'Administrateur général oui.
    const ancien = await creerCompte(sim, { identifiant: 'ancien', nomAffiche: 'Ancien', acces: {} });
    const refus = await respLol.post('/api/e/lol/comptes', { identifiant: 'ancien', metiers: ['joueur'], existant: true });
    assert.equal(refus.statut, 403);
    assert.match(refus.json.erreur.message, /aucun jeu/);
    assert.deepEqual((await compteGlobal(sim, 'ancien')).acces, {}, 'aucun accès ajouté');
    assert.equal((await respLol.post(`/api/e/lol/comptes/${ancien._id}/mdp`)).statut, 404, 'mot de passe hors de portée');
    assert.equal((await admin.post('/api/e/lol/comptes', { identifiant: 'ancien', metiers: ['joueur'], existant: true })).statut, 200);
  } finally {
    await sim.arreter();
  }
});

test('membre lié : un seul compte par membre dans un jeu, et seulement un membre de ce jeu', async () => {
  const { sim, admin } = await monde();
  try {
    const [m1] = await sim.joueurs('valorant');
    const [l1] = await sim.joueurs('lol');
    const resp = await compteConnecte(sim, { identifiant: 'resp-val', acces: { valorant: ['responsable'] } });
    const cree = (identifiant, membreId) => resp.post('/api/e/valorant/comptes', { identifiant, nomAffiche: identifiant, metiers: ['joueur'], membreId });

    const a = await cree('lie-a', m1._id);
    assert.equal(a.statut, 201);
    assert.equal(a.json.compte.membreId, m1._id);
    assert.match((await cree('lie-b', m1._id)).json.erreur.message, /déjà lié/);
    assert.equal((await cree('lie-c', l1._id)).statut, 400, 'membre d’un autre jeu');
    assert.equal((await cree('lie-d', 'm-zzzzzzzzzz')).statut, 400, 'membre inexistant');
    assert.equal((await resp.put(`/api/e/valorant/comptes/${resp.id}`, { metiers: ['responsable'], membreId: m1._id })).statut, 409);
    const parAdmin = await admin.post('/api/admin/comptes', { identifiant: 'lie-e', nomAffiche: 'E', acces: { valorant: { metiers: ['joueur'], membreId: m1._id } } });
    assert.equal(parAdmin.statut, 409, 'même règle pour l’Administrateur général');

    // Le même compte peut être lié à un membre dans chaque jeu.
    const idA = a.json.compte._id;
    const deuxLiens = await admin.put(`/api/admin/comptes/${idA}`, {
      nomAffiche: 'lie-a', actif: true, admin: false,
      acces: { valorant: { metiers: ['joueur'], membreId: m1._id }, lol: { metiers: ['joueur'], membreId: l1._id } },
    });
    assert.equal(deuxLiens.statut, 200);
    assert.deepEqual(deuxLiens.json.compte.acces.lol, { metiers: ['joueur'], membreId: l1._id });
    const lieA = await connecterEtChanger(sim, 'lie-a', a.json.mdpTemporaire);
    assert.equal((await lieA.get('/api/e/lol/donnees')).json.membreId, l1._id);
    assert.equal((await lieA.get('/api/e/valorant/donnees')).json.membreId, m1._id);
  } finally {
    await sim.arreter();
  }
});

test('accès sans métier : le lien avec un membre est gardé, sans ouvrir le jeu (sauf à l’Administrateur général)', async () => {
  const { sim, admin } = await monde();
  try {
    const [, m2, m3] = await sim.joueurs('valorant');
    const soi = await admin.put(`/api/admin/comptes/${admin.id}`, {
      nomAffiche: 'chef', actif: true, admin: true,
      acces: { valorant: { metiers: [], membreId: m2._id }, lol: { metiers: [], membreId: '' } },
    });
    assert.equal(soi.statut, 200, soi.texte);
    assert.deepEqual(soi.json.compte.acces, { valorant: { metiers: [], membreId: m2._id } }, 'entrée vide retirée');
    const d = (await admin.get('/api/e/valorant/donnees')).json;
    assert.deepEqual([d.metiers, d.membreId], [['responsable'], m2._id], 'Administrateur général et joueur');

    const lien = await admin.post('/api/admin/comptes', { identifiant: 'lien-seul', nomAffiche: 'Lien', acces: { valorant: { metiers: [], membreId: m3._id } } });
    assert.equal(lien.statut, 201, lien.texte);
    const c = await connecterEtChanger(sim, 'lien-seul', lien.json.mdpTemporaire);
    assert.deepEqual((await c.get('/api/auth/moi')).json.jeux, [], 'aucun métier : aucun jeu ouvert');
    assert.equal((await c.get('/api/e/valorant/donnees')).statut, 404);
    const autre = await admin.post('/api/admin/comptes', { identifiant: 'lien-bis', nomAffiche: 'Bis', acces: { valorant: { metiers: ['joueur'], membreId: m3._id } } });
    assert.equal(autre.statut, 409, 'le membre reste pris');
  } finally {
    await sim.arreter();
  }
});

// ——— Garde-fous ———

test('il reste toujours un Administrateur général actif', async () => {
  const { sim, admin } = await monde({ jeux: [] });
  try {
    const moi = `/api/admin/comptes/${admin.id}`;
    assert.equal((await admin.put(moi, { nomAffiche: 'chef', actif: true, admin: false, acces: {} })).statut, 409);
    assert.equal((await admin.put(moi, { nomAffiche: 'chef', actif: false, admin: true, acces: {} })).statut, 409);
    assert.equal((await admin.del(moi)).statut, 409);
    assert.equal((await admin.post(`${moi}/mdp`)).statut, 409, 'son propre mot de passe se change depuis « Mon compte »');

    const cree = await admin.post('/api/admin/comptes', { identifiant: 'adjoint', nomAffiche: 'Adjoint', admin: true });
    assert.equal(cree.statut, 201);
    assert.equal(cree.json.compte.admin, true);
    const adjoint = await connecterEtChanger(sim, 'adjoint', cree.json.mdpTemporaire);
    assert.equal((await adjoint.put(moi, { nomAffiche: 'chef', actif: true, admin: false, acces: {} })).statut, 200, 'un autre reste');
    assert.equal((await admin.get('/api/admin/jeux')).statut, 403, 'chef n’est plus Administrateur général');

    const lui = `/api/admin/comptes/${adjoint.id}`;
    assert.equal((await adjoint.put(lui, { nomAffiche: 'Adjoint', actif: true, admin: false, acces: {} })).statut, 409);
    assert.equal((await adjoint.del(lui)).statut, 409);
    assert.equal((await adjoint.get('/api/admin/jeux')).statut, 200);
  } finally {
    await sim.arreter();
  }
});

test('un Responsable ne retire ni son rôle de Responsable, ni son accès, ni son compte', async () => {
  const { sim } = await monde();
  try {
    const resp = await compteConnecte(sim, { identifiant: 'resp-val', nomAffiche: 'Resp', acces: { valorant: ['responsable', 'joueur'] } });
    const soi = `/api/e/valorant/comptes/${resp.id}`;
    assert.match((await resp.put(soi, { metiers: ['joueur'], nomAffiche: 'Resp', actif: true })).json.erreur.message, /ton propre rôle de Responsable/);
    assert.equal((await resp.put(soi, { metiers: ['responsable'], nomAffiche: 'Resp', actif: false })).statut, 409);
    assert.equal((await resp.del(`${soi}/acces`)).statut, 409);
    assert.equal((await resp.del(soi)).statut, 409);
    assert.equal((await resp.post(`${soi}/mdp`)).statut, 409);
    const ok = await resp.put(soi, { metiers: ['coach', 'responsable'], nomAffiche: 'Resp 2', actif: true });
    assert.equal(ok.statut, 200);
    assert.deepEqual([ok.json.compte.metiers, ok.json.compte.nomAffiche], [['responsable', 'coach'], 'Resp 2']);
  } finally {
    await sim.arreter();
  }
});

test('Administrateur général : comptes multi-jeux, validations, désactivation, réinitialisation, suppression', async () => {
  const { sim, admin } = await monde();
  try {
    const cree = await admin.post('/api/admin/comptes', {
      identifiant: 'multi', nomAffiche: 'Multi', acces: { valorant: { metiers: ['joueur', 'capitaine'] }, lol: { metiers: ['coach'] } },
    });
    assert.equal(cree.statut, 201);
    assert.deepEqual(cree.json.compte.acces, { valorant: { metiers: ['capitaine', 'joueur'], membreId: '' }, lol: { metiers: ['coach'], membreId: '' } });
    assert.equal((await admin.post('/api/admin/comptes', { identifiant: 'multi', nomAffiche: 'Bis' })).statut, 409);
    assert.equal((await admin.post('/api/admin/comptes', { identifiant: 'Avec Espace', nomAffiche: 'X' })).statut, 400);
    assert.equal((await admin.post('/api/admin/comptes', { identifiant: 'jeu-inconnu', nomAffiche: 'X', acces: { tetris: { metiers: ['joueur'] } } })).statut, 400);
    assert.equal((await admin.post('/api/admin/comptes', { identifiant: 'metier-inconnu', nomAffiche: 'X', acces: { valorant: { metiers: ['dieu'] } } })).statut, 400);

    const multi = await connecterEtChanger(sim, 'multi', cree.json.mdpTemporaire);
    const id = multi.id;
    const corps = { nomAffiche: 'Multi', admin: false, acces: { valorant: { metiers: ['joueur'] } } };
    assert.equal((await admin.put(`/api/admin/comptes/${id}`, { ...corps, actif: false })).statut, 200);
    assert.equal((await multi.get('/api/auth/moi')).statut, 401, 'désactivé : déconnecté');
    const remis = await admin.put(`/api/admin/comptes/${id}`, { ...corps, actif: true });
    assert.deepEqual(Object.keys(remis.json.compte.acces), ['valorant'], 'les accès sont remplacés');

    const reinit = await admin.post(`/api/admin/comptes/${id}/mdp`);
    assert.equal(reinit.json.compte.doitChangerMdp, true);
    assert.equal((await connecter(sim, 'multi', reinit.json.mdpTemporaire)).compte.doitChangerMdp, true);
    await assert.rejects(connecter(sim, 'multi', MDP), /401/, 'l’ancien mot de passe ne marche plus');

    const tous = (await admin.get('/api/admin/comptes')).json.comptes;
    assert.ok(tous.some((c) => c.identifiant === 'multi'));
    assert.ok(tous.every((c) => !('hash' in c)));
    assert.equal((await admin.del(`/api/admin/comptes/${id}`)).statut, 200);
    assert.equal(await compteGlobal(sim, 'multi'), null);
    assert.equal((await admin.del(`/api/admin/comptes/${id}`)).statut, 404);
    const actions = (await journal(admin)).map((e) => e.action);
    for (const a of ['compte créé', 'compte désactivé', 'compte modifié', 'mot de passe réinitialisé', 'compte supprimé']) assert.ok(actions.includes(a), a);
  } finally {
    await sim.arreter();
  }
});

test('nom de jeu réservé : un nom de rôle de fonction Discord (Administrateur, Responsable…) est refusé à la création et au renommage', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    for (const nom of ['Administrateur', '  responsable ', 'Remplaçant', 'Capitaine / IGL', 'INVITÉ']) {
      const r = await admin.post('/api/admin/jeux', { modele: 'autre', nom });
      assert.equal(r.statut, 400, nom);
      assert.match(JSON.stringify(r.json), /rôle de fonction/);
    }
    assert.equal((await admin.put('/api/admin/jeux/valorant', { nom: 'Administrateur' })).statut, 400);
    assert.equal((await admin.put('/api/admin/jeux/valorant', { nom: 'Valorant Académie' })).statut, 200, 'un nom ordinaire passe');
  } finally {
    await sim.arreter();
  }
});
