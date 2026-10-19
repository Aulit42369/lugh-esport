// Annonces de la structure reprises sur Discord, dans le salon #annonces du serveur, par un webhook propre à la
// structure (document « discord-annonces » de parametres). L'adresse est un secret : jamais renvoyée au navigateur
// (seulement ses 6 derniers caractères). Une annonce importante mentionne @everyone ; les autres ne mentionnent personne.

import { MOTIF_WEBHOOK, apercuWebhook } from './discord.js';
import { MARQUE } from '../../shared/marque.js';

const ID = 'discord-annonces';

export function texteAnnonce({ titre, texte, importante = false, jeux = [] }) {
  const pour = jeux.length ? `\n\n_Pour : ${jeux.join(', ')}_` : '';
  const tete = importante ? '@everyone 📢 ' : '📢 ';
  return `${tete}**${titre}**\n\n${texte}${pour}`.slice(0, 2000);
}

export function creerAnnoncesDiscord({ global, fetchImpl = globalThis.fetch }) {
  const lire = async () => (await global.lire('parametres', ID))?.webhook || '';

  async function poster(webhook, contenu, { everyone = false } = {}) {
    const rep = await fetchImpl(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: contenu, username: MARQUE.nom, allowed_mentions: { parse: everyone ? ['everyone'] : [] } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!rep.ok) throw new Error(`Discord a répondu ${rep.status}`);
  }

  return {
    async etat() {
      const w = await lire();
      return { configure: !!w, apercu: apercuWebhook(w) };
    },
    async enregistrer({ webhook = '', supprimer = false }) {
      if (!supprimer && !MOTIF_WEBHOOK.test(webhook)) {
        throw new Error('Adresse de webhook Discord invalide : celle affichée par l’installateur pour les annonces.');
      }
      await global.ecrire('parametres', { _id: ID, webhook: supprimer ? '' : webhook });
      return this.etat();
    },
    async tester(compte) {
      const w = await lire();
      if (!w) throw new Error('Aucun webhook d’annonces configuré.');
      await poster(w, `✅ Test de ${MARQUE.nom} réussi${compte?.nomAffiche ? `, envoyé par ${compte.nomAffiche}` : ''} : les annonces de la structure arriveront dans ce salon.`);
    },
    // Rend « envoyee », « echec » ou « non » (pas de webhook) ; ne lève jamais : l'annonce existe dans Lugh quoi qu'il arrive.
    async publier(annonce, nomsJeux = []) {
      const w = await lire();
      if (!w) return 'non';
      try {
        await poster(w, texteAnnonce({ ...annonce, jeux: nomsJeux }), { everyone: !!annonce.importante });
        return 'envoyee';
      } catch {
        return 'echec';
      }
    },
  };
}
