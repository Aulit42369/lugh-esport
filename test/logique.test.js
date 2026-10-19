// Fonctions pures communes au serveur et au navigateur : statistiques (trois types de score), alertes de l'équipe,
// écart de méta et suggestions, assistant de veto, agenda .ics, CSV, textes Discord.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELES } from '../shared/jeux/index.js';
import { definitionEffective } from '../shared/jeux/definition.js';
import { validerReglagesJeu } from '../shared/jeux/reglages-jeu.js';
import { statsScrims, resultat, pointsClassement, scoreLisible, manchesParCamp, trierParDate } from '../shared/stats.js';
import { alertesEquipe, diffMeta, suggestionsDepuisDiff, idSuggestion } from '../shared/alertes.js';
import { proposerVeto } from '../shared/veto.js';
import { agendaIcs, csv } from '../shared/exports.js';
import {
  texteScrim, texteSemaine, texteMeta, texteMatch, texteAbsence, texteDerniersScrims, texteActionsVod, couper,
} from '../shared/discord.js';
import { MOTIFS } from '../shared/validation.js';
import { MARQUE } from '../shared/marque.js';

const def = (id, reglages = null) => definitionEffective(MODELES[id], reglages ? validerReglagesJeu(MODELES[id], reglages).valeur : null);
const metaDe = (id) => structuredClone(MODELES[id].initiale);
const manche = (date, map, campDepart, mtNous, mtEux, scoreNous, scoreEux, pistols = {}) => ({ date, map, campDepart, mtNous, mtEux, scoreNous, scoreEux, pistols });

// ——— Statistiques ———

test('statistiques en manches (Valorant) : bilan, camps avec prolongations, pistols, rounds, série', () => {
  const s = statsScrims([
    manche('2026-10-07', 'lotus', 'def', null, null, 12, 12),
    manche('2026-10-01', 'haven', 'att', 7, 5, 13, 9, { att: 'gagne', def: 'perdu' }),
    manche('2026-10-05', 'lotus', 'att', 6, 6, 14, 12, { att: 'gagne', def: 'gagne' }),
    manche('2026-10-03', 'haven', 'def', 4, 8, 10, 13, { att: 'perdu', def: 'perdu' }),
  ], def('valorant'));
  assert.deepEqual([s.total, s.victoires, s.defaites, s.nuls, s.winrate], [4, 2, 1, 1, 50]);
  assert.deepEqual([s.roundsPour, s.roundsContre], [49, 46]);
  assert.deepEqual(s.parMap.haven, { map: 'haven', joues: 2, victoires: 1, defaites: 1, roundsPour: 23, roundsContre: 22, places: [], winrate: 50, placeMoyenne: null });
  assert.equal(s.parMap.lotus.winrate, 50);
  // Attaque : 7–5 (1re mi-temps), 6–5 (2e mi-temps du match commencé en défense), 6–6 ; défense : 6–4, 4–8, 8–6 (prolongations comprises).
  assert.deepEqual(s.cotes, { att: { gagnes: 19, perdus: 16, taux: 54 }, def: { gagnes: 18, perdus: 18, taux: 50 } });
  assert.deepEqual(s.pistols, { gagnes: 3, joues: 6, taux: 50 });
  assert.deepEqual(s.tendance, ['V', 'D', 'V', 'N'], 'dans l’ordre des dates');
  assert.deepEqual(s.serie, { type: 'N', longueur: 1 });
  assert.equal(s.classement.parties, 0);
  assert.equal(manchesParCamp(manche('', '', 'att', 7, 5, 13, 9), ['att']), null, 'deux camps nécessaires');
  assert.deepEqual(statsScrims([], def('valorant')).winrate, null);
  assert.deepEqual(trierParDate([{ date: '2026-10-02', heure: '21:00', n: 2 }, { date: '2026-10-02', heure: '', n: 1 }, { date: '2026-10-01', n: 0 }]).map((x) => x.n), [0, 1, 2]);
});

test('statistiques en score simple (LoL) : pas de camps ni de pistols, série de défaites', () => {
  const s = statsScrims([
    { date: '2026-10-01', scoreNous: 2, scoreEux: 1 },
    { date: '2026-10-02', scoreNous: 0, scoreEux: 2 },
    { date: '2026-10-03', scoreNous: 1, scoreEux: 2 },
  ], def('lol'));
  assert.deepEqual([s.victoires, s.defaites, s.nuls, s.winrate, s.roundsPour, s.roundsContre], [1, 2, 0, 33, 3, 5]);
  assert.deepEqual(s.cotes, { bleu: { gagnes: 0, perdus: 0, taux: null }, rouge: { gagnes: 0, perdus: 0, taux: null } });
  assert.deepEqual(s.pistols, { gagnes: 0, joues: 0, taux: null });
  assert.equal(s.parMap[''].joues, 3);
  assert.deepEqual(s.serie, { type: 'D', longueur: 2 });
  assert.equal(scoreLisible({ scoreNous: 3, scoreEux: 2 }), '3–2');
});

test('statistiques en classement (Apex, Fortnite) : résultat, points du barème officiel, moyennes', () => {
  const apex = def('apex');
  const p = (date, place, eliminations, extra = {}) => ({ date, map: 'stormpoint', place, equipes: 20, eliminations, ...extra });
  assert.equal(resultat(p('', 1, 0)), 'V');
  assert.equal(resultat(p('', 10, 0)), 'N', 'moitié haute du lobby');
  assert.equal(resultat(p('', 11, 0)), 'D', 'moitié basse du lobby');
  assert.equal(pointsClassement(p('', 1, 9), apex.score), 21, '12 + 9 éliminations');
  assert.equal(pointsClassement(p('', 2, 3), apex.score), 12);
  assert.equal(pointsClassement(p('', 16, 0), apex.score), 0);
  assert.equal(pointsClassement(p('', 5, 2, { points: 30 }), apex.score), 30, 'points saisis prioritaires');
  assert.equal(pointsClassement(p('', 1, 4), def('fortnite').score), 81, 'Fortnite : 65 + 4 × 4');
  assert.equal(pointsClassement(p('', 1, 4), { type: 'classement', bareme: null }), null);
  assert.equal(pointsClassement({ scoreNous: 2, scoreEux: 1 }, apex.score), null);

  const s = statsScrims([p('2026-10-01', 1, 9), p('2026-10-02', 11, 2), p('2026-10-03', 5, 4), p('2026-10-04', 16, 0)], apex);
  assert.deepEqual([s.victoires, s.defaites, s.nuls, s.winrate, s.roundsPour], [1, 2, 1, 25, 0]);
  assert.deepEqual(s.classement, { parties: 4, top1: 1, placeMoyenne: 8.3, eliminationsMoyennes: 3.8, pointsMoyens: 8, pointsTotal: 32 });
  assert.equal(s.parMap.stormpoint.placeMoyenne, 8.3);
  assert.deepEqual(s.serie, { type: 'D', longueur: 1 });
  assert.equal(scoreLisible(p('', 1, 9)), '1re / 20 · 9 élim.');
  assert.equal(scoreLisible({ place: 3 }), '3e / 20');
  assert.equal(scoreLisible({ place: 2, equipes: 50, eliminations: 0 }), '2e / 50 · 0 élim.');
});

// ——— Alertes, écart de méta, suggestions ———

test('alertes de l’équipe (Valorant) : méta ancienne, maps peu prêtes, compos, maps hors pool, nerf, IGL, planning', () => {
  const meta = { ...metaDe('valorant'), derniereVerif: '2026-10-12T10:00:00.000Z', statut: 'ok' };
  meta.personnages.find((x) => x.id === 'jett').dernierChangement = { patch: '13.08', type: 'nerf', resume: 'Dash plus lent.' };
  const entree = {
    meta,
    mapsEquipe: [
      { _id: 'haven', statut: 'pick', preparation: 80, compo: [{ personnage: 'jett', membre: '' }] },
      { _id: 'bind', statut: 'travail', preparation: 10, compo: [] },
      { _id: 'ascent', statut: 'pick', preparation: 50, compo: [] },
    ],
    strats: [{ map: 'ascent', statut: 'maitrisee' }, { map: 'ascent', statut: 'archivee' }, { map: 'haven', statut: 'rodage' }],
    membres: [{ type: 'joueur', statut: 'titulaire', pseudo: 'Kairo', personnages: { principaux: ['jett'] } }],
    planningSemaine: null,
    maintenant: new Date('2026-10-21T10:00:00Z'),
  };
  const alertes = alertesEquipe({ def: def('valorant'), ...entree });
  const textes = alertes.map((a) => a.texte);
  for (const attendu of [
    'Méta vérifiée il y a 9 jours.', 'Bind : préparation à 10 %.', 'Abyss : préparation à 0 %.', 'Haven (Pick) n’a pas de compo complète.',
    'Ascent n’est plus dans le pool mais reste en Pick.', '1 strat sur des maps hors pool, à archiver.', 'Nerf de Jett en 13.08 : Kairo le joue en principal.',
    'Aucun IGL désigné parmi les titulaires.', 'Le planning de cette semaine est vide.',
  ]) assert.ok(textes.includes(attendu), attendu);
  assert.ok(!textes.some((t) => t.startsWith('Haven : préparation')), 'Haven est prête à 80 %');
  const niveaux = alertes.map((a) => a.niveau);
  assert.deepEqual(niveaux, [...niveaux].sort((a, b) => ['urgent', 'attention', 'info'].indexOf(a) - ['urgent', 'attention', 'info'].indexOf(b)), 'les plus graves d’abord');

  const sansAuto = alertesEquipe({ def: def('valorant', { meta: { auto: false } }), ...entree }).map((a) => a.texte);
  assert.ok(!sansAuto.some((t) => t.startsWith('Méta vérifiée')), 'vérification automatique coupée : pas d’alerte d’ancienneté');
  const echec = alertesEquipe({ def: def('valorant'), ...entree, meta: { ...meta, statut: 'echec', erreur: 'réponse rejetée' } });
  assert.equal(echec[0].texte, 'Dernière actualisation de la méta en échec : réponse rejetée.');
  assert.deepEqual(alertesEquipe({ def: def('valorant'), meta: null }), []);
});

test('alertes de l’équipe : rien sur les maps sans map pool, pas d’IGL attendu en solo, cas calme', () => {
  const calme = alertesEquipe({
    def: def('lol'),
    meta: { ...metaDe('lol'), derniereVerif: '2026-10-20T06:00:00.000Z', statut: 'ok' },
    mapsEquipe: [{ _id: 'general', statut: 'pick', preparation: 0, compo: [] }],
    strats: [{ map: '', statut: 'rodage' }],
    membres: [{ type: 'joueur', statut: 'titulaire', pseudo: 'Lune', igl: true }],
    planningSemaine: { blocs: [{ id: 'b-aaaaaaaaaa' }] },
    maintenant: new Date('2026-10-21T10:00:00Z'),
  });
  assert.deepEqual(calme, []);
  const solo = alertesEquipe({
    def: def('fc', { equipe: { titulaires: 1, remplacants: 0 } }),
    meta: { ...metaDe('fc'), derniereVerif: '2026-10-20T06:00:00.000Z', statut: 'ok' },
    membres: [{ type: 'joueur', statut: 'titulaire', pseudo: 'Solo' }],
    planningSemaine: { blocs: [{}] },
    maintenant: new Date('2026-10-21T10:00:00Z'),
  });
  assert.deepEqual(solo, []);
  const rl = alertesEquipe({
    def: def('rl'),
    meta: { ...metaDe('rl'), derniereVerif: '2026-10-20T06:00:00.000Z', statut: 'ok' },
    membres: ['A', 'B', 'C'].map((pseudo) => ({ type: 'joueur', statut: 'titulaire', pseudo })),
    planningSemaine: { blocs: [{}] },
    maintenant: new Date('2026-10-21T10:00:00Z'),
  });
  assert.deepEqual(rl, [], 'Rocket League : pas d’IGL attitré, pas d’alerte');
});

test('écart de méta et suggestions selon le jeu : maps entrées et sorties, personnages, identifiants sûrs', () => {
  const avant = metaDe('cs2');
  const apres = { ...metaDe('cs2'), patch: 'Mise à jour du 21 octobre 2026' };
  const sortie = apres.mapPool[0];
  const entree = apres.maps.find((m) => !apres.mapPool.includes(m.id)).id;
  apres.mapPool = [...apres.mapPool.slice(1), entree];
  const d = diffMeta(avant, apres);
  assert.deepEqual(d.mapsEntrees.map((m) => m.id), [entree]);
  assert.deepEqual(d.mapsSorties.map((m) => m.id), [sortie]);
  assert.equal(d.vide, false);
  const sugg = suggestionsDepuisDiff(def('cs2'), d, { meta: apres, mapsEquipe: [{ _id: sortie, statut: 'confort' }], strats: [], membres: [] });
  assert.deepEqual(sugg.map((s) => s.type).sort(), ['planning', 'strats'], 'CS2 : pas de compo de personnages à construire');
  assert.match(sugg.find((s) => s.type === 'strats').texte, /^Retirer .+ du planning\.$/);
  for (const s of sugg) assert.ok(MOTIFS.suggestion.test(idSuggestion(s.cle)), s.cle);
  assert.equal(idSuggestion('Map Entrée / Spéciale 13.09'), 'g-map-entr-e-sp-ciale-13-09');
  assert.equal(diffMeta(null, apres).vide, true, 'première méta : aucun écart');
  assert.equal(diffMeta(apres, structuredClone(apres)).vide, true);
  assert.deepEqual(suggestionsDepuisDiff(def('cs2'), diffMeta(apres, apres), { meta: apres }), []);
});

// ——— Veto ———

test('assistant de veto (Valorant, BO3) : sept étapes, nos bans sur nos points faibles, nos picks sur nos points forts', () => {
  const pool = ['abyss', 'bind', 'corrode', 'haven', 'lotus', 'summit', 'sunset'];
  const notre = {
    haven: { statut: 'pick', preparation: 80 }, lotus: { statut: 'confort', preparation: 60 }, sunset: { statut: 'confort', preparation: 50 },
    abyss: { statut: 'travail', preparation: 30 }, bind: { statut: 'travail', preparation: 25 }, corrode: { statut: 'travail', preparation: 10 },
    summit: { statut: 'ban', preparation: 5 },
  };
  const adv = { fortes: ['bind', 'lotus'], faibles: ['haven'], bans: ['abyss'] };
  const e = proposerVeto({ formats: def('valorant').formats, format: 'bo3', nousCommencons: true, pool, notre, adv, nomMap: (id) => id.toUpperCase() });
  assert.deepEqual(e.map((x) => [x.qui, x.action, x.map]), [
    ['nous', 'ban', 'summit'], ['eux', 'ban', 'abyss'], ['nous', 'pick', 'haven'], ['eux', 'pick', 'bind'],
    ['nous', 'ban', 'corrode'], ['eux', 'ban', 'sunset'], [null, 'decisive', 'lotus'],
  ]);
  assert.deepEqual(e.map((x) => x.raison), [
    'notre ban prioritaire (5 %)', 'ban habituel de l’adversaire', 'notre map (80 %) et point faible adverse', 'probable : leur map forte',
    'notre map la moins prête (10 %)', 'probable : leur map la plus faible ou notre point fort', 'map restante',
  ]);
  assert.deepEqual([e[0].numero, e[0].nom], [1, 'SUMMIT']);
  assert.equal(proposerVeto({ formats: def('valorant').formats, format: 'bo1', nousCommencons: false, pool, notre, adv })[0].qui, 'eux');
  assert.equal(proposerVeto({ formats: def('valorant').formats, format: 'bo9', pool, notre, adv }).length, 7, 'format inconnu : BO3');
});

test('assistant de veto selon le jeu : BO1 de R6 terminé par un pick, BO1 de CS2, rien pour un jeu à draft', () => {
  const r6 = def('r6');
  const pool = metaDe('r6').mapPool;
  assert.equal(pool.length, 9);
  const e = proposerVeto({ formats: r6.formats, format: 'bo1', nousCommencons: true, pool, notre: {}, adv: {} });
  assert.equal(e.length, 8);
  assert.deepEqual(e.map((x) => x.action), ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'pick']);
  assert.equal(e.at(-1).qui, 'eux');
  assert.equal(new Set(e.map((x) => x.map)).size, 8, 'une map reste hors du veto');
  const nousFinissons = proposerVeto({ formats: r6.formats, format: 'bo1', nousCommencons: false, pool, notre: {}, adv: {} }).at(-1);
  assert.deepEqual([nousFinissons.qui, nousFinissons.action], ['nous', 'pick']);
  assert.match(nousFinissons.raison, /^notre meilleure map disponible/);

  const cs2 = proposerVeto({ formats: def('cs2').formats, format: 'bo1', nousCommencons: true, pool: metaDe('cs2').mapPool, notre: {}, adv: {} });
  assert.deepEqual(cs2.map((x) => x.qui), ['nous', 'nous', 'eux', 'eux', 'eux', 'nous', null]);
  assert.deepEqual(proposerVeto({ formats: def('lol').formats, format: 'bo3', pool: ['a', 'b'], notre: {}, adv: {} }), [], 'LoL : draft, pas de veto de maps');
  assert.deepEqual(proposerVeto({ formats: def('valorant').formats, format: 'bo3', pool: [], notre: {}, adv: {} }), []);
});

// ——— Exports ———

test('agenda .ics : fuseau de Paris (VTIMEZONE), dates de la semaine ISO, échappement, lignes pliées à 75 octets', () => {
  const blocs = [
    { id: 'b-aaaaaaaaaa', jour: 2, debut: '20:00', fin: '22:00', type: 'scrim', titre: 'Scrim ; contre, Orage', details: 'Ligne 1\nLigne 2', map: 'haven', pour: 'equipe' },
    { id: 'b-bbbbbbbbbb', jour: 7, debut: '23:00', fin: '24:00', type: 'aim', titre: '', details: '', map: '', pour: 'individuel' },
    { id: 'b-cccccccccc', jour: 3, debut: '18:00', fin: '19:30', type: 'vod', titre: 'Review', details: 'Échauffement prévu à côté du café 😀 — rotations, utilitaires, débrief élaboré '.repeat(4), map: '', pour: 'equipe' },
  ];
  const ics = agendaIcs({ def: def('valorant'), semaine: '2026-W43', blocs, nomCalendrier: 'Lugh Valorant, semaine 43', nomMap: (id) => (id === 'haven' ? 'Haven' : id), maintenant: new Date('2026-10-18T12:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'fins de ligne CRLF uniquement');
  const lignes = ics.split('\r\n');
  for (const l of ['BEGIN:VTIMEZONE', 'TZID:Europe/Paris', 'BEGIN:DAYLIGHT', 'TZOFFSETTO:+0200', 'BEGIN:STANDARD', 'TZOFFSETTO:+0100', 'END:VTIMEZONE', 'X-WR-CALNAME:Lugh Valorant\\, semaine 43']) {
    assert.ok(lignes.includes(l), l);
  }
  assert.equal(lignes.filter((l) => l === 'BEGIN:VEVENT').length, 3);
  for (const l of [
    'UID:valorant-2026-W43-b-aaaaaaaaaa@lugh', 'DTSTAMP:20261018T120000Z',
    'DTSTART;TZID=Europe/Paris:20261020T200000', 'DTEND;TZID=Europe/Paris:20261020T220000',
    'SUMMARY:Scrim \\; contre\\, Orage', 'DESCRIPTION:Scrim\\nMap : Haven\\nLigne 1\\nLigne 2',
    'DTSTART;TZID=Europe/Paris:20261025T230000', 'DTEND;TZID=Europe/Paris:20261026T000000', 'SUMMARY:Aim et mécanique',
  ]) assert.ok(lignes.includes(l), l);

  const octets = (t) => Buffer.byteLength(t, 'utf8');
  assert.ok(lignes.every((l) => octets(l) <= 75), 'aucune ligne au-delà de 75 octets');
  assert.ok(lignes.some((l) => l.startsWith(' ')), 'au moins une ligne pliée');
  assert.ok(!ics.includes('�'), 'aucun caractère coupé');
  const attendu = `DESCRIPTION:VOD review\\n${blocs[2].details.replace(/,/g, '\\,')}`;
  assert.ok(ics.replace(/\r\n /g, '').includes(attendu), 'le texte se recolle à l’identique');
});

test('CSV pour Excel en français : BOM, « ; », virgule décimale, guillemets, formules neutralisées', () => {
  const c = csv(['Nom', 'Score', 'Note'], [
    ['Équipe; test', 13.5, 'ok'],
    ['Guillemet "x"', null, -3],
    ['=HYPERLINK("x")', -3, '@Kraken'],
    ['+33 6', 0, '-moins'],
    ['\tTab', 1, 'ligne\nsuite'],
  ]);
  assert.ok(c.startsWith('﻿Nom;Score;Note\r\n'));
  assert.ok(c.endsWith('\r\n'));
  assert.ok(c.includes('\r\n"Équipe; test";13,5;ok\r\n'));
  assert.ok(c.includes('\r\n"Guillemet ""x""";;-3\r\n'), 'un nombre négatif reste un nombre');
  assert.ok(c.includes('\r\n"\'=HYPERLINK(""x"")";-3;\'@Kraken\r\n'), 'une formule devient du texte');
  assert.ok(c.includes('\r\n\'+33 6;0;\'-moins\r\n'));
  assert.ok(c.includes('\r\n\'\tTab;1;"ligne\nsuite"\r\n'));
});

// ——— Textes Discord ———

test('textes Discord selon le type de score et le vocabulaire du jeu', () => {
  const val = def('valorant');
  const nomMap = (id) => ({ haven: 'Haven', lotus: 'Lotus', worldsedge: 'World’s Edge', stormpoint: 'Storm Point' }[id] || id);
  assert.equal(texteScrim(val, { date: '2026-10-15', adversaire: 'Kraken', map: 'lotus', type: 'officiel', campDepart: 'def', mtNous: 4, mtEux: 8, scoreNous: 9, scoreEux: 13, corriger: 'Retakes' }, nomMap),
    '❌ **Défaite 9–13** contre Kraken sur Lotus (match officiel, 15 oct. 2026)\nAttaque 5–5, Défense 4–8\n🎯 Retakes');
  assert.equal(texteScrim(def('lol'), { date: '2026-10-16', adversaire: 'Nébula', type: 'scrim', scoreNous: 1, scoreEux: 1 }), '➖ **Égalité 1–1** contre Nébula (scrim, 16 oct. 2026)');
  const apex = def('apex');
  assert.equal(texteScrim(apex, { date: '2026-10-17', adversaire: 'Lobby', map: 'worldsedge', type: 'scrim', place: 11, equipes: 20, eliminations: 2 }, nomMap),
    '🔻 **11e / 20 · 2 élim.** · 3 pts : Lobby sur World’s Edge (scrim, 17 oct. 2026)');
  assert.match(texteScrim(apex, { date: '2026-10-17', adversaire: 'Lobby', type: 'scrim', place: 5, equipes: 20 }), /^🏁 \*\*5e \/ 20\*\* · 4 pts : Lobby \(scrim/);

  const blocs = [
    { jour: 3, debut: '20:00', fin: '22:00', type: 'scrim', titre: 'Scrim contre Orage', map: 'haven', pour: 'equipe' },
    { jour: 1, debut: '19:00', fin: '20:00', type: 'aim', titre: '', map: '', pour: 'individuel' },
    { jour: 3, debut: '18:00', fin: '19:00', type: 'vod', titre: '', map: '', pour: 'titulaires' },
  ];
  assert.equal(texteSemaine({ def: val, titre: 'Planning Valorant, semaine 43', blocs, nomMap, collectifSeulement: true }),
    '📅 **Planning Valorant, semaine 43**\n\n**Mercredi**\n`18:00–19:00` VOD review (titulaires)\n`20:00–22:00` Scrim contre Orage (Haven, toute l’équipe)');
  assert.match(texteSemaine({ def: val, titre: 'T', blocs }), /\*\*Lundi\*\*\n`19:00–20:00` Aim et mécanique \(chacun de son côté\)/);
  assert.equal(texteSemaine({ def: val, titre: 'T', blocs: [] }), '📅 **T**\nAucune séance prévue.');

  const ecart = { entrees: ['Cache'], sorties: ['Overpass'], personnagesModifies: [], nouveauxPersonnages: [] };
  assert.equal(texteMeta(def('cs2'), { patch: 'MAJ 21/10', saison: 'Premier 5' }, ecart),
    `🗺️ **Méta Counter-Strike 2 : patch MAJ 21/10** (Premier 5)\nEntrent dans le pool : Cache\nSortent du pool : Overpass\nDétails et suggestions sur ${MARQUE.nom}, page Méta.`);
  assert.match(texteMeta(def('lol'), { patch: '26.21', saison: 'S3' }, { personnagesModifies: ['Aatrox'], nouveauxPersonnages: ['Brumeline'] }), /Champions modifiés : Aatrox\nNouveaux champions : Brumeline/);
  assert.equal(texteMatch(def('lol'), { nom: 'Nébula', prochainMatch: { date: '2026-10-30', heure: '19:00', format: 'bo5' } }), `⚔️ **Prochain match : Nébula** le 30 oct. 2026 à 19:00 (BO5)\nPréparation sur ${MARQUE.nom}, page Adversaires.`);
  assert.equal(texteAbsence({ date: '2026-10-28', debut: '20:00', fin: '23:00', raison: 'Examen' }, 'Kairo'), '🚫 **Absence : Kairo** le 28 oct. 2026 de 20:00 à 23:00 (Examen)');
  assert.equal(texteDerniersScrims([
    { date: '2026-10-15', adversaire: 'Orage', map: 'haven', scoreNous: 13, scoreEux: 9 },
    { date: '2026-10-17', adversaire: 'Lobby', map: 'stormpoint', place: 1, equipes: 20, eliminations: 9 },
  ], nomMap), '**Derniers résultats**\n🏆 1re / 20 · 9 élim. : Lobby, Storm Point (17 oct. 2026)\n✅ 13–9 contre Orage, Haven (15 oct. 2026)');
  assert.equal(texteDerniersScrims([]), 'Aucun résultat.');
  assert.equal(texteActionsVod({ titre: 'Scrim Lotus' }, [{ action: 'Trader plus vite', membre: 'm-a', temps: '12:30' }, { action: '' }, { action: 'Smokes plus tôt' }], () => 'Kairo'),
    '🎬 **Review : Scrim Lotus**\n• **Kairo** : Trader plus vite (12:30)\n• **Équipe** : Smokes plus tôt');
  const long = couper('x'.repeat(2500));
  assert.equal(long.length, 2000);
  assert.ok(long.endsWith('…'));
  assert.equal(couper('court'), 'court');
});
