// Stockage en mémoire : même interface que MongoDB, utilisé par les tests et le mode simulation.
// Une fabrique donne une base séparée par nom, comme MongoDB. Les données disparaissent à l'arrêt du serveur.

function valeurComparable(v) {
  return v instanceof Date ? v.getTime() : v;
}

function verifierCondition(valeur, condition) {
  if (condition === null || typeof condition !== 'object' || condition instanceof Date || Array.isArray(condition)) {
    return valeurComparable(valeur) === valeurComparable(condition);
  }
  for (const [op, attendu] of Object.entries(condition)) {
    const a = valeurComparable(valeur);
    const b = valeurComparable(attendu);
    if (op === '$gt' && !(a > b)) return false;
    if (op === '$gte' && !(a >= b)) return false;
    if (op === '$lt' && !(a < b)) return false;
    if (op === '$lte' && !(a <= b)) return false;
    if (op === '$ne' && a === b) return false;
    if (op === '$in' && !attendu.map(valeurComparable).includes(a)) return false;
    if (!['$gt', '$gte', '$lt', '$lte', '$ne', '$in'].includes(op)) throw new Error(`Opérateur non pris en charge : ${op}`);
  }
  return true;
}

export function correspond(doc, filtre = {}) {
  return Object.entries(filtre).every(([champ, condition]) => verifierCondition(doc[champ], condition));
}

function trier(docs, tri) {
  const cles = Object.entries(tri);
  return docs.sort((x, y) => {
    for (const [champ, sens] of cles) {
      const a = valeurComparable(x[champ]);
      const b = valeurComparable(y[champ]);
      if (a === b) continue;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return (a < b ? -1 : 1) * sens;
    }
    return 0;
  });
}

export function creerStockageMemoire(nomBase = 'memoire') {
  const collections = new Map();

  function coll(nom) {
    if (!collections.has(nom)) collections.set(nom, new Map());
    return collections.get(nom);
  }

  return {
    type: 'memoire',
    nom: nomBase,
    async preparer() {},
    async ping() {
      return true;
    },
    async taille() {
      let octets = 0;
      for (const docs of collections.values()) for (const d of docs.values()) octets += JSON.stringify(d).length;
      return octets;
    },
    async lire(nom, id) {
      const doc = coll(nom).get(id);
      return doc ? structuredClone(doc) : null;
    },
    async lister(nom, filtre = {}, { tri = null, limite = 0 } = {}) {
      let docs = [...coll(nom).values()].filter((d) => correspond(d, filtre));
      if (tri) docs = trier(docs, tri);
      if (limite) docs = docs.slice(0, limite);
      return docs.map((d) => structuredClone(d));
    },
    async ecrire(nom, doc) {
      if (!doc || typeof doc._id !== 'string') throw new Error('Document sans _id');
      coll(nom).set(doc._id, structuredClone(doc));
      return structuredClone(doc);
    },
    async supprimer(nom, id) {
      return coll(nom).delete(id);
    },
    async supprimerPlusieurs(nom, filtre = {}) {
      let n = 0;
      for (const [id, doc] of coll(nom)) {
        if (correspond(doc, filtre)) {
          coll(nom).delete(id);
          n += 1;
        }
      }
      return n;
    },
    async compter(nom, filtre = {}) {
      let n = 0;
      for (const doc of coll(nom).values()) if (correspond(doc, filtre)) n += 1;
      return n;
    },
    // MongoDB efface seul les documents expirés (index TTL) ; ici, on le fait à la demande.
    async purgerExpires(maintenant = new Date()) {
      for (const docs of collections.values()) {
        for (const [id, doc] of docs) if (doc._expire && new Date(doc._expire) <= maintenant) docs.delete(id);
      }
    },
  };
}

export function creerFabriqueMemoire() {
  const bases = new Map();
  return {
    type: 'memoire',
    async init() {},
    base(nom) {
      if (!bases.has(nom)) bases.set(nom, creerStockageMemoire(nom));
      return bases.get(nom);
    },
    noms: () => [...bases.keys()],
    async supprimerBase(nom) {
      bases.delete(nom);
    },
    async fermer() {},
  };
}
