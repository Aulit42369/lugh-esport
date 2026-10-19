// Notifications Discord d'un jeu par webhook. L'adresse du webhook est un secret : stockée dans la base du jeu,
// jamais envoyée aux navigateurs. Aucune mention (@everyone, rôles) n'est jamais déclenchée.

import { texteSemaine, texteScrim, texteMeta, texteMatch, texteAbsence } from '../../shared/discord.js';
import { semaineIso, dateCivile, decalerSemaine, numeroSemaine } from '../../shared/temps.js';
import { EVENEMENTS_DISCORD } from '../../shared/referentiel.js';
import { MARQUE } from '../../shared/marque.js';

export const MOTIF_WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}$/;
const DELAI_PLANNING_MS = 120_000;

export function apercuWebhook(url) {
  return url ? `…${url.slice(-6)}` : '';
}

export function creerNotifications({
  stockage, depot, config, definition, journal = console, fetchImpl = globalThis.fetch, delaiPlanningMs = DELAI_PLANNING_MS,
}) {
  let reglages = null;
  const minuteries = new Map();

  async function lireReglages() {
    if (!reglages) reglages = (await stockage.lire('reglages', 'discord')) || { _id: 'discord', webhook: '', evenements: {} };
    return reglages;
  }

  async function poster(webhook, contenu) {
    const rep = await fetchImpl(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: contenu, username: `${MARQUE.nom} ${definition().court}`.slice(0, 32), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!rep.ok) throw new Error(`Discord a répondu ${rep.status}`);
  }

  async function envoyer(evenement, contenu) {
    const r = await lireReglages();
    if (!r.webhook || r.evenements?.[evenement] === false) return false;
    try {
      await poster(r.webhook, contenu);
      return true;
    } catch (e) {
      journal.error?.('[Discord]', e.message);
      await depot.journaliser(null, 'échec d’une notification Discord', evenement, e.message);
      return false;
    }
  }

  function nomMapDepuis(meta) {
    return (id) => meta?.maps?.find((m) => m.id === id)?.nom || id;
  }

  // Le planning se modifie bloc par bloc : un seul message, deux minutes après la dernière modification.
  function planifierPlanning(id) {
    clearTimeout(minuteries.get(id));
    const t = setTimeout(async () => {
      minuteries.delete(id);
      try {
        const p = await stockage.lire('planning', id);
        if (!p?.blocs?.length) return;
        const meta = await stockage.lire('meta', 'courante');
        await envoyer('planning', texteSemaine({
          def: definition(), titre: `Planning ${definition().nom}, semaine ${numeroSemaine(id)}`, blocs: p.blocs, nomMap: nomMapDepuis(meta), collectifSeulement: true,
        }));
      } catch (e) {
        // Base momentanément indisponible : le message est perdu, le serveur continue.
        journal.error?.('[Discord] planning :', e?.message || e);
      }
    }, delaiPlanningMs);
    t.unref?.();
    minuteries.set(id, t);
  }

  async function surEcriture(coll, doc, avant) {
    const r = await lireReglages();
    if (!r.webhook) return;
    if (coll === 'planning') {
      const courante = semaineIso(dateCivile(new Date(), config.fuseau));
      if (doc._id === courante || doc._id === decalerSemaine(courante, 1)) planifierPlanning(doc._id);
    } else if (coll === 'scrims' && !avant) {
      const meta = await stockage.lire('meta', 'courante');
      await envoyer('scrims', texteScrim(definition(), doc, nomMapDepuis(meta)));
    } else if (coll === 'adversaires' && doc.prochainMatch?.date
      && (doc.prochainMatch.date !== avant?.prochainMatch?.date || doc.prochainMatch.heure !== avant?.prochainMatch?.heure)) {
      await envoyer('matchs', texteMatch(definition(), doc));
    } else if (coll === 'absences' && !avant) {
      const m = await stockage.lire('membres', doc.membreId);
      await envoyer('absences', texteAbsence(doc, m?.pseudo || 'un membre'));
    }
  }

  depot.ecouter(surEcriture);

  return {
    lireReglages,
    async reglagesPublics() {
      const r = await lireReglages();
      return {
        configure: !!r.webhook,
        apercu: apercuWebhook(r.webhook),
        evenements: Object.fromEntries(EVENEMENTS_DISCORD.map((e) => [e.id, r.evenements?.[e.id] !== false])),
      };
    },
    async enregistrer({ webhook, supprimer = false, evenements = {} }) {
      const r = await lireReglages();
      const suivant = { _id: 'discord', webhook: r.webhook || '', evenements: {} };
      if (supprimer) suivant.webhook = '';
      else if (webhook) {
        if (!MOTIF_WEBHOOK.test(webhook)) throw new Error('Adresse de webhook Discord invalide : copie-la depuis Discord → Paramètres du salon → Intégrations → Webhooks.');
        suivant.webhook = webhook;
      }
      for (const e of EVENEMENTS_DISCORD) suivant.evenements[e.id] = evenements[e.id] !== false;
      await stockage.ecrire('reglages', suivant);
      reglages = suivant;
      return this.reglagesPublics();
    },
    async tester(compte) {
      const r = await lireReglages();
      if (!r.webhook) throw new Error('Aucun webhook configuré.');
      await poster(r.webhook, `✅ Test de ${MARQUE.nom} (${definition().nom}) réussi${compte?.nomAffiche ? `, envoyé par ${compte.nomAffiche}` : ''}. Les notifications de ce jeu arriveront dans ce salon.`);
    },
    async meta(meta, ecart) {
      if (ecart && !ecart.vide) await envoyer('meta', texteMeta(definition(), meta, ecart));
    },
    arreter() {
      for (const t of minuteries.values()) clearTimeout(t);
      minuteries.clear();
    },
  };
}
