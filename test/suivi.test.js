// Suivi de l'équipe, fonctions pures : moniteur de santé, présences, bilan du mois, « quoi de neuf », dates et
// semaines ISO, contenus d'entraînement (programme, seuils chiffrés, semaines types).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELES } from '../shared/jeux/index.js';
import { definitionEffective } from '../shared/jeux/definition.js';
import { alertesSante, SEUILS_SANTE } from '../shared/sante.js';
import { statsPresences, seancesAppel, moisDeSemaine, semainesDuMois, bilanMois, quoiDeNeuf, moyennesMesures } from '../shared/suivi.js';
import { programmePour, seuilAtteint, seuilPourChiffre, ebauchePourPalier, objectifsDuPalier } from '../shared/jeux/contenus.js';
import { chargeSemaine, alertesCharge } from '../shared/charge.js';
import { rappelsTournois, tournoisAVenir, fiabilitePartenaire, conflitsEntreJeux } from '../shared/organisation.js';
import { validerReglagesJeu } from '../shared/jeux/reglages-jeu.js';
import {
  semaineIso, civileDepuisIso, isoCivile, lundiDe, decalerSemaine, joursDe, numeroSemaine, dateCivile, minutes, hhmm, dureeLisible,
} from '../shared/temps.js';

const def = (id) => definitionEffective(MODELES[id]);
const AUJOURDHUI = '2026-10-21';
const SEMAINE = '2026-W43';
const joueur = (_id, pseudo, statut = 'titulaire') => ({ _id, type: 'joueur', statut, pseudo });
const presence = (semaine, statuts, jour = 2) => ({ semaine, jour, statuts });
const victoire = (date, map) => ({ date, map, campDepart: 'att', scoreNous: 13, scoreEux: 5 });
const defaite = (date, map) => ({ date, map, campDepart: 'att', scoreNous: 5, scoreEux: 13 });

// ——— Moniteur de santé ———

test('santé : présence sous 70 % sur 30 jours avec au moins 4 séances notées (excusés et séances hors période exclus)', () => {
  assert.deepEqual([SEUILS_SANTE.presenceMin, SEUILS_SANTE.joursPresence, SEUILS_SANTE.seancesMin], [70, 30, 4]);
  const membres = [
    joueur('m-a', 'Assidu'), joueur('m-b', 'Absent'), joueur('m-c', 'Rare', 'remplacant'), joueur('m-x', 'Parti', 'ancien'),
    { _id: 'm-s', type: 'staff', statut: 'actif', pseudo: 'Coach' }, joueur('m-y', ''),
  ];
  const tous = (statut) => ({ 'm-x': statut, 'm-s': statut, 'm-y': statut });
  const presences = [
    presence('2026-W35', { 'm-b': 'absent', 'm-a': 'absent' }), // il y a plus de 30 jours
    presence('2026-W40', { 'm-a': 'present', 'm-b': 'present', 'm-c': 'absent', ...tous('absent') }),
    presence('2026-W41', { 'm-a': 'present', 'm-b': 'absent', 'm-c': 'absent', ...tous('absent') }),
    presence('2026-W42', { 'm-a': 'present', 'm-b': 'absent', 'm-c': 'absent', ...tous('absent') }),
    presence('2026-W43', { 'm-a': 'retard', 'm-b': 'retard', ...tous('absent') }),
    presence('2026-W43', { 'm-a': 'present', 'm-b': 'excuse', 'm-c': 'excuse' }, 4),
    presence('2026-W44', { 'm-a': 'absent', 'm-b': 'absent', 'm-c': 'absent' }), // à venir
  ];
  const alertes = alertesSante({ def: def('valorant'), membres, presences, semaineCourante: SEMAINE, aujourdhui: AUJOURDHUI });
  assert.deepEqual(alertes, [{ niveau: 'attention', texte: 'Présence de Absent : 50 % sur 30 jours.', lien: '#/presences' }]);
});

test('santé : chiffres oubliés depuis 2 semaines, trois défaites de suite, map du pool sans scrim depuis 3 semaines', () => {
  const membres = [joueur('m-a', 'Assidu'), joueur('m-b', 'Absent'), joueur('m-c', 'Rare', 'remplacant'), joueur('m-e', 'Essai', 'essai')];
  const mesures = [
    { membreId: 'm-a', semaine: '2026-W41' }, { membreId: 'm-a', semaine: '2026-W42' },
    { membreId: 'm-b', semaine: '2026-W41' },
  ];
  const scrims = [victoire('2026-09-20', 'abyss'), defaite('2026-10-10', 'haven'), defaite('2026-10-12', 'lotus'), defaite('2026-10-14', 'haven')];
  const meta = structuredClone(MODELES.valorant.initiale);
  const alertes = alertesSante({ def: def('valorant'), membres, mesures, scrims, meta, semaineCourante: SEMAINE, aujourdhui: AUJOURDHUI });
  const textes = alertes.map((a) => a.texte);
  assert.deepEqual(textes, [
    'Aucun chiffre de Absent depuis 2 semaines.',
    'Rare n’a encore saisi aucun chiffre.',
    '3 défaites de suite : prévoir une VOD collective et un débrief.',
    'Aucun scrim sur Abyss depuis 3 semaines.',
    'Aucun scrim sur Bind depuis 3 semaines (map jamais jouée).',
    'Aucun scrim sur Corrode depuis 3 semaines (map jamais jouée).',
    'Aucun scrim sur Summit depuis 3 semaines (map jamais jouée).',
    'Aucun scrim sur Sunset depuis 3 semaines (map jamais jouée).',
  ]);
  assert.deepEqual(alertes.find((a) => a.texte.startsWith('Rare')).lien, '#/progression/m-c');
  assert.equal(alertes.find((a) => a.texte.startsWith('3 défaites')).niveau, 'attention');

  // Deux défaites seulement, moins de 3 scrims : rien sur les séries ni sur les maps.
  const peu = alertesSante({ def: def('valorant'), membres: [], scrims: scrims.slice(2), meta, semaineCourante: SEMAINE, aujourdhui: AUJOURDHUI });
  assert.deepEqual(peu, []);
  // Aucun chiffre saisi par l'équipe : pas de rappel. Jeu sans map pool : pas d'alerte de map.
  assert.deepEqual(alertesSante({ def: def('lol'), membres, mesures: [], scrims: scrims.map((s) => ({ ...s, map: '' })).slice(0, 1), meta: structuredClone(MODELES.lol.initiale), semaineCourante: SEMAINE, aujourdhui: AUJOURDHUI }), []);
  // Classement : une place dans la moitié basse du lobby est une défaite.
  const lobby = [16, 12, 18].map((place, i) => ({ date: `2026-10-1${i}`, map: 'stormpoint', place, equipes: 20 }));
  assert.ok(alertesSante({ def: def('apex'), scrims: lobby, semaineCourante: SEMAINE, aujourdhui: AUJOURDHUI }).some((a) => a.texte.startsWith('3 défaites de suite')));
});

test('santé : équipe régulière, aucune alerte', () => {
  const pool = MODELES.valorant.initiale.mapPool;
  const alertes = alertesSante({
    def: def('valorant'),
    membres: [joueur('m-a', 'Assidu'), joueur('m-b', 'Second', 'remplacant')],
    presences: ['2026-W40', '2026-W41', '2026-W42', '2026-W43'].map((s) => presence(s, { 'm-a': 'present', 'm-b': 'retard' })),
    mesures: [{ membreId: 'm-a', semaine: '2026-W43' }, { membreId: 'm-b', semaine: '2026-W42' }],
    scrims: pool.map((map, i) => victoire(`2026-10-${10 + i}`, map)),
    meta: structuredClone(MODELES.valorant.initiale),
    semaineCourante: SEMAINE,
    aujourdhui: AUJOURDHUI,
  });
  assert.deepEqual(alertes, []);
});

test('charge d’entraînement : heures planifiées et jours off de chaque joueur, seuils des Réglages du jeu', () => {
  const membres = [joueur('m-a', 'Assidu'), joueur('m-b', 'Second', 'remplacant'), { _id: 'm-s', type: 'staff', statut: 'actif', pseudo: 'Coach' }, joueur('m-x', 'Parti', 'ancien')];
  let n = 0;
  const bloc = (jour, debut, fin, pour = 'equipe', extra = {}) => ({ id: `b-${String((n += 1)).padStart(10, '0')}`, jour, debut, fin, type: 'scrim', pour, membres: [], ...extra });
  const planning = {
    _id: SEMAINE,
    blocs: [
      ...[1, 2, 3, 4, 5, 6].map((j) => bloc(j, '20:00', '23:00')),
      bloc(7, '14:00', '17:00', 'titulaires'),
      bloc(7, '18:00', '23:00', 'equipe', { type: 'repos' }),
      bloc(2, '10:00', '11:00', 'individuel'),
      bloc(3, '10:00', '12:00', 'choix', { membres: ['m-b'] }),
      bloc(4, '10:00', '12:00', 'staff'),
    ],
  };
  const mesures = [{ membreId: 'm-a', semaine: SEMAINE, parties: 12 }];
  const val = definitionEffective(MODELES.valorant);
  assert.deepEqual(chargeSemaine({ def: val, planning, membres, mesures, semaine: SEMAINE }), [
    { membreId: 'm-a', pseudo: 'Assidu', minutes: 22 * 60, jours: 7, joursOff: 0, parties: 12, depasse: true, sansRepos: true },
    { membreId: 'm-b', pseudo: 'Second', minutes: 21 * 60, jours: 6, joursOff: 1, parties: null, depasse: true, sansRepos: false },
  ]);
  assert.deepEqual(alertesCharge({ def: val, planning: [planning], membres, mesures, semaine: SEMAINE }).map((a) => a.texte), [
    'Charge de Assidu : 22 h planifiées cette semaine (plafond 20 h).',
    'Assidu n’a aucun jour off cette semaine.',
    'Charge de Second : 21 h planifiées cette semaine (plafond 20 h).',
  ]);
  const souple = definitionEffective(MODELES.valorant, validerReglagesJeu(MODELES.valorant, { charge: { heuresMax: 25, joursOffMin: 2 } }).valeur);
  assert.deepEqual(alertesCharge({ def: souple, planning: [planning], membres, semaine: SEMAINE }).map((a) => a.texte), [
    'Assidu n’a aucun jour off cette semaine.',
    'Second n’a que 1 jour off cette semaine (2 au minimum).',
  ]);
  assert.deepEqual(alertesCharge({ def: val, planning: [{ ...planning, _id: '2026-W42' }], membres, semaine: SEMAINE }), [], 'pas de planning cette semaine');
  const sante = alertesSante({ def: val, membres, planning: [planning], semaineCourante: SEMAINE, aujourdhui: AUJOURDHUI });
  assert.equal(sante.filter((a) => /Charge de|jour off/.test(a.texte)).length, 3, 'le moniteur de santé reprend la charge');
});

test('tournois : rappels d’inscription, de début et de résultat ; tournois à venir', () => {
  const t = (nom, champs) => ({ nom, roster: ['m-a'], ...champs });
  const tournois = [
    t('Coupe A', { statut: 'envisage', dateLimite: '2026-10-28' }),
    t('Coupe B', { statut: 'envisage', dateLimite: '2026-10-23' }),
    t('Coupe C', { statut: 'envisage', dateLimite: '2026-10-21' }),
    t('Coupe D', { statut: 'envisage', dateLimite: '2026-10-22' }),
    t('Coupe E', { statut: 'envisage', dateLimite: '2026-10-18' }),
    t('Coupe F', { statut: 'envisage', dateLimite: '2026-11-15' }),
    t('Ligue G', { statut: 'inscrit', debut: '2026-10-22' }),
    t('Ligue H', { statut: 'inscrit', debut: '2026-10-30', roster: [] }),
    t('Ligue I', { statut: 'encours', debut: '2026-10-10', fin: '2026-10-19' }),
    t('Ligue J', { statut: 'termine', debut: '2026-09-01', fin: '2026-10-01' }),
  ];
  assert.deepEqual(rappelsTournois(tournois, AUJOURDHUI).map((r) => [r.niveau, r.texte]), [
    ['info', 'Inscription à Coupe A : date limite dans 7 jours (28 oct.).'],
    ['attention', 'Inscription à Coupe B : date limite dans 2 jours (23 oct.).'],
    ['attention', 'Dernier jour pour s’inscrire à Coupe C.'],
    ['attention', 'Inscription à Coupe D : date limite demain (22 oct.).'],
    ['info', 'Date limite passée pour Coupe E : indique si l’équipe est inscrite.'],
    ['info', 'Ligue G commence demain : roster et horaires à confirmer.'],
    ['attention', 'Aucun joueur inscrit dans le roster de Ligue H.'],
    ['info', 'Ligue I est terminé ? Saisis le résultat.'],
  ]);
  assert.deepEqual(tournoisAVenir(tournois, AUJOURDHUI).map((x) => x.nom), ['Ligue G', 'Ligue H', 'Coupe A', 'Coupe B', 'Coupe C', 'Coupe D', 'Coupe E', 'Coupe F']);
});

test('partenaires de scrim : fiabilité calculée sur les scrims joués et les incidents notés', () => {
  const p = { _id: 'e-aaaaaaaaaa', incidents: [{ type: 'annule' }, { type: 'absent' }, { type: 'retard' }, { type: 'annuleNous' }] };
  const scrims = [{ partenaire: 'e-aaaaaaaaaa', date: '2026-10-01' }, { partenaire: 'e-aaaaaaaaaa', date: '2026-10-10' }, { partenaire: 'e-bbbbbbbbbb', date: '2026-10-12' }];
  assert.deepEqual(fiabilitePartenaire(p, scrims), { joues: 2, annules: 1, absents: 1, retards: 1, annulesNous: 1, taux: 50, dernier: '2026-10-10' });
  assert.deepEqual(fiabilitePartenaire({ _id: 'e-cccccccccc' }, scrims), { joues: 0, annules: 0, absents: 0, retards: 0, annulesNous: 0, taux: null, dernier: null });
});

test('conflits entre jeux : une même personne attendue au même moment dans deux jeux', () => {
  const lol = { id: 'lol', nom: 'League of Legends', court: 'LoL', couleur: 'sarcelle' };
  const planning = { blocs: [
    { id: 'b-aaaaaaaaaa', jour: 2, debut: '20:00', fin: '22:00', type: 'scrim', pour: 'equipe' },
    { id: 'b-bbbbbbbbbb', jour: 3, debut: '18:00', fin: '19:00', type: 'vod', pour: 'staff' },
  ] };
  const autre = { blocs: [
    { id: 'b-xxxxxxxxxx', jour: 2, debut: '21:00', fin: '23:00', type: 'scrim', pour: 'equipe' },
    { id: 'b-yyyyyyyyyy', jour: 2, debut: '22:00', fin: '23:00', type: 'scrim', pour: 'titulaires' },
    { id: 'b-zzzzzzzzzz', jour: 2, debut: '19:00', fin: '20:00', type: 'scrim', pour: 'equipe' },
    { id: 'b-wwwwwwwwww', jour: 3, debut: '18:00', fin: '19:00', type: 'repos', pour: 'equipe' },
  ] };
  const liens = [{ membre: { _id: 'm-a', type: 'joueur', statut: 'titulaire' }, autres: [{ jeu: lol, membre: { _id: 'm-l', type: 'joueur', statut: 'remplacant' }, planning: autre }] }];
  assert.deepEqual(conflitsEntreJeux({ planning, liens }), [{ blocId: 'b-aaaaaaaaaa', membreId: 'm-a', jeu: lol, jour: 2, debut: '21:00', fin: '23:00' }]);
  assert.deepEqual(conflitsEntreJeux({ planning, liens: [] }), []);
});

// ——— Présences, bilan du mois, chiffres ———

test('présences : taux sans les excusés, séances où l’appel a un sens, mois d’une semaine', () => {
  const s = statsPresences([
    { semaine: '2026-W42', statuts: { a: 'present', b: 'absent', c: 'inconnu' } },
    { semaine: '2026-W43', statuts: { a: 'retard', b: 'excuse' } },
  ]);
  assert.deepEqual(s.a, { present: 1, retard: 1, excuse: 0, absent: 0, total: 2, taux: 100 });
  assert.deepEqual(s.b, { present: 0, retard: 0, excuse: 1, absent: 1, total: 2, taux: 0 });
  assert.deepEqual(s.c, { present: 0, retard: 0, excuse: 0, absent: 0, total: 0, taux: null });
  const blocs = [
    { type: 'scrim', pour: 'equipe' }, { type: 'echauffement', pour: 'equipe' }, { type: 'aim', pour: 'individuel' },
    { type: 'vod', pour: 'staff' }, { type: 'repos', pour: 'equipe' }, { type: 'practice', pour: 'titulaires' },
  ];
  assert.deepEqual(seancesAppel(blocs).map((b) => b.type), ['scrim', 'practice']);
  assert.equal(moisDeSemaine('2026-W40'), '2026-10', 'le jeudi décide du mois');
  assert.equal(moisDeSemaine('2026-W44'), '2026-10');
  assert.equal(moisDeSemaine('2026-W45'), '2026-11');
  assert.deepEqual(semainesDuMois('2026-11'), ['2026-W44', '2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49']);
});

test('bilan du mois : scrims du mois, objectifs atteints, moyennes des chiffres du jeu comparées au mois précédent', () => {
  const val = def('valorant');
  const b = bilanMois({
    mois: '2026-10',
    def: val,
    scrims: [victoire('2026-10-05', 'haven'), defaite('2026-09-30', 'lotus')],
    presences: [presence('2026-W40', { 'm-a': 'present', 'm-b': 'absent' }), presence('2026-W45', { 'm-a': 'absent' })],
    objectifs: [{
      _id: 'm-a',
      suivis: { 'meca-1-1': { statut: 'atteint', le: '2026-10-12' }, 'meca-1-2': { statut: 'atteint', le: '2026-09-02' }, 'util-1-1': { statut: 'encours', le: '2026-10-03' } },
      perso: [{ id: 'p-aaaaaaaaaa', statut: 'atteint', le: '2026-10-20' }, { id: 'p-bbbbbbbbbb', statut: 'encours', le: '' }],
    }, { _id: 'm-b', suivis: {}, perso: [] }],
    mesures: [
      { membreId: 'm-a', semaine: '2026-W42', valeurs: { hs: 20, acs: 200, kd: 1.1 }, parties: 10 },
      { membreId: 'm-a', semaine: '2026-W43', valeurs: { hs: 22, acs: null, kd: 1.3 }, parties: 5 },
      { membreId: 'm-a', semaine: '2026-W38', valeurs: { hs: 15, acs: 180 }, parties: 7 },
      { membreId: 'm-a', semaine: '2026-W30', valeurs: { hs: 10 } },
      { membreId: 'm-a', semaine: 'pas-une-semaine', valeurs: { hs: 99 } },
    ],
  });
  assert.equal(b.mois, '2026-10');
  assert.deepEqual([b.scrims.total, b.scrims.victoires], [1, 1]);
  assert.deepEqual(b.atteints, { 'm-a': ['meca-1-1', 'p-aaaaaaaaaa'] });
  assert.deepEqual(b.presences, { 'm-a': { present: 1, retard: 0, excuse: 0, absent: 0, total: 1, taux: 100 }, 'm-b': { present: 0, retard: 0, excuse: 0, absent: 1, total: 1, taux: 0 } });
  assert.deepEqual(b.chiffres['m-a'], {
    mois: { valeurs: { hs: 21, acs: 200, kd: 1.2 }, parties: 15 },
    precedent: { valeurs: { hs: 15, acs: 180, kd: null }, parties: 7 },
  });
  const lol = bilanMois({ mois: '2026-10', def: def('lol'), mesures: [{ membreId: 'm-l', semaine: '2026-W42', valeurs: { kda: 3, cs: 7.5 } }] });
  assert.deepEqual(Object.keys(lol.chiffres['m-l'].mois.valeurs), ['kda', 'cs', 'kp', 'vision'], 'les chiffres du jeu');
  assert.deepEqual(bilanMois({ mois: '2026-01', def: val }).chiffres, {});
  assert.deepEqual(moyennesMesures([], val.chiffres), { valeurs: { hs: null, acs: null, kd: null }, parties: 0 });
});

test('« quoi de neuf » : ce que les autres ont changé depuis la visite précédente, du plus récent au plus ancien, 12 au plus', () => {
  const moi = 'c-moi';
  const d = (extra, majLe, { qui = 'c-autre', creeLe = majLe } = {}) => ({ ...extra, maj: { par: qui, le: majLe }, cree: { par: qui, le: creeLe } });
  const donnees = {
    strats: [
      d({ _id: 's1', nom: 'Exec A', map: 'bind' }, '2026-10-16T10:00:00.000Z'),
      d({ _id: 's2', nom: 'Mienne', map: 'bind' }, '2026-10-16T11:00:00.000Z', { qui: moi }),
      d({ _id: 's3', nom: 'Ancienne', map: '' }, '2026-10-17T08:00:00.000Z', { creeLe: '2026-10-01T08:00:00.000Z' }),
      d({ _id: 's4', nom: 'Vieille', map: 'haven' }, '2026-10-10T08:00:00.000Z'),
    ],
    planning: [
      d({ _id: '2026-W43' }, '2026-10-18T09:00:00.000Z'),
      d({ _id: '2026-W44' }, '2026-10-18T09:30:00.000Z'),
      d({ _id: 'modele' }, '2026-10-16T12:00:00.000Z'),
    ],
    scrims: [d({ _id: 'x1', scoreNous: 13, scoreEux: 9, adversaire: 'Orage' }, '2026-10-19T21:00:00.000Z')],
    vods: [d({ _id: 'v1', titre: 'Scrim Lotus' }, '2026-10-19T22:00:00.000Z')],
    vodNotes: [
      d({ _id: 'n1', vodId: 'v1', membre: 'm-moi', texte: 'Bon placement en défense' }, '2026-10-20T08:00:00.000Z'),
      d({ _id: 'n2', vodId: 'v1', membre: 'm-autre', texte: 'Pas pour moi' }, '2026-10-20T08:05:00.000Z'),
    ],
    objectifs: [d({ _id: 'm-moi' }, '2026-10-20T09:00:00.000Z', { qui: 'c-coach', creeLe: '2026-09-01T00:00:00.000Z' })],
    meta: [{ _id: 'courante', patch: '13.09', derniereVerif: '2026-10-20T05:45:00.000Z', dernierEcart: { vide: false } }],
    adversaires: [d({ _id: 'd1', nom: 'Kraken', prochainMatch: { date: '2026-10-30' } }, '2026-10-20T10:00:00.000Z')],
    candidats: [d({ _id: 'k1', pseudo: 'Nova' }, '2026-10-20T11:00:00.000Z')],
    absences: [d({ _id: 'a1', membreId: 'm-b' }, '2026-10-20T12:00:00.000Z')],
    bibliotheque: [d({ _id: 'l1' }, '2026-10-20T13:00:00.000Z'), d({ _id: 'l2' }, '2026-10-20T14:00:00.000Z'), d({ _id: 'l3' }, '2026-10-20T15:00:00.000Z', { qui: moi })],
    suggestions: [
      { _id: 'g-a', statut: 'nouvelle', creeLe: '2026-10-20T05:45:01.000Z' },
      { _id: 'g-b', statut: 'nouvelle', creeLe: '2026-10-20T05:45:02.000Z' },
      { _id: 'g-c', statut: 'appliquee', creeLe: '2026-10-20T05:45:03.000Z' },
    ],
  };
  const items = quoiDeNeuf({
    depuis: '2026-10-15T00:00:00.000Z', moi, monMembreId: 'm-moi', liste: (c) => donnees[c] || [],
    nomMap: (id) => id.toUpperCase(), nomMembre: (id) => (id === 'm-b' ? 'Talus' : '?'), semaineCourante: '2026-W43',
  });
  assert.deepEqual(items.map((i) => i.texte), [
    '2 ajouts dans la bibliothèque',
    'Absence déclarée : Talus',
    'Nouveau candidat : Nova',
    'Prochain match contre Kraken mis à jour',
    'Tes objectifs ont été mis à jour par le staff',
    'Note de VOD te concernant : Bon placement en défense',
    '2 suggestions après la mise à jour de la méta',
    'Méta : patch 13.09, changements à consulter',
    'VOD à revoir : Scrim Lotus',
    'Nouveau résultat : 13–9 contre Orage',
    'Planning de la semaine mis à jour',
    'Strat modifiée : «\u00a0Ancienne\u00a0»',
  ], '14 nouveautés, les 12 plus récentes');
  assert.deepEqual(items.map((i) => i.lien).slice(0, 6), ['#/bibliotheque', '#/presences', '#/recrutement', '#/adversaires/d1', '#/progression/m-moi', '#/vod/v1']);
  const sansPlafond = quoiDeNeuf({ depuis: '2026-10-16T09:00:00.000Z', moi, liste: (c) => donnees[c] || [], nomMap: (id) => id.toUpperCase(), semaineCourante: '2026-W43' });
  assert.ok(sansPlafond.some((i) => i.texte === 'Nouvelle strat : «\u00a0Exec A\u00a0» sur BIND' && i.lien === '#/strats/bind'));
  assert.ok(sansPlafond.some((i) => i.texte === 'Semaine type modifiée' && i.lien === '#/planning/modele'));
  assert.ok(!sansPlafond.some((i) => /Mienne|te concernant|Tes objectifs/.test(i.texte)), 'ni mes propres changements, ni ce qui concerne un autre membre');
  assert.deepEqual(quoiDeNeuf({ depuis: null, moi, liste: (c) => donnees[c] || [] }), [], 'première visite : rien');
});

// ——— Dates et semaines ISO ———

test('dates : semaines ISO en fin et début d’année, jours de la semaine, heure de Paris, durées', () => {
  const semaine = (iso) => semaineIso(civileDepuisIso(iso));
  assert.equal(semaine('2026-10-18'), '2026-W42');
  assert.equal(semaine('2026-10-19'), '2026-W43');
  assert.equal(semaine('2026-01-01'), '2026-W01');
  assert.equal(semaine('2026-12-31'), '2026-W53');
  assert.equal(semaine('2027-01-03'), '2026-W53');
  assert.equal(semaine('2027-01-04'), '2027-W01');
  assert.equal(isoCivile(lundiDe('2026-W43')), '2026-10-19');
  assert.equal(isoCivile(lundiDe('2027-W01')), '2027-01-04');
  assert.equal(decalerSemaine('2026-W53', 1), '2027-W01');
  assert.equal(decalerSemaine('2027-W01', -1), '2026-W53');
  assert.deepEqual(joursDe('2026-W44').map((j) => j.iso), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(numeroSemaine('2026-W07'), 7);
  assert.deepEqual(dateCivile(new Date('2026-10-18T22:30:00Z'), 'Europe/Paris'), { a: 2026, m: 10, j: 19 }, 'été : UTC+2');
  assert.deepEqual(dateCivile(new Date('2026-12-31T23:30:00Z'), 'Europe/Paris'), { a: 2027, m: 1, j: 1 }, 'hiver : UTC+1');
  assert.deepEqual([minutes('20:30'), minutes('24:00'), hhmm(1230), hhmm(-5), hhmm(5000)], [1230, 1440, '20:30', '00:00', '24:00']);
  assert.deepEqual([dureeLisible(45), dureeLisible(90), dureeLisible(120)], ['45 min', '1 h 30', '2 h']);
});

// ——— Contenus d'entraînement ———

test('contenus : programme par palier et par rôle, seuils chiffrés dans les deux sens, semaine type selon le palier', () => {
  const val = def('valorant');
  const p = programmePour(val, 3, 'controleur');
  assert.equal(p.palier, 3);
  assert.ok(p.echauffement.length >= 2);
  assert.equal(p.dureeEchauffement, p.echauffement.reduce((s, e) => s + e.duree, 0));
  assert.deepEqual(p.role, val.parRole.controleur);
  assert.equal(programmePour(val, 9, 'inconnu').palier, 6, 'palier borné');
  assert.deepEqual(programmePour(val, 2, 'inconnu').role, []);

  assert.deepEqual(seuilAtteint(val, 'meca-3-2', { valeurs: { hs: 21 } }), { atteint: true, valeur: 21, seuil: 20, chiffre: 'hs' });
  assert.equal(seuilAtteint(val, 'meca-3-2', { valeurs: { hs: 19.5 } }).atteint, false);
  assert.equal(seuilAtteint(val, 'meca-1-1', { valeurs: { hs: 21 } }), null, 'objectif sans seuil');
  assert.equal(seuilAtteint(val, 'meca-3-2', { valeurs: {} }), null, 'chiffre non saisi');
  const ow = def('ow2');
  assert.equal(seuilAtteint(ow, 'jeu-3-1', { valeurs: { morts10: 6.5 } }).atteint, true, 'sens « <= » : moins de morts');
  assert.equal(seuilAtteint(ow, 'jeu-3-1', { valeurs: { morts10: 8 } }).atteint, false);
  assert.deepEqual(seuilPourChiffre(val, 'hs', 3), { palier: 3, seuil: 20, sens: '>=' });
  assert.deepEqual(seuilPourChiffre(val, 'hs', 6), { palier: 4, seuil: 23, sens: '>=' }, 'au-delà : le dernier seuil');
  assert.equal(seuilPourChiffre(val, 'acs', 3), null);

  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => ebauchePourPalier(val, n)), ['decouverte', 'decouverte', 'progression', 'progression', 'competition', 'haut-niveau']);
  assert.equal(ebauchePourPalier(def('lol'), 6), 'competition', 'LoL n’a pas de semaine « haut niveau »');
  for (const id of ['valorant', 'lol', 'rl', 'fortnite']) {
    const d = def(id);
    for (let n = 1; n <= 6; n += 1) for (const dom of d.domaines) assert.ok(objectifsDuPalier(d, n, dom.id).length > 0, `${id} ${dom.id} palier ${n}`);
  }
});
