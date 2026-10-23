// Actualisation de la méta d'un jeu : par l'API Claude (automatique ou bouton) ou par import manuel d'un JSON.
// Validation stricte avec la définition du jeu, écart avec la version précédente, suggestions, coût estimé.
// N'écrit que dans meta, metaHistorique et suggestions ; en cas d'échec, l'ancienne méta est conservée.

import { interrogerClaude as interrogerParDefaut, extraireJson } from './claude.js';
import { construireConsigne } from './consigne.js';
import { validerMeta } from '../../shared/schemas-meta.js';
import { diffMeta, suggestionsDepuisDiff, idSuggestion } from '../../shared/alertes.js';
import { aujourdhui } from '../../shared/temps.js';
import { champsMetier } from '../domaine/depot.js';
import { TARIFS_CLAUDE, TARIF_RECHERCHE, PLAFONDS_MANUELS } from '../config.js';

const HISTORIQUE_MAX = 20;
const SUGGESTIONS_MAX = 60;
const USAGE_NUL = { entree: 0, sortie: 0, recherches: 0 };

export function coutEstime(modele, usage) {
  const t = TARIFS_CLAUDE[modele] || TARIFS_CLAUDE['claude-sonnet-5-5'];
  return (usage.entree / 1e6) * t.entree + (usage.sortie / 1e6) * t.sortie + usage.recherches * TARIF_RECHERCHE;
}

const MOIS_VIDE = { passages: 0, entree: 0, sortie: 0, recherches: 0, usd: 0 };

// Vérifications lancées à la main, comptées dans le même cumul mensuel que le coût (plafond PLAFONDS_MANUELS),
// qu'elles réussissent ou non : un appel qui échoue après avoir consommé des jetons coûte aussi.
export function compterManuel(couts = {}, mois) {
  const m = couts[mois] || MOIS_VIDE;
  return { ...couts, [mois]: { ...m, manuels: (m.manuels || 0) + 1 } };
}
export const manuelsDuMois = (couts, mois) => couts?.[mois]?.manuels || 0;

export function cumulerCouts(couts = {}, mois, usage, usd) {
  const c = { ...couts };
  const m = c[mois] || MOIS_VIDE;
  c[mois] = {
    ...m,
    passages: m.passages + 1,
    entree: m.entree + usage.entree,
    sortie: m.sortie + usage.sortie,
    recherches: m.recherches + usage.recherches,
    usd: Math.round((m.usd + usd) * 10_000) / 10_000,
  };
  const cles = Object.keys(c).sort().slice(-6);
  return Object.fromEntries(cles.map((k) => [k, c[k]]));
}

function resumerEcart(diff) {
  return {
    patch: diff.patch,
    entrees: diff.mapsEntrees.map((m) => m.nom),
    sorties: diff.mapsSorties.map((m) => m.nom),
    personnagesModifies: diff.personnagesModifies.map((a) => a.nom),
    nouveauxPersonnages: diff.nouveauxPersonnages.map((a) => a.nom),
    vide: diff.vide,
  };
}

export function creerActualisation({
  depot, stockage, config, definition, notifications = null, maintenant = () => new Date(), interroger = interrogerParDefaut, journal = console,
}) {
  let enCours = null;

  async function archiver(avantDoc, quand) {
    await stockage.ecrire('metaHistorique', { ...champsMetier(avantDoc), _id: `h-${quand.getTime()}`, archiveLe: quand.toISOString() });
    const anciens = await stockage.lister('metaHistorique', {}, { tri: { archiveLe: -1 } });
    for (const h of anciens.slice(HISTORIQUE_MAX)) await stockage.supprimer('metaHistorique', h._id);
  }

  async function creerSuggestions(diff, meta, compte, quand) {
    const [mapsEquipe, strats, membres] = await Promise.all([
      depot.lister('mapsEquipe'), depot.lister('strats'), depot.lister('membres'),
    ]);
    let nouvelles = 0;
    for (const sug of suggestionsDepuisDiff(definition(), diff, { meta, mapsEquipe, strats, membres })) {
      const id = idSuggestion(sug.cle);
      if (await stockage.lire('suggestions', id)) continue;
      await depot.enregistrer('suggestions', id, { ...sug, statut: 'nouvelle', patch: meta.patch, creeLe: quand.toISOString() }, compte);
      nouvelles += 1;
    }
    const toutes = await stockage.lister('suggestions', {}, { tri: { creeLe: -1 } });
    for (const s of toutes.slice(SUGGESTIONS_MAX)) await depot.supprimer('suggestions', s._id, compte);
    return nouvelles;
  }

  function compterTentative(avant, creneau) {
    if (!creneau) return avant?.tentatives || null;
    const n = avant?.tentatives?.creneau === creneau ? avant.tentatives.n + 1 : 1;
    return { creneau, n };
  }

  // Valide une méta brute et l'applique ; lève une erreur lisible si elle est refusée.
  async function appliquer(brut, { declencheur, compte = null, usage = USAGE_NUL, creneau = null, payant = false }) {
    const debut = maintenant();
    const mois = debut.toISOString().slice(0, 7);
    const manuel = (c) => (declencheur === 'manuel' ? compterManuel(c, mois) : c);
    const avantDoc = await stockage.lire('meta', 'courante');
    const avant = avantDoc ? champsMetier(avantDoc) : null;
    const verif = validerMeta(definition(), brut, avant);
    if (!verif.ok) {
      const raisons = verif.erreurs.slice(0, 3).map((e) => `${e.chemin} : ${e.message}`).join(' ; ');
      throw new Error(`réponse rejetée (${raisons})`);
    }
    const nouvelle = {
      ...verif.valeur,
      schema: 2,
      statut: 'ok',
      erreur: null,
      avertissements: verif.avertissements.slice(0, 10),
      derniereVerif: debut.toISOString(),
      derniereTentative: debut.toISOString(),
      declencheur,
      tentatives: compterTentative(avant, creneau),
      couts: manuel(payant ? cumulerCouts(avant?.couts, mois, usage, coutEstime(config.claude.modele, usage)) : (avant?.couts || {})),
    };
    const diff = diffMeta(avant, nouvelle);
    nouvelle.dernierEcart = resumerEcart(diff);
    if (avantDoc) await archiver(avantDoc, debut);
    await depot.enregistrer('meta', 'courante', nouvelle, compte);
    const nb = await creerSuggestions(diff, nouvelle, compte, debut);
    await depot.journaliser(compte, 'méta actualisée', declencheur, diff.vide ? 'aucun changement' : `${nb} suggestion(s)`);
    await notifications?.meta(nouvelle, nouvelle.dernierEcart);
    return { ok: true, diff };
  }

  async function noterEchec(erreur, { declencheur, compte, usage, creneau }) {
    const debut = maintenant();
    const avantDoc = await stockage.lire('meta', 'courante');
    if (avantDoc) {
      const avant = champsMetier(avantDoc);
      const mois = debut.toISOString().slice(0, 7);
      let couts = usage.entree || usage.recherches ? cumulerCouts(avant.couts, mois, usage, coutEstime(config.claude.modele, usage)) : avant.couts || {};
      if (declencheur === 'manuel') couts = compterManuel(couts, mois);
      await depot.enregistrer('meta', 'courante', {
        ...avant, statut: 'echec', erreur, derniereTentative: debut.toISOString(), declencheur, couts, tentatives: compterTentative(avant, creneau),
      }, compte);
    }
    await depot.journaliser(compte, 'échec de l’actualisation de la méta', declencheur, erreur);
  }

  async function executer(declencheur, compte, creneau) {
    let usage = USAGE_NUL;
    try {
      const avantDoc = await stockage.lire('meta', 'courante');
      const consigne = construireConsigne({
        def: definition(),
        meta: avantDoc ? champsMetier(avantDoc) : null,
        aujourdhui: aujourdhui(config.fuseau),
        maxRecherches: config.claude.maxRecherches,
      });
      const rep = await interroger({ cle: config.claude.cle, modele: config.claude.modele, ...consigne });
      usage = rep.usage;
      return await appliquer(extraireJson(rep.texte), { declencheur, compte, usage, creneau, payant: true });
    } catch (e) {
      const erreur = String(e?.message || e).slice(0, 300);
      await noterEchec(erreur, { declencheur, compte, usage, creneau });
      return { ok: false, erreur };
    }
  }

  return {
    get enCours() {
      return !!enCours;
    },
    lancer({ declencheur = 'manuel', compte = null, creneau = null } = {}) {
      if (enCours) return { lancee: false, raison: 'en_cours' };
      if (!config.claude.cle) return { lancee: false, raison: 'cle_absente' };
      // Même si l'échec ne peut pas être noté (base indisponible), la promesse ne fait jamais tomber le serveur.
      enCours = executer(declencheur, compte, creneau)
        .catch((e) => {
          journal.error?.('[méta]', e?.message || e);
          return { ok: false, erreur: String(e?.message || e).slice(0, 300) };
        })
        .finally(() => {
          enCours = null;
        });
      return { lancee: true, promesse: enCours };
    },
    // Bouton « Vérifier maintenant » : plafonné par mois (le compteur est écrit à la fin du passage, avant de
    // libérer le verrou : deux clics rapprochés ne passent pas tous les deux).
    async lancerManuel(compte) {
      if (enCours) return { lancee: false, raison: 'en_cours' };
      const doc = await stockage.lire('meta', 'courante');
      const utilise = manuelsDuMois(doc?.couts, maintenant().toISOString().slice(0, 7));
      if (utilise >= PLAFONDS_MANUELS.meta) return { lancee: false, raison: 'plafond', plafond: PLAFONDS_MANUELS.meta };
      return this.lancer({ declencheur: 'manuel', compte });
    },
    // Import manuel : le JSON préparé par Claude dans une conversation, collé par un Responsable ou un coach.
    async importer(texte, compte) {
      if (enCours) throw new Error('Une actualisation est déjà en cours.');
      let brut;
      try {
        brut = typeof texte === 'string' ? extraireJson(texte) : texte;
      } catch {
        throw new Error('Aucun JSON lisible dans le texte collé.');
      }
      return appliquer(brut, { declencheur: 'import', compte });
    },
    async consigneManuelle() {
      const avantDoc = await stockage.lire('meta', 'courante');
      const c = construireConsigne({ def: definition(), meta: avantDoc ? champsMetier(avantDoc) : null, aujourdhui: aujourdhui(config.fuseau) });
      return `${c.systeme}\n\n${c.question}\n\nUtilise la recherche web pour vérifier chaque point.`;
    },
  };
}
