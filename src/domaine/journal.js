// Journal global : qui a fait quoi, et dans quel jeu (vide pour l'administration générale). Conservé 90 jours.

import { randomUUID } from 'node:crypto';

const RETENTION_JOURNAL_MS = 90 * 24 * 3600 * 1000;

export function creerJournal({ stockage, maintenant = () => new Date() }) {
  return {
    async ecrire(compte, action, cible = '', details = '', jeu = '') {
      const t = maintenant();
      await stockage.ecrire('journal', {
        _id: randomUUID(),
        date: t.toISOString(),
        par: compte?._id || 'systeme',
        action,
        cible: String(cible).slice(0, 120),
        details: String(details).slice(0, 300),
        jeu: jeu || '',
        _expire: new Date(t.getTime() + RETENTION_JOURNAL_MS),
      });
    },

    // Entrées les plus récentes, toutes ou d'un seul jeu.
    async lister({ jeu = null, limite = 300 } = {}) {
      const filtre = jeu === null ? {} : { jeu };
      const entrees = await stockage.lister('journal', filtre, { tri: { date: -1 }, limite });
      return entrees.map(({ _expire, ...e }) => e);
    },
  };
}
