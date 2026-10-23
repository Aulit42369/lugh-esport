// Dépôt d'un jeu : écritures signées et numérotées (révisions), suppressions tracées, synchronisation.
// Une instance par jeu (sa base) ; le journal est global et note le jeu concerné.
// Les révisions sont attribuées en mémoire, de façon synchrone : un seul serveur (Render gratuit) écrit dans la base.

import { COLLECTIONS_SYNC } from './collections.js';
import { erreurs } from '../http/outils.js';

const RETENTION_SUPPRESSIONS_MS = 30 * 24 * 3600 * 1000;

export function nettoyer(doc) {
  if (!doc) return doc;
  const { _expire, ...reste } = doc;
  return reste;
}

// Champs métier d'une fiche, sans les champs gérés par le dépôt (pour la réenregistrer).
export function champsMetier(doc) {
  if (!doc) return {};
  const { _id, rev, maj, cree, _expire, ...reste } = doc;
  return reste;
}

export function creerDepot({ stockage, maintenant = () => new Date(), journal = console, historique = null, jeu = '' }) {
  let rev = 0;
  const enVol = new Set();
  const ecouteurs = new Set();

  // Prévient les modules intéressés (notifications) après chaque écriture, sans jamais bloquer ni faire échouer l'écriture.
  function prevenir(coll, doc, avant, compte) {
    for (const fn of ecouteurs) {
      try {
        Promise.resolve(fn(coll, doc, avant, compte)).catch((e) => journal.error?.('[écouteur]', e?.message || e));
      } catch (e) {
        journal.error?.('[écouteur]', e?.message || e);
      }
    }
  }

  function allouer() {
    rev += 1;
    enVol.add(rev);
    return rev;
  }

  async function liberer(r) {
    enVol.delete(r);
    await stockage.ecrire('compteurs', { _id: 'rev', valeur: rev });
  }

  // Révision jusqu'à laquelle toutes les écritures sont terminées : rien ne peut apparaître en dessous.
  function revSure() {
    return enVol.size ? Math.min(...enVol) - 1 : rev;
  }

  function signature(compte) {
    return { par: compte?._id || 'systeme', le: maintenant().toISOString() };
  }

  // Une écriture à la fois par fiche : lecture, contrôle de revBase et écriture forment un tout (sinon deux
  // enregistrements partis de la même révision pourraient passer tous les deux, avec la latence d'Atlas).
  const verrous = new Map();
  async function verrouiller(cle, fn) {
    const avant = verrous.get(cle) || Promise.resolve();
    const suite = avant.catch(() => {}).then(fn);
    const marque = suite.catch(() => {});
    verrous.set(cle, marque);
    try {
      return await suite;
    } finally {
      if (verrous.get(cle) === marque) verrous.delete(cle);
    }
  }

  async function ecrire(coll, id, valeur, compte, { revBase = null, silencieux = false } = {}) {
    const actuel = await stockage.lire(coll, id);
    if (revBase !== null && revBase !== undefined) {
      const attendue = actuel ? actuel.rev : 0;
      if (attendue !== revBase) {
        throw erreurs.conflit('Cette fiche a été modifiée par quelqu’un d’autre pendant ton édition.',
          { actuelle: nettoyer(actuel) });
      }
    }
    const r = allouer();
    try {
      const doc = { ...valeur, _id: id, rev: r, maj: signature(compte), cree: actuel?.cree || signature(compte) };
      await stockage.ecrire(coll, doc);
      if (!silencieux) prevenir(coll, nettoyer(doc), nettoyer(actuel), compte);
      return nettoyer(doc);
    } finally {
      await liberer(r);
    }
  }

  return {
    stockage,

    ecouter(fn) {
      ecouteurs.add(fn);
      return () => ecouteurs.delete(fn);
    },

    async initialiser() {
      const compteur = await stockage.lire('compteurs', 'rev');
      let max = compteur?.valeur ?? 0;
      for (const nom of [...COLLECTIONS_SYNC, 'suppressions']) {
        const [dernier] = await stockage.lister(nom, {}, { tri: { rev: -1 }, limite: 1 });
        if (dernier?.rev > max) max = dernier.rev;
      }
      rev = max;
    },

    revSure,

    async lire(coll, id) {
      return nettoyer(await stockage.lire(coll, id));
    },

    async lister(coll, filtre = {}, options = {}) {
      return (await stockage.lister(coll, filtre, options)).map(nettoyer);
    },

    // revBase : révision que l'éditeur avait sous les yeux ; si la fiche a bougé depuis, refus (409).
    // silencieux : pas de notification (restauration d'une sauvegarde).
    async enregistrer(coll, id, valeur, compte, options = {}) {
      return verrouiller(`${coll}:${id}`, () => ecrire(coll, id, valeur, compte, options));
    },

    // Même verrou que l'enregistrement : une suppression ne passe jamais au milieu d'un enregistrement de la même fiche.
    async supprimer(coll, id, compte) {
      return verrouiller(`${coll}:${id}`, async () => {
        const existait = await stockage.supprimer(coll, id);
        if (!existait) return false;
        const r = allouer();
        try {
          await stockage.ecrire('suppressions', {
            _id: `${coll}:${id}`,
            coll,
            id,
            rev: r,
            par: compte?._id || 'systeme',
            _expire: new Date(maintenant().getTime() + RETENTION_SUPPRESSIONS_MS),
          });
        } finally {
          await liberer(r);
        }
        return true;
      });
    },

    async toutCharger() {
      const sure = revSure();
      const donnees = {};
      for (const coll of COLLECTIONS_SYNC) donnees[coll] = (await stockage.lister(coll)).map(nettoyer);
      return { rev: sure, donnees };
    },

    async depuis(depuisRev) {
      const sure = revSure();
      if (depuisRev > rev) return { reinitialiser: true, rev: sure };
      if (depuisRev >= sure) return { rev: depuisRev, docs: {}, suppressions: [] };
      const filtre = { rev: { $gt: depuisRev, $lte: sure } };
      const docs = {};
      for (const coll of COLLECTIONS_SYNC) {
        const liste = await stockage.lister(coll, filtre);
        if (liste.length) docs[coll] = liste.map(nettoyer);
      }
      const suppressions = (await stockage.lister('suppressions', filtre)).map(({ coll, id, rev: r }) => ({ coll, id, rev: r }));
      return { rev: sure, docs, suppressions };
    },

    async journaliser(compte, action, cible = '', details = '') {
      await historique?.ecrire(compte, action, cible, details, jeu);
    },
  };
}
