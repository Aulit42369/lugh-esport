// Assemble le serveur : sécurité, routes de l'API, fichiers statiques, services partagés et espaces de jeu.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { creerRouteur } from './http/routeur.js';
import { envoyerErreur, erreurs, ErreurHttp, ipClient, lireCorpsJson } from './http/outils.js';
import { poserEntetesSecurite, controlerEcriture, creerLimiteurDebit } from './http/securite.js';
import { creerStatique } from './http/statique.js';
import { creerSessions } from './auth/sessions.js';
import { creerLimiteurConnexion } from './auth/limiteur.js';
import { creerJournal } from './domaine/journal.js';
import { creerRegistre } from './espaces/registre.js';
import { routesAuth } from './routes/auth.js';
import { routesAdmin } from './routes/admin.js';
import { routesComptes } from './routes/comptes.js';
import { routesDonnees } from './routes/donnees.js';
import { routesMeta } from './routes/meta.js';
import { routesPerso } from './routes/perso.js';
import { routesReglages } from './routes/reglages.js';
import { routesDeuxFacteurs } from './routes/deuxfacteurs.js';
import { routesAnnonces } from './routes/annonces.js';
import { routesOrganisation } from './routes/organisation.js';
import { routesStructure } from './routes/structure.js';
import { routesBot } from './routes/bot.js';
import { routesDiscord } from './routes/discord.js';
import { routesAdministratif, lireIdentite } from './routes/administratif.js';
import { contexteStructure } from '../shared/administratif/identite.js';
import { routesTresorerie } from './routes/tresorerie.js';
import { routesRiot } from './routes/riot.js';
import { creerServiceRiot } from './riot/service.js';
import { creerVeille } from './domaine/veille.js';
import { creerParametres } from './domaine/parametres.js';
import { reinitialiserAuDemarrage, convertirClesAuDemarrage } from './auth/deuxfacteurs.js';
import { creerCoffre } from './auth/chiffrement.js';
import { creerAnnoncesDiscord } from './notifications/annonces.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function creerApp({
  config, fabrique, maintenant = () => new Date(), interrogerClaude = null, fetchDiscord = null, fetchRiot = null, journal = console, automatismes = true,
  delaiPlanningMs = undefined,
}) {
  const global = fabrique.base(config.base);
  await global.preparer('global');
  const historique = creerJournal({ stockage: global, maintenant });
  // Dernier recours (accès Render requis) : remet à zéro la double authentification d'un compte au démarrage
  // (appelé à chaque démarrage : variable retirée, la note d'usage unique est effacée).
  await reinitialiserAuDemarrage({ global, historique, identifiant: config.reinitialiser2fa, journal });
  // Clés de double authentification : chiffrement des anciennes clés en clair, alerte si des clés sont illisibles.
  const coffre2fa = creerCoffre(config.cle2fa);
  const illisibles = await convertirClesAuDemarrage({ global, coffre: coffre2fa });
  if (illisibles) {
    config.avertissements.push(`${illisibles} clé(s) de double authentification illisible(s) : LUGH_CLE_2FA est absente ou n’est plus la même. Remets la valeur d’origine dans Render (sinon ces comptes ne peuvent plus se connecter).`);
  }
  const registre = creerRegistre({
    fabrique, global, config, historique, maintenant, journal, interrogerClaude, fetchDiscord, delaiPlanningMs, automatismes,
  });
  await registre.initialiser();

  const services = {
    config,
    fabrique,
    global,
    historique,
    registre,
    maintenant,
    journal,
    coffre2fa,
    sessions: creerSessions({ stockage: global, maintenant }),
    parametres: creerParametres({ global, maintenant }),
    annoncesDiscord: creerAnnoncesDiscord({ global, ...(fetchDiscord ? { fetchImpl: fetchDiscord } : {}) }),
    riot: creerServiceRiot({ config, global, maintenant, journal, fetchImpl: fetchRiot }),
    limiteurConnexion: creerLimiteurConnexion({ maintenant: () => maintenant().getTime() }),
    veille: creerVeille({
      global, config, maintenant, journal,
      contexte: async () => contexteStructure(await lireIdentite(global)),
      ...(interrogerClaude ? { interroger: interrogerClaude } : {}),
    }),
  };

  const limiteurDebit = creerLimiteurDebit({ max: 300, maintenant: () => maintenant().getTime() });
  const routeur = creerRouteur();
  routesAuth(routeur, services);
  routesAdmin(routeur, services);
  routesComptes(routeur, services);
  routesDonnees(routeur, services);
  routesMeta(routeur, services);
  routesPerso(routeur, services);
  routesReglages(routeur, services);
  routesDeuxFacteurs(routeur, services);
  routesAnnonces(routeur, services);
  routesOrganisation(routeur, services);
  routesStructure(routeur, services);
  routesBot(routeur, services);
  routesDiscord(routeur, services);
  routesAdministratif(routeur, services);
  routesTresorerie(routeur, services);
  routesRiot(routeur, services);

  const servirStatique = creerStatique([
    { prefixe: '/shared/', dossier: join(RACINE, 'shared') },
    { prefixe: '/', dossier: join(RACINE, 'public') },
  ]);

  async function traiter(req, res) {
    poserEntetesSecurite(res, config);
    let url;
    try {
      url = new URL(req.url, 'http://appli.local');
    } catch {
      url = new URL('/', 'http://appli.local');
    }
    const chemin = url.pathname;
    try {
      if (chemin.startsWith('/api/')) {
        const ip = ipClient(req, config.derriereProxy, config.proxySauts);
        if (!limiteurDebit.autoriser(ip)) throw erreurs.tropDeRequetes();
        // Le cron et le bot s'authentifient par une clé dans l'en-tête Authorization, sans cookie : pas d'en-tête X-Lugh.
        if (!chemin.startsWith('/api/cron/') && !chemin.startsWith('/api/bot/')) controlerEcriture(req, config);
        const trouve = routeur.trouver(req.method, chemin);
        if (!trouve) throw erreurs.introuvable('Adresse inconnue.');
        let corps;
        const r = {
          req,
          res,
          params: trouve.params,
          query: url.searchParams,
          ip,
          compte: null,
          compteGlobal: null,
          espace: null,
          jeton: null,
          corps: async (limite) => {
            if (corps === undefined) corps = await lireCorpsJson(req, limite);
            return corps;
          },
        };
        for (const etape of trouve.etapes) await etape(r);
        if (!res.headersSent) throw new Error(`Route sans réponse : ${req.method} ${chemin}`);
        return;
      }
      if (await servirStatique(req, res, chemin)) return;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Page introuvable.');
    } catch (err) {
      if (err instanceof ErreurHttp) return envoyerErreur(res, err);
      if (err?.sature) return envoyerErreur(res, erreurs.tropDeRequetes('Serveur très sollicité : réessaie dans un instant.'));
      if (String(err?.name || '').startsWith('Mongo')) {
        journal.error('[base] indisponible :', err.message);
        return envoyerErreur(res, erreurs.indisponible('Base de données momentanément indisponible. Réessaie dans un instant.'));
      }
      journal.error('[erreur interne]', err);
      return envoyerErreur(res, err);
    }
  }

  // En mémoire seulement : MongoDB efface seul les sessions, le journal et les traces expirés (index TTL).
  const purge = setInterval(() => {
    const t = maintenant();
    global.purgerExpires(t).catch(() => {});
    for (const doc of registre.liste()) registre.obtenir(doc._id)?.stockage.purgerExpires(t).catch(() => {});
  }, 3_600_000);
  purge.unref?.();

  return {
    traiter,
    services,
    vider: () => registre.vider(),
    arreter() {
      clearInterval(purge);
      limiteurDebit.arreter();
      services.limiteurConnexion.arreter();
      registre.arreter();
    },
  };
}
