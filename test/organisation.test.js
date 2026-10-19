// Organisation de la structure : annonces de l'Administrateur général, vue d'ensemble des jeux, conflits d'agenda
// entre deux jeux, agenda personnel (.ics) qui regroupe les jeux d'une personne.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, compteConnecte, creerCompte, connecterEtChanger } from './simulation.js';
import { nouvelId } from '../shared/validation.js';
import { semaineCourante, aujourdhui, decalerSemaine, joursDe, ajouterJours, civileDepuisIso, isoCivile } from '../shared/temps.js';

// Ces routes datent les choses avec l'horloge réelle (jour et semaine en cours à Paris).
const AUJ = () => aujourdhui('Europe/Paris');
const jourDans = (n) => isoCivile(ajouterJours(civileDepuisIso(AUJ()), n));
const compact = (iso) => iso.replace(/-/g, '');

async function monde() {
  const sim = await demarrer({ jeux: ['valorant', 'lol', 'cs2'] });
  const admin = await adminPret(sim);
  return { sim, admin };
}

test('annonces : publiées par l’Administrateur général, visibles selon les jeux visés, lues et suivies', async () => {
  const { sim, admin } = await monde();
  try {
    const jv = await compteConnecte(sim, { identifiant: 'jv', nomAffiche: 'JV', acces: { valorant: 'joueur' } });
    const jl = await compteConnecte(sim, { identifiant: 'jl', nomAffiche: 'JL', acces: { lol: 'joueur' } });
    const deux = await compteConnecte(sim, { identifiant: 'deux', nomAffiche: 'Deux', acces: { valorant: 'joueur', lol: 'joueur' } });
    const publier = (corps) => admin.post('/api/admin/annonces', corps);

    const tous = await publier({ titre: 'Bienvenue', texte: 'Pour tous les jeux.' });
    assert.equal(tous.statut, 201);
    assert.match(tous.json.annonce._id, /^an-[a-z0-9]{10}$/);
    sim.maintenant.avancer(60_000);
    const val = (await publier({ titre: 'Scrim Valorant', texte: 'Jeudi 20 h.', jeux: ['valorant', 'valorant'], importante: true })).json.annonce._id;
    await publier({ titre: 'Expirée', texte: 'Trop tard.', expireLe: '2020-01-01' });
    for (const mauvais of [{ texte: 'sans titre' }, { titre: 'Sans texte' }, { titre: 'T', texte: 'x', jeux: ['tetris'] }, { titre: 'T', texte: 'x', jeux: ['Valorant'] }, { titre: 'T', texte: 'x', expireLe: '2026-02-30' }]) {
      assert.equal((await publier(mauvais)).statut, 400, JSON.stringify(mauvais));
    }
    assert.equal((await jv.post('/api/admin/annonces', { titre: 'T', texte: 'x' })).statut, 403);

    const titres = async (c, q = '') => (await c.get(`/api/annonces${q}`)).json.annonces.map((a) => a.titre);
    assert.deepEqual(await titres(jv), ['Scrim Valorant', 'Bienvenue'], 'importante d’abord ; expirée masquée');
    assert.deepEqual(await titres(jl), ['Bienvenue'], 'une annonce d’un autre jeu reste invisible');
    assert.deepEqual(await titres(deux, '?jeu=lol'), ['Bienvenue']);
    assert.equal((await jl.get('/api/annonces?jeu=valorant')).statut, 404, 'jeu sans accès');
    const vue = (await jv.get('/api/annonces')).json.annonces[0];
    assert.deepEqual([vue.jeux, vue.importante, vue.auteur, vue.lu], [['valorant'], true, 'chef', false]);

    assert.deepEqual((await jv.post(`/api/annonces/${val}/lu`)).json, { ok: true });
    assert.equal((await jv.get('/api/annonces')).json.annonces[0].lu, true);
    assert.equal((await jl.post(`/api/annonces/${val}/lu`)).statut, 404, 'pas destinataire');
    assert.equal((await jl.post('/api/annonces/pas-un-id/lu')).statut, 400);

    const suivi = (await admin.get('/api/admin/annonces')).json;
    assert.equal(suivi.max, 100);
    const parTitre = Object.fromEntries(suivi.annonces.map((a) => [a.titre, a]));
    assert.deepEqual(parTitre['Scrim Valorant'].lus.map((l) => l.nomAffiche), ['JV']);
    assert.deepEqual(parTitre['Scrim Valorant'].nonLus, ['Deux']);
    assert.deepEqual([...parTitre.Bienvenue.nonLus].sort(), ['Deux', 'JL', 'JV']);
    assert.equal(parTitre['Expirée'].enCours, false);

    assert.equal((await admin.put(`/api/admin/annonces/${val}`, { titre: 'Scrim Valorant (horaire changé)', texte: 'Jeudi 21 h.', jeux: ['valorant'], relire: true })).statut, 200);
    const relu = (await admin.get('/api/admin/annonces')).json.annonces.find((a) => a._id === val);
    assert.deepEqual([relu.titre, relu.lus, relu.nonLus.sort()], ['Scrim Valorant (horaire changé)', [], ['Deux', 'JV']]);
    assert.deepEqual((await admin.del(`/api/admin/annonces/${val}`)).json, { ok: true });
    assert.deepEqual((await admin.del(`/api/admin/annonces/${val}`)).json, { ok: false });
    const actions = (await admin.get('/api/admin/journal')).json.entrees.map((e) => e.action);
    for (const a of ['annonce publiée', 'annonce modifiée', 'annonce supprimée']) assert.ok(actions.includes(a), a);

    // L'annonce expirée depuis plus de 30 jours disparaît à la publication suivante : on remplit jusqu'à 101.
    for (let i = await sim.global.compter('annonces'); i < 101; i += 1) {
      await sim.global.ecrire('annonces', { _id: nouvelId('an'), titre: `A${i}`, texte: 'x', jeux: [], creeLe: sim.maintenant().toISOString(), par: admin.id, lus: {} });
    }
    assert.equal((await publier({ titre: 'De trop', texte: 'x' })).statut, 409);
    assert.ok(!(await sim.global.lister('annonces')).some((a) => a.titre === 'Expirée'), 'annonce expirée depuis longtemps purgée');
  } finally {
    await sim.arreter();
  }
});

test('vue d’ensemble de la structure : effectif, matchs, tournois, alertes, résultats et méta de chaque jeu', async () => {
  const { sim, admin } = await monde();
  try {
    await creerCompte(sim, { identifiant: 'coach-val', acces: { valorant: ['headcoach'] } });
    await admin.put(`/api/e/valorant/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Kraken', prochainMatch: { date: jourDans(3), heure: '20:00', format: 'bo3' } } });
    await admin.put(`/api/e/valorant/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Ancien', prochainMatch: { date: jourDans(-3), heure: '20:00' } } });
    await admin.put(`/api/e/valorant/c/tournois/${nouvelId('t')}`, { valeur: { nom: 'Coupe', statut: 'inscrit', debut: jourDans(10) } });
    for (const [n, nous] of [[-3, 13], [-5, 7], [-40, 13]]) {
      await admin.put(`/api/e/valorant/c/scrims/${nouvelId('x')}`, { valeur: { date: jourDans(n), adversaire: `Adv ${n}`, map: 'haven', scoreNous: nous, scoreEux: 10 } });
    }
    const r = await admin.get('/api/admin/structure');
    assert.equal(r.statut, 200);
    assert.deepEqual([r.json.aujourdhui, r.json.semaine], [AUJ(), semaineCourante('Europe/Paris')]);
    assert.deepEqual(r.json.jeux.map((j) => [j.id, j.couleur, j.actif]), [['valorant', 'corail', true], ['lol', 'sarcelle', true], ['cs2', 'ambre', true]]);
    const v = r.json.jeux[0];
    assert.deepEqual(v.effectif, { joueurs: 7, staff: 2, comptes: 1 });
    assert.deepEqual(v.matchs, [{ adversaire: 'Kraken', date: jourDans(3), heure: '20:00', format: 'BO3' }]);
    assert.deepEqual(v.tournois, [{ nom: 'Coupe', debut: jourDans(10), statut: 'inscrit', dateLimite: '' }]);
    assert.deepEqual([v.resultats.joues30, v.resultats.winrate30, v.resultats.derniers.length], [2, 50, 3]);
    assert.deepEqual(v.resultats.derniers[0], { date: jourDans(-3), adversaire: 'Adv -3', resultat: 'V', score: '13–10' });
    assert.equal(v.presence, null);
    assert.deepEqual([v.meta.patch, v.meta.statut], ['13.08', 'ok']);
    assert.ok(v.alertes.total >= v.alertes.attention && v.alertes.premieres.length <= 4);
    assert.equal((await compteConnecte(sim, { identifiant: 'resp', acces: { valorant: ['responsable'] } }).then((c) => c.get('/api/admin/structure'))).statut, 403);
  } finally {
    await sim.arreter();
  }
});

test('conflits d’agenda entre deux jeux : seulement le jeu et l’horaire de l’autre séance', async () => {
  const { sim, admin } = await monde();
  try {
    const [m0] = await sim.joueurs('valorant');
    const [l0] = await sim.joueurs('lol');
    await creerCompte(sim, { identifiant: 'deux', acces: { valorant: { metiers: ['joueur'], membreId: m0._id }, lol: { metiers: ['joueur'], membreId: l0._id } } });
    const coach = await compteConnecte(sim, { identifiant: 'coach', acces: { valorant: ['coach'] } });
    const bloc = (jour, debut, fin, titre, pour = 'equipe') => ({ id: nouvelId('b'), jour, debut, fin, type: 'scrim', titre, details: `Détails ${titre}`, pour, membres: [], map: '' });
    const v1 = bloc(2, '20:00', '22:00', 'Scrim Valorant');
    await admin.put('/api/e/valorant/c/planning/2026-W45', { valeur: { blocs: [v1, bloc(4, '18:00', '19:00', 'Analyse', 'staff')] } });
    await admin.put('/api/e/lol/c/planning/2026-W45', { valeur: { blocs: [bloc(2, '21:00', '23:00', 'Scrim secret LoL'), bloc(2, '19:00', '20:00', 'Juste avant'), bloc(4, '18:00', '19:00', 'Pendant l’analyse du staff')] } });

    const r = await coach.get('/api/e/valorant/conflits/2026-W45');
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.conflits, [{ blocId: v1.id, membreId: m0._id, jeu: { id: 'lol', nom: 'League of Legends', court: 'LoL', couleur: 'sarcelle' }, jour: 2, debut: '21:00', fin: '23:00' }]);
    assert.ok(!r.texte.includes('secret') && !r.texte.includes('Détails'), 'le contenu de l’autre séance reste privé');
    assert.deepEqual((await coach.get('/api/e/valorant/conflits/2026-W46')).json, { conflits: [] }, 'semaine sans planning');
    assert.equal((await coach.get('/api/e/valorant/conflits/semaine-x')).statut, 400);
    assert.equal((await coach.get('/api/e/lol/conflits/2026-W45')).statut, 404, 'jeu sans accès');
    await admin.put('/api/admin/jeux/lol', { actif: false });
    assert.deepEqual((await coach.get('/api/e/valorant/conflits/2026-W45')).json.conflits, [], 'jeu désactivé : ignoré');
  } finally {
    await sim.arreter();
  }
});

test('agenda personnel .ics : les séances qui concernent la personne dans chacun de ses jeux, ses matchs et tournois', async () => {
  const { sim, admin } = await monde();
  try {
    const [m0] = await sim.joueurs('valorant');
    const remplacantLol = (await sim.joueurs('lol')).find((m) => m.statut === 'remplacant');
    const deux = await compteConnecte(sim, {
      identifiant: 'deux', nomAffiche: 'Deux', acces: { valorant: { metiers: ['joueur'], membreId: m0._id }, lol: { metiers: ['remplacant'], membreId: remplacantLol._id } },
    });
    const prochaine = decalerSemaine(semaineCourante('Europe/Paris'), 1);
    const jours = joursDe(prochaine).map((j) => j.iso);
    const bloc = (jour, debut, fin, type, titre, pour, membres = []) => ({ id: nouvelId('b'), jour, debut, fin, type, titre, details: '', pour, membres, map: '' });
    await admin.put(`/api/e/valorant/c/planning/${prochaine}`, { valeur: { blocs: [
      bloc(2, '20:00', '22:00', 'scrim', 'Scrim Valorant', 'equipe'),
      bloc(3, '18:00', '19:00', 'vod', 'Réunion staff', 'staff'),
      bloc(4, '10:00', '11:00', 'aim', '', 'individuel'),
      bloc(5, '20:00', '22:00', 'scrim', 'Scrim choisi', 'choix', ['m-zzzzzzzzzz']),
      bloc(6, '14:00', '16:00', 'repos', 'Repos', 'equipe'),
    ] } });
    await admin.put(`/api/e/lol/c/planning/${prochaine}`, { valeur: { blocs: [
      bloc(2, '21:00', '23:00', 'scrim', 'Scrim titulaires LoL', 'titulaires'),
      bloc(7, '15:00', '17:00', 'scrim', 'Scrim LoL', 'equipe'),
    ] } });
    await admin.put(`/api/e/valorant/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Kraken', circuit: 'Premier', prochainMatch: { date: jourDans(3), heure: '20:00' } } });
    await admin.put(`/api/e/valorant/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Trop loin', prochainMatch: { date: jourDans(40), heure: '20:00' } } });
    await admin.put(`/api/e/lol/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Nébula', prochainMatch: { date: jourDans(4) } } });
    await admin.put(`/api/e/lol/c/tournois/${nouvelId('t')}`, { valeur: { nom: 'Coupe LoL', statut: 'inscrit', debut: jourDans(10), format: 'Double élimination' } });
    await admin.put(`/api/e/lol/c/tournois/${nouvelId('t')}`, { valeur: { nom: 'Peut-être', statut: 'envisage', debut: jourDans(12) } });

    const r = await deux.get('/api/moi/agenda.ics');
    assert.equal(r.statut, 200);
    assert.match(r.entetes.get('content-type'), /^text\/calendar/);
    assert.equal(r.entetes.get('content-disposition'), `attachment; filename="lugh-agenda-${AUJ()}.ics"`);
    const lignes = r.texte.replace(/\r\n /g, '').split('\r\n');
    assert.ok(lignes.includes('X-WR-CALNAME:Lugh · Deux'));
    const titres = lignes.filter((l) => l.startsWith('SUMMARY:')).map((l) => l.slice(8));
    for (const attendu of ['[VAL] Scrim Valorant', '[VAL] Aim et mécanique', '[LoL] Scrim LoL', '[VAL] Match contre Kraken', '[LoL] Match contre Nébula (heure à confirmer)', '[LoL] Coupe LoL']) {
      assert.ok(titres.includes(attendu), `${attendu} attendu dans ${titres.join(' | ')}`);
    }
    for (const absent of ['Réunion staff', 'Scrim choisi', 'Repos', 'Scrim titulaires LoL', 'Trop loin', 'Peut-être']) {
      assert.ok(!titres.some((t) => t.includes(absent)), `${absent} ne concerne pas cette personne`);
    }
    assert.ok(lignes.includes(`DTSTART;TZID=Europe/Paris:${compact(jours[1])}T200000`));
    assert.ok(lignes.includes(`DTSTART;TZID=Europe/Paris:${compact(jourDans(3))}T200000`) && lignes.includes(`DTEND;TZID=Europe/Paris:${compact(jourDans(3))}T220000`), 'match : deux heures');
    assert.ok(lignes.includes(`DTSTART;VALUE=DATE:${compact(jourDans(10))}`) && lignes.includes(`DTEND;VALUE=DATE:${compact(jourDans(11))}`), 'tournoi : journée entière');
    const debuts = lignes.filter((l) => l.startsWith('DTSTART;')).map((l) => l.split(':')[1].slice(0, 8));
    assert.deepEqual(debuts, [...debuts].sort(), 'dans l’ordre des dates');
    assert.equal((await deux.get('/api/moi/agenda.ics', { entetes: { Cookie: 'lugh_session=faux' } })).statut, 401);
  } finally {
    await sim.arreter();
  }
});

test('agenda personnel : un lien vers un membre sans métier n’ouvre pas les données de ce jeu', {
}, async () => {
  const { sim, admin } = await monde();
  try {
    const [c0] = await sim.joueurs('cs2');
    const cree = await admin.post('/api/admin/comptes', { identifiant: 'ancien', nomAffiche: 'Ancien', acces: { valorant: { metiers: ['joueur'] }, cs2: { metiers: [], membreId: c0._id } } });
    assert.equal(cree.statut, 201, cree.texte);
    const ancien = await connecterEtChanger(sim, 'ancien', cree.json.mdpTemporaire);
    assert.deepEqual((await ancien.get('/api/auth/moi')).json.jeux.map((j) => j.id), ['valorant']);
    assert.equal((await ancien.get('/api/e/cs2/donnees')).statut, 404, 'aucun accès au jeu');
    const prochaine = decalerSemaine(semaineCourante('Europe/Paris'), 1);
    await admin.put(`/api/e/cs2/c/planning/${prochaine}`, { valeur: { blocs: [{ id: nouvelId('b'), jour: 3, debut: '20:00', fin: '22:00', type: 'scrim', titre: 'Scrim CS2 confidentiel', pour: 'equipe', membres: [], map: '' }] } });
    await admin.put(`/api/e/cs2/c/adversaires/${nouvelId('d')}`, { valeur: { nom: 'Adversaire CS2 confidentiel', prochainMatch: { date: jourDans(2), heure: '21:00' } } });
    const ics = (await ancien.get('/api/moi/agenda.ics')).texte;
    assert.ok(!ics.includes('confidentiel'), 'rien du jeu sans accès');
  } finally {
    await sim.arreter();
  }
});
