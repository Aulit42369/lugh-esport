// Riot Sign On (OAuth 2.0, code d'autorisation) : adresse d'autorisation, échange du code, rafraîchissement, révocation.
// Le secret client voyage seulement dans l'en-tête Authorization (Basic), les codes et jetons dans le corps du POST.

import { RIOT, ErreurRiot } from './client.js';

// Demo : l'autorisation passe par une page locale qui imite Riot (simulation seulement, jamais en production).
export const AUTORISATION_DEMO = '/api/riot/demo/autoriser';

export function creerRso({ config, fetchImpl = fetch, maintenant = () => new Date() }) {
  const { clientId, clientSecret, redirectUri, demo } = config;
  const basic = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

  async function poster(chemin, champs) {
    let rep;
    try {
      rep = await fetchImpl(`${RIOT.auth}${chemin}`, {
        method: 'POST',
        headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(champs).toString(),
      });
    } catch {
      throw new ErreurRiot(503, 'Riot Sign On injoignable.');
    }
    if (rep.status === 400 || rep.status === 401) throw new ErreurRiot(401, 'Autorisation Riot refusée ou retirée.');
    if (!rep.ok) throw new ErreurRiot(503, `Riot Sign On a répondu ${rep.status}.`);
    return rep.json();
  }

  // Jetons tels qu'on les garde (chiffrés ensuite par l'appelant) : l'heure d'expiration plutôt que la durée.
  const garder = (j, ancien = {}) => ({
    acces: j.access_token,
    rafraichissement: j.refresh_token || ancien.rafraichissement || '',
    expire: new Date(maintenant().getTime() + (Number(j.expires_in) || 3600) * 1000).toISOString(),
  });

  return {
    // state : aléatoire, lié à la session côté serveur (protection contre la falsification de requête).
    adresseAutorisation(state) {
      const p = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid offline_access', state });
      return `${demo ? AUTORISATION_DEMO : `${RIOT.auth}/authorize`}?${p}`;
    },
    async echangerCode(code) {
      return garder(await poster('/token', { grant_type: 'authorization_code', code, redirect_uri: redirectUri }));
    },
    async rafraichir(jetons) {
      if (!jetons.rafraichissement) throw new ErreurRiot(401, 'Autorisation Riot expirée.');
      return garder(await poster('/token', { grant_type: 'refresh_token', refresh_token: jetons.rafraichissement }), jetons);
    },
    // Au mieux : la liaison est supprimée chez nous même si Riot ne répond pas.
    // shortcut: adresse de révocation à confirmer dans la documentation RSO reçue avec la clé de production.
    async revoquer(jetons) {
      try {
        if (jetons?.rafraichissement) await poster('/token/revoke', { token: jetons.rafraichissement, token_type_hint: 'refresh_token' });
        return true;
      } catch {
        return false;
      }
    },
  };
}
