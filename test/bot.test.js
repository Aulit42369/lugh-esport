// Bot Discord de Lugh : clé du bot, liaison par code à usage unique, rôles attendus, rappels (heure d'été comprise),
// commandes /planning /match /absent, déliaison signalée au bot, réglages de l'Administrateur général.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, compteConnecte, client, MDP, WEBHOOK } from './simulation.js';
import { nouvelId } from '../shared/validation.js';
import { rolesAttendus } from '../src/domaine/bot.js';
import { instantCivil } from '../shared/temps.js';

const CLE = 'k'.repeat(40);
const DISCORD_A = '111111111111111111';
const DISCORD_B = '222222222222222222';

function bot(sim, cle = CLE) {
  const c = client(sim.base);
  const auth = cle ? { Authorization: `Bearer ${cle}` } : {};
  return {
    post: (chemin, corps) => c.post(chemin, corps, { entetes: auth, sansQg: true }),
  };
}

async function preparer({ cle = CLE } = {}) {
  const sim = await demarrer({ jeux: ['valorant', 'lol'], env: cle ? { LUGH_CLE_BOT: cle } : {} });
  const [joueurValo] = await sim.joueurs('valorant');
  const joueur = await compteConnecte(sim, {
    identifiant: 'brume', acces: { valorant: { metiers: ['joueur'], membreId: joueurValo._id }, lol: ['coach'] },
  });
  return { sim, joueur, membreId: joueurValo._id };
}

async function lier(sim, personne, discordId, pseudo = 'Brume#0001') {
  const code = (await personne.post('/api/moi/discord/code', {})).json.code;
  const r = await bot(sim).post('/api/bot/lier', { code, discordId, pseudo });
  if (r.statut !== 200) return r;
  return personne.post('/api/moi/discord/confirmer', { accepter: true });
}

test('clé du bot : absente → 503, fausse → 403, bonne → 200 sans en-tête X-Lugh', async () => {
  const sans = await preparer({ cle: null });
  try {
    assert.equal((await bot(sans.sim, 'x'.repeat(40)).post('/api/bot/synchro', {})).statut, 503);
  } finally {
    await sans.sim.arreter();
  }
  const { sim } = await preparer();
  try {
    assert.equal((await bot(sim, 'y'.repeat(40)).post('/api/bot/synchro', {})).statut, 403);
    assert.equal((await bot(sim, '').post('/api/bot/synchro', {})).statut, 403);
    assert.equal((await bot(sim).post('/api/bot/synchro', { version: '2.0.0' })).statut, 200);
  } finally {
    await sim.arreter();
  }
});

test('LUGH_CLE_BOT trop courte : refusée au démarrage', async () => {
  await assert.rejects(() => demarrer({ env: { LUGH_CLE_BOT: 'courte' } }), /LUGH_CLE_BOT trop courte/);
});

test('liaison : code à usage unique, 10 minutes, 5 essais faux au plus, un Discord pour un seul compte', async () => {
  const { sim, joueur } = await preparer();
  try {
    const b = bot(sim);
    const { code } = (await joueur.post('/api/moi/discord/code', {})).json;
    assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
    for (let i = 0; i < 5; i += 1) assert.equal((await b.post('/api/bot/lier', { code: 'AAAAAA', discordId: DISCORD_A })).statut, 400);
    assert.equal((await b.post('/api/bot/lier', { code, discordId: DISCORD_A })).statut, 429, 'bloqué après 5 codes faux');
    const ok = await b.post('/api/bot/lier', { code, discordId: DISCORD_B, pseudo: 'Brume' });
    assert.equal(ok.statut, 200);
    assert.deepEqual(ok.json, { aConfirmer: true, pseudo: 'Brume' }, 'le nom du compte Lugh n’est pas révélé à qui tape le code');
    assert.equal((await b.post('/api/bot/lier', { code, discordId: DISCORD_B })).statut, 400, 'code déjà utilisé');
    let moi = (await joueur.get('/api/auth/moi')).json.compte;
    assert.equal(moi.discord, null, 'pas lié avant confirmation');
    assert.equal(moi.discordAttente.pseudo, 'Brume');
    assert.ok(!(await bot(sim).post('/api/bot/synchro', {})).json.membres.length, 'le bot ne voit rien avant confirmation');
    assert.equal((await joueur.post('/api/moi/discord/confirmer', { accepter: true })).statut, 200);
    moi = (await joueur.get('/api/auth/moi')).json.compte;
    assert.equal(moi.discord.pseudo, 'Brume');
    assert.equal(moi.discordAttente, null);
    assert.equal((await joueur.post('/api/moi/discord/code', {})).statut, 409, 'déjà lié');

    const autre = await compteConnecte(sim, { identifiant: 'givre', acces: { valorant: ['joueur'] } });
    const code2 = (await autre.post('/api/moi/discord/code', {})).json.code;
    assert.equal((await b.post('/api/bot/lier', { code: code2, discordId: DISCORD_B })).statut, 409, 'ce Discord est déjà lié à brume');

    // Code vu par quelqu'un d'autre : la personne refuse le pseudo inconnu, rien n'est lié.
    const code4 = (await autre.post('/api/moi/discord/code', {})).json.code;
    assert.equal((await b.post('/api/bot/lier', { code: code4, discordId: '444444444444444444', pseudo: 'intrus' })).statut, 200);
    assert.equal((await autre.post('/api/moi/discord/confirmer', { accepter: false })).statut, 200);
    assert.equal((await autre.get('/api/auth/moi')).json.compte.discord, null);
    assert.equal((await autre.post('/api/moi/discord/confirmer', { accepter: true })).statut, 404, 'plus rien en attente');
    const code5 = (await autre.post('/api/moi/discord/code', {})).json.code;
    await b.post('/api/bot/lier', { code: code5, discordId: '444444444444444444', pseudo: 'givre' });
    sim.maintenant.avancer(16 * 60_000);
    assert.equal((await autre.post('/api/moi/discord/confirmer', { accepter: true })).statut, 404, 'attente expirée après 15 min');

    const code3 = (await autre.post('/api/moi/discord/code', {})).json.code;
    sim.maintenant.avancer(11 * 60_000);
    assert.equal((await b.post('/api/bot/lier', { code: code3, discordId: '333333333333333333' })).statut, 400, 'code expiré');
  } finally {
    await sim.arreter();
  }
});

test('synchro : rôles attendus, état du bot visible par l’Administrateur général, déliaison signalée', async () => {
  const { sim, joueur } = await preparer();
  try {
    assert.equal((await lier(sim, joueur, DISCORD_A)).statut, 200);
    const s = await bot(sim).post('/api/bot/synchro', {
      version: '2.0.0', serveur: { id: '999999999999999999', nom: 'Lugh' }, problemes: ['Rôle introuvable : Fortnite'], stats: { membres: 4, lies: 1, ajoutes: 2, retires: 0 },
    });
    assert.deepEqual(s.json.jeux.map((j) => j.nom).sort(), ['League of Legends', 'Valorant']);
    const m = s.json.membres.find((x) => x.discordId === DISCORD_A);
    assert.deepEqual(m.fonctions.sort(), ['joueur', 'staff']);
    assert.deepEqual(m.jeux.sort(), ['lol', 'valorant']);

    const admin = await adminPret(sim);
    const etat = (await admin.get('/api/admin/discord')).json;
    assert.equal(etat.configure, true);
    assert.equal(etat.etat.serveur.nom, 'Lugh');
    assert.deepEqual(etat.etat.problemes, ['Rôle introuvable : Fortnite']);
    assert.equal(etat.liaisons.length, 1);

    assert.equal((await joueur.del('/api/moi/discord')).json.ok, true);
    const apres = await bot(sim).post('/api/bot/synchro', {});
    assert.ok(!apres.json.membres.some((x) => x.discordId === DISCORD_A));
    assert.deepEqual(apres.json.delies, [DISCORD_A], 'le bot retire les rôles Lugh du compte délié');

    assert.equal((await lier(sim, joueur, DISCORD_A)).statut, 200);
    assert.deepEqual((await bot(sim).post('/api/bot/synchro', {})).json.delies, [], 'relié : plus signalé comme délié');
  } finally {
    await sim.arreter();
  }
});

test('compte désactivé : plus aucun rôle attendu ; Administrateur général : rôle admin', () => {
  const jeux = [{ id: 'valorant' }, { id: 'lol' }];
  assert.deepEqual(rolesAttendus({ actif: false, acces: { valorant: { metiers: ['joueur'] } } }, jeux), { fonctions: [], jeux: [] });
  const admin = rolesAttendus({ admin: true, acces: { valorant: { metiers: ['capitaine'], membreId: '' } } }, jeux);
  assert.deepEqual(admin, { fonctions: ['admin', 'capitaine'], jeux: ['valorant'] });
  assert.deepEqual(rolesAttendus({ admin: true, acces: {} }, jeux), { fonctions: ['admin'], jeux: [] });
});

test('heure de Paris → instant : heure d’été et heure d’hiver', () => {
  assert.equal(instantCivil('2026-10-24', '14:00', 'Europe/Paris').toISOString(), '2026-10-24T12:00:00.000Z');
  assert.equal(instantCivil('2026-10-25', '14:00', 'Europe/Paris').toISOString(), '2026-10-25T13:00:00.000Z');
  assert.equal(instantCivil('2026-03-29', '01:30', 'Europe/Paris').toISOString(), '2026-03-29T00:30:00.000Z');
});

test('rappels : séances et scrims des 27 h à venir, filtres des réglages, échauffement et repos ignorés', async () => {
  const { sim } = await preparer();
  try {
    // DEPART = mercredi 21/10/2026 10:00 UTC (12:00 à Paris), semaine 2026-W43.
    const bloc = (jour, debut, fin, type, titre, pour = 'equipe') => ({ id: nouvelId('b'), jour, debut, fin, type, titre, pour, membres: [], map: '' });
    await sim.espace('valorant').stockage.ecrire('planning', {
      _id: '2026-W43',
      blocs: [
        bloc(3, '14:00', '16:00', 'scrim', 'Scrim contre Orage'),
        bloc(3, '13:30', '14:00', 'echauffement', 'Échauffement'),
        bloc(3, '11:00', '12:00', 'theorie', 'Déjà passé'),
        bloc(4, '09:00', '10:00', 'theorie', 'Stratbook'),
        bloc(4, '21:00', '22:00', 'classe', 'Classé chacun de son côté', 'individuel'),
        bloc(5, '20:00', '22:00', 'scrim', 'Trop loin'),
      ],
    });
    await sim.espace('valorant').stockage.ecrire('adversaires', { _id: nouvelId('d'), nom: 'Kraken', prochainMatch: { date: '2026-10-22', heure: '10:00', format: 'bo3' } });
    await sim.espace('lol').stockage.ecrire('tournois', { _id: nouvelId('t'), nom: 'Coupe du jour', statut: 'encours', debut: '2026-10-21', fin: '2026-10-21' });
    const r = (await bot(sim).post('/api/bot/synchro', {})).json.rappels;
    assert.deepEqual(r.map((x) => x.titre), ['Coupe du jour', 'Scrim contre Orage', 'Stratbook', 'Match contre Kraken'], 'le scrim du vendredi est au-delà de 27 h');
    assert.equal(r[0].immediat, true, 'tournoi du jour : 9 h est passé mais il part encore (bot redémarré)');
    assert.equal(r[1].debut, '2026-10-21T12:00:00.000Z');
    assert.equal(r[1].jeu.nom, 'Valorant');
    assert.equal(r[3].genre, 'match');
    assert.equal(r[3].debut, '2026-10-22T08:00:00.000Z');

    const admin = await adminPret(sim);
    const regl = await admin.put('/api/admin/discord/reglages', { roles: true, rappels: { actif: true, delai: 60, seances: false, scrims: true, matchs: false, tournois: true } });
    assert.equal(regl.statut, 200);
    assert.deepEqual((await bot(sim).post('/api/bot/synchro', {})).json.rappels.map((x) => x.titre), ['Coupe du jour', 'Scrim contre Orage']);
    assert.equal((await admin.put('/api/admin/discord/reglages', { rappels: { delai: 7 } })).statut, 400);
    await admin.put('/api/admin/discord/reglages', { rappels: { actif: false } });
    assert.deepEqual((await bot(sim).post('/api/bot/synchro', {})).json.rappels, []);
  } finally {
    await sim.arreter();
  }
});

test('/planning, /match et /absent : seulement pour un compte lié, absences comme depuis l’appli', async () => {
  const { sim, joueur, membreId } = await preparer();
  try {
    const b = bot(sim);
    assert.equal((await b.post('/api/bot/planning', { discordId: DISCORD_A })).statut, 404, 'pas encore lié');
    await lier(sim, joueur, DISCORD_A);
    await sim.espace('valorant').stockage.ecrire('planning', {
      _id: '2026-W43', blocs: [{ id: nouvelId('b'), jour: 4, debut: '20:00', fin: '22:00', type: 'scrim', titre: 'Scrim du jeudi', pour: 'equipe', membres: [], map: '' }],
    });
    const p = (await b.post('/api/bot/planning', { discordId: DISCORD_A, jeu: 'val' })).json;
    assert.equal(p.jeux.length, 1);
    assert.deepEqual(p.jeux[0].blocs.map((x) => [x.date, x.titre]), [['2026-10-22', 'Scrim du jeudi']]);
    assert.equal((await b.post('/api/bot/planning', { discordId: DISCORD_A, jeu: 'fortnite' })).statut, 404);
    assert.equal((await b.post('/api/bot/match', { discordId: DISCORD_A })).json.jeux.length, 2);

    const abs = (await b.post('/api/bot/absence', { discordId: DISCORD_A, du: '2026-10-23', au: '2026-10-25', motif: 'Voyage scolaire' })).json;
    assert.deepEqual(abs.creees, [{ jeu: 'Valorant', jours: 3 }]);
    await b.post('/api/bot/absence', { discordId: DISCORD_A, du: '2026-10-23', au: '2026-10-25', motif: 'Voyage scolaire' });
    assert.equal(abs.ignorees[0].jeu, 'League of Legends', 'coach LoL sans fiche : ignoré');
    const enBase = await sim.espace('valorant').stockage.lister('absences', { membreId });
    assert.deepEqual(enBase.map((a) => a.date).sort(), ['2026-10-23', '2026-10-24', '2026-10-25'], 'commande répétée : pas de doublon');
    assert.equal((await b.post('/api/bot/absence', { discordId: DISCORD_A, du: '2026-10-01' })).statut, 400, 'pas dans le passé');
    assert.equal((await b.post('/api/bot/absence', { discordId: DISCORD_A, du: '2026-10-25', au: '2026-10-23' })).statut, 400);
  } finally {
    await sim.arreter();
  }
});

test('code de liaison sans bot installé : refus clair ; Administrateur général délie un compte', async () => {
  const sans = await preparer({ cle: null });
  try {
    assert.equal((await sans.joueur.post('/api/moi/discord/code', {})).statut, 503);
  } finally {
    await sans.sim.arreter();
  }
  const { sim, joueur } = await preparer();
  try {
    await lier(sim, joueur, DISCORD_A);
    const admin = await adminPret(sim);
    const id = (await admin.get('/api/admin/discord')).json.liaisons[0].compteId;
    assert.equal((await joueur.del(`/api/admin/comptes/${id}/discord`)).statut, 403);
    assert.equal((await admin.del(`/api/admin/comptes/${id}/discord`)).json.ok, true);
    assert.deepEqual((await bot(sim).post('/api/bot/synchro', {})).json.delies, [DISCORD_A]);
    assert.ok(MDP);
  } finally {
    await sim.arreter();
  }
});

test('sauvegarde hebdomadaire : export complet d’un jeu pour le Pi, date gardée dans l’état du bot', async () => {
  const { sim } = await preparer();
  try {
    const s = await bot(sim).post('/api/bot/sauvegarde', { jeu: 'valorant' });
    assert.equal(s.statut, 200);
    assert.equal(s.json.espace, 'valorant');
    assert.ok(Array.isArray(s.json.membres) && s.json.membres.length);
    assert.ok(!JSON.stringify(s.json).includes('hash'), 'aucun mot de passe haché');
    assert.equal((await bot(sim).post('/api/bot/sauvegarde', { jeu: 'inconnu' })).statut, 404);
    await bot(sim).post('/api/bot/synchro', { sauvegarde: { le: '2026-10-21T10:00:00.000Z', jeux: 2, octets: 123456 } });
    const admin = await adminPret(sim);
    assert.deepEqual((await admin.get('/api/admin/discord')).json.etat.sauvegarde, { le: '2026-10-21T10:00:00.000Z', jeux: 2, octets: 123456 });
    // Un jeu désactivé n'a plus de rôle ni de salon, mais il reste sauvegardé chaque semaine.
    assert.ok([200, 201].includes((await admin.post('/api/admin/jeux', { modele: 'lol' })).statut));
    assert.equal((await admin.put('/api/admin/jeux/lol', { actif: false })).statut, 200);
    const synchro = (await bot(sim).post('/api/bot/synchro', {})).json;
    assert.ok(!synchro.jeux.some((j) => j.id === 'lol'), 'jeu désactivé : pas de rôle ni de salon');
    assert.deepEqual(synchro.sauvegardes.map((j) => j.id).sort(), ['lol', 'valorant']);
    assert.equal((await bot(sim).post('/api/bot/sauvegarde', { jeu: 'lol' })).json.espace, 'lol');
  } finally {
    await sim.arreter();
  }
});

test('annonces reprises sur Discord : webhook secret, @everyone seulement si importante, case décochable', async () => {
  const { sim } = await preparer();
  try {
    const admin = await adminPret(sim);
    assert.equal((await admin.put('/api/admin/discord/annonces', { webhook: 'https://example.com/pas-discord' })).statut, 400);
    const ok = await admin.put('/api/admin/discord/annonces', { webhook: WEBHOOK });
    assert.equal(ok.statut, 200);
    assert.equal(ok.json.annonces.apercu, `…${WEBHOOK.slice(-6)}`);
    assert.ok(!JSON.stringify((await admin.get('/api/admin/discord')).json).includes(WEBHOOK), 'adresse jamais renvoyée');

    const normale = await admin.post('/api/admin/annonces', { titre: 'Planning de novembre', texte: 'Il est en ligne.', jeux: ['valorant'] });
    assert.equal(normale.json.discord, 'envoyee');
    const envoi = sim.discord.envois.at(-1);
    assert.equal(envoi.url, WEBHOOK);
    assert.match(envoi.corps.content, /^📢 \*\*Planning de novembre\*\*\n\nIl est en ligne\.\n\n_Pour : Valorant_$/);
    assert.deepEqual(envoi.corps.allowed_mentions, { parse: [] });

    await admin.post('/api/admin/annonces', { titre: 'Réunion', texte: 'Ce soir 21 h.', jeux: [], importante: true });
    assert.match(sim.discord.envois.at(-1).corps.content, /^@everyone 📢/);
    assert.deepEqual(sim.discord.envois.at(-1).corps.allowed_mentions, { parse: ['everyone'] });

    const n = sim.discord.envois.length;
    assert.equal((await admin.post('/api/admin/annonces', { titre: 'Interne', texte: 'Pas sur Discord.', jeux: [], discord: false })).json.discord, 'non');
    assert.equal(sim.discord.envois.length, n);

    sim.discord.statut = 500;
    const rate = await admin.post('/api/admin/annonces', { titre: 'Panne', texte: 'Discord en panne.', jeux: [] });
    assert.equal(rate.statut, 201, 'l’annonce existe quand même dans Lugh');
    assert.equal(rate.json.discord, 'echec');
    sim.discord.statut = 204;
    assert.equal((await admin.post('/api/admin/discord/annonces/test', {})).statut, 200);
  } finally {
    await sim.arreter();
  }
});

test('webhooks branchés par le bot : seulement là où il n’y en a pas, jamais remplacés, jamais renvoyés', async () => {
  const { sim } = await preparer();
  try {
    const admin = await adminPret(sim);
    const b = bot(sim);
    const AUTRE = 'https://discord.com/api/webhooks/987654321098765432/zyxwvutsrqponmlkjihgfedcba_FEDCBA-654321';
    // LoL a déjà un webhook collé à la main, avec un événement coupé.
    assert.equal((await admin.put('/api/e/lol/reglages/discord', { webhook: WEBHOOK, evenements: { meta: false } })).statut, 200);

    const s1 = (await b.post('/api/bot/synchro', {})).json;
    assert.deepEqual(s1.discord.manquants, { jeux: ['valorant'], annonces: true });

    const r = await b.post('/api/bot/webhooks', {
      jeux: [{ jeu: 'valorant', url: AUTRE }, { jeu: 'lol', url: AUTRE }, { jeu: 'inconnu', url: AUTRE }, { jeu: 'valorant', url: 'https://example.com/x' }],
      annonces: AUTRE,
    });
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.jeux.map((x) => x.statut), ['enregistre', 'deja', 'introuvable', 'invalide']);
    assert.equal(r.json.annonces, 'enregistre');
    assert.ok(!JSON.stringify(r.json).includes(AUTRE), 'adresse jamais renvoyée');
    assert.equal((await admin.get('/api/e/lol/reglages')).json.discord.apercu, `…${WEBHOOK.slice(-6)}`, 'webhook manuel gardé');
    assert.equal((await admin.get('/api/e/lol/reglages')).json.discord.evenements.meta, false);
    assert.equal((await admin.get('/api/e/valorant/reglages')).json.discord.apercu, `…${AUTRE.slice(-6)}`);
    assert.equal((await b.post('/api/bot/webhooks', { annonces: WEBHOOK })).json.annonces, 'deja');

    assert.deepEqual((await b.post('/api/bot/synchro', {})).json.discord.manquants, { jeux: [], annonces: false });
    const vue = (await admin.get('/api/admin/discord')).json;
    assert.deepEqual(vue.jeux.map((j) => [j.id, j.configure]), [['valorant', true], ['lol', true]]);
    assert.ok(!JSON.stringify(vue).includes(AUTRE));
    // Retiré à la main : le bot ne le rebranche pas, jusqu'à ce qu'on en colle un nouveau.
    await admin.put('/api/e/valorant/reglages/discord', { supprimer: true });
    await admin.put('/api/admin/discord/annonces', { supprimer: true });
    assert.deepEqual((await b.post('/api/bot/synchro', {})).json.discord.manquants, { jeux: [], annonces: false });
    const encore = await b.post('/api/bot/webhooks', { jeux: [{ jeu: 'valorant', url: AUTRE }], annonces: AUTRE });
    assert.deepEqual([encore.json.jeux[0].statut, encore.json.annonces], ['retire', 'retire']);
    assert.deepEqual((await admin.get('/api/admin/discord')).json.jeux.find((j) => j.id === 'valorant'), { id: 'valorant', nom: 'Valorant', configure: false, retire: true });
    await admin.put('/api/e/valorant/reglages/discord', { webhook: AUTRE });
    assert.equal((await admin.get('/api/e/valorant/reglages')).json.discord.retire, false);
    assert.equal((await b.post('/api/bot/webhooks', { jeux: 'pas une liste' })).statut, 400);
    assert.equal((await bot(sim, 'z'.repeat(40)).post('/api/bot/webhooks', { annonces: AUTRE })).statut, 403);
  } finally {
    await sim.arreter();
  }
});

test('sauvegarde du Pi en retard : alerte dans la vue d’ensemble et l’état du service au-delà de 8 jours', async () => {
  const { alerteSauvegarde } = await import('../src/domaine/bot.js');
  const m = new Date('2026-10-23T12:00:00Z');
  assert.equal(alerteSauvegarde(null, m, ''), null, 'bot non configuré : rien');
  assert.match(alerteSauvegarde(null, m, 'cle'), /jamais présenté/);
  assert.equal(alerteSauvegarde({ dernierContact: m.toISOString(), sauvegarde: { le: '2026-10-16T12:00:00Z' } }, m, 'cle'), null, '7 jours : normal');
  assert.match(alerteSauvegarde({ dernierContact: m.toISOString(), sauvegarde: { le: '2026-10-14T12:00:00Z' } }, m, 'cle'), /il y a 9 jours/);
  assert.match(alerteSauvegarde({ dernierContact: m.toISOString(), sauvegarde: null }, m, 'cle'), /Aucune sauvegarde/);
  const { sim } = await preparer();
  try {
    const admin = await adminPret(sim);
    await bot(sim).post('/api/bot/synchro', { sauvegarde: { le: '2020-01-01T10:00:00.000Z', jeux: 1, octets: 10 } });
    assert.match((await admin.get('/api/admin/structure')).json.alertes[0], /Raspberry Pi il y a \d+ jours/);
    assert.ok((await admin.get('/api/admin/etat')).json.avertissements.some((a) => /Raspberry Pi/.test(a)));
    await bot(sim).post('/api/bot/synchro', { sauvegarde: { le: new Date().toISOString(), jeux: 1, octets: 10 } });
    assert.deepEqual((await admin.get('/api/admin/structure')).json.alertes, []);
  } finally {
    await sim.arreter();
  }
});
