// Stockage MongoDB Atlas : toutes les données vivent ici (le disque de Render est effacé à chaque déploiement).
// Un seul client pour tout le serveur ; une base globale (« lugh ») et une base par jeu (« lugh_valorant »…).

import { MongoClient } from 'mongodb';
import { MARQUE } from '../../shared/marque.js';
import { MOTIF_CHEMIN } from './memoire.js';

// Index de chaque type de base : créés au démarrage (créer un index existant ne coûte rien).
export const INDEX = {
  global: [
    ['sessions', { _expire: 1 }, { expireAfterSeconds: 0 }],
    ['sessions', { compteId: 1 }],
    ['journal', { _expire: 1 }, { expireAfterSeconds: 0 }],
    ['journal', { date: -1 }],
    ['journal', { jeu: 1, date: -1 }],
    ['comptes', { identifiant: 1 }, { unique: true }],
    ['annonces', { creeLe: -1 }],
    ['ecritures', { date: 1 }],
    ['autorisations', { jeu: 1 }],
    ['restaurations', { jeu: 1 }],
  ],
  jeu: [
    ['suppressions', { _expire: 1 }, { expireAfterSeconds: 0 }],
    ['vodNotes', { vodId: 1 }],
    ['votes', { cible: 1 }],
    ['mesures', { membreId: 1 }],
    ['absences', { membreId: 1 }],
    ['dispos', { membreId: 1 }],
    ...['jeu', 'equipe', 'membres', 'mapsEquipe', 'strats', 'planning', 'objectifs', 'scrims', 'vods', 'vodNotes', 'dispos',
      'meta', 'suggestions', 'suppressions', 'adversaires', 'presences', 'absences', 'mesures', 'bibliotheque', 'candidats', 'votes',
      'seances', 'tournois', 'partenaires',
    ].map((nom) => [nom, { rev: 1 }]),
  ],
};

function stockageBase(db, nom) {
  const c = (collection) => db.collection(collection);
  return {
    type: 'mongo',
    nom,

    async preparer(profil) {
      for (const [collection, cle, options] of INDEX[profil] || []) await c(collection).createIndex(cle, options || {});
    },

    // Taille occupée par cette base (données + index), en octets : l'offre gratuite d'Atlas s'arrête à 512 Mo.
    async taille() {
      const st = await db.command({ dbStats: 1, scale: 1 });
      return (st.dataSize || 0) + (st.indexSize || 0);
    },

    async ping() {
      await db.command({ ping: 1 });
      return true;
    },

    async lire(collection, id) {
      return c(collection).findOne({ _id: id });
    },

    async lister(collection, filtre = {}, { tri = null, limite = 0 } = {}) {
      let curseur = c(collection).find(filtre);
      if (tri) curseur = curseur.sort(tri);
      if (limite) curseur = curseur.limit(limite);
      return curseur.toArray();
    },

    async ecrire(collection, doc) {
      if (!doc || typeof doc._id !== 'string') throw new Error('Document sans _id');
      await c(collection).replaceOne({ _id: doc._id }, doc, { upsert: true });
      return doc;
    },

    // Écriture partielle atomique ($set sur des chemins) : une écriture simultanée d'un autre champ n'est pas écrasée.
    async modifier(collection, id, champs) {
      for (const chemin of Object.keys(champs)) if (!MOTIF_CHEMIN.test(chemin)) throw new Error(`Chemin invalide : ${chemin}`);
      const r = await c(collection).updateOne({ _id: id }, { $set: champs });
      return r.matchedCount > 0;
    },

    async supprimer(collection, id) {
      const r = await c(collection).deleteOne({ _id: id });
      return r.deletedCount > 0;
    },

    async supprimerPlusieurs(collection, filtre = {}) {
      const r = await c(collection).deleteMany(filtre);
      return r.deletedCount;
    },

    async compter(collection, filtre = {}) {
      return c(collection).countDocuments(filtre);
    },

    async purgerExpires() {
      // Géré par les index TTL de MongoDB.
    },
  };
}

export function creerFabriqueMongo({ uri, Client = MongoClient }) {
  let client = null;
  const bases = new Map();

  return {
    type: 'mongo',

    async init() {
      client = new Client(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10, appName: MARQUE.id });
      await client.connect();
    },

    // Base nommée (créée par MongoDB à la première écriture).
    base(nom) {
      if (!client) throw new Error('Base non connectée');
      if (!bases.has(nom)) bases.set(nom, stockageBase(client.db(nom), nom));
      return bases.get(nom);
    },

    // Efface une base entière, collection par collection : l'utilisateur Atlas « lecture et écriture » peut supprimer
    // une collection mais pas une base ; une base sans collection disparaît d'elle-même.
    async supprimerBase(nom) {
      if (!client) throw new Error('Base non connectée');
      const db = client.db(nom);
      for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) await db.collection(name).drop();
      bases.delete(nom);
    },

    async fermer() {
      if (client) await client.close();
      client = null;
      bases.clear();
    },
  };
}
