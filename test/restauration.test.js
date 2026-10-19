// Sauvegarde (export JSON d'un jeu) et restauration : même jeu seulement, Réglages du jeu d'abord, silencieuse,
// fiches revalidées, champs techniques déduits de l'identifiant, plafonds vérifiés avant toute écriture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, compteConnecte, compteGlobal, pause, stratPour, metaDe, WEBHOOK } from './simulation.js';
import { COLLECTIONS_SYNC } from '../src/domaine/collections.js';
import { nouvelId } from '../shared/validation.js';

async function preparer() {
  const sim = await demarrer({ jeux: ['valorant', 'lol'] });
  const admin = await adminPret(sim);
  return { sim, admin, st: sim.espace('valorant').stockage };
}

async function exporter(admin, jeu = 'valorant') {
  const r = await admin.get(`/api/e/${jeu}/export`);
  assert.equal(r.statut, 200);
  return JSON.parse(r.texte);
}

test('export : format lugh version 2 avec le jeu et le modèle, sans mot de passe ni webhook', async () => {
  const { sim, admin } = await preparer();
  try {
    await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK });
    await admin.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: stratPour('valorant', 'Exportée') });
    await compteConnecte(sim, { identifiant: 'joueur-val', acces: { valorant: 'joueur' } });
    await compteConnecte(sim, { identifiant: 'joueur-lol', acces: { lol: 'joueur' } });
    const r = await admin.get('/api/e/valorant/export');
    assert.equal(r.statut, 200);
    assert.match(r.entetes.get('content-type'), /^application\/json/);
    assert.equal(r.entetes.get('content-disposition'), 'attachment; filename="lugh-valorant-sauvegarde-2026-10-21.json"');
    assert.equal(r.entetes.get('cache-control'), 'no-store');
    const s = JSON.parse(r.texte);
    assert.deepEqual([s.format, s.version, s.espace, s.modele, s.nomJeu, s.exporteLe], ['lugh', 2, 'valorant', 'valorant', 'Valorant', sim.maintenant().toISOString()]);
    for (const coll of COLLECTIONS_SYNC) assert.ok(Array.isArray(s[coll]), coll);
    assert.equal('reglages' in s, false);
    assert.ok(s.strats.some((x) => x.nom === 'Exportée'));
    assert.deepEqual(s.comptes.map((c) => c.identifiant).sort(), ['chef', 'joueur-val'], 'seulement les comptes de ce jeu');
    assert.ok(!r.texte.includes('scrypt$') && !r.texte.includes('"hash"'));
    assert.ok(!r.texte.includes(WEBHOOK.split('/').at(-1)), 'jamais le webhook');
    assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((e) => e.action === 'export des données'));
  } finally {
    await sim.arreter();
  }
});

test('restauration refusée : autre jeu, autre modèle, autre format ou version, mauvais métier', async () => {
  const { sim, admin, st } = await preparer();
  try {
    const s = await exporter(admin);
    const avant = await st.compter('membres');
    const autreJeu = await admin.post('/api/e/lol/restaurer', s);
    assert.equal(autreJeu.statut, 400);
    assert.match(autreJeu.json.erreur.message, /autre jeu \(Valorant\)/);
    for (const faux of [{ ...s, version: 1 }, { ...s, format: 'qg-valorant' }, { ...s, modele: 'cs2' }, { ...s, espace: 'lol' }, {}]) {
      assert.equal((await admin.post('/api/e/valorant/restaurer', faux)).statut, 400, JSON.stringify({ ...faux, membres: undefined }).slice(0, 80));
    }
    assert.equal((await admin.post('/api/e/valorant/restaurer', '[1, 2]')).statut, 400, 'pas un objet JSON');
    const hc = await compteConnecte(sim, { identifiant: 'hc', acces: { valorant: ['headcoach'] } });
    assert.equal((await hc.post('/api/e/valorant/restaurer', s)).statut, 403);
    assert.equal(await st.compter('membres'), avant);
  } finally {
    await sim.arreter();
  }
});

test('restauration : la sauvegarde remplace les fiches du jeu ; comptes, méta et Discord ne bougent pas', async () => {
  const { sim, admin, st } = await preparer();
  try {
    await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK });
    const s1 = nouvelId('s');
    await admin.put(`/api/e/valorant/c/strats/${s1}`, { valeur: stratPour('valorant', 'À garder') });
    const [m0] = await sim.joueurs('valorant');
    const sauvegarde = await exporter(admin);

    await admin.del(`/api/e/valorant/c/strats/${s1}`);
    const s2 = nouvelId('s');
    await admin.put(`/api/e/valorant/c/strats/${s2}`, { valeur: stratPour('valorant', 'Après la sauvegarde') });
    await admin.put(`/api/e/valorant/c/membres/${m0._id}`, { valeur: { type: 'joueur', statut: 'titulaire', pseudo: 'Renommé après' } });
    const meta = { ...metaDe('valorant'), patch: '13.09', patchDate: '2026-10-27' };
    assert.equal((await admin.post('/api/e/valorant/meta/importer', { texte: JSON.stringify(meta) })).statut, 200);
    await compteConnecte(sim, { identifiant: 'nouveau', acces: { valorant: 'joueur' } });
    const comptes = await sim.global.compter('comptes');
    const rev = (await admin.get('/api/e/valorant/sync?rev=0')).json.rev;

    const r = await admin.post('/api/e/valorant/restaurer', sauvegarde);
    assert.equal(r.statut, 200, r.texte);
    assert.equal(r.json.ignores, 0);
    assert.deepEqual(r.json.details, []);
    assert.ok(r.json.restaures > 10);
    assert.equal(r.json.supprimes, 1, 'la strat créée après la sauvegarde');
    assert.equal((await st.lire('strats', s1)).nom, 'À garder');
    assert.equal(await st.lire('strats', s2), null);
    assert.equal((await st.lire('membres', m0._id)).pseudo, m0.pseudo);
    assert.equal((await st.lire('meta', 'courante')).patch, '13.09', 'la méta n’est jamais restaurée');
    assert.equal(await sim.global.compter('comptes'), comptes, 'les comptes ne bougent pas');
    assert.ok(await compteGlobal(sim, 'nouveau'));
    assert.equal((await admin.get('/api/e/valorant/reglages')).json.discord.configure, true);
    const sync = (await admin.get(`/api/e/valorant/sync?rev=${rev}`)).json;
    assert.ok(sync.suppressions.some((x) => x.id === s2), 'les autres appareils apprennent la suppression');
    assert.ok(sync.docs.strats.some((x) => x._id === s1));
    assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((e) => e.action === 'sauvegarde restaurée'));
  } finally {
    await sim.arreter();
  }
});

test('restauration : les Réglages du jeu de la sauvegarde passent en premier et servent à valider les fiches', async () => {
  const { sim, admin, st } = await preparer();
  try {
    const { modele } = (await admin.get('/api/e/valorant/reglages-jeu')).json;
    const roles = [...modele.roles, { id: 'ancre', nom: 'Ancre', court: 'ANC' }];
    assert.equal((await admin.put('/api/e/valorant/reglages-jeu', { valeur: { listes: { roles } } })).statut, 200);
    const id = nouvelId('m');
    assert.equal((await admin.put(`/api/e/valorant/c/membres/${id}`, { valeur: { type: 'joueur', statut: 'titulaire', pseudo: 'Roc', roleJeu: 'ancre' } })).statut, 200);
    const sauvegarde = await exporter(admin);
    assert.ok(sauvegarde.jeu.some((d) => d._id === 'reglages'));

    assert.equal((await admin.put('/api/e/valorant/reglages-jeu', { valeur: {} })).statut, 200, 'retour au modèle : « ancre » n’existe plus');
    await admin.del(`/api/e/valorant/c/membres/${id}`);
    assert.equal((await admin.put(`/api/e/valorant/c/membres/${id}`, { valeur: { type: 'joueur', statut: 'titulaire', roleJeu: 'ancre' } })).statut, 400);

    const r = await admin.post('/api/e/valorant/restaurer', sauvegarde);
    assert.equal(r.statut, 200, r.texte);
    assert.equal(r.json.ignores, 0, 'le membre « ancre » est valide avec les Réglages de la sauvegarde');
    assert.equal((await st.lire('membres', id)).roleJeu, 'ancre');
    assert.ok((await admin.get('/api/e/valorant/reglages-jeu')).json.reglages.listes.roles.some((x) => x.id === 'ancre'));
    assert.ok((await admin.get('/api/e/valorant/donnees')).json.definition.roles.some((x) => x.id === 'ancre'), 'définition rechargée');

    // Réglages invalides dans le fichier : ignorés, les fiches sont validées avec les Réglages actuels.
    const casse = structuredClone(sauvegarde);
    casse.jeu = [{ _id: 'reglages', listes: { roles: [{ id: 'ancre', nom: 'Ancre' }] } }];
    const r2 = await admin.post('/api/e/valorant/restaurer', casse);
    assert.equal(r2.statut, 200);
    assert.ok(r2.json.details.includes('jeu reglages'));
    assert.ok((await admin.get('/api/e/valorant/reglages-jeu')).json.reglages.listes.roles.some((x) => x.id === 'duelliste'), 'réglages actuels gardés');
  } finally {
    await sim.arreter();
  }
});

test('restauration silencieuse : aucun message Discord pour les fiches remises en place', async () => {
  const { sim, admin, st } = await preparer();
  try {
    await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK });
    const sauvegarde = await exporter(admin);
    const [m0] = await sim.joueurs('valorant');
    sauvegarde.scrims = [1, 2, 3].map((n) => ({ _id: nouvelId('x'), date: `2026-10-1${n}`, adversaire: `Équipe ${n}`, map: 'haven', campDepart: 'att', scoreNous: 13, scoreEux: n }));
    sauvegarde.absences = [{ _id: nouvelId('a'), membreId: m0._id, date: '2026-10-30' }];
    sauvegarde.adversaires = [{ _id: nouvelId('d'), nom: 'Kraken', prochainMatch: { date: '2026-10-30', heure: '20:00', format: 'bo3' } }];
    const n = sim.discord.envois.length;
    const r = await admin.post('/api/e/valorant/restaurer', sauvegarde);
    assert.equal(r.statut, 200, r.texte);
    assert.equal(await st.compter('scrims'), 3);
    assert.equal(await st.compter('absences'), 1);
    await pause(100);
    assert.equal(sim.discord.envois.length, n, 'rien n’est posté dans Discord');
  } finally {
    await sim.arreter();
  }
});

test('restauration : fiches invalides ignorées, champs techniques déduits de l’identifiant, avis orphelins ignorés', async () => {
  const { sim, admin, st } = await preparer();
  try {
    const [m0] = await sim.joueurs('valorant');
    const vod = nouvelId('v');
    await admin.put(`/api/e/valorant/c/vods/${vod}`, { valeur: { titre: 'Scrim', lien: 'https://example.com/v' } });
    await admin.put('/api/e/valorant/c/equipe/profil', { valeur: { nom: 'Équipe actuelle', tag: 'ACT' } });
    const s = await exporter(admin);
    const k = nouvelId('k');
    const noteOk = nouvelId('n');
    s.equipe = [{ _id: 'profil', nom: 'Invalide', tag: 'minuscules' }];
    s.strats.push({ _id: 'pas-un-id', nom: 'invalide' }, { _id: nouvelId('s'), nom: 'Sans type ni map' });
    s.mesures = [{ _id: `${m0._id}_2026-W40`, valeurs: { hs: 20 }, semaine: 'pas-une-semaine', membreId: 'autre' }];
    s.dispos = [{ _id: `2026-W40_${m0._id}`, creneaux: { 1: [20] }, semaine: 'x', membreId: 'y' }];
    s.candidats = [{ _id: k, pseudo: 'Nova', twitch: 'twitch.tv/Nova_TV' }];
    s.votes = [
      { _id: `${k}_${admin.id}`, avis: 'contre', cible: 'falsifie', compteId: 'falsifie' },
      { _id: `k-${'a'.repeat(10)}_c-${'b'.repeat(10)}`, avis: 'pour' },
    ];
    s.vodNotes = [{ _id: nouvelId('n'), vodId: vod, texte: 'Auteur bidon', auteur: '<script>' }, { _id: noteOk, vodId: vod, texte: 'Bonne note', auteur: admin.id }];

    const r = await admin.post('/api/e/valorant/restaurer', s);
    assert.equal(r.statut, 200, r.texte);
    assert.equal(r.json.ignores, 5);
    for (const d of ['equipe profil', 'strats pas-un-id', 'votes k-aaaaaaaaaa_c-bbbbbbbbbb']) assert.ok(r.json.details.includes(d), d);
    assert.equal((await st.lire('equipe', 'profil')).nom, 'Équipe actuelle', 'fiche invalide : la version actuelle reste');
    const mesure = await st.lire('mesures', `${m0._id}_2026-W40`);
    assert.deepEqual([mesure.membreId, mesure.semaine, mesure.valeurs.hs], [m0._id, '2026-W40', 20]);
    const dispo = await st.lire('dispos', `2026-W40_${m0._id}`);
    assert.deepEqual([dispo.semaine, dispo.membreId], ['2026-W40', m0._id]);
    const vote = await st.lire('votes', `${k}_${admin.id}`);
    assert.deepEqual([vote.cible, vote.compteId, vote.avis], [k, admin.id, 'contre']);
    assert.equal(await st.compter('votes'), 1);
    assert.equal((await st.lire('candidats', k)).twitch, 'nova_tv', 'revalidé : nom de chaîne normalisé');
    assert.deepEqual((await st.lister('vodNotes')).map((n) => n._id), [noteOk]);
  } finally {
    await sim.arreter();
  }
});

test('restauration : plafonds vérifiés avant toute écriture', async () => {
  const { sim, admin, st } = await preparer();
  try {
    const s1 = nouvelId('s');
    await admin.put(`/api/e/valorant/c/strats/${s1}`, { valeur: stratPour('valorant', 'Avant') });
    const s = await exporter(admin);
    await admin.del(`/api/e/valorant/c/strats/${s1}`);
    const { modele } = (await admin.get('/api/e/valorant/reglages-jeu')).json;
    s.jeu = [{ _id: 'reglages', listes: { roles: [...modele.roles, { id: 'ancre', nom: 'Ancre' }] } }];
    s.adversaires = Array.from({ length: 301 }, (_, i) => ({ _id: nouvelId('d'), nom: `Adversaire ${i}` }));
    const r = await admin.post('/api/e/valorant/restaurer', s);
    assert.equal(r.statut, 400);
    assert.match(r.json.erreur.message, /301 fiches « adversaires », 300 au maximum/);
    assert.equal(await st.lire('strats', s1), null, 'rien n’a été restauré');
    assert.equal(await st.compter('adversaires'), 0);
    assert.equal(await st.lire('jeu', 'reglages'), null, 'pas même les Réglages');
  } finally {
    await sim.arreter();
  }
});

test('point de restauration : l’état d’avant est gardé, la restauration s’annule (et l’annulation aussi)', async () => {
  const { sim, admin, st } = await preparer();
  try {
    assert.deepEqual((await admin.get('/api/e/valorant/restauration')).json, { point: null });
    const annulerSansPoint = await admin.post('/api/e/valorant/restauration/annuler');
    assert.equal(annulerSansPoint.statut, 404);
    assert.match(annulerSansPoint.json.erreur.message, /Aucune restauration à annuler/);

    const a = nouvelId('s');
    await admin.put(`/api/e/valorant/c/strats/${a}`, { valeur: stratPour('valorant', 'État A') });
    const sauvegarde = await exporter(admin);
    await admin.del(`/api/e/valorant/c/strats/${a}`);
    const b = nouvelId('s');
    await admin.put(`/api/e/valorant/c/strats/${b}`, { valeur: stratPour('valorant', 'État B') });
    const fichesB = (await Promise.all(['membres', 'mapsEquipe', 'planning', 'equipe', 'strats'].map((c) => st.compter(c)))).reduce((x, y) => x + y, 0);

    sim.maintenant.avancer(60_000);
    const r = await admin.post('/api/e/valorant/restaurer', sauvegarde);
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.point, { le: sim.maintenant().toISOString(), par: 'chef', source: sauvegarde.exporteLe, fiches: fichesB, interrompue: false });
    assert.ok(await st.lire('strats', a));
    assert.equal(await st.lire('strats', b), null);

    const annule = await admin.post('/api/e/valorant/restauration/annuler');
    assert.equal(annule.statut, 200, annule.texte);
    assert.equal(annule.json.point.source, 'annulation');
    assert.equal(await st.lire('strats', a), null, 'retour à l’état d’avant la restauration');
    assert.equal((await st.lire('strats', b)).nom, 'État B');
    assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((e) => e.action === 'restauration annulée'));

    assert.equal((await admin.post('/api/e/valorant/restauration/annuler')).statut, 200, 'annuler l’annulation');
    assert.ok(await st.lire('strats', a));
    assert.equal(await st.lire('strats', b), null);
    assert.deepEqual((await admin.get('/api/e/lol/restauration')).json, { point: null }, 'un point par jeu');

    const hc = await compteConnecte(sim, { identifiant: 'hc', acces: { valorant: ['headcoach'] } });
    assert.equal((await hc.get('/api/e/valorant/restauration')).statut, 403);
    assert.equal((await hc.post('/api/e/valorant/restauration/annuler')).statut, 403);
  } finally {
    await sim.arreter();
  }
});

test('annuler une restauration remet aussi les Réglages d’avant, même quand le jeu suivait encore le modèle', {
}, async () => {
  const { sim, admin, st } = await preparer();
  try {
    const x = nouvelId('x');
    const scrim = { date: '2026-10-15', adversaire: 'Orage', map: 'haven', campDepart: 'att', mtNous: 7, mtEux: 5, scoreNous: 13, scoreEux: 9, pistols: { att: 'gagne', def: 'perdu' } };
    assert.equal((await admin.put(`/api/e/valorant/c/scrims/${x}`, { valeur: scrim })).statut, 200);
    assert.equal(await st.lire('jeu', 'reglages'), null, 'le jeu suit encore son modèle');

    const sauvegarde = await exporter(admin);
    sauvegarde.jeu = [{ _id: 'reglages', score: { type: 'simple' } }];
    sauvegarde.scrims = [];
    assert.equal((await admin.post('/api/e/valorant/restaurer', sauvegarde)).statut, 200);
    assert.equal((await admin.get('/api/e/valorant/donnees')).json.definition.score.type, 'simple');

    assert.equal((await admin.post('/api/e/valorant/restauration/annuler')).statut, 200);
    assert.equal((await admin.get('/api/e/valorant/donnees')).json.definition.score.type, 'manches', 'Réglages d’avant : ceux du modèle');
    const revenu = await st.lire('scrims', x);
    assert.deepEqual([revenu.campDepart, revenu.mtNous, revenu.pistols], ['att', 7, { att: 'gagne', def: 'perdu' }], 'scrim remis à l’identique');
  } finally {
    await sim.arreter();
  }
});
