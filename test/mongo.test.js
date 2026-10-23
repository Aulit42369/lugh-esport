// L'adaptateur MongoDB (src/stockage/mongo.js), branché sur un faux pilote en mémoire : une base par nom, index selon
// le profil de la base, et exactement les mêmes résultats que le stockage en mémoire utilisé par les autres tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerFabriqueMongo, INDEX } from '../src/stockage/mongo.js';
import { creerFabriqueMemoire, correspond } from '../src/stockage/memoire.js';
import { creerDepot } from '../src/domaine/depot.js';
import { COLLECTIONS_SYNC } from '../src/domaine/collections.js';
import { creerApp } from '../src/app.js';
import { lireConfig } from '../src/config.js';
import { amorcer } from '../src/domaine/amorcage.js';
import { silencieux, horloge, MDP_ADMIN } from './simulation.js';

// ——— Faux pilote MongoDB : client → bases nommées → collections ———

class FauxCurseur {
  constructor(docs) { this.docs = docs; }
  sort(tri) {
    const cles = Object.entries(tri);
    this.docs.sort((a, b) => {
      for (const [champ, sens] of cles) {
        if (a[champ] === b[champ]) continue;
        if (a[champ] === undefined) return -sens;
        if (b[champ] === undefined) return sens;
        return (a[champ] < b[champ] ? -1 : 1) * sens;
      }
      return 0;
    });
    return this;
  }
  limit(n) { this.docs = this.docs.slice(0, n); return this; }
  async toArray() { return this.docs.map((d) => structuredClone(d)); }
}

class FausseCollection {
  constructor() { this.docs = new Map(); this.index = []; }
  async createIndex(cle, options) { this.index.push({ cle, options }); }
  async findOne(filtre) {
    const d = [...this.docs.values()].find((x) => correspond(x, filtre));
    return d ? structuredClone(d) : null;
  }
  find(filtre) { return new FauxCurseur([...this.docs.values()].filter((x) => correspond(x, filtre))); }
  async replaceOne(filtre, doc, options) {
    assert.equal(options?.upsert, true, 'écriture en upsert');
    assert.deepEqual(Object.keys(filtre), ['_id'], 'remplacement par identifiant');
    this.docs.set(filtre._id, structuredClone(doc));
    return { acknowledged: true };
  }
  // $set sur des chemins pointés, comme MongoDB : objets intermédiaires créés, refus sur une valeur qui n'est pas un objet.
  async updateOne(filtre, maj, options) {
    assert.deepEqual(Object.keys(filtre), ['_id'], 'modification par identifiant');
    assert.deepEqual(Object.keys(maj), ['$set'], 'écriture partielle : $set seulement');
    assert.equal(options?.upsert, undefined, 'jamais de création par une écriture partielle');
    const doc = this.docs.get(filtre._id);
    if (!doc) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    for (const [chemin, valeur] of Object.entries(maj.$set)) {
      const segments = chemin.split('.');
      const dernier = segments.pop();
      let cible = doc;
      for (const seg of segments) {
        cible[seg] ??= {};
        if (typeof cible[seg] !== 'object' || cible[seg] === null) throw new Error(`Cannot create field '${dernier}' in element ${seg}`);
        cible = cible[seg];
      }
      cible[dernier] = structuredClone(valeur);
    }
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }
  async deleteOne(filtre) { return { deletedCount: this.docs.delete(filtre._id) ? 1 : 0 }; }
  async deleteMany(filtre) {
    let n = 0;
    for (const [id, d] of this.docs) if (correspond(d, filtre)) { this.docs.delete(id); n += 1; }
    return { deletedCount: n };
  }
  async countDocuments(filtre) { return [...this.docs.values()].filter((x) => correspond(x, filtre)).length; }
  async drop() { this.supprimee = true; return true; }
}

class FauxClient {
  static instances = [];
  constructor(uri, options) {
    this.uri = uri;
    this.options = options;
    this.bases = new Map();
    this.connecte = false;
    FauxClient.instances.push(this);
  }
  async connect() { this.connecte = true; }
  async close() { this.ferme = true; }
  db(nom) {
    if (!this.bases.has(nom)) this.bases.set(nom, new Map());
    const collections = this.bases.get(nom);
    return {
      collection: (c) => {
        if (!collections.has(c)) collections.set(c, new FausseCollection());
        return collections.get(c);
      },
      command: async (cmd) => ({ ok: cmd.ping === 1 ? 1 : 0 }),
      listCollections: () => ({ toArray: async () => [...collections.keys()].map((name) => ({ name })) }),
    };
  }
}

// Un client partagé entre deux démarrages : simule les données qui restent dans Atlas pendant un redémarrage.
function clientPersistant() {
  const unique = new FauxClient('mongodb+srv://exemple', {});
  return class {
    constructor(uri, options) {
      unique.uri = uri;
      unique.options = options;
      return unique;
    }
  };
}

async function scenario(stockage) {
  const depot = creerDepot({ stockage, maintenant: () => new Date('2026-10-21T10:00:00Z') });
  await depot.initialiser();
  const a = await depot.enregistrer('strats', 's-aaaaaaaaaa', { nom: 'A', map: 'haven' }, null);
  const b = await depot.enregistrer('strats', 's-bbbbbbbbbb', { nom: 'B', map: 'lotus' }, null);
  await depot.enregistrer('strats', 's-cccccccccc', { nom: 'C', map: 'haven' }, null);
  await depot.enregistrer('strats', 's-aaaaaaaaaa', { nom: 'A2', map: 'haven' }, null, { revBase: a.rev });
  const conflit = await depot.enregistrer('strats', 's-aaaaaaaaaa', { nom: 'A3' }, null, { revBase: a.rev }).catch((e) => e.statut);
  await depot.supprimer('strats', 's-bbbbbbbbbb', null);
  const dejaSupprime = await depot.supprimer('strats', 's-bbbbbbbbbb', null);
  await depot.enregistrer('vodNotes', 'n-aaaaaaaaaa', { vodId: 'v-aaaaaaaaaa', texte: '1' }, null);
  await depot.enregistrer('vodNotes', 'n-bbbbbbbbbb', { vodId: 'v-aaaaaaaaaa', texte: '2' }, null);
  await depot.enregistrer('vodNotes', 'n-cccccccccc', { vodId: 'v-bbbbbbbbbb', texte: '3' }, null);
  const sync = await depot.depuis(b.rev - 1);
  const tout = await depot.toutCharger();
  return {
    noms: tout.donnees.strats.map((s) => s.nom).sort(),
    syncDocs: Object.fromEntries(Object.entries(sync.docs).map(([c, d]) => [c, d.map((x) => x._id).sort()])),
    syncSuppr: sync.suppressions.map((s) => `${s.coll}:${s.id}`),
    conflit,
    dejaSupprime,
    rev: tout.rev,
    compteHaven: await stockage.compter('strats', { map: 'haven' }),
    dansListe: (await stockage.lister('strats', { map: { $in: ['haven', 'mars'] } }, { tri: { nom: -1 } })).map((s) => s.nom),
    plage: (await stockage.lister('strats', { rev: { $gt: a.rev, $lte: tout.rev } })).map((s) => s._id).sort(),
    autreQue: (await stockage.lister('strats', { nom: { $ne: 'C' } })).map((s) => s.nom),
    limite: (await stockage.lister('vodNotes', {}, { tri: { texte: 1 }, limite: 2 })).map((n) => n.texte),
    supprimes: await stockage.supprimerPlusieurs('vodNotes', { vodId: 'v-aaaaaaaaaa' }),
    restants: await stockage.compter('vodNotes'),
    absent: await stockage.lire('strats', 's-zzzzzzzzzz'),
    sansExpire: Object.keys(await depot.lire('strats', 's-aaaaaaaaaa')).includes('_expire'),
    partielle: [
      await stockage.modifier('strats', 's-cccccccccc', { 'lus.c-aaaaaaaaaa': '2026-10-21', 'visites.lol': { dernier: 'x' } }),
      await stockage.modifier('strats', 's-cccccccccc', { 'lus.c-bbbbbbbbbb': '2026-10-22', nom: 'C2' }),
      await stockage.modifier('strats', 's-zzzzzzzzzz', { nom: 'fantôme' }),
      await stockage.modifier('strats', 's-cccccccccc', { 'lus.$x': 1 }).catch((e) => e.message),
    ],
    apresPartielle: await stockage.lire('strats', 's-cccccccccc'),
    fantome: await stockage.lire('strats', 's-zzzzzzzzzz'),
  };
}

test('fabrique MongoDB : un seul client, une base séparée par nom, connexion vérifiée', async () => {
  const fabrique = creerFabriqueMongo({ uri: 'mongodb+srv://lugh:secret@exemple.mongodb.net', Client: FauxClient });
  assert.throws(() => fabrique.base('lugh'), /Base non connectée/);
  await fabrique.init();
  const client = FauxClient.instances.at(-1);
  assert.equal(client.connecte, true);
  assert.equal(client.uri, 'mongodb+srv://lugh:secret@exemple.mongodb.net');
  assert.deepEqual([client.options.appName, client.options.maxPoolSize, client.options.serverSelectionTimeoutMS], ['lugh', 10, 10_000]);
  assert.equal(fabrique.type, 'mongo');

  const globale = fabrique.base('lugh');
  const valorant = fabrique.base('lugh_valorant');
  assert.equal(fabrique.base('lugh'), globale, 'une instance par base');
  assert.equal(await globale.ping(), true);
  await globale.ecrire('comptes', { _id: 'c-aaaaaaaaaa', identifiant: 'chef' });
  await valorant.ecrire('strats', { _id: 's-aaaaaaaaaa', nom: 'Default' });
  assert.equal(await valorant.lire('comptes', 'c-aaaaaaaaaa'), null, 'les comptes ne sont pas dans la base du jeu');
  assert.equal(await globale.lire('strats', 's-aaaaaaaaaa'), null);
  assert.deepEqual([...client.bases.keys()].sort(), ['lugh', 'lugh_valorant']);
  await assert.rejects(valorant.ecrire('strats', { nom: 'sans identifiant' }), /Document sans _id/);
  await fabrique.fermer();
  assert.equal(client.ferme, true);
  assert.throws(() => fabrique.base('lugh'), /Base non connectée/, 'fermée : plus de base');
});

test('index posés selon le profil de la base : générale (sessions, journal, comptes) ou jeu (synchronisation)', async () => {
  const fabrique = creerFabriqueMongo({ uri: 'mongodb://x', Client: FauxClient });
  await fabrique.init();
  const client = FauxClient.instances.at(-1);
  await fabrique.base('lugh').preparer('global');
  await fabrique.base('lugh_lol').preparer('jeu');
  await fabrique.base('lugh_rien').preparer('inconnu');
  const index = (base, coll) => client.bases.get(base)?.get(coll)?.index || [];
  const ttl = (base, coll) => index(base, coll).some((i) => i.cle._expire === 1 && i.options.expireAfterSeconds === 0);
  assert.ok(ttl('lugh', 'sessions') && ttl('lugh', 'journal'), 'sessions et journal expirent seuls');
  assert.ok(index('lugh', 'comptes').some((i) => i.cle.identifiant === 1 && i.options.unique), 'identifiant unique');
  assert.ok(index('lugh', 'sessions').some((i) => i.cle.compteId === 1));
  assert.ok(index('lugh', 'restaurations').some((i) => i.cle.jeu === 1));
  assert.ok(ttl('lugh_lol', 'suppressions'), 'traces de suppression effacées après 30 jours');
  assert.ok(index('lugh_lol', 'vodNotes').some((i) => i.cle.vodId === 1) && index('lugh_lol', 'votes').some((i) => i.cle.cible === 1), 'cascades indexées');
  for (const coll of [...COLLECTIONS_SYNC, 'suppressions']) {
    assert.ok(index('lugh_lol', coll).some((i) => i.cle.rev === 1), `synchronisation indexée : ${coll}`);
    assert.ok(INDEX.jeu.some(([c, cle]) => c === coll && cle.rev === 1), `INDEX.jeu couvre ${coll}`);
  }
  assert.equal(index('lugh', 'strats').length, 0, 'pas d’index de jeu dans la base générale');
  assert.equal(client.bases.get('lugh_rien')?.size || 0, 0, 'profil inconnu : rien');
  await fabrique.fermer();
});

test('MongoDB et mémoire donnent exactement les mêmes résultats sur le scénario du dépôt', async () => {
  const mongo = creerFabriqueMongo({ uri: 'mongodb://x', Client: FauxClient });
  await mongo.init();
  const memoire = creerFabriqueMemoire();
  await memoire.init();
  const resultatMongo = await scenario(mongo.base('lugh_valorant'));
  const resultatMemoire = await scenario(memoire.base('lugh_valorant'));
  assert.deepEqual(resultatMongo, resultatMemoire);
  assert.deepEqual(resultatMongo.noms, ['A2', 'C']);
  assert.deepEqual(resultatMongo.syncSuppr, ['strats:s-bbbbbbbbbb']);
  assert.equal(resultatMongo.conflit, 409);
  assert.equal(resultatMongo.dejaSupprime, false);
  assert.deepEqual(resultatMongo.dansListe, ['C', 'A2']);
  assert.deepEqual(resultatMongo.limite, ['1', '2']);
  assert.deepEqual([resultatMongo.supprimes, resultatMongo.restants], [2, 1]);
  assert.equal(resultatMongo.sansExpire, false);
  assert.deepEqual(resultatMongo.partielle, [true, true, false, 'Chemin invalide : lus.$x']);
  const { lus, visites, nom, map } = resultatMongo.apresPartielle;
  assert.deepEqual({ lus, visites, nom, map }, { lus: { 'c-aaaaaaaaaa': '2026-10-21', 'c-bbbbbbbbbb': '2026-10-22' }, visites: { lol: { dernier: 'x' } }, nom: 'C2', map: 'haven' });
  assert.equal(resultatMongo.fantome, null, 'pas de création');
  await mongo.fermer();
});

test('les révisions reprennent après un redémarrage, sur MongoDB comme en mémoire', async () => {
  for (const stockage of [creerFabriqueMemoire().base('lugh_x'), await (async () => {
    const f = creerFabriqueMongo({ uri: 'mongodb://x', Client: FauxClient });
    await f.init();
    return f.base('lugh_x');
  })()]) {
    const d1 = creerDepot({ stockage });
    await d1.initialiser();
    const premier = await d1.enregistrer('scrims', 'x-aaaaaaaaaa', { adversaire: 'A' }, null);
    await d1.supprimer('scrims', 'x-aaaaaaaaaa', null);
    const d2 = creerDepot({ stockage });
    await d2.initialiser();
    assert.equal(d2.revSure(), premier.rev + 1, 'la suppression compte aussi');
    const suivant = await d2.enregistrer('scrims', 'x-bbbbbbbbbb', { adversaire: 'B' }, null);
    assert.ok(suivant.rev > premier.rev + 1);
  }
});

test('l’application sur MongoDB : base générale et une base par jeu, index posés une fois, tout retrouvé au redémarrage', async () => {
  const Client = clientPersistant();
  const config = lireConfig({ LUGH_MODE: 'simulation', LUGH_ADMIN_ID: 'chef', LUGH_ADMIN_MDP: MDP_ADMIN, ANTHROPIC_API_KEY: '' });
  const demarrerApp = async () => {
    const fabrique = creerFabriqueMongo({ uri: 'mongodb+srv://exemple', Client });
    await fabrique.init();
    const app = await creerApp({ config, fabrique, maintenant: horloge(), journal: silencieux, automatismes: false });
    await amorcer({ ...app.services, journal: silencieux });
    return { app, fabrique };
  };
  const premier = await demarrerApp();
  const client = new Client();
  await premier.app.services.registre.creer({ modele: 'valorant', id: 'valorant', compte: null });
  await premier.app.services.registre.creer({ modele: 'lol', id: 'lol', compte: null });
  assert.deepEqual([...client.bases.keys()].sort(), ['lugh', 'lugh_lol', 'lugh_valorant']);
  const nbIndex = client.bases.get('lugh_valorant').get('strats').index.length;
  assert.ok(nbIndex > 0);
  const espaces = [...client.bases.get('lugh').get('espaces').docs.values()];
  assert.deepEqual(espaces.map((d) => [d._id, d.versionIndex > 0, d.couleur]).sort(), [['lol', true, 'sarcelle'], ['valorant', true, 'corail']]);
  assert.equal(client.bases.get('lugh').get('comptes').docs.size, 1, 'Administrateur général créé au premier démarrage');
  const membres = client.bases.get('lugh_valorant').get('membres').docs.size;
  premier.app.arreter();

  const second = await demarrerApp();
  assert.deepEqual(second.app.services.registre.liste().map((d) => d._id), ['valorant', 'lol']);
  assert.equal(client.bases.get('lugh_valorant').get('strats').index.length, nbIndex, 'index déjà posés : pas recréés');
  assert.equal(client.bases.get('lugh').get('comptes').docs.size, 1, 'pas de second Administrateur général');
  assert.equal((await second.app.services.registre.obtenir('valorant').depot.lister('membres')).length, membres);
  assert.equal(second.app.services.registre.obtenir('lol').def.modele, 'lol');
  second.app.arreter();
});

test('suppression d’une base : chaque collection est supprimée (l’utilisateur Atlas n’a pas le droit de supprimer une base)', async () => {
  const fabrique = creerFabriqueMongo({ uri: 'mongodb://x', Client: FauxClient });
  await fabrique.init();
  const client = FauxClient.instances.at(-1);
  const b = fabrique.base('lugh_lol');
  await b.ecrire('strats', { _id: 's1' });
  await b.ecrire('membres', { _id: 'm1' });
  const collections = [...client.bases.get('lugh_lol').values()];
  await fabrique.supprimerBase('lugh_lol');
  assert.equal(collections.length, 2);
  assert.ok(collections.every((c) => c.supprimee));
  assert.notEqual(fabrique.base('lugh_lol'), b, 'nouvelle base neuve si le jeu est recréé');
});
