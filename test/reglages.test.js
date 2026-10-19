// Réglages du jeu (/api/e/:jeu/reglages-jeu) et notifications Discord de chaque jeu (/api/e/:jeu/reglages…).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, compteConnecte, attendreQue, pause, stratPour, WEBHOOK } from './simulation.js';
import { reglagesVides } from '../shared/jeux/reglages-jeu.js';
import { actifs } from '../shared/jeux/definition.js';
import { nouvelId } from '../shared/validation.js';
import { semaineCourante, numeroSemaine } from '../shared/temps.js';
import { MARQUE } from '../shared/marque.js';

const nomDiscord = (court) => `${MARQUE.nom} ${court}`.slice(0, 32);

const WEBHOOK_LOL = 'https://discord.com/api/webhooks/987654321098765432/ZYXWVUTSRQPONMLKJIHGFEDCBA_lol-654321';

let sim;
let admin;
before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol', 'apex'], delaiPlanningMs: 400 }); // planning regroupé : marge large sous charge
  admin = await adminPret(sim);
});
after(() => sim.arreter());

async function lireReglages(jeu) {
  const r = await admin.get(`/api/e/${jeu}/reglages-jeu`);
  assert.equal(r.statut, 200);
  return r.json;
}

const envoisDepuis = (n) => sim.discord.envois.slice(n);

// ——— Réglages du jeu ———

test('lecture des Réglages du jeu : modèle complet sans sa méta, réglages vides, nombre de scrims', async () => {
  const r = await lireReglages('valorant');
  assert.equal(r.modele.id, 'valorant');
  assert.equal('initiale' in r.modele, false, 'la méta initiale ne fait pas partie des réglages');
  assert.deepEqual(r.modele.roles.map((x) => x.id), ['duelliste', 'initiateur', 'controleur', 'sentinelle', 'flex']);
  assert.deepEqual(r.modele.score, { type: 'manches', gagnant: 13, miTemps: 12, pistols: true });
  assert.deepEqual(r.reglages, reglagesVides());
  assert.deepEqual([r.rev, r.nom, r.court, r.scrims], [0, 'Valorant', 'VAL', 0]);
});

test('enregistrement refusé avec le détail des erreurs : rien n’est écrit', async () => {
  const { modele } = await lireReglages('valorant');
  const r = await admin.put('/api/e/valorant/reglages-jeu', { valeur: { listes: { roles: modele.roles.filter((x) => x.id !== 'flex') } } });
  assert.equal(r.statut, 400);
  assert.equal(r.json.erreur.code, 'invalide');
  assert.ok(r.json.erreur.details.some((e) => /« Flex » vient du modèle/.test(e.message)));
  assert.equal((await lireReglages('valorant')).rev, 0);
  assert.equal(await sim.espace('valorant').stockage.compter('jeu'), 0);
});

test('enregistrement : définition rechargée et renvoyée, nouveau rôle et nouveau chiffre utilisables aussitôt, signal par la synchronisation', async () => {
  const coach = await compteConnecte(sim, { identifiant: 'coach', acces: { valorant: ['headcoach'] } });
  const depart = (await coach.get('/api/e/valorant/donnees')).json.rev;
  const { modele } = await lireReglages('valorant');
  const roles = [...modele.roles.map((x) => (x.id === 'flex' ? { ...x, archive: true } : x)), { id: 'ancre', nom: 'Ancre', court: 'ANC', resume: 'Tient un site seul.' }];
  const chiffres = [...modele.chiffres, { id: 'clutch', nom: 'Clutchs gagnés', unite: '', min: 0, max: 20, decimales: 0, aide: '' }];
  const r = await admin.put('/api/e/valorant/reglages-jeu', { valeur: { listes: { roles, chiffres } }, revBase: 0 });
  assert.equal(r.statut, 200, r.texte);
  assert.equal(r.json.doc._id, 'reglages');
  assert.deepEqual(actifs(r.json.definition.roles).map((x) => x.id), ['duelliste', 'initiateur', 'controleur', 'sentinelle', 'ancre']);
  assert.ok(r.json.definition.chiffres.some((x) => x.id === 'clutch'));

  // Les autres appareils reçoivent la fiche « jeu » : signal pour recharger la définition.
  const sync = (await coach.get(`/api/e/valorant/sync?rev=${depart}`)).json;
  assert.deepEqual(sync.docs.jeu.map((d) => d._id), ['reglages']);
  const d = (await coach.get('/api/e/valorant/donnees')).json;
  assert.ok(d.definition.roles.some((x) => x.id === 'ancre'));

  const id = nouvelId('m');
  assert.equal((await admin.put(`/api/e/valorant/c/membres/${id}`, { valeur: { type: 'joueur', statut: 'titulaire', pseudo: 'Roc', roleJeu: 'ancre' } })).statut, 200);
  const mesure = await admin.put(`/api/e/valorant/mesures/${id}/2026-W43`, { valeur: { valeurs: { clutch: 4, hs: 20 } } });
  assert.deepEqual(mesure.json.doc.valeurs, { hs: 20, acs: null, kd: null, clutch: 4 });
  assert.equal((await admin.put(`/api/e/lol/c/membres/${nouvelId('m')}`, { valeur: { type: 'joueur', statut: 'titulaire', roleJeu: 'ancre' } })).statut, 400, 'LoL n’est pas touché');

  const relu = await lireReglages('valorant');
  assert.equal(relu.rev, r.json.doc.rev);
  assert.ok(relu.reglages.listes.roles.some((x) => x.id === 'ancre'));
  assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((e) => e.action === 'réglages du jeu modifiés'));
});

test('type de score figé une fois des scrims enregistrés ; barème, taille du lobby et points de victoire restent modifiables', async () => {
  await sim.creerJeu('fc'); // score simple dans le modèle
  const classement = { type: 'classement', equipes: 16, bareme: { places: [10, 6, 4, 3, 2, 1], elimination: 1 } };
  const r = await admin.put('/api/e/fc/reglages-jeu', { valeur: { score: classement } });
  assert.equal(r.statut, 200, 'aucun scrim : changement libre');
  assert.equal(r.json.definition.score.type, 'classement');
  assert.equal((await admin.put(`/api/e/fc/c/scrims/${nouvelId('x')}`, { valeur: { date: '2026-10-15', adversaire: 'Lobby', scoreNous: 2, scoreEux: 1 } })).statut, 400);
  assert.equal((await admin.put(`/api/e/fc/c/scrims/${nouvelId('x')}`, { valeur: { date: '2026-10-15', adversaire: 'Lobby', place: 2 } })).statut, 200);
  assert.equal((await lireReglages('fc')).scrims, 1);

  const refus = await admin.put('/api/e/fc/reglages-jeu', { valeur: { score: { type: 'simple' } } });
  assert.equal(refus.statut, 409);
  assert.match(refus.json.erreur.message, /type de score/);
  assert.equal((await admin.put('/api/e/fc/reglages-jeu', { valeur: {} })).statut, 409, 'revenir au modèle change aussi le type');
  const bareme = await admin.put('/api/e/fc/reglages-jeu', { valeur: { score: { ...classement, equipes: 20, bareme: { places: [12, 8, 5], elimination: 2 } } } });
  assert.equal(bareme.statut, 200, bareme.texte);
  assert.deepEqual(bareme.json.definition.score, { type: 'classement', equipes: 20, bareme: { places: [12, 8, 5], elimination: 2 } });

  // Manches : la longueur d'une mi-temps décide de la forme des scrims ; le reste peut changer.
  assert.equal((await admin.put(`/api/e/valorant/c/scrims/${nouvelId('x')}`, { valeur: { date: '2026-10-15', adversaire: 'Orage', map: 'haven', campDepart: 'att', scoreNous: 13, scoreEux: 9 } })).statut, 200);
  const { reglages } = await lireReglages('valorant');
  const avec = (score) => admin.put('/api/e/valorant/reglages-jeu', { valeur: { ...reglages, score } });
  assert.equal((await avec({ type: 'manches', gagnant: 13, miTemps: 6, pistols: true })).statut, 409);
  assert.equal((await avec({ type: 'simple' })).statut, 409);
  const gagnant = await avec({ type: 'manches', gagnant: 7, miTemps: 12, pistols: false });
  assert.equal(gagnant.statut, 200, gagnant.texte);
  assert.deepEqual(gagnant.json.definition.score, { type: 'manches', gagnant: 7, miTemps: 12, pistols: false });
});

test('nom et nom court du jeu modifiés depuis les Réglages, partout', async () => {
  const { reglages, rev } = await lireReglages('apex');
  const r = await admin.put('/api/e/apex/reglages-jeu', { valeur: reglages, nom: '  Apex Académie ', court: 'APX-A', revBase: rev });
  assert.equal(r.statut, 200);
  assert.deepEqual([r.json.definition.nom, r.json.definition.court], ['Apex Académie', 'APX-A']);
  const moi = (await admin.get('/api/auth/moi')).json.jeux.find((j) => j.id === 'apex');
  assert.deepEqual([moi.nom, moi.court], ['Apex Académie', 'APX-A']);
  assert.equal((await admin.get('/api/admin/jeux')).json.jeux.find((j) => j.id === 'apex').nom, 'Apex Académie');
  const garde = await admin.put('/api/e/apex/reglages-jeu', { valeur: reglages, nom: '   ' });
  assert.equal(garde.json.definition.nom, 'Apex Académie', 'nom vide : ignoré');
});

test('conflit sur les Réglages : une version modifiée entre-temps est refusée et rien ne change', {
}, async () => {
  const local = await demarrer({ jeux: ['valorant'] });
  try {
    const chef = await adminPret(local);
    const { reglages, rev } = (await chef.get('/api/e/valorant/reglages-jeu')).json;
    assert.equal((await chef.put('/api/e/valorant/reglages-jeu', { valeur: reglages, revBase: rev })).statut, 200);
    const perime = await chef.put('/api/e/valorant/reglages-jeu', { valeur: reglages, revBase: rev, nom: 'Nom qui ne doit pas passer' });
    assert.equal(perime.statut, 409);
    assert.equal((await chef.get('/api/e/valorant/donnees')).json.jeu.nom, 'Valorant', 'le jeu ne doit pas être renommé par une requête refusée');
  } finally {
    await local.arreter();
  }
});

test('Réglages du jeu réservés au Responsable du jeu', async () => {
  const hc = await compteConnecte(sim, { identifiant: 'hc-apex', acces: { apex: ['headcoach'] } });
  assert.equal((await hc.get('/api/e/apex/reglages-jeu')).statut, 403);
  assert.equal((await hc.put('/api/e/apex/reglages-jeu', { valeur: {} })).statut, 403);
  const resp = await compteConnecte(sim, { identifiant: 'resp-apex', acces: { apex: ['responsable'] } });
  assert.equal((await resp.get('/api/e/apex/reglages-jeu')).statut, 200);
  assert.equal((await resp.get('/api/e/lol/reglages-jeu')).statut, 404);
});

// ——— Discord, un webhook par jeu ———

test('Discord : adresse vérifiée, secret jamais renvoyé (seulement ses 6 derniers caractères), un webhook par jeu', async () => {
  const vide = (await admin.get('/api/e/valorant/reglages')).json.discord;
  assert.deepEqual(vide, { configure: false, apercu: '', evenements: { planning: true, scrims: true, matchs: true, meta: true, absences: true } });
  for (const mauvais of ['https://exemple.com/hook', 'http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz', 'https://discord.com/api/webhooks/abc/def', 'javascript:alert(1)']) {
    const r = await admin.put('/api/e/valorant/reglages/discord', { webhook: mauvais });
    assert.equal(r.statut, 400, mauvais);
    assert.equal(r.json.erreur.code, 'webhook');
  }
  assert.equal((await admin.put('/api/e/valorant/reglages/discord', { webhook: 123 })).statut, 400);

  const ok = await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK, evenements: { absences: false } });
  assert.equal(ok.statut, 200);
  assert.deepEqual(ok.json.discord, {
    configure: true, apercu: `…${WEBHOOK.slice(-6)}`, evenements: { planning: true, scrims: true, matchs: true, meta: true, absences: false },
  });
  const secret = WEBHOOK.split('/').at(-1).slice(0, 20);
  for (const chemin of ['/api/e/valorant/reglages', '/api/e/valorant/donnees', '/api/e/valorant/sync?rev=0', '/api/e/valorant/export', '/api/e/valorant/etat', '/api/admin/etat']) {
    const r = await admin.get(chemin);
    assert.equal(r.statut, 200, chemin);
    assert.ok(!r.texte.includes(secret), `${chemin} : le webhook ne sort jamais`);
  }
  assert.equal((await admin.get('/api/e/lol/reglages')).json.discord.configure, false, 'LoL a son propre réglage');

  const sansAdresse = await admin.put('/api/e/valorant/reglages/discord', { evenements: { absences: false, meta: false } });
  assert.equal(sansAdresse.json.discord.configure, true, 'changer les événements garde l’adresse');
  assert.equal(sansAdresse.json.discord.evenements.meta, false);
  assert.equal((await admin.put('/api/e/valorant/reglages/discord', { supprimer: true })).json.discord.configure, false);
  assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((e) => e.action === 'réglages Discord modifiés'));
});

test('Discord : message de test sans aucune mention possible, au nom du jeu ; échec signalé', async () => {
  await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK });
  const n = sim.discord.envois.length;
  assert.equal((await admin.post('/api/e/valorant/discord/test')).statut, 200);
  const [envoi] = envoisDepuis(n);
  assert.equal(envoi.url, WEBHOOK);
  assert.equal(envoi.methode, 'POST');
  assert.deepEqual(envoi.corps.allowed_mentions, { parse: [] });
  assert.equal(envoi.corps.username, nomDiscord('VAL'));
  assert.ok(envoi.corps.content.startsWith('✅ ') && envoi.corps.content.includes('(Valorant)') && envoi.corps.content.includes('envoyé par chef'), envoi.corps.content);

  const sans = await admin.post('/api/e/lol/discord/test');
  assert.equal(sans.statut, 502);
  assert.match(sans.json.erreur.message, /Aucun webhook configuré/);
  sim.discord.statut = 404;
  try {
    const echec = await admin.post('/api/e/valorant/discord/test');
    assert.equal(echec.statut, 502);
    assert.match(echec.json.erreur.message, /Discord a répondu 404/);
  } finally {
    sim.discord.statut = 204;
  }
});

test('Discord : notifications par événement, textes selon le type de score, planning regroupé, échec sans conséquence', async () => {
  await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK, evenements: { absences: false } });
  await admin.put('/api/e/lol/reglages/discord', { webhook: WEBHOOK_LOL });
  await admin.put('/api/e/apex/reglages/discord', { webhook: WEBHOOK_LOL.replace('987654321098765432', '111111111111111111') });
  const n = sim.discord.envois.length;
  const attendreEnvois = (k) => attendreQue(() => sim.discord.envois.length >= n + k, { message: `${k} message(s) Discord` });

  const x = nouvelId('x');
  await admin.put(`/api/e/valorant/c/scrims/${x}`, { valeur: { date: '2026-10-15', adversaire: 'Orage', map: 'haven', campDepart: 'att', mtNous: 7, mtEux: 5, scoreNous: 13, scoreEux: 9, bien: 'Bons trades' } });
  await attendreEnvois(1);
  const [scrim] = envoisDepuis(n);
  assert.equal(scrim.url, WEBHOOK);
  assert.equal(scrim.corps.content, '✅ **Victoire 13–9** contre Orage sur Haven (scrim, 15 oct. 2026)\nAttaque 7–5, Défense 6–4\n👍 Bons trades');

  await admin.put(`/api/e/valorant/c/scrims/${x}`, { valeur: { date: '2026-10-15', adversaire: 'Orage', map: 'haven', scoreNous: 13, scoreEux: 10 } });
  const [membre] = await sim.joueurs('valorant');
  await admin.post('/api/e/valorant/absences', { valeur: { membreId: membre._id, date: '2026-10-28' } });
  await pause(60);
  assert.equal(sim.discord.envois.length, n + 1, 'scrim modifié et absence (désactivée) : aucun message');

  await admin.put(`/api/e/valorant/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Kraken', prochainMatch: { date: '2026-10-30', heure: '20:00', format: 'bo3' } } });
  await attendreEnvois(2);
  assert.match(envoisDepuis(n)[1].corps.content, /^⚔️ \*\*Prochain match : Kraken\*\* le 30 oct\. 2026 à 20:00 \(BO3\)/);

  const semaine = semaineCourante('Europe/Paris');
  const bloc = (titre) => ({ id: nouvelId('b'), jour: 3, debut: '20:00', fin: '22:00', type: 'scrim', titre, details: '', pour: 'equipe', membres: [], map: '' });
  await admin.put(`/api/e/valorant/c/planning/${semaine}`, { valeur: { blocs: [bloc('Scrim A')] } });
  await admin.put(`/api/e/valorant/c/planning/${semaine}`, { valeur: { blocs: [bloc('Scrim A'), bloc('Scrim B')] } });
  await attendreEnvois(3);
  await pause(80);
  const plannings = envoisDepuis(n).filter((e) => e.corps.content.includes('Planning'));
  assert.equal(plannings.length, 1, 'une rafale de modifications donne un seul message');
  assert.match(plannings[0].corps.content, new RegExp(`^📅 \\*\\*Planning Valorant, semaine ${numeroSemaine(semaine)}\\*\\*`));
  assert.match(plannings[0].corps.content, /Scrim B/);

  const avantLol = sim.discord.envois.length;
  await admin.put(`/api/e/lol/c/scrims/${nouvelId('x')}`, { valeur: { date: '2026-10-16', adversaire: 'Nébula', scoreNous: 2, scoreEux: 1 } });
  await attendreQue(() => sim.discord.envois.length > avantLol);
  const lol = sim.discord.envois.at(-1);
  assert.deepEqual([lol.url, lol.corps.username], [WEBHOOK_LOL, nomDiscord('LoL')]);
  assert.equal(lol.corps.content, '✅ **Victoire 2–1** contre Nébula (scrim, 16 oct. 2026)', 'score simple : pas de camps');

  const avantApex = sim.discord.envois.length;
  await admin.put(`/api/e/apex/c/scrims/${nouvelId('x')}`, { valeur: { date: '2026-10-17', adversaire: 'Lobby ALGS', map: 'stormpoint', type: 'tournoi', place: 1, eliminations: 9 } });
  await attendreQue(() => sim.discord.envois.length > avantApex);
  assert.equal(sim.discord.envois.at(-1).corps.content, '🏆 **1re / 20 · 9 élim.** · 21 pts : Lobby ALGS sur Storm Point (tournoi, 17 oct. 2026)', 'barème officiel : 12 + 9 × 1');

  sim.discord.statut = 500;
  try {
    const avant = sim.discord.envois.length;
    const r = await admin.put(`/api/e/valorant/c/scrims/${nouvelId('x')}`, { valeur: { date: '2026-10-18', adversaire: 'Brume', map: 'lotus', scoreNous: 5, scoreEux: 13 } });
    assert.equal(r.statut, 200, 'l’écriture réussit même si Discord échoue');
    await attendreQue(() => sim.discord.envois.length > avant);
    await attendreQue(async () => (await admin.get('/api/e/valorant/journal')).json.entrees.some((e) => e.action === 'échec d’une notification Discord' && /500/.test(e.details)));
  } finally {
    sim.discord.statut = 204;
  }
  assert.equal((await admin.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: stratPour('valorant') })).statut, 200);
});
