// Sessions : jeton aléatoire dans un cookie HttpOnly ; seule son empreinte SHA-256 est stockée en base.

import { randomBytes, createHash } from 'node:crypto';

export const NOM_COOKIE = 'lugh_session';
export const DUREE_SESSION_MS = 30 * 24 * 3600 * 1000;
const PROLONGER_SOUS_MS = 15 * 24 * 3600 * 1000;

function empreinte(jeton) {
  return createHash('sha256').update(String(jeton)).digest('hex');
}

export function creerSessions({ stockage, maintenant = () => new Date() }) {
  return {
    async creer(compteId, agent = '') {
      const jeton = randomBytes(32).toString('base64url');
      const t = maintenant();
      await stockage.ecrire('sessions', {
        _id: empreinte(jeton),
        compteId,
        creeLe: t.toISOString(),
        agent: String(agent).slice(0, 160),
        _expire: new Date(t.getTime() + DUREE_SESSION_MS),
      });
      return jeton;
    },

    async lire(jeton) {
      if (!jeton || typeof jeton !== 'string' || jeton.length > 100) return null;
      const session = await stockage.lire('sessions', empreinte(jeton));
      if (!session) return null;
      const t = maintenant();
      const expire = new Date(session._expire);
      if (expire <= t) {
        await stockage.supprimer('sessions', session._id);
        return null;
      }
      if (expire.getTime() - t.getTime() < PROLONGER_SOUS_MS) {
        session._expire = new Date(t.getTime() + DUREE_SESSION_MS);
        await stockage.ecrire('sessions', session);
      }
      return session;
    },

    async supprimer(jeton) {
      if (jeton) await stockage.supprimer('sessions', empreinte(jeton));
    },

    // Déconnecte un compte partout, sauf éventuellement la session en cours.
    async supprimerPourCompte(compteId, saufJeton = null) {
      const garder = saufJeton ? empreinte(saufJeton) : null;
      const sessions = await stockage.lister('sessions', { compteId });
      for (const s of sessions) if (s._id !== garder) await stockage.supprimer('sessions', s._id);
    },
  };
}
