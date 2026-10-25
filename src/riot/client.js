// Client de l'API Riot (VALORANT, Europe) : limites de débit locales, respect des 429 (Retry-After), erreurs typées.
// La clé RIOT_API_KEY voyage seulement dans l'en-tête X-Riot-Token, jamais dans une URL.

// Source unique des adresses Riot (shard VALORANT « eu », région de compte « europe », Riot Sign On).
export const RIOT = {
  val: 'https://eu.api.riotgames.com',
  compte: 'https://europe.api.riotgames.com',
  auth: 'https://auth.riotgames.com',
};

// shortcut: limites d'une clé de développement (20 / s, 100 / 2 min) ; à relever avec celles de la clé de production.
export const LIMITES_DEFAUT = [{ n: 20, ms: 1000 }, { n: 100, ms: 120_000 }];
const ESSAIS_429 = 3;

export class ErreurRiot extends Error {
  constructor(statut, message, attente = 0) {
    super(message);
    this.statut = statut;
    this.attente = attente;
  }
}

const dormir = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

// Fenêtres glissantes : chaque appel attend qu'une place se libère dans toutes les fenêtres (et la fin d'un 429).
export function creerLimiteur({ limites = LIMITES_DEFAUT, maintenant = Date.now, attendre = dormir } = {}) {
  const passages = [];
  let pauseJusqua = 0;
  let file = Promise.resolve();
  async function place() {
    for (;;) {
      const t = maintenant();
      if (pauseJusqua > t) {
        if (pauseJusqua - t > 10_000) throw new ErreurRiot(429, 'Riot limite les requêtes : réessaie dans un instant.', pauseJusqua - t);
        await attendre(pauseJusqua - t);
        continue;
      }
      const plusLongue = Math.max(...limites.map((l) => l.ms));
      while (passages.length && passages[0] <= t - plusLongue) passages.shift();
      let attente = 0;
      for (const { n, ms } of limites) {
        const recents = passages.filter((p) => p > t - ms);
        if (recents.length >= n) attente = Math.max(attente, recents[recents.length - n] + ms - t);
      }
      if (!attente) {
        passages.push(t);
        return;
      }
      await attendre(attente);
    }
  }
  return {
    // Les appels passent un par un dans la file : l'ordre est gardé et aucune rafale ne dépasse la limite.
    prendre() {
      const tour = file.then(place);
      file = tour.catch(() => {});
      return tour;
    },
    pause(ms) {
      pauseJusqua = Math.max(pauseJusqua, maintenant() + ms);
    },
  };
}

export function creerClientRiot({ cle, fetchImpl = fetch, limiteur = creerLimiteur() }) {
  async function appeler(url, { jeton = '' } = {}) {
    for (let essai = 0; ; essai += 1) {
      await limiteur.prendre();
      let rep;
      try {
        rep = await fetchImpl(url, { headers: jeton ? { Authorization: `Bearer ${jeton}` } : { 'X-Riot-Token': cle } });
      } catch {
        throw new ErreurRiot(503, 'Serveurs Riot injoignables.');
      }
      if (rep.status === 429) {
        const attente = Math.max(1, Number(rep.headers?.get?.('retry-after')) || 1) * 1000;
        limiteur.pause(attente);
        // Longue attente : on rend la main (la page ne reste pas bloquée), la pause vaut pour les appels suivants.
        if (essai + 1 >= ESSAIS_429 || attente > 10_000) throw new ErreurRiot(429, 'Riot limite les requêtes : réessaie dans un instant.', attente);
        continue; // le limiteur applique la pause au prochain passage
      }
      if (rep.status === 404) return null;
      if (rep.status === 401 || rep.status === 403) throw new ErreurRiot(rep.status, 'Accès refusé par Riot (clé ou jeton).');
      if (!rep.ok) throw new ErreurRiot(503, `Riot a répondu ${rep.status}.`);
      return rep.json();
    }
  }
  const id = (x) => encodeURIComponent(x);
  return {
    appeler,
    // Après Riot Sign On : le compte de la personne connectée, avec SON jeton d'accès (jamais la clé API).
    compteConnecte: (jetonAcces) => appeler(`${RIOT.compte}/riot/account/v1/accounts/me`, { jeton: jetonAcces }),
    historique: (puuid) => appeler(`${RIOT.val}/val/match/v1/matchlists/by-puuid/${id(puuid)}`),
    partie: (matchId) => appeler(`${RIOT.val}/val/match/v1/matches/${id(matchId)}`),
    contenu: () => appeler(`${RIOT.val}/val/content/v1/contents?locale=fr-FR`),
  };
}
