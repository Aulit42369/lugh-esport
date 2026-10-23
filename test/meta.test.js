// Méta de chaque jeu : actualisation par la (fausse) API Claude ou par import manuel, validation avec la définition
// du jeu, consigne propre au jeu, verrou, créneaux du lundi et du jeudi, déclenchement externe (cron).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrer, adminPret, compteConnecte, client, attendreQue, pause, horloge, reponseClaude, metaDe, stratPour, WEBHOOK, SECRET_CRON,
} from './simulation.js';
import { MODELES } from '../shared/jeux/index.js';
import { definitionEffective } from '../shared/jeux/definition.js';
import { validerReglagesJeu } from '../shared/jeux/reglages-jeu.js';
import { interrogerClaude, extraireJson } from '../src/meta/claude.js';
import { construireConsigne } from '../src/meta/consigne.js';
import { creneauPrecedent, doitVerifierMeta } from '../src/domaine/automatismes.js';
import { instantCivil } from '../shared/temps.js';
import { nouvelId } from '../shared/validation.js';
import { MARQUE } from '../shared/marque.js';

// Réponse de la fausse API selon le jeu nommé dans la consigne (« … d'une équipe <nom> francophone »).
function repondreParJeu(metas) {
  return (params) => {
    for (const [nom, meta] of Object.entries(metas)) {
      if (params.systeme.includes(`équipe ${nom} francophone`)) return typeof meta === 'function' ? meta() : reponseClaude(meta);
    }
    throw new Error('jeu inattendu dans la consigne');
  };
}

const plusRecente = (modele, patch = 'test-2', patchDate = '2026-10-20') => ({ ...metaDe(modele), patch, patchDate });

// Réglages écrits directement côté serveur (sans passer par une visite du jeu, qui déclencherait les automatismes).
async function reglerDirectement(e, brut) {
  const v = validerReglagesJeu(e.modele, brut);
  assert.ok(v.ok);
  await e.depot.enregistrer('jeu', 'reglages', v.valeur, null);
  await e.rechargerDefinition();
}

// ——— Actualisation par l'API ———

let sim;
let admin;
before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol'] });
  admin = await adminPret(sim);
});
after(() => sim.arreter());

test('actualisation de Valorant : méta validée, écart, historique, coût du mois, suggestions, rien d’autre ne bouge', async () => {
  const e = sim.espace('valorant');
  await admin.put('/api/e/valorant/reglages/discord', { webhook: WEBHOOK });
  const [m0] = await sim.joueurs('valorant');
  await admin.put(`/api/e/valorant/c/membres/${m0._id}`, { valeur: { type: 'joueur', statut: 'titulaire', pseudo: 'Kairo', personnages: { principaux: ['jett'] } } });
  await admin.put(`/api/e/valorant/c/strats/${nouvelId('s')}`, { valeur: { ...stratPour('valorant'), map: 'sunset' } });
  await admin.put('/api/e/valorant/c/mapsEquipe/sunset', { valeur: { statut: 'pick', preparation: 60 } });
  const strats = await e.stockage.lister('strats');
  const mapsEquipe = await e.stockage.lister('mapsEquipe');

  const nouvelle = plusRecente('valorant', '13.09', '2026-10-27');
  nouvelle.mapPool = nouvelle.mapPool.map((id) => (id === 'sunset' ? 'ascent' : id));
  nouvelle.personnages.find((p) => p.id === 'jett').dernierChangement = { patch: '13.09', type: 'nerf', resume: 'Dash plus lent.' };
  nouvelle.personnages.push({ id: 'nova', nom: 'Nova', role: 'initiateur', annee: 2026, dernierChangement: null });
  sim.claude.repondre = repondreParJeu({ Valorant: nouvelle });
  const n = sim.discord.envois.length;

  const r = await admin.post('/api/e/valorant/meta/actualiser');
  assert.equal(r.statut, 202);
  assert.deepEqual(r.json, { lancee: true });
  await attendreQue(() => !e.actualisation.enCours);

  const meta = await e.stockage.lire('meta', 'courante');
  assert.deepEqual([meta.patch, meta.statut, meta.erreur, meta.declencheur, meta.schema], ['13.09', 'ok', null, 'manuel', 2]);
  assert.equal(meta.derniereVerif, sim.maintenant().toISOString());
  assert.deepEqual(meta.dernierEcart, {
    patch: { avant: '13.08', apres: '13.09' }, entrees: ['Ascent'], sorties: ['Sunset'], personnagesModifies: ['Jett'], nouveauxPersonnages: ['Nova'], vide: false,
  });
  assert.deepEqual(meta.couts, { '2026-10': { passages: 1, entree: 50_000, sortie: 4_000, recherches: 6, usd: 0.2, manuels: 1 } }, 'le bouton compte dans le plafond du mois');
  assert.deepEqual((await e.stockage.lister('metaHistorique')).map((h) => h.patch), ['13.08']);

  const suggestions = Object.fromEntries((await e.stockage.lister('suggestions')).map((s) => [s.titre, s]));
  assert.deepEqual(Object.keys(suggestions).sort(), ['Ascent entre dans le pool', 'Construire la compo Ascent', 'Nerf de Jett en 13.09', 'Nouveau agent : Nova', 'Sunset quitte le pool']);
  assert.equal(suggestions['Sunset quitte le pool'].texte, 'Archiver 1 strat, retirer Sunset du planning, désigner un nouveau pick (map).');
  assert.equal(suggestions['Nerf de Jett en 13.09'].texte, 'Dash plus lent. Concerne : Kairo.');
  assert.ok(Object.values(suggestions).every((s) => s.statut === 'nouvelle' && s.patch === '13.09'));
  assert.deepEqual(await e.stockage.lister('strats'), strats, 'la méta ne touche jamais au travail de l’équipe');
  assert.deepEqual(await e.stockage.lister('mapsEquipe'), mapsEquipe);
  assert.equal((await sim.espace('lol').stockage.lire('meta', 'courante')).patch, MODELES.lol.initiale.patch, 'LoL n’est pas touché');

  await attendreQue(() => sim.discord.envois.length > n);
  assert.equal(sim.discord.envois.at(-1).corps.content, `🗺️ **Méta Valorant : patch 13.09** (Saison 2026 · Acte 6)\nEntrent dans le pool : Ascent\nSortent du pool : Sunset\nAgents modifiés : Jett\nNouveaux agents : Nova\nDétails et suggestions sur ${MARQUE.nom}, page Méta.`);
  assert.ok((await admin.get('/api/e/valorant/journal')).json.entrees.some((x) => x.action === 'méta actualisée' && x.details === '5 suggestion(s)'));

  const [appel] = sim.claude.appels;
  assert.deepEqual([appel.cle, appel.modele], ['cle-de-test', 'claude-sonnet-5-5']);
  assert.deepEqual(appel.outils, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8, allowed_domains: e.def.meta.sources }]);

  const etat = await admin.get('/api/admin/etat');
  assert.equal(etat.json.jeux.find((j) => j.id === 'valorant').couts['2026-10'].usd, 0.2, 'coût visible par jeu');
  assert.deepEqual(etat.json.jeux.find((j) => j.id === 'lol').couts, {});
  assert.ok(!etat.texte.includes('cle-de-test'), 'la clé API ne sort jamais');
});

test('actualisation de League of Legends : sa méta, ses mots, ses suggestions ; Valorant n’est pas touché', async () => {
  const e = sim.espace('lol');
  const [l0] = await sim.joueurs('lol');
  await admin.put(`/api/e/lol/c/membres/${l0._id}`, { valeur: { type: 'joueur', statut: 'titulaire', pseudo: 'Lune', roleJeu: 'top', personnages: { principaux: ['aatrox'] } } });
  const nouvelle = plusRecente('lol', '26.21', '2026-10-21');
  nouvelle.personnages.find((p) => p.id === 'aatrox').dernierChangement = { patch: '26.21', type: 'nerf', resume: 'Soins réduits.' };
  nouvelle.personnages.push({ id: 'brumeline', nom: 'Brumeline', role: 'top', annee: 2026, dernierChangement: null });
  const appels = sim.claude.appels.length;
  const metaValorant = await sim.espace('valorant').stockage.lire('meta', 'courante');
  sim.claude.repondre = repondreParJeu({ 'League of Legends': nouvelle });

  assert.equal((await admin.post('/api/e/lol/meta/actualiser')).statut, 202);
  await attendreQue(() => !e.actualisation.enCours);
  const meta = await e.stockage.lire('meta', 'courante');
  assert.equal(meta.patch, '26.21');
  assert.deepEqual([meta.dernierEcart.entrees, meta.dernierEcart.sorties, meta.dernierEcart.nouveauxPersonnages], [[], [], ['Brumeline']]);
  const titres = (await e.stockage.lister('suggestions')).map((s) => s.titre).sort();
  assert.deepEqual(titres, ['Nerf de Aatrox en 26.21', 'Nouveau champion : Brumeline']);

  const appel = sim.claude.appels[appels];
  assert.match(appel.systeme, /équipe League of Legends francophone/);
  assert.match(appel.systeme, /TOUS les champions jouables/);
  assert.doesNotMatch(appel.systeme, /map pool/);
  assert.deepEqual(appel.outils[0].allowed_domains, e.def.meta.sources);
  assert.deepEqual(await sim.espace('valorant').stockage.lire('meta', 'courante'), metaValorant);
});

test('réponse invalide ou erreur de l’API : rien n’est écrit, l’ancienne méta reste, l’échec et son coût sont notés', async () => {
  const local = await demarrer({ jeux: ['valorant'] });
  try {
    const e = local.espace('valorant');
    const base = metaDe('valorant');
    const mauvaises = [
      [() => ({ texte: 'Désolé, je ne peux pas.', usage: { entree: 10, sortie: 10, recherches: 1 } }), /Aucun JSON exploitable/],
      [() => reponseClaude({ ...base, patch: '13.02', patchDate: '2026-09-01' }), /réponse rejetée \(patchDate/],
      [() => reponseClaude({ ...base, personnages: base.personnages.slice(0, 10) }), /liste de personnages incomplète/],
      [() => reponseClaude({ ...base, mapPool: [] }), /réponse rejetée/],
      [() => { throw new Error('API Claude en erreur 529 : surchargée'); }, /529/],
    ];
    for (const [i, [reponse, motif]] of mauvaises.entries()) {
      local.claude.repondre = reponse;
      const { lancee, promesse } = e.actualisation.lancer({ declencheur: 'test' });
      assert.equal(lancee, true);
      const fin = await promesse;
      assert.equal(fin.ok, false);
      assert.match(fin.erreur, motif);
      const meta = await e.stockage.lire('meta', 'courante');
      assert.deepEqual([meta.patch, meta.statut, meta.declencheur], ['13.08', 'echec', 'test'], `réponse ${i}`);
      assert.match(meta.erreur, motif);
      assert.equal(meta.derniereVerif, MODELES.valorant.initiale.verifieLe, 'la dernière vérification réussie ne bouge pas');
    }
    assert.equal(await e.stockage.compter('suggestions'), 0);
    assert.equal(await e.stockage.compter('metaHistorique'), 0);
    assert.equal((await e.stockage.lire('meta', 'courante')).couts['2026-10'].passages, 4, 'les appels payés sont comptés, pas l’erreur réseau');

    local.claude.repondre = () => reponseClaude(plusRecente('valorant'));
    assert.equal((await e.actualisation.lancer({ declencheur: 'test' }).promesse).ok, true);
    const meta = await e.stockage.lire('meta', 'courante');
    assert.deepEqual([meta.statut, meta.erreur, meta.patch], ['ok', null, 'test-2']);
  } finally {
    await local.arreter();
  }
});

test('une seule actualisation à la fois par jeu ; l’import attend la fin ; chaque jeu a son verrou', async () => {
  const local = await demarrer({ jeux: ['valorant', 'lol'] });
  try {
    const chef = await adminPret(local);
    let liberer;
    const attente = new Promise((ok) => { liberer = ok; });
    local.claude.repondre = async (params) => {
      await attente;
      return repondreParJeu({ Valorant: plusRecente('valorant'), 'League of Legends': plusRecente('lol') })(params);
    };
    assert.equal((await chef.post('/api/e/valorant/meta/actualiser')).statut, 202);
    const deuxieme = await chef.post('/api/e/valorant/meta/actualiser');
    assert.equal(deuxieme.statut, 409);
    assert.match(deuxieme.json.erreur.message, /déjà en cours/);
    const importe = await chef.post('/api/e/valorant/meta/importer', { texte: JSON.stringify(plusRecente('valorant')) });
    assert.equal(importe.statut, 400);
    assert.match(importe.json.erreur.message, /déjà en cours/);
    assert.equal((await chef.get('/api/e/valorant/etat')).json.actualisationEnCours, true);
    assert.equal((await chef.post('/api/e/lol/meta/actualiser')).statut, 202, 'LoL a son propre verrou');
    liberer();
    await attendreQue(() => !local.espace('valorant').actualisation.enCours && !local.espace('lol').actualisation.enCours);
    assert.equal((await local.espace('valorant').stockage.lire('meta', 'courante')).patch, 'test-2');
    assert.equal((await local.espace('lol').stockage.lire('meta', 'courante')).patch, 'test-2');
    const coach = await compteConnecte(local, { identifiant: 'coach-adj', acces: { valorant: ['coach'] } });
    assert.equal((await coach.post('/api/e/valorant/meta/actualiser')).statut, 403);
  } finally {
    await local.arreter();
  }
});

test('client Claude : reprise après pause_turn avec les mêmes outils, usage cumulé, erreurs lisibles', async () => {
  const envoyes = [];
  const reponses = [
    { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'Je cherche.' }, { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'patch' } }], usage: { input_tokens: 100, output_tokens: 10, server_tool_use: { web_search_requests: 2 } } },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: '```json\n{"a":1}\n```' }], usage: { input_tokens: 200, output_tokens: 50, server_tool_use: { web_search_requests: 1 } } },
  ];
  const fetchImpl = async (url, init) => {
    envoyes.push({ url, init, corps: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => reponses.shift() };
  };
  const consigne = construireConsigne({ def: definitionEffective(MODELES.valorant), meta: metaDe('valorant'), aujourdhui: '2026-10-21', maxRecherches: 5 });
  const r = await interrogerClaude({ cle: 'cle', modele: 'claude-sonnet-5-5', fetchImpl, ...consigne });
  assert.equal(envoyes.length, 2);
  assert.equal(envoyes[0].url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual([envoyes[0].init.headers['x-api-key'], envoyes[0].init.headers['anthropic-version']], ['cle', '2023-06-01']);
  assert.deepEqual([envoyes[0].corps.model, envoyes[0].corps.max_tokens, envoyes[0].corps.system], ['claude-sonnet-5-5', 12_000, consigne.systeme]);
  assert.deepEqual(envoyes[0].corps.tools, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, allowed_domains: definitionEffective(MODELES.valorant).meta.sources }]);
  assert.deepEqual(envoyes[1].corps.tools, envoyes[0].corps.tools, 'mêmes outils à la reprise');
  assert.deepEqual(envoyes[1].corps.messages.map((m) => m.role), ['user', 'assistant']);
  assert.equal(envoyes[1].corps.messages[1].content[1].id, 'srvtoolu_1', 'la réponse en pause est renvoyée telle quelle');
  assert.deepEqual(r.usage, { entree: 300, sortie: 60, recherches: 3 });
  assert.equal(r.stopReason, 'end_turn');
  assert.deepEqual(extraireJson(r.texte), { a: 1 });

  const enPause = async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'pause_turn', content: [], usage: {} }) });
  await assert.rejects(interrogerClaude({ cle: 'c', modele: 'm', systeme: '', question: 'q', fetchImpl: enPause, maxReprises: 2 }), /trop de reprises/);
  const erreur = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
  await assert.rejects(interrogerClaude({ cle: 'c', modele: 'm', systeme: '', question: 'q', fetchImpl: erreur }), /erreur 401 : invalid x-api-key/);
  const tronque = async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'max_tokens', content: [], usage: {} }) });
  await assert.rejects(interrogerClaude({ cle: 'c', modele: 'm', systeme: '', question: 'q', fetchImpl: tronque }), /tronquée/);
  const reseau = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(interrogerClaude({ cle: 'c', modele: 'm', systeme: '', question: 'q', fetchImpl: reseau }), /injoignable \(réseau\)/);
  const illisible = async () => ({ ok: true, status: 200, json: async () => ({ bonjour: true }) });
  await assert.rejects(interrogerClaude({ cle: 'c', modele: 'm', systeme: '', question: 'q', fetchImpl: illisible }), /illisible/);
  await assert.rejects(interrogerClaude({ cle: '', modele: 'm', systeme: '', question: 'q', fetchImpl }), /Clé API Claude absente/);

  assert.deepEqual(extraireJson('Brouillon :\n```json\n{"v":1}\n```\nVersion finale :\n```json\n{"v":2}\n```'), { v: 2 }, 'dernier bloc');
  assert.deepEqual(extraireJson('Voilà : {"b":2} fin'), { b: 2 });
  assert.throws(() => extraireJson('```json\n[1, 2]\n```'), /Aucun JSON/);
  assert.throws(() => extraireJson('pas de json'), /Aucun JSON/);
});

test('sans clé API : import manuel validé, avec la consigne du jeu à copier', async () => {
  const local = await demarrer({ jeux: ['valorant'], env: { ANTHROPIC_API_KEY: '' } });
  try {
    const chef = await adminPret(local);
    const st = local.espace('valorant').stockage;
    const sansCle = await chef.post('/api/e/valorant/meta/actualiser');
    assert.equal(sansCle.statut, 503);
    assert.match(sansCle.json.erreur.message, /Clé API Claude absente/);
    assert.equal((await chef.get('/api/e/valorant/donnees')).json.serveur.metaAuto, false);

    const consigne = (await chef.get('/api/e/valorant/meta/consigne')).json.texte;
    for (const morceau of ['équipe Valorant francophone', 'Base actuelle', '"patch":"13.08"', 'agents', 'playvalorant.com', 'Utilise la recherche web']) {
      assert.ok(consigne.includes(morceau), morceau);
    }

    const nouvelle = plusRecente('valorant', '13.09', '2026-10-27');
    const r = await chef.post('/api/e/valorant/meta/importer', { texte: `Voici :\n\`\`\`json\n${JSON.stringify(nouvelle)}\n\`\`\`` });
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json, { ok: true, vide: false });
    const meta = await st.lire('meta', 'courante');
    assert.deepEqual([meta.patch, meta.declencheur, meta.couts], ['13.09', 'import', {}], 'un import ne coûte rien');
    assert.deepEqual((await chef.post('/api/e/valorant/meta/importer', { texte: JSON.stringify(nouvelle) })).json, { ok: true, vide: true });

    const refus = await chef.post('/api/e/valorant/meta/importer', { texte: JSON.stringify({ ...nouvelle, patch: '12.01', patchDate: '2026-01-01' }) });
    assert.equal(refus.statut, 400);
    assert.equal(refus.json.erreur.code, 'meta_refusee');
    assert.match(refus.json.erreur.message, /^Méta refusée : réponse rejetée \(patchDate/);
    assert.equal((await st.lire('meta', 'courante')).patch, '13.09', 'ancienne méta gardée');
    assert.match((await chef.post('/api/e/valorant/meta/importer', { texte: 'pas de json ici' })).json.erreur.message, /Aucun JSON lisible/);
    assert.equal((await chef.post('/api/e/valorant/meta/importer', { texte: '   ' })).statut, 400);
  } finally {
    await local.arreter();
  }
});

test('consigne propre à chaque jeu : nom, vocabulaire, rôles, domaines autorisés et consignes des Réglages', () => {
  const val = definitionEffective(MODELES.valorant);
  const c = construireConsigne({ def: val, meta: metaDe('valorant'), aujourdhui: '2026-10-21' });
  assert.match(c.systeme, /^Tu es l’analyste méta d’une équipe Valorant francophone\./);
  assert.match(c.systeme, /TOUTES les maps compétitives existantes et TOUS les agents jouables/);
  assert.match(c.systeme, /"role": "duelliste\|initiateur\|controleur\|sentinelle\|flex"/);
  assert.match(c.systeme, /Consignes propres à Valorant :/);
  assert.deepEqual(c.outils, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8, allowed_domains: val.meta.sources }]);
  assert.match(c.question, /^Date du jour : 2026-10-21\./);
  assert.match(c.question, /Le map pool compétitif en vigueur/);
  assert.match(c.question, /"patch":"13\.08"/);
  assert.match(construireConsigne({ def: val, meta: null, aujourdhui: '2026-10-21' }).question, /aucune \(première actualisation\)/);

  const lol = construireConsigne({ def: definitionEffective(MODELES.lol), meta: null, aujourdhui: '2026-10-21' });
  assert.match(lol.systeme, /TOUS les champions jouables/);
  assert.doesNotMatch(lol.systeme, /maps compétitives/);
  assert.match(lol.systeme, /"general"/, 'compos pro sous « general » sans map pool');
  assert.doesNotMatch(lol.question, /map pool/);

  const rl = construireConsigne({ def: definitionEffective(MODELES.rl), meta: null, aujourdhui: '2026-10-21' });
  assert.match(rl.systeme, /Inclue toutes les informations de la base/);
  assert.match(rl.question, /Les changements d’équilibrage importants/);

  const autre = construireConsigne({ def: definitionEffective(MODELES.autre, null, { id: 'marvelrivals', nom: 'Marvel Rivals' }), meta: null, aujourdhui: '2026-10-21' });
  assert.match(autre.systeme, /équipe Marvel Rivals francophone/);
  assert.match(autre.systeme, /les sites officiels de l’éditeur et les wikis de référence/);
  assert.equal('allowed_domains' in autre.outils[0], false, 'aucune source dans le modèle : recherche non filtrée');

  const regle = validerReglagesJeu(MODELES.valorant, { meta: { sources: ['https://www.example.com/notes', 'vlr.gg'], consigne: 'Surveiller la ranked.', auto: true } });
  const perso = construireConsigne({ def: definitionEffective(MODELES.valorant, regle.valeur), meta: null, aujourdhui: '2026-10-21', maxRecherches: 3 });
  assert.match(perso.systeme, /Consignes propres à Valorant :\nSurveiller la ranked\./);
  assert.deepEqual(perso.outils[0].allowed_domains, ['example.com', 'vlr.gg']);
  assert.equal(perso.outils[0].max_uses, 3);
});

// ——— Créneaux du lundi et du jeudi, vérification automatique, cron ———

test('créneaux de la méta : lundi et jeudi 7 h 45 heure de Paris, été comme hiver ; une fois par créneau, 3 essais espacés de 3 h', () => {
  const c = (iso) => creneauPrecedent(new Date(iso), 'Europe/Paris').toISOString();
  assert.equal(c('2026-10-19T06:00:00Z'), '2026-10-19T05:45:00.000Z', 'lundi, heure d’été');
  assert.equal(c('2026-10-19T05:40:00Z'), '2026-10-15T05:45:00.000Z', 'lundi avant 7 h 45 : jeudi précédent');
  assert.equal(c('2026-10-18T10:00:00Z'), '2026-10-15T05:45:00.000Z', 'dimanche');
  assert.equal(c('2026-10-26T08:00:00Z'), '2026-10-26T06:45:00.000Z', 'lundi, heure d’hiver');
  assert.equal(c('2026-10-29T06:44:00Z'), '2026-10-26T06:45:00.000Z');
  assert.equal(c('2026-10-29T06:45:00Z'), '2026-10-29T06:45:00.000Z', 'jeudi 7 h 45 pile');
  assert.equal(instantCivil('2026-01-05', '07:45', 'Europe/Paris').toISOString(), '2026-01-05T06:45:00.000Z');
  assert.equal(instantCivil('2026-07-06', '07:45', 'Europe/Paris').toISOString(), '2026-07-06T05:45:00.000Z');

  const t = new Date('2026-10-19T09:00:00Z');
  const creneau = '2026-10-19T05:45:00.000Z';
  assert.equal(doitVerifierMeta(null, t, 'Europe/Paris'), creneau, 'aucune méta : à vérifier');
  assert.equal(doitVerifierMeta({ derniereVerif: '2026-10-15T08:00:00Z' }, t, 'Europe/Paris'), creneau);
  assert.equal(doitVerifierMeta({ derniereVerif: '2026-10-19T06:00:00Z' }, t, 'Europe/Paris'), null, 'déjà vérifiée depuis le créneau');
  const echec = (n, derniereTentative) => ({ derniereVerif: '2026-10-15T08:00:00Z', derniereTentative, tentatives: { creneau, n } });
  assert.equal(doitVerifierMeta(echec(1, '2026-10-19T08:00:00Z'), t, 'Europe/Paris'), null, 'moins de 3 h après un échec');
  assert.equal(doitVerifierMeta(echec(1, '2026-10-19T05:50:00Z'), t, 'Europe/Paris'), creneau, '3 h après un échec');
  assert.equal(doitVerifierMeta(echec(2, '2026-10-19T05:50:00Z'), t, 'Europe/Paris'), creneau);
  assert.equal(doitVerifierMeta(echec(3, '2026-10-19T05:50:00Z'), t, 'Europe/Paris'), null, '3 essais au plus');
  assert.equal(doitVerifierMeta({ ...echec(3, '2026-10-19T05:50:00Z'), tentatives: { creneau: '2026-10-15T05:45:00.000Z', n: 3 } }, t, 'Europe/Paris'), creneau, 'compteur remis à zéro au créneau suivant');
});

test('vérification automatique : à la première visite d’un jeu après le créneau, nouvel essai 3 h après un échec, coupée par les Réglages', async () => {
  const local = await demarrer({ automatismes: true, maintenant: horloge('2026-10-19T09:00:00Z'), jeux: ['valorant', 'lol'] });
  try {
    await reglerDirectement(local.espace('valorant'), { meta: { auto: false } });
    let echecs = 1;
    local.claude.repondre = repondreParJeu({
      'League of Legends': () => {
        if (echecs-- > 0) throw new Error('API Claude en erreur 529');
        return reponseClaude(plusRecente('lol', '26.21', '2026-10-19'));
      },
    });
    const joueur = await compteConnecte(local, { identifiant: 'matinal', acces: { valorant: 'joueur', lol: 'joueur' } });
    const lol = local.espace('lol');
    const visiter = async (jeu) => { await joueur.get(`/api/e/${jeu}/donnees`); await pause(30); };

    await visiter('valorant');
    assert.equal(local.claude.appels.length, 0, 'Valorant : vérification automatique coupée dans ses Réglages');
    await visiter('lol');
    await attendreQue(() => local.claude.appels.length === 1 && !lol.actualisation.enCours);
    let meta = await lol.stockage.lire('meta', 'courante');
    assert.deepEqual([meta.statut, meta.declencheur, meta.tentatives], ['echec', 'automatique', { creneau: '2026-10-19T05:45:00.000Z', n: 1 }]);

    local.maintenant.avancer(3600_000);
    await visiter('lol');
    assert.equal(local.claude.appels.length, 1, 'pas de nouvel essai moins de 3 h après un échec');
    local.maintenant.avancer(2 * 3600_000 + 60_000);
    await visiter('lol');
    await attendreQue(() => local.claude.appels.length === 2 && !lol.actualisation.enCours);
    meta = await lol.stockage.lire('meta', 'courante');
    assert.deepEqual([meta.statut, meta.patch, meta.declencheur, meta.tentatives], ['ok', '26.21', 'automatique', { creneau: '2026-10-19T05:45:00.000Z', n: 2 }]);

    local.maintenant.avancer(5 * 60_000);
    await visiter('lol');
    assert.equal(local.claude.appels.length, 2, 'une seule vérification réussie par créneau');
    local.maintenant.regler('2026-10-22T06:00:00Z'); // jeudi 8 h, heure de Paris
    await visiter('lol');
    await attendreQue(() => local.claude.appels.length === 3 && !lol.actualisation.enCours);
    assert.equal(local.claude.appels.filter((a) => a.systeme.includes('Valorant')).length, 0);
  } finally {
    await local.arreter();
  }
});

test('déclenchement externe (cron) : secret obligatoire, tous les jeux actifs dont la vérification automatique est active', async () => {
  const local = await demarrer({ jeux: ['valorant', 'lol', 'cs2', 'apex'] });
  try {
    await local.registre.modifier('cs2', { actif: false });
    await reglerDirectement(local.espace('apex'), { meta: { auto: false } });
    local.claude.repondre = repondreParJeu({ Valorant: plusRecente('valorant'), 'League of Legends': plusRecente('lol') });
    const c = client(local.base);
    const cron = (entetes) => c.appel('POST', '/api/cron/meta', undefined, { sansQg: true, entetes });
    assert.equal((await cron({})).statut, 403);
    assert.equal((await cron({ Authorization: 'Bearer mauvais-secret' })).statut, 403);
    assert.equal((await cron({ Authorization: `Bearer ${SECRET_CRON}x` })).statut, 403);
    const r = await cron({ Authorization: `Bearer ${SECRET_CRON}` });
    assert.equal(r.statut, 202);
    assert.deepEqual(r.json, { lancee: true, jeux: ['valorant', 'lol'] });
    await attendreQue(() => local.claude.appels.length === 2 && !local.espace('lol').actualisation.enCours && !local.espace('valorant').actualisation.enCours);
    for (const jeu of ['valorant', 'lol']) {
      const meta = await local.espace(jeu).stockage.lire('meta', 'courante');
      assert.deepEqual([meta.patch, meta.declencheur], ['test-2', 'cron'], jeu);
    }
    for (const jeu of ['cs2', 'apex']) assert.equal((await local.espace(jeu).stockage.lire('meta', 'courante')).declencheur, 'initial', jeu);
  } finally {
    await local.arreter();
  }
  const sansSecret = await demarrer({ env: { LUGH_SECRET_CRON: '' } });
  const sansCle = await demarrer({ env: { ANTHROPIC_API_KEY: '' } });
  try {
    const appel = (s) => client(s.base).appel('POST', '/api/cron/meta', undefined, { sansQg: true, entetes: { Authorization: `Bearer ${SECRET_CRON}` } });
    assert.equal((await appel(sansSecret)).statut, 503);
    assert.deepEqual((await appel(sansCle)).json, { lancee: false, raison: 'cle_absente' });
  } finally {
    await sansSecret.arreter();
    await sansCle.arreter();
  }
});

test('jeu désactivé : aucune vérification automatique, même quand l’Administrateur général l’ouvre', async () => {
  const local = await demarrer({ automatismes: true, maintenant: horloge('2026-10-19T09:00:00Z'), jeux: ['valorant', 'lol'] });
  try {
    local.claude.repondre = repondreParJeu({ 'League of Legends': () => reponseClaude(plusRecente('lol', '26.21', '2026-10-19')) });
    const admin = await adminPret(local);
    await admin.put('/api/admin/jeux/lol', { actif: false });
    await admin.get('/api/e/lol/donnees');
    await admin.get('/api/e/lol/export');
    await pause(60);
    assert.equal(local.claude.appels.length, 0, 'aucun appel payant pour un jeu désactivé');
    await admin.put('/api/admin/jeux/lol', { actif: true });
    await admin.get('/api/e/lol/donnees');
    await attendreQue(() => local.claude.appels.length === 1);
  } finally {
    await local.arreter();
  }
});
