// Registre des espaces de jeu : la liste des jeux créés (collection « espaces » de la base globale) et, pour
// chacun, ses services : sa base « lugh_<jeu> », son dépôt, sa définition effective, sa méta, ses notifications,
// ses automatismes. Un jeu désactivé garde ses données et ses services : seul l'accès est fermé.

import { creerDepot, champsMetier } from '../domaine/depot.js';
import { creerAutomatismes } from '../domaine/automatismes.js';
import { creerActualisation } from '../meta/actualisation.js';
import { creerNotifications } from '../notifications/discord.js';
import { amorcerJeu } from './amorcage-jeu.js';
import { modele as modeleParId, ID_AUTRE } from '../../shared/jeux/index.js';
import { definitionEffective } from '../../shared/jeux/definition.js';
import { schemasPour } from '../../shared/schemas.js';
import { MAX_ESPACES } from '../domaine/collections.js';
import { couleurPourNouveauJeu, estCouleurJeu } from '../../shared/couleurs.js';

// À augmenter quand une collection d'un jeu reçoit un nouvel index : chaque jeu les crée au démarrage suivant.
const VERSION_INDEX = 2;

export function creerRegistre({
  fabrique, global, config, historique, maintenant = () => new Date(), journal = console,
  interrogerClaude = null, fetchDiscord = null, delaiPlanningMs = undefined, automatismes = true,
}) {
  const espaces = new Map();

  async function construire(doc) {
    const modele = modeleParId(doc.modele);
    if (!modele) {
      journal.error?.(`[jeux] modèle inconnu pour le jeu ${doc._id} : ${doc.modele}`);
      return null;
    }
    const stockage = fabrique.base(`${config.base}_${doc._id}`);
    let aEcrire = false;
    if ((doc.versionIndex || 0) < VERSION_INDEX) {
      await stockage.preparer('jeu');
      doc.versionIndex = VERSION_INDEX;
      aEcrire = true;
    }
    // Jeu créé avant les couleurs de jeu : il reçoit la teinte de son modèle (ou la première libre).
    if (!estCouleurJeu(doc.couleur)) {
      doc.couleur = couleurPourNouveauJeu(doc.modele, [...espaces.values()].map((x) => x.doc.couleur));
      aEcrire = true;
    }
    if (aEcrire) await global.ecrire('espaces', doc);
    const depot = creerDepot({ stockage, maintenant, journal, historique, jeu: doc._id });
    await depot.initialiser();

    const e = { id: doc._id, doc, modele, stockage, depot, def: null };
    e.definition = () => e.def;
    e.schemas = () => schemasPour(e.def);
    e.rechargerDefinition = async () => {
      const reglages = await stockage.lire('jeu', 'reglages');
      e.def = definitionEffective(modele, reglages ? champsMetier(reglages) : null, { id: e.id, nom: e.doc.nom, court: e.doc.court, couleur: e.doc.couleur });
      return e.def;
    };
    await e.rechargerDefinition();

    e.notifications = creerNotifications({
      stockage, depot, config, definition: e.definition, journal,
      ...(fetchDiscord ? { fetchImpl: fetchDiscord } : {}), ...(delaiPlanningMs ? { delaiPlanningMs } : {}),
    });
    e.actualisation = creerActualisation({
      depot, stockage, config, definition: e.definition, notifications: e.notifications, maintenant, journal,
      ...(interrogerClaude ? { interroger: interrogerClaude } : {}),
    });
    e.automatismes = automatismes
      ? creerAutomatismes({ depot, stockage, config, actualisation: e.actualisation, definition: e.definition, maintenant, journal })
      : null;
    espaces.set(e.id, e);
    return e;
  }

  const trier = (a, b) => (a.ordre ?? 99) - (b.ordre ?? 99) || a.nom.localeCompare(b.nom, 'fr');

  return {
    async initialiser() {
      for (const doc of (await global.lister('espaces')).sort(trier)) await construire(doc);
    },

    // Services d'un jeu (actif ou non), ou null s'il n'existe pas.
    obtenir(id) {
      return espaces.get(id) || null;
    },

    liste() {
      return [...espaces.values()].map((e) => e.doc).sort(trier);
    },

    // Crée l'espace d'un jeu (ou le réactive s'il existe déjà) et prépare ses données de départ.
    async creer({ modele, id, nom, court, compte }) {
      const m = modeleParId(modele);
      if (!m) throw new Error('modèle inconnu');
      const existant = espaces.get(id);
      if (existant) {
        existant.doc.actif = true;
        await global.ecrire('espaces', existant.doc);
        return existant;
      }
      if (espaces.size >= MAX_ESPACES) throw new Error(`${MAX_ESPACES} jeux au maximum (limite de la base gratuite).`);
      const doc = {
        _id: id,
        modele,
        nom: nom || m.nom,
        court: court || m.court || m.nom,
        actif: true,
        couleur: couleurPourNouveauJeu(modele, [...espaces.values()].map((x) => x.doc.couleur)),
        ordre: espaces.size + 1,
        creeLe: maintenant().toISOString(),
        creePar: compte?._id || 'systeme',
        versionIndex: 0,
      };
      await global.ecrire('espaces', doc);
      const e = await construire(doc);
      await amorcerJeu({ depot: e.depot, stockage: e.stockage, def: e.def, modele: m, maintenant });
      await historique.ecrire(compte, 'jeu créé', e.doc.nom, modele === ID_AUTRE ? 'modèle « Autre jeu »' : '', e.id);
      return e;
    },

    async modifier(id, champs) {
      const e = espaces.get(id);
      if (!e) return null;
      Object.assign(e.doc, champs);
      await global.ecrire('espaces', e.doc);
      await e.rechargerDefinition();
      return e;
    },

    arreter() {
      for (const e of espaces.values()) e.notifications.arreter();
    },
  };
}
