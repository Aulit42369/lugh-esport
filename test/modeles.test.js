// Modèles de jeu, définition effective (modèle + Réglages du jeu), schémas des documents et méta, jeu par jeu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELES, ORDRE, ID_AUTRE, modele, resumeModele } from '../shared/jeux/index.js';
import { controlerModele } from '../shared/jeux/controle.js';
import { completerModele, TYPES_BLOC_COMMUNS } from '../shared/jeux/commun.js';
import { definitionEffective, actifs, typesStratPour, urlProfil, mot } from '../shared/jeux/definition.js';
import { validerReglagesJeu, reglagesVides } from '../shared/jeux/reglages-jeu.js';
import { blocsDepuisEbauche } from '../shared/jeux/contenus.js';
import { schemasPour } from '../shared/schemas.js';
import { validerMeta } from '../shared/schemas-meta.js';
import { lienTwitch } from '../shared/validation.js';
import { pointsClassement } from '../shared/stats.js';
import { metaInitiale } from '../src/espaces/amorcage-jeu.js';

const val = MODELES.valorant;
const defDe = (id, reglages = null, espace = null) => definitionEffective(MODELES[id], reglages, espace);
const schemas = (id, reglages = null) => schemasPour(defDe(id, reglages));
const messages = (r) => (r.erreurs || []).map((e) => `${e.chemin} ${e.message}`).join(' | ');

// Réglages valides (sinon le test s'arrête avec le détail des erreurs).
function reglages(idModele, brut) {
  const v = validerReglagesJeu(MODELES[idModele], brut);
  assert.ok(v.ok, `réglages refusés : ${messages(v)}`);
  return v.valeur;
}

// ——— Catalogue et contrôle des modèles ———

test('catalogue : dix modèles dans l’ordre proposé, recherche sûre par identifiant', () => {
  assert.deepEqual(ORDRE, ['valorant', 'cs2', 'lol', 'r6', 'ow2', 'rl', 'fc', 'apex', 'fortnite', 'autre']);
  assert.equal(ID_AUTRE, 'autre');
  for (const id of ORDRE) assert.equal(MODELES[id].id, id);
  assert.equal(modele('lol'), MODELES.lol);
  for (const inconnu of ['tetris', '__proto__', 'toString', 'constructor', '']) assert.equal(modele(inconnu), null, inconnu);
  assert.deepEqual(resumeModele(MODELES.rl), {
    id: 'rl', nom: 'Rocket League', court: 'RL', editeur: MODELES.rl.editeur, genre: 'sport-auto', titulaires: 3, patch: MODELES.rl.initiale.patch,
  });
});

test('chaque modèle passe le contrôle complet et donne des données de départ valides', () => {
  for (const id of ORDRE) {
    const m = MODELES[id];
    assert.deepEqual(controlerModele(m), [], `modèle ${id}`);
    const def = definitionEffective(m);
    const { validerDocument, documentParDefaut } = schemasPour(def);

    // Méta initiale : valide, sans avertissement, prête à être enregistrée.
    const v = validerMeta(def, m.initiale);
    assert.ok(v.ok, `${id} : méta initiale ${messages(v)}`);
    assert.deepEqual(v.avertissements, [], `${id} : avertissements de la méta initiale`);
    const meta = metaInitiale(def, m, new Date('2026-10-21T10:00:00Z'));
    assert.equal(meta.schema, 2);
    assert.equal(meta.statut, 'ok');
    assert.equal(meta.declencheur, 'initial');
    if (def.aPool) assert.ok(meta.mapPool.length > 0, `${id} : map pool vide`);

    // Réglages vides : acceptés tels quels ; la définition sans réglages est celle du modèle.
    assert.ok(validerReglagesJeu(m, reglagesVides()).ok, `${id} : réglages vides refusés`);
    assert.equal(def.espace, id);
    assert.ok(def.formats.length > 0);
    if (def.score.type === 'manches') assert.equal(actifs(def.camps).length, 2, `${id} : manches sans deux camps`);

    // Chaque semaine type donne un planning valide pour ce jeu (identifiants de blocs neufs et uniques).
    for (const e of def.ebauches) {
      const blocs = blocsDepuisEbauche(def, e.id);
      const r = validerDocument('planning', { blocs, note: '', ebauche: e.id });
      assert.ok(r.ok, `${id}/${e.id} : ${messages(r)}`);
      assert.equal(new Set(blocs.map((b) => b.id)).size, blocs.length);
    }
    // Postes créés à l'activation : valides pour ce jeu.
    const titulaire = documentParDefaut('membres', { type: 'joueur', statut: 'titulaire', roleJeu: actifs(def.roles)[0].id });
    assert.ok(validerDocument('membres', titulaire).ok, `${id} : poste de titulaire invalide`);
  }
});

test('le contrôle d’un modèle signale chaque incohérence', () => {
  assert.deepEqual(controlerModele({ id: 'Pas Valide' }), ['identifiant du modèle invalide : Pas Valide']);
  const casse = structuredClone(val);
  casse.roles.push({ id: 'duelliste', nom: 'Doublon' });
  casse.camps = [{ id: 'att', nom: 'Attaque' }];
  casse.typesBloc.push({ id: 'scrim', nom: 'Scrim bis' });
  casse.chiffres[0] = { ...casse.chiffres[0], min: 50, max: 10 };
  casse.objectifs[0] = { ...casse.objectifs[0], palier: casse.objectifs[0].palier === 6 ? 5 : 6 };
  casse.ebauches[0] = { ...casse.ebauches[0], blocs: [...casse.ebauches[0].blocs, { jour: 1, debut: '25:00', fin: '26:00', type: 'scrim' }] };
  casse.profil = { ...casse.profil, modele: 'http://tracker.example/profil' };
  casse.seuils = { ...casse.seuils, 'zzz-1-1': { chiffre: 'inconnu', seuil: 1 } };
  delete casse.initiale;
  const erreurs = controlerModele(casse);
  for (const attendu of [
    'roles : identifiant en double « duelliste »',
    'camps : zéro ou deux',
    'score : un score en manches demande deux camps',
    'typesStrat : camp inconnu dans « setup »',
    'typesBloc : « scrim » est déjà un bloc commun',
    'chiffres : min ≥ max pour « hs »',
    `objectifs : domaine ou palier incohérent pour « ${val.objectifs[0].id} »`,
    'ebauches : bloc invalide',
    'profil : adresse https:// avec {id} attendue',
    'seuils : objectif inconnu « zzz-1-1 »',
    'seuils : chiffre inconnu « inconnu »',
    'initiale manquante',
  ]) {
    assert.ok(erreurs.some((e) => e.startsWith(attendu)), `erreur attendue : ${attendu}\nreçues : ${erreurs.join('\n')}`);
  }
});

// ——— Définition effective : modèle + Réglages du jeu ———

test('Réglages : un élément archivé reste valide mais n’est plus proposé ; un rôle ajouté est accepté', () => {
  const roles = completerModele(val).roles.map((r) => (r.id === 'flex' ? { ...r, archive: true } : r));
  roles.push({ id: 'ancre', nom: 'Ancre', court: 'ANC', resume: 'Tient un site seul.', exercices: ['Retakes à un contre deux', ''] });
  const typesStrat = completerModele(val).typesStrat.map((t) => (t.id === 'fake' ? { ...t, archive: true } : t));
  const def = definitionEffective(val, reglages('valorant', { listes: { roles, typesStrat } }));

  assert.deepEqual(actifs(def.roles).map((r) => r.id), ['duelliste', 'initiateur', 'controleur', 'sentinelle', 'ancre']);
  assert.ok(def.roles.find((r) => r.id === 'flex').archive);
  assert.deepEqual(def.parRole.ancre, ['Retakes à un contre deux'], 'les exercices du rôle alimentent le programme individuel');
  assert.ok(!typesStratPour(def, 'att').some((t) => t.id === 'fake'));
  assert.ok(typesStratPour(def, 'att').some((t) => t.id === 'execute'));

  const { validerDocument } = schemasPour(def);
  const membre = (roleJeu) => validerDocument('membres', { type: 'joueur', statut: 'titulaire', pseudo: 'Nova', roleJeu });
  assert.ok(membre('ancre').ok, 'nouveau rôle accepté');
  assert.ok(membre('flex').ok, 'rôle archivé toujours valide pour les fiches existantes');
  assert.equal(membre('tank').ok, false);
  assert.ok(validerDocument('strats', { map: 'bind', camp: 'att', type: 'fake', nom: 'Fake A' }).ok, 'type archivé toujours valide');
  // Le modèle lui-même n'a pas changé.
  assert.equal(schemas('valorant').validerDocument('membres', { type: 'joueur', statut: 'titulaire', roleJeu: 'ancre' }).ok, false);
});

test('Réglages : vocabulaire vidé, plus de personnages ni de cartes ; vocabulaire renommé', () => {
  const vide = { personnage: '', personnages: '', carte: '', cartes: '', manche: '', manches: '', astuce: '', astuces: '' };
  const def = definitionEffective(val, reglages('valorant', { vocabulaire: vide }));
  assert.equal(def.aPersonnages, false);
  assert.equal(def.aCartes, false);
  assert.equal(def.aPool, false);
  assert.equal(def.personnagesParCamp, false);
  assert.deepEqual([def.vocabulaire.manche, def.vocabulaire.manches, def.vocabulaire.astuce], ['manche', 'manches', 'astuce']);
  const { validerDocument } = schemasPour(def);
  assert.ok(validerDocument('strats', { camp: 'att', type: 'default', nom: 'Sans map' }).ok, 'plus de map obligatoire');
  assert.ok(validerDocument('scrims', { date: '2026-10-15', adversaire: 'A', scoreNous: 13, scoreEux: 5 }).ok);

  // Un mot sans son pluriel ne compte pas : la paire entière est retirée.
  const bancal = definitionEffective(val, reglages('valorant', { vocabulaire: { ...vide, personnage: 'héros', carte: 'map', cartes: 'maps' } }));
  assert.equal(bancal.aPersonnages, false);
  assert.equal(bancal.aCartes, true);

  const renomme = definitionEffective(val, reglages('valorant', {
    vocabulaire: { personnage: 'héros', personnages: 'héros', carte: 'arène', cartes: 'arènes', manche: 'round', manches: 'rounds', astuce: 'lineup', astuces: 'lineups' },
  }));
  assert.equal(mot(renomme, 'cartes', true), 'Arènes');
  assert.equal(renomme.aPool, true);
  const r = schemasPour(renomme).validerDocument('strats', { camp: 'att', type: 'default', nom: 'Sans arène' });
  assert.equal(r.ok, false);
  assert.match(messages(r), /Arène obligatoire/);
});

test('profil public : séparateur de LoL et d’Overwatch, adresse changée dans les Réglages', () => {
  const lol = defDe('lol');
  assert.equal(lol.profil.separateur, '-');
  assert.equal(urlProfil(lol, 'Nova#EUW'), 'https://op.gg/lol/summoners/euw/Nova-EUW');
  assert.equal(urlProfil(defDe('ow2'), 'Pixel#12345'), 'https://overwatch.blizzard.com/fr-fr/career/Pixel-12345/');
  assert.equal(urlProfil(defDe('valorant'), 'Nova#EUW'), 'https://tracker.gg/valorant/profile/riot/Nova%23EUW/overview', 'pas de séparateur : # encodé');
  assert.equal(urlProfil(defDe('valorant'), 'sans-tag'), null, 'format du modèle non respecté');
  assert.equal(urlProfil(defDe('fc'), 'Joueur'), null, 'pas de profil public pour ce jeu');

  const profilLol = MODELES.lol.profil;
  const meme = defDe('lol', reglages('lol', { profil: { actif: true, site: 'OP.GG', modele: profilLol.modele, format: profilLol.format, aide: '' } }));
  assert.equal(urlProfil(meme, 'Nova#EUW'), 'https://op.gg/lol/summoners/euw/Nova-EUW', 'même adresse : séparateur gardé');
  const autre = defDe('lol', reglages('lol', { profil: { actif: true, site: 'League of Graphs', modele: 'https://www.leagueofgraphs.com/summoner/euw/{id}', format: '', aide: '' } }));
  assert.equal(autre.profil.separateur, undefined);
  assert.equal(urlProfil(autre, 'Nova#EUW'), 'https://www.leagueofgraphs.com/summoner/euw/Nova%23EUW');
  assert.equal(defDe('lol', reglages('lol', { profil: { actif: false } })).profil, null);
});

test('définition effective : effectif, score, nom de l’espace, sources de la méta et textes des objectifs', () => {
  const objectif = MODELES.apex.objectifs[0];
  const def = defDe('apex', reglages('apex', {
    equipe: { titulaires: 4, remplacants: 1 },
    score: { type: 'classement', equipes: 30, bareme: { places: [15, 10, 5], elimination: 2 } },
    objectifs: { [objectif.id]: { texte: 'Texte maison', critere: '' } },
    meta: { sources: ['https://www.Example.com/patch-notes', 'pas un domaine', 'ea.com', 'ea.com'], consigne: 'Surveiller la ranked.', auto: false },
  }), { id: 'apexacademie', nom: 'Apex Académie', court: 'APX' });
  assert.deepEqual([def.modele, def.espace, def.nom, def.court], ['apex', 'apexacademie', 'Apex Académie', 'APX']);
  assert.deepEqual(def.equipe, { titulaires: 4, remplacants: 1 });
  assert.deepEqual(def.score, { type: 'classement', equipes: 30, bareme: { places: [15, 10, 5], elimination: 2 } });
  assert.deepEqual(def.meta.sources, ['example.com', 'ea.com']);
  assert.equal(def.meta.consigne, 'Surveiller la ranked.');
  assert.equal(def.meta.auto, false);
  const o = def.objectifs.find((x) => x.id === objectif.id);
  assert.equal(o.texte, 'Texte maison');
  assert.equal(o.critere, objectif.critere, 'critère vide : celui du modèle est gardé');
  const { documentParDefaut, validerDocument } = schemasPour(def);
  assert.equal(documentParDefaut('scrims', { date: '2026-10-15', adversaire: 'Lobby', place: 2 }).equipes, 30);
  assert.equal(pointsClassement({ place: 2, eliminations: 3 }, def.score), 16, 'barème des Réglages : 10 + 3 × 2');
  assert.equal(validerDocument('scrims', { date: '2026-10-15', adversaire: 'L', map: 'stormpoint', place: 31, equipes: 30 }).ok, false);
});

test('R6 : personnages par camp avec deux camps actifs ; sans camp actif, plus de camp imposé aux strats', () => {
  assert.equal(defDe('r6').personnagesParCamp, true);
  const sansCamp = defDe('r6', reglages('r6', { listes: { camps: completerModele(MODELES.r6).camps.map((c) => ({ ...c, archive: true })) } }));
  assert.equal(sansCamp.personnagesParCamp, false);
  const strat = { map: 'bank', type: 'execute', nom: 'Exécution 2F' };
  assert.equal(schemas('r6').validerDocument('strats', strat).ok, false, 'camp obligatoire avec deux camps actifs');
  assert.ok(schemasPour(sansCamp).validerDocument('strats', strat).ok);
});

// ——— Validation des Réglages du jeu ———

test('Réglages refusés : élément du modèle supprimé, camps incohérents, domaines, chiffres, profil, objectifs', () => {
  const m = completerModele(val);
  const cas = [
    [{ listes: { roles: m.roles.filter((r) => r.id !== 'flex') } }, 'roles : « Flex » vient du modèle ; masque-le au lieu de le supprimer'],
    [{ listes: { roles: [...m.roles, { id: 'flex', nom: 'Flex bis' }] } }, 'roles : deux éléments ont le même identifiant'],
    [{ listes: { roles: m.roles.map((r) => ({ ...r, archive: true })) } }, 'roles : au moins un rôle actif'],
    [{ listes: { camps: [m.camps[0], { ...m.camps[1], archive: true }] } }, 'camps : zéro ou deux camps actifs'],
    [{ listes: { camps: [...m.camps, { id: 'milieu', nom: 'Milieu' }] } }, '2 éléments maximum'],
    [{ listes: { typesBloc: [...m.typesBloc, { id: 'scrim', nom: 'Scrim maison' }] } }, 'typesBloc : identifiant déjà pris par un bloc commun'],
    [{ listes: { typesStrat: [...m.typesStrat, { id: 'rush', nom: 'Rush', camps: ['milieu'] }] } }, 'typesStrat : camp inconnu'],
    [{ listes: { chiffres: [...m.chiffres, { id: 'clutch', nom: 'Clutchs', min: 10, max: 5 }] } }, 'chiffres : le minimum doit être inférieur au maximum'],
    [{ listes: { domaines: m.domaines.map((d, i) => (i ? d : { ...d, id: 'visee' })) } }, 'domaines : seuls les noms et les résumés se modifient'],
    [{ listes: { domaines: m.domaines.slice(0, 5) } }, 'domaines : seuls les noms et les résumés se modifient'],
    [{ objectifs: { 'zzz-1-1': { texte: 'Inventé' } } }, 'objectifs : zzz-1-1 n\'existe pas dans le modèle'],
    [{ profil: { actif: true, site: 'X', modele: 'https://x.example/profil', format: '' } }, 'profil : adresse en https:// contenant {id}'],
    [{ profil: { actif: true, site: 'X', modele: 'http://x.example/{id}', format: '' } }, 'profil : adresse en https:// contenant {id}'],
    [{ profil: { actif: true, site: 'X', modele: 'https://x.example/{id}', format: '([' } }, 'profil : format invalide'],
    [{ equipe: { titulaires: 0, remplacants: 2 } }, 'entre 1 et 12'],
    [{ score: { type: 'elo' } }, 'valeur non reconnue'],
  ];
  for (const [brut, attendu] of cas) {
    const v = validerReglagesJeu(val, brut);
    assert.equal(v.ok, false, `accepté à tort : ${JSON.stringify(brut).slice(0, 120)}`);
    assert.ok(messages(v).includes(attendu), `attendu « ${attendu} », reçu : ${messages(v)}`);
  }
});

test('Réglages acceptés : sections nulles par défaut, renommage, ajouts, champs inconnus ignorés', () => {
  assert.deepEqual(reglagesVides(), {
    vocabulaire: null,
    equipe: null,
    score: null,
    listes: { roles: null, camps: null, typesStrat: null, typesBloc: null, rangs: null, chiffres: null, checklistMatch: null, domaines: null },
    objectifs: {},
    routines: {},
    profil: null,
    meta: { sources: null, consigne: '', auto: true },
    charge: null,
  });
  const m = completerModele(val);
  const v = validerReglagesJeu(val, {
    nom: 'Tentative de renommer le jeu ici',
    listes: {
      domaines: m.domaines.map((d) => (d.id === 'meca' ? { ...d, nom: 'Visée', resume: 'Tout ce qui touche au tir.' } : d)),
      chiffres: [...m.chiffres, { id: 'clutch', nom: 'Clutchs gagnés', unite: '', min: 0, max: 20, decimales: 0, aide: '' }],
      camps: m.camps.map((c) => ({ ...c, archive: true })),
      typesBloc: [...m.typesBloc, { id: 'retakes', nom: 'Retakes', duree: 45 }],
    },
  });
  assert.ok(v.ok, messages(v));
  assert.equal('nom' in v.valeur, false, 'le nom du jeu vit dans la liste des jeux, pas dans les Réglages');
  const def = definitionEffective(val, v.valeur);
  assert.equal(def.domaines.find((d) => d.id === 'meca').nom, 'Visée');
  assert.ok(def.chiffres.some((c) => c.id === 'clutch'));
  assert.ok(def.typesBlocTous.some((t) => t.id === 'retakes'));
  assert.equal(def.typesBlocTous[0].id, TYPES_BLOC_COMMUNS[0].id, 'échauffement en premier');
});

// ——— Schémas des documents, construits pour chaque jeu ———

test('scrims selon le type de score : manches (Valorant), score simple (LoL), classement (Apex, Fortnite)', () => {
  const v = schemas('valorant');
  const base = { date: '2026-10-15', adversaire: 'Orage', map: 'haven', campDepart: 'att', mtNous: 7, mtEux: 5, scoreNous: 13, scoreEux: 9, pistols: { att: 'gagne', def: 'perdu' } };
  assert.ok(v.validerDocument('scrims', base).ok);
  const refus = [
    [{ map: '' }, 'Map obligatoire'],
    [{ mtNous: 8, mtEux: 5 }, 'une mi-temps compte 12 rounds au maximum'],
    [{ scoreNous: 6 }, 'le score final ne peut pas être inférieur au score de la mi-temps'],
    [{ pistols: { rouge: 'gagne' } }, 'camp inconnu pour un pistol'],
    [{ date: '2026-02-30' }, 'cette date n\'existe pas'],
    [{ mtNous: 13 }, 'entre 0 et 12'],
    [{ campDepart: 'bleu' }, 'valeur non reconnue'],
  ];
  for (const [modif, attendu] of refus) {
    const r = v.validerDocument('scrims', { ...base, ...modif });
    assert.equal(r.ok, false, JSON.stringify(modif));
    assert.ok(messages(r).includes(attendu), `${attendu} / ${messages(r)}`);
  }

  const lol = schemas('lol').validerDocument('scrims', { date: '2026-10-15', adversaire: 'Nébula', scoreNous: 2, scoreEux: 1, mtNous: 1, campDepart: 'bleu', place: 1 });
  assert.ok(lol.ok, messages(lol));
  for (const champ of ['mtNous', 'campDepart', 'pistols', 'place']) assert.equal(champ in lol.valeur, false, `${champ} n’existe pas en score simple`);
  assert.equal(lol.valeur.map, '');
  assert.equal(schemas('lol').validerDocument('scrims', { date: '2026-10-15', adversaire: 'N', scoreNous: 2 }).ok, false, 'score adverse obligatoire');

  const apex = schemas('apex');
  const partie = { date: '2026-10-15', adversaire: 'Lobby ALGS', map: 'stormpoint', place: 3, equipes: 20, eliminations: 7 };
  const ok = apex.validerDocument('scrims', partie);
  assert.ok(ok.ok, messages(ok));
  assert.equal('scoreNous' in ok.valeur, false);
  assert.match(messages(apex.validerDocument('scrims', { ...partie, place: 25 })), /la place ne peut pas dépasser le nombre d’équipes/);
  assert.match(messages(apex.validerDocument('scrims', { ...partie, map: '' })), /Map obligatoire/);
  assert.match(messages(apex.validerDocument('scrims', { ...partie, place: null })), /place obligatoire/);

  const fortnite = schemas('fortnite');
  assert.equal(fortnite.documentParDefaut('scrims', { date: '2026-10-15', adversaire: 'Cash Cup', place: 4 }).equipes, 50, 'lobby de 50 duos');
  assert.ok(fortnite.validerDocument('scrims', { date: '2026-10-15', adversaire: 'Cash Cup', place: 4 }).ok, 'pas de carte dans Fortnite');
});

test('stratbook : map obligatoire dans les jeux à map pool, camp imposé par le type de strat', () => {
  assert.match(messages(schemas('cs2').validerDocument('strats', { camp: 'att', type: 'default', nom: 'Default' })), /Map obligatoire/);
  assert.ok(schemas('lol').validerDocument('strats', { type: 'baron', nom: 'Setup Nashor' }).ok, 'LoL : pas de map');
  assert.ok(schemas('lol').validerDocument('strats', { type: 'baron', camp: 'rouge', nom: 'Setup Nashor' }).ok);
  const v = schemas('valorant');
  const strat = { map: 'lotus', type: 'execute', nom: 'Exécution A' };
  assert.match(messages(v.validerDocument('strats', { ...strat, camp: 'def' })), /une strat « Exécution » ne se joue pas de ce côté/);
  assert.match(messages(v.validerDocument('strats', strat)), /camp obligatoire pour ce type de strat/);
  assert.ok(v.validerDocument('strats', { ...strat, camp: 'att' }).ok);
  assert.ok(v.validerDocument('strats', { ...strat, type: 'pistol', camp: 'def' }).ok, 'pistol : les deux camps');
  assert.equal(v.validerDocument('strats', { ...strat, camp: 'att', type: 'baron' }).ok, false, 'type d’un autre jeu');
});

test('candidats : chaîne Twitch normalisée en nom de chaîne, rôle et rang du jeu', () => {
  const v = schemas('valorant');
  for (const [saisie, attendu] of [
    ['https://www.twitch.tv/Nova_TV?ref=lugh', 'nova_tv'], ['twitch.tv/NovaTV', 'novatv'], ['@Nova_TV', 'nova_tv'],
    ['m.twitch.tv/nova_tv/videos', 'nova_tv'], ['nova_tv', 'nova_tv'], ['', ''],
  ]) {
    const r = v.validerDocument('candidats', { pseudo: 'Nova', twitch: saisie });
    assert.ok(r.ok, `${saisie} : ${messages(r)}`);
    assert.equal(r.valeur.twitch, attendu, saisie);
  }
  for (const saisie of ['nova tv', 'abc', 'https://evil.example/x', 'javascript:alert(1)']) {
    assert.equal(v.validerDocument('candidats', { pseudo: 'Nova', twitch: saisie }).ok, false, saisie);
  }
  assert.equal(lienTwitch('nova_tv'), 'https://www.twitch.tv/nova_tv');
  assert.equal(lienTwitch('<script>'), null);
  assert.ok(v.validerDocument('candidats', { pseudo: 'Nova', roleJeu: 'sentinelle', rang: 'radiant' }).ok);
  assert.equal(v.validerDocument('candidats', { pseudo: 'Nova', roleJeu: 'top' }).ok, false);
  assert.ok(schemas('lol').validerDocument('candidats', { pseudo: 'Nova', roleJeu: 'top' }).ok);
  assert.equal(schemas('lol').validerDocument('candidats', { pseudo: 'Nova', rang: 'radiant' }).ok, false);
});

test('chiffres de la semaine : un champ par chiffre du jeu, bornes et décimales du modèle', () => {
  const v = schemas('valorant').validerDocument('mesures', { rang: 'diamant1', valeurs: { hs: '21,54', acs: 231, kd: 1.137, kda: 4 }, parties: 9 });
  assert.ok(v.ok, messages(v));
  assert.deepEqual(v.valeur.valeurs, { hs: 21.5, acs: 231, kd: 1.14 });
  assert.match(messages(schemas('valorant').validerDocument('mesures', { valeurs: { hs: 140 } })), /valeurs\.hs entre 0 et 100/);
  const lol = schemas('lol').validerDocument('mesures', { valeurs: { kda: 3.456, cs: 7.25, hs: 20 } });
  assert.ok(lol.ok, messages(lol));
  assert.deepEqual(lol.valeur.valeurs, { kda: 3.46, cs: 7.3, kp: null, vision: null });
  const cs2 = schemas('cs2').validerDocument('mesures', { valeurs: { rating: '-1,25' } });
  assert.equal(cs2.valeur.valeurs.rating, -1.25, 'chiffre négatif accepté quand le modèle le permet');
  const avecClutch = schemasPour(defDe('valorant', reglages('valorant', {
    listes: { chiffres: [...completerModele(val).chiffres, { id: 'clutch', nom: 'Clutchs', min: 0, max: 20, decimales: 0 }] },
  }))).validerDocument('mesures', { valeurs: { clutch: 3 } });
  assert.equal(avecClutch.valeur.valeurs.clutch, 3, 'chiffre ajouté dans les Réglages');
});

test('documents d’organisation : comptes rendus de séance, tournois, partenaires de scrim', () => {
  const v = schemas('valorant');
  const seance = { semaine: '2026-W43', blocId: 'b-aaaaaaaaaa', jour: 2, debut: '20:00', type: 'scrim', travaille: 'Retakes B' };
  assert.ok(v.validerDocument('seances', seance).ok);
  assert.match(messages(v.validerDocument('seances', { ...seance, travaille: '' })), /travaille obligatoire/);
  assert.equal(v.validerDocument('seances', { ...seance, type: 'laning' }).ok, false, 'type de bloc d’un autre jeu');
  assert.ok(schemas('lol').validerDocument('seances', { ...seance, type: 'laning' }).ok);

  const tournoi = { nom: 'Coupe de France', debut: '2026-11-10', fin: '2026-11-12', dateLimite: '2026-11-03', roster: ['m-aaaaaaaaaa'] };
  const t = v.validerDocument('tournois', tournoi);
  assert.ok(t.ok, messages(t));
  assert.deepEqual([t.valeur.statut, t.valeur.place], ['envisage', null]);
  assert.match(messages(v.validerDocument('tournois', { ...tournoi, fin: '2026-11-09' })), /la fin doit être après le début/);
  assert.match(messages(v.validerDocument('tournois', { ...tournoi, dateLimite: '2026-11-11' })), /la date limite d’inscription doit précéder le début/);
  assert.equal(v.validerDocument('tournois', { ...tournoi, lien: 'http://inscription.example' }).ok, false, 'lien https seulement');
  assert.equal(v.validerDocument('tournois', { ...tournoi, roster: ['Kairo'] }).ok, false, 'roster : des membres');
  assert.equal(v.validerDocument('tournois', { ...tournoi, statut: 'gagne' }).ok, false);

  const partenaire = { nom: 'Kraken eSport', incidents: [{ date: '2026-10-10', type: 'annule', note: 'Prévenus 10 min avant' }] };
  const p = v.validerDocument('partenaires', partenaire);
  assert.ok(p.ok, messages(p));
  assert.equal(p.valeur.statut, 'actif');
  assert.equal(v.validerDocument('partenaires', { ...partenaire, incidents: [{ date: '2026-10-10', type: 'fantome' }] }).ok, false);
  assert.equal(v.validerDocument('partenaires', { ...partenaire, incidents: [{ type: 'annule' }] }).ok, false, 'date obligatoire');

  const scrim = { date: '2026-10-15', adversaire: 'Kraken eSport', map: 'haven', scoreNous: 13, scoreEux: 9 };
  assert.equal(v.validerDocument('scrims', { ...scrim, partenaire: 'e-aaaaaaaaaa' }).valeur.partenaire, 'e-aaaaaaaaaa');
  assert.equal(v.validerDocument('scrims', { ...scrim, partenaire: 'kraken' }).ok, false);
});

test('Réglages : seuils de charge d’entraînement (heures par semaine, jours off)', () => {
  assert.deepEqual(defDe('valorant').charge, { heuresMax: 20, joursOffMin: 1 }, 'valeurs par défaut');
  assert.deepEqual(defDe('valorant', reglages('valorant', { charge: { heuresMax: 25, joursOffMin: 2 } })).charge, { heuresMax: 25, joursOffMin: 2 });
  assert.match(messages(validerReglagesJeu(val, { charge: { heuresMax: 0, joursOffMin: 1 } })), /charge\.heuresMax entre 1 et 80/);
  assert.match(messages(validerReglagesJeu(val, { charge: { heuresMax: 20, joursOffMin: 8 } })), /charge\.joursOffMin entre 0 et 7/);
  assert.equal(defDe('valorant').shotcall, true);
  assert.equal(defDe('rl').shotcall, false, 'pas d’IGL attitré en Rocket League');
  assert.equal(defDe('fc').shotcall, false);
});

// ——— Méta, validée avec la définition de chaque jeu ———

test('méta : rôle inconnu vidé avec un avertissement, compo invalide écartée, pool recalculé', () => {
  const def = defDe('valorant');
  const brut = metaInitialeDe('valorant');
  brut.personnages[0].role = 'tank';
  brut.compsPro.haven = [{ personnages: ['jett', 'inconnu', 'omen', 'sova', 'killjoy'], usage: '', evenement: '', source: '' }];
  brut.compsPro.ascent = brut.compsPro.bind; // map hors pool : compos ignorées
  brut.maps.find((m) => m.id === 'ascent').enPool = true;
  brut.maps.find((m) => m.id === 'haven').enPool = false;
  const v = validerMeta(def, brut);
  assert.ok(v.ok, messages(v));
  assert.equal(v.valeur.personnages[0].role, '');
  assert.ok(v.avertissements.some((a) => a.startsWith(`rôle inconnu ignoré pour ${brut.personnages[0].nom} : tank`)), v.avertissements.join(' | '));
  assert.ok(v.avertissements.some((a) => a.startsWith('compo ignorée (haven)')));
  assert.equal(v.valeur.compsPro.haven, undefined);
  assert.equal(v.valeur.compsPro.ascent, undefined);
  assert.equal(v.valeur.maps.find((m) => m.id === 'ascent').enPool, false);
  assert.equal(v.valeur.maps.find((m) => m.id === 'haven').enPool, true);

  // LoL : pas de map pool, compos sous « general ».
  const lol = metaInitialeDe('lol');
  lol.compsPro.faille = lol.compsPro.general;
  const vl = validerMeta(defDe('lol'), lol);
  assert.ok(vl.ok, messages(vl));
  assert.deepEqual(Object.keys(vl.valeur.compsPro), ['general']);
});

test('méta : patch plus ancien, liste raccourcie, pool incohérent ou doublon refusés', () => {
  const def = defDe('valorant');
  const avant = metaInitialeDe('valorant');
  const essai = (modif) => validerMeta(def, { ...metaInitialeDe('valorant'), ...modif }, avant);
  assert.ok(essai({}).ok, 'même méta : acceptée');
  assert.ok(essai({ patch: '13.09', patchDate: '2026-10-27' }).ok);

  const ancien = essai({ patchDate: '2026-09-01' });
  assert.equal(ancien.ok, false);
  assert.ok(ancien.erreurs.some((e) => e.chemin === 'patchDate'), messages(ancien));

  const n = avant.personnages.length;
  assert.ok(essai({ personnages: avant.personnages.slice(0, n - 3) }).ok, 'trois personnages de moins : toléré');
  const tronquee = essai({ personnages: avant.personnages.slice(0, n - 4) });
  assert.equal(tronquee.ok, false);
  assert.match(messages(tronquee), /liste de personnages incomplète/);
  assert.match(messages(essai({ maps: avant.maps.slice(0, avant.maps.length - 3) })), /liste de maps incomplète/);

  assert.match(messages(essai({ mapPool: [...avant.mapPool, 'atlantis'] })), /map du pool absente de la liste : atlantis/);
  assert.match(messages(essai({ personnages: [...avant.personnages, avant.personnages[0]] })), /personnage en double/);
  assert.match(messages(validerMeta(def, { ...metaInitialeDe('valorant'), mapPool: [] })), /1 éléments minimum/);
  assert.ok(validerMeta(defDe('lol'), { ...metaInitialeDe('lol'), mapPool: [] }).ok, 'LoL : pas de map pool');
  assert.match(messages(validerMeta(def, { ...metaInitialeDe('valorant'), sources: ['http://site.example/'] })), /https/);
});

function metaInitialeDe(id) {
  return structuredClone(MODELES[id].initiale);
}
