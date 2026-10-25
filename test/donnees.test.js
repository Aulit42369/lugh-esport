// Données d'un jeu : chargement, écritures validées avec la définition du jeu, synchronisation par révision,
// suppressions en cascade, conflits 409, plafonds, chiffres, avis, visites et semaine créée automatiquement.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrer, adminPret, compteConnecte, compteGlobal, attendreQue, stratPour,
} from './simulation.js';
import { COLLECTIONS_SYNC } from '../src/domaine/collections.js';
import { METIERS } from '../shared/roles.js';
import { nouvelId } from '../shared/validation.js';
import { semaineIso, dateCivile } from '../shared/temps.js';

let sim;
let admin;
let coach;
let staff;
before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol', 'apex'] });
  admin = await adminPret(sim);
  [staff] = await sim.membres('valorant', { fonction: 'headcoach' });
  coach = await compteConnecte(sim, { identifiant: 'coach', nomAffiche: 'Ardent', acces: { valorant: { metiers: ['headcoach'], membreId: staff._id }, lol: ['coach'] } });
});
after(() => sim.arreter());

const ecrire = (cl, jeu, coll, id, valeur, extra = {}) => cl.put(`/api/e/${jeu}/c/${coll}/${id}`, { valeur, ...extra });

test('chargement d’un jeu : définition effective, toutes les collections, comptes publics, permissions', async () => {
  const d = (await coach.get('/api/e/valorant/donnees')).json;
  assert.deepEqual(Object.keys(d.donnees).sort(), [...COLLECTIONS_SYNC].sort());
  assert.equal('reglages' in d.donnees, false, 'le webhook Discord ne part jamais vers le navigateur');
  assert.deepEqual(d.donnees.jeu, [], 'pas encore de Réglages du jeu');
  assert.deepEqual([d.definition.modele, d.definition.espace, d.definition.aPool, d.definition.score.type], ['valorant', 'valorant', true, 'manches']);
  assert.deepEqual(d.metiers, ['headcoach']);
  assert.equal(d.membreId, staff._id);
  assert.deepEqual([...d.permissions].sort(), [...METIERS.headcoach.perms].sort());
  assert.equal(d.compte.identifiant, 'coach');
  assert.deepEqual(Object.keys(d.compte.acces), ['valorant', 'lol']);
  const moi = d.comptes.find((x) => x._id === coach.id);
  assert.deepEqual(moi, { _id: coach.id, nomAffiche: 'Ardent', metiers: ['headcoach'], membreId: staff._id, actif: true, admin: false });
  assert.ok(d.comptes.some((x) => x.admin && x.metiers.includes('responsable')));
  assert.equal(d.serveur.version, '2.8.0');
  assert.match(d.serveur.semaine, /^\d{4}-W\d{2}$/);
  assert.match(d.serveur.aujourdhui, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(d.serveur.metaAuto, true);
  assert.ok(Number.isInteger(d.rev) && d.rev > 0);
  assert.equal((await coach.get('/api/e/lol/donnees')).json.definition.modele, 'lol');
});

test('écritures validées avec la définition de chaque jeu ; champs inconnus et identifiants invalides refusés', async () => {
  const id = nouvelId('s');
  const r = await ecrire(coach, 'valorant', 'strats', id, { ...stratPour('valorant', 'Exec A'), etapes: ['Smokes', 'Entrée'], champInconnu: 'x', _id: 'autre', rev: 999 });
  assert.equal(r.statut, 200);
  const doc = r.json.doc;
  assert.deepEqual([doc._id, doc.statut, doc.champInconnu], [id, 'apprendre', undefined]);
  assert.notEqual(doc.rev, 999);
  assert.deepEqual(doc.maj, { par: coach.id, le: sim.maintenant().toISOString() });
  assert.deepEqual(doc.cree, doc.maj);

  const sansMap = await ecrire(coach, 'valorant', 'strats', nouvelId('s'), { camp: 'att', type: 'default', nom: 'Sans map' });
  assert.equal(sansMap.statut, 400);
  assert.equal(sansMap.json.erreur.code, 'invalide');
  assert.ok(sansMap.json.erreur.details.some((e) => e.message === 'Map obligatoire'));
  assert.equal((await ecrire(coach, 'lol', 'strats', nouvelId('s'), stratPour('lol'))).statut, 200, 'LoL : pas de map');

  assert.equal((await ecrire(coach, 'valorant', 'scrims', nouvelId('x'), { date: '2026-10-15', adversaire: 'Orage', map: 'haven', campDepart: 'att', mtNous: 7, mtEux: 5, scoreNous: 13, scoreEux: 9 })).statut, 200);
  assert.equal((await ecrire(coach, 'lol', 'scrims', nouvelId('x'), { date: '2026-10-15', adversaire: 'Nébula', scoreNous: 2, scoreEux: 1 })).statut, 200);
  assert.equal((await ecrire(admin, 'apex', 'scrims', nouvelId('x'), { date: '2026-10-15', adversaire: 'Lobby', map: 'stormpoint', place: 3 })).statut, 200);
  assert.equal((await ecrire(admin, 'apex', 'scrims', nouvelId('x'), { date: '2026-10-15', adversaire: 'Lobby', map: 'stormpoint', place: 25, equipes: 20 })).statut, 400);
  assert.equal((await ecrire(admin, 'apex', 'scrims', nouvelId('x'), { date: '2026-10-15', adversaire: 'Lobby', place: 3 })).statut, 400, 'Apex : map obligatoire');

  const bloc = (type, debut = '20:00', fin = '22:00') => ({ blocs: [{ id: nouvelId('b'), jour: 2, debut, fin, type }] });
  assert.equal((await ecrire(coach, 'valorant', 'planning', '2026-W44', bloc('aim'))).statut, 200);
  assert.equal((await ecrire(coach, 'valorant', 'planning', '2026-W44', bloc('scrim', '22:00', '21:00'))).statut, 400);
  assert.equal((await ecrire(coach, 'valorant', 'planning', '2026-W44', bloc('laning'))).statut, 400, 'bloc d’un autre jeu');
  assert.equal((await ecrire(coach, 'lol', 'planning', '2026-W44', bloc('laning'))).statut, 200);

  for (const [coll, idInvalide] of [['planning', 'semaine-x'], ['strats', 'pas-un-id'], ['membres', 's-aaaaaaaaaa'], ['equipe', 'autre'], ['mapsEquipe', 'Haven']]) {
    assert.equal((await ecrire(admin, 'valorant', coll, idInvalide, {})).statut, 400, `${coll}/${idInvalide}`);
  }
  for (const coll of ['comptes', 'meta', 'votes', 'jeu', 'reglages', 'suggestions', 'vodNotes', 'mesures', 'dispos', 'absences', 'suppressions']) {
    assert.equal((await ecrire(admin, 'valorant', coll, 'x', {})).statut, 404, `${coll} ne s’écrit pas par l’adresse générique`);
  }
});

test('synchronisation par révision, propre à chaque jeu', async () => {
  const depart = (await admin.get('/api/e/valorant/donnees')).json.rev;
  const departLol = (await admin.get('/api/e/lol/donnees')).json.rev;
  const id = nouvelId('s');
  const doc = (await ecrire(admin, 'valorant', 'strats', id, stratPour('valorant'))).json.doc;
  assert.ok(doc.rev > depart);

  const sync = (await admin.get(`/api/e/valorant/sync?rev=${depart}`)).json;
  assert.deepEqual(sync.docs.strats.map((s) => s._id), [id]);
  assert.deepEqual(sync.suppressions, []);
  assert.ok(sync.rev >= doc.rev);
  assert.deepEqual((await admin.get(`/api/e/lol/sync?rev=${departLol}`)).json.docs, {}, 'rien dans LoL');
  assert.equal(await sim.espace('lol').stockage.lire('strats', id), null, 'bases séparées');

  assert.equal((await admin.del(`/api/e/valorant/c/strats/${id}`)).statut, 200);
  const apres = (await admin.get(`/api/e/valorant/sync?rev=${sync.rev}`)).json;
  assert.deepEqual(apres.suppressions.map(({ coll, id: x }) => [coll, x]), [['strats', id]]);
  assert.deepEqual((await admin.get(`/api/e/valorant/sync?rev=${apres.rev}`)).json, { rev: apres.rev, docs: {}, suppressions: [] });
  assert.deepEqual((await admin.get(`/api/e/valorant/sync?rev=${apres.rev + 1000}`)).json, { reinitialiser: true, rev: apres.rev });
  for (const rev of ['abc', '-1', '1.5', '{"$gt":0}', 'NaN']) {
    assert.equal((await admin.get(`/api/e/valorant/sync?rev=${encodeURIComponent(rev)}`)).statut, 400, rev);
  }
});

test('suppressions en cascade : une VOD emporte ses notes, un candidat ses avis', async () => {
  const st = sim.espace('valorant').stockage;
  const avant = (await admin.get('/api/e/valorant/sync?rev=0')).json.rev;
  const vodId = nouvelId('v');
  await ecrire(coach, 'valorant', 'vods', vodId, { titre: 'Match', lien: 'https://example.com/m' });
  const n1 = (await coach.post('/api/e/valorant/vod-notes', { valeur: { vodId, texte: 'Note 1' } })).json.doc;
  const n2 = (await admin.post('/api/e/valorant/vod-notes', { valeur: { vodId, texte: 'Note 2' } })).json.doc;
  const k = nouvelId('k');
  await ecrire(coach, 'valorant', 'candidats', k, { pseudo: 'Nova' });
  await coach.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'pour' } });
  await admin.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'neutre' } });
  assert.equal(await st.compter('votes', { cible: k }), 2);

  assert.deepEqual((await coach.del(`/api/e/valorant/c/vods/${vodId}`)).json, { ok: true });
  assert.equal(await st.compter('vodNotes', { vodId }), 0);
  assert.equal((await coach.post('/api/e/valorant/vod-notes', { valeur: { vodId, texte: 'Trop tard' } })).statut, 404);
  assert.deepEqual((await coach.del(`/api/e/valorant/c/candidats/${k}`)).json, { ok: true });
  assert.equal(await st.compter('votes', { cible: k }), 0);

  const suppr = (await admin.get(`/api/e/valorant/sync?rev=${avant}`)).json.suppressions.map((s) => `${s.coll}:${s.id}`);
  for (const attendu of [`vods:${vodId}`, `vodNotes:${n1._id}`, `vodNotes:${n2._id}`, `candidats:${k}`, `votes:${k}_${coach.id}`, `votes:${k}_${admin.id}`]) {
    assert.ok(suppr.includes(attendu), attendu);
  }
  assert.deepEqual((await coach.del(`/api/e/valorant/c/vods/${vodId}`)).json, { ok: false }, 'déjà supprimée');
  assert.equal((await admin.del('/api/e/valorant/c/equipe/profil')).statut, 404, 'le profil ne se supprime pas');
  const journal = (await admin.get('/api/e/valorant/journal')).json.entrees.map((e) => `${e.action}:${e.cible}`);
  assert.ok(journal.includes(`suppression vods:${vodId}`) && journal.includes(`suppression candidats:${k}`));
});

test('supprimer un membre emporte ses chiffres, absences, dispos et objectifs, pas ceux des autres', async () => {
  const st = sim.espace('valorant').stockage;
  const id = nouvelId('m');
  assert.equal((await ecrire(coach, 'valorant', 'membres', id, { type: 'joueur', statut: 'essai', pseudo: 'Passager' })).statut, 200);
  const [temoin] = await sim.joueurs('valorant');
  for (const membre of [id, temoin._id]) {
    assert.equal((await coach.put(`/api/e/valorant/mesures/${membre}/2026-W43`, { valeur: { valeurs: { hs: 20 } } })).statut, 200);
    assert.equal((await coach.put(`/api/e/valorant/dispos/2026-W43/${membre}`, { valeur: { creneaux: { 2: [20] } } })).statut, 200);
    assert.equal((await coach.post('/api/e/valorant/absences', { valeur: { membreId: membre, date: '2026-10-29' } })).statut, 201);
    assert.equal((await ecrire(coach, 'valorant', 'objectifs', membre, { palier: 'debutant' })).statut, 200);
  }
  await coach.put(`/api/e/valorant/mesures/${id}/2026-W44`, { valeur: { valeurs: { hs: 21 } } });
  const avant = (await admin.get('/api/e/valorant/sync?rev=0')).json.rev;

  assert.equal((await coach.del(`/api/e/valorant/c/membres/${id}`)).statut, 200);
  for (const coll of ['mesures', 'absences', 'dispos']) {
    assert.equal(await st.compter(coll, { membreId: id }), 0, coll);
    assert.equal(await st.compter(coll, { membreId: temoin._id }), 1, `${coll} du témoin`);
  }
  assert.equal(await st.lire('objectifs', id), null);
  assert.ok(await st.lire('objectifs', temoin._id));
  const colls = new Set((await admin.get(`/api/e/valorant/sync?rev=${avant}`)).json.suppressions.map((s) => s.coll));
  assert.deepEqual([...colls].sort(), ['absences', 'dispos', 'membres', 'mesures', 'objectifs']);
});

test('organisation : comptes rendus de séance, tournois et partenaires de scrim se synchronisent et se suppriment comme les autres fiches', async () => {
  const depart = (await coach.get('/api/e/valorant/sync?rev=0')).json.rev;
  const bloc = nouvelId('b');
  const seance = await ecrire(coach, 'valorant', 'seances', `2026-W43_${bloc}`, { semaine: '2026-W43', blocId: bloc, jour: 2, debut: '20:00', type: 'scrim', travaille: 'Retakes B', aRevoir: 'Utilitaires trop tôt' });
  assert.equal(seance.statut, 200);
  const t = nouvelId('t');
  const [m0] = await sim.joueurs('valorant');
  assert.equal((await ecrire(coach, 'valorant', 'tournois', t, { nom: 'Coupe de France', statut: 'inscrit', debut: '2026-11-10', roster: [m0._id] })).statut, 200);
  const e = nouvelId('e');
  assert.equal((await ecrire(coach, 'valorant', 'partenaires', e, { nom: 'Kraken eSport', incidents: [{ date: '2026-10-10', type: 'retard' }] })).statut, 200);
  assert.equal((await ecrire(coach, 'valorant', 'scrims', nouvelId('x'), { date: '2026-10-16', adversaire: 'Kraken eSport', partenaire: e, map: 'lotus', scoreNous: 13, scoreEux: 11 })).statut, 200);
  assert.equal((await ecrire(coach, 'valorant', 'seances', 'pas-un-id', { semaine: '2026-W43' })).statut, 400);

  const sync = (await coach.get(`/api/e/valorant/sync?rev=${depart}`)).json.docs;
  assert.deepEqual([sync.seances.length, sync.tournois[0].nom, sync.partenaires[0].incidents[0].type], [1, 'Coupe de France', 'retard']);
  assert.equal((await coach.del(`/api/e/valorant/c/tournois/${t}`)).statut, 200);
  assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((x) => x.action === 'suppression tournois' && x.cible === t));
  assert.equal((await coach.get('/api/e/lol/donnees')).json.donnees.tournois.length, 0, 'propres à chaque jeu');
});

test('avis : seulement sur des candidats, un seul par personne et par candidat', async () => {
  const k = nouvelId('k');
  await ecrire(admin, 'valorant', 'candidats', k, { pseudo: 'Orion' });
  const v = await admin.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'pour', commentaire: 'Solide', choix: ['o1'] } });
  assert.equal(v.statut, 200);
  assert.deepEqual([v.json.doc._id, v.json.doc.cible, v.json.doc.compteId, v.json.doc.avis, v.json.doc.choix], [`${k}_${admin.id}`, k, admin.id, 'pour', undefined]);
  assert.equal((await admin.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'contre' } })).json.doc.avis, 'contre');
  assert.equal(await sim.espace('valorant').stockage.compter('votes', { cible: k }), 1, 'un avis modifié remplace le précédent');
  const [membre] = await sim.joueurs('valorant');
  assert.equal((await admin.put(`/api/e/valorant/votes/${membre._id}`, { valeur: { avis: 'pour' } })).statut, 400, 'un membre n’est pas un candidat');
  assert.equal((await admin.put(`/api/e/valorant/votes/${nouvelId('s')}`, { valeur: { avis: 'pour' } })).statut, 400);
  assert.equal((await admin.put('/api/e/valorant/votes/k-zzzzzzzzzz', { valeur: { avis: 'pour' } })).statut, 404);
  assert.equal((await admin.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'peut-etre' } })).statut, 400);
  assert.deepEqual((await admin.del(`/api/e/valorant/votes/${k}`)).json, { ok: true });
  assert.equal(await sim.espace('valorant').stockage.compter('votes', { cible: k }), 0);
});

test('conflit : une fiche modifiée pendant l’édition est refusée (409) au lieu d’être écrasée', async () => {
  const id = nouvelId('s');
  const base = stratPour('valorant', 'Default');
  const v1 = (await ecrire(admin, 'valorant', 'strats', id, base, { revBase: 0 })).json.doc;
  assert.equal((await ecrire(coach, 'valorant', 'strats', id, { ...base, nom: 'Version B' }, { revBase: v1.rev })).statut, 200);
  const conflit = await ecrire(admin, 'valorant', 'strats', id, { ...base, nom: 'Version A' }, { revBase: v1.rev });
  assert.equal(conflit.statut, 409);
  assert.equal(conflit.json.erreur.details.actuelle.nom, 'Version B');
  assert.equal((await ecrire(admin, 'valorant', 'strats', id, base, { revBase: 0 })).statut, 409, 'création en double');
  assert.equal((await sim.espace('valorant').stockage.lire('strats', id)).nom, 'Version B');
  assert.equal((await ecrire(admin, 'valorant', 'strats', nouvelId('s'), base, { revBase: 3 })).statut, 409, 'fiche disparue');
});

test('plafonds par collection : nouvelle fiche refusée à la limite, mise à jour toujours possible', async () => {
  const st = sim.espace('apex').stockage;
  const ids = [];
  for (let i = 0; i < 300; i += 1) {
    ids.push(nouvelId('d'));
    await st.ecrire('adversaires', { _id: ids.at(-1), nom: `Adversaire ${i}`, rev: 0 });
  }
  const refus = await ecrire(admin, 'apex', 'adversaires', nouvelId('d'), { nom: 'Un de trop' });
  assert.equal(refus.statut, 409);
  assert.match(refus.json.erreur.message, /Limite atteinte \(300 fiches\)/);
  assert.equal((await ecrire(admin, 'apex', 'adversaires', ids[0], { nom: 'Renommé' })).statut, 200);
  assert.equal(await sim.espace('valorant').stockage.compter('adversaires') < 300, true, 'plafond propre à chaque jeu');
  assert.equal((await ecrire(admin, 'valorant', 'adversaires', nouvelId('d'), { nom: 'Ailleurs' })).statut, 200);

  const membres = await st.compter('membres');
  for (let i = membres; i < 60; i += 1) await st.ecrire('membres', { _id: nouvelId('m'), type: 'joueur', statut: 'essai', pseudo: `J${i}`, rev: 0 });
  assert.equal((await ecrire(admin, 'apex', 'membres', nouvelId('m'), { type: 'joueur', statut: 'essai', pseudo: 'Soixante et un' })).statut, 409);
  const k = nouvelId('k');
  await ecrire(admin, 'apex', 'candidats', k, { pseudo: 'Recrue' });
  assert.equal((await admin.post(`/api/e/apex/candidats/${k}/essai`)).statut, 409, 'passage à l’essai bloqué aussi');
});

test('chiffres de la semaine : valeurs selon les chiffres du jeu, rang du jeu', async () => {
  const [v0] = await sim.joueurs('valorant');
  const [l0] = await sim.joueurs('lol');
  const r = await admin.put(`/api/e/valorant/mesures/${v0._id}/2026-W43`, { valeur: { rang: 'diamant1', valeurs: { hs: '21,54', acs: 231, kd: 1.137, kda: 3 }, parties: 9, note: 'Bonne semaine' } });
  assert.equal(r.statut, 200);
  assert.deepEqual([r.json.doc.rang, r.json.doc.valeurs, r.json.doc.parties], ['diamant1', { hs: 21.5, acs: 231, kd: 1.14 }, 9]);
  const lol = await admin.put(`/api/e/lol/mesures/${l0._id}/2026-W43`, { valeur: { valeurs: { kda: 3.456, cs: 7.25, hs: 20 } } });
  assert.equal(lol.statut, 200);
  assert.deepEqual(lol.json.doc.valeurs, { kda: 3.46, cs: 7.3, kp: null, vision: null });
  assert.equal((await admin.put(`/api/e/lol/mesures/${l0._id}/2026-W43`, { valeur: { rang: 'radiant' } })).statut, 400, 'rang d’un autre jeu');
  const horsBornes = await admin.put(`/api/e/valorant/mesures/${v0._id}/2026-W43`, { valeur: { valeurs: { kd: 11 } } });
  assert.equal(horsBornes.statut, 400);
  assert.deepEqual(horsBornes.json.erreur.details.map((e) => e.chemin), ['valeurs.kd']);
  assert.equal((await admin.put(`/api/e/lol/mesures/${v0._id}/2026-W43`, { valeur: {} })).statut, 404, 'membre d’un autre jeu');
});

test('visites, jeu par jeu : « quoi de neuf » part de la dernière activité de la visite précédente', async () => {
  const joueur = await compteConnecte(sim, { identifiant: 'visiteur', acces: { valorant: 'joueur', lol: 'joueur' } });
  const t0 = sim.maintenant().toISOString();
  assert.equal((await joueur.get('/api/e/valorant/donnees')).json.depuis, null, 'première visite');
  sim.maintenant.avancer(30 * 60_000);
  await joueur.get('/api/e/valorant/sync?rev=0'); // activité : la visite continue
  const t1 = sim.maintenant().toISOString();
  const visites = (await compteGlobal(sim, 'visiteur')).visites;
  assert.deepEqual(visites.valorant, { debut: t0, dernier: t1, precedente: null });
  assert.equal(visites.lol, undefined);

  sim.maintenant.avancer(3 * 3600_000);
  assert.equal((await joueur.get('/api/e/valorant/donnees')).json.depuis, t1, 'nouvelle visite après 2 h sans activité');
  sim.maintenant.avancer(60_000);
  assert.equal((await joueur.get('/api/e/valorant/donnees')).json.depuis, t1, 'stable pendant la visite');
  assert.equal((await joueur.get('/api/e/lol/donnees')).json.depuis, null, 'chaque jeu a ses visites');
});

test('semaine en cours créée depuis la semaine type à la première visite du jeu, une seule fois', async () => {
  const local = await demarrer({ automatismes: true, jeux: ['valorant', 'lol'], env: { ANTHROPIC_API_KEY: '' } });
  try {
    const joueur = await compteConnecte(local, { identifiant: 'lundi', acces: { valorant: 'joueur', lol: 'joueur' } });
    const st = local.espace('valorant').stockage;
    const semaine = semaineIso(dateCivile(local.maintenant(), 'Europe/Paris'));
    assert.equal(semaine, '2026-W43');
    assert.equal(await st.lire('planning', semaine), null);

    await joueur.get('/api/e/valorant/donnees');
    await attendreQue(async () => !!(await st.lire('planning', semaine)), { message: 'semaine créée' });
    const modele = await st.lire('planning', 'modele');
    const creee = await st.lire('planning', semaine);
    assert.equal(creee.blocs.length, modele.blocs.length);
    assert.equal(creee.ebauche, modele.ebauche);
    assert.ok(creee.blocs.every((b, i) => b.id !== modele.blocs[i].id && /^b-[a-z0-9]{10}$/.test(b.id)), 'identifiants de blocs neufs');
    assert.equal(creee.maj.par, 'systeme');
    assert.equal(await local.espace('lol').stockage.lire('planning', semaine), null, 'un jeu non visité n’est pas touché');

    local.maintenant.avancer(5 * 60_000);
    await joueur.get('/api/e/valorant/sync?rev=0');
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal((await st.lire('planning', semaine)).rev, creee.rev, 'pas recréée');

    local.maintenant.avancer(7 * 86_400_000);
    await joueur.get('/api/e/valorant/donnees');
    await attendreQue(async () => !!(await st.lire('planning', '2026-W44')), { message: 'semaine suivante créée' });
  } finally {
    await local.arreter();
  }
});
