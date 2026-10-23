// Routes de la méta : vérification à la demande dans un jeu, déclenchement externe facultatif, santé du service.
// La vérification du lundi et du jeudi n'a besoin d'aucun cron : voir src/domaine/automatismes.js.

import { envoyerJson, erreurs } from '../http/outils.js';
import { egalTempsConstant } from '../http/securite.js';
import { exigerConnexion, exigerEspace, exigerPerm } from '../auth/acces.js';

export function routesMeta(routeur, s) {
  routeur.get('/api/sante', async (r) => {
    envoyerJson(r.res, 200, { ok: true });
  });

  routeur.post('/api/e/:jeu/meta/actualiser', exigerConnexion(s), exigerEspace(s), exigerPerm('meta.actualiser'), async (r) => {
    const resultat = r.espace.actualisation.lancer({ declencheur: 'manuel', compte: r.compte });
    if (!resultat.lancee) {
      if (resultat.raison === 'en_cours') throw erreurs.conflit('Une actualisation est déjà en cours.');
      throw erreurs.indisponible('Clé API Claude absente : ajoute ANTHROPIC_API_KEY dans les variables Render.');
    }
    envoyerJson(r.res, 202, { lancee: true });
  });

  // Facultatif (LUGH_SECRET_CRON) : force une vérification de tous les jeux actifs depuis un service externe. Le secret
  // voyage dans l'en-tête Authorization, jamais dans l'URL. Réponse immédiate ; les vérifications s'enchaînent ensuite.
  routeur.post('/api/cron/meta', async (r) => {
    if (!s.config.secretCron) throw erreurs.indisponible('Actualisation automatique non configurée (LUGH_SECRET_CRON).');
    const recu = String(r.req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!recu || !egalTempsConstant(recu, s.config.secretCron)) throw erreurs.interdit('Secret invalide.');
    if (!s.config.claude.cle) return envoyerJson(r.res, 202, { lancee: false, raison: 'cle_absente' });
    const jeux = s.registre.liste().filter((d) => d.actif !== false).map((d) => s.registre.obtenir(d._id)).filter((e) => e.def.meta.auto);
    (async () => {
      for (const e of jeux) {
        const resultat = e.actualisation.lancer({ declencheur: 'cron' });
        if (resultat.lancee) await resultat.promesse;
      }
    })().catch((e) => s.journal.error?.('[cron méta]', e?.message || e));
    envoyerJson(r.res, 202, { lancee: jeux.length > 0, jeux: jeux.map((e) => e.id) });
  });
}
