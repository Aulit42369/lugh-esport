// Lecture et contrôle des variables d'environnement : seul endroit où le serveur lit process.env.

// Tarifs de l'API Claude en dollars par million de jetons (vérifiés le 18/10/2026 sur la page Pricing).
export const TARIFS_CLAUDE = {
  'claude-haiku-5-5': { entree: 0.10, sortie: 0.50 },
  'claude-sonnet-5-5': { entree: 2, sortie: 10 },
  'claude-sonnet-5': { entree: 2, sortie: 10 },
  'claude-opus-5-5': { entree: 4, sortie: 20 },
};
export const TARIF_RECHERCHE = 0.01; // 10 $ pour 1 000 recherches web

// Vérifications lancées à la main par mois (bouton) : la méta par jeu, la veille légale pour la structure.
// Les passages automatiques du lundi et du jeudi ne comptent pas.
export const PLAFONDS_MANUELS = { meta: 10, veille: 5 };

export function lireConfig(env = process.env) {
  const mode = env.LUGH_MODE === 'simulation' ? 'simulation' : 'production';
  const erreurs = [];
  const avertissements = [];

  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port <= 0) erreurs.push('PORT invalide.');

  const mongodbUri = (env.MONGODB_URI || '').trim();
  if (mode === 'production' && !mongodbUri) {
    erreurs.push('MONGODB_URI manquant : colle la chaîne de connexion Atlas dans les variables d’environnement Render.');
  }

  // Facultatif : la méta se vérifie déjà à la première visite après le lundi et le jeudi 7 h 45.
  // Ce secret ne sert qu'à un réveil externe (cron-job.org) pour vérifier même sans visite.
  const secretCron = (env.LUGH_SECRET_CRON || '').trim();
  if (secretCron && secretCron.length < 24) erreurs.push('LUGH_SECRET_CRON trop court : 24 caractères minimum.');

  // Facultatif : clé partagée avec le bot Discord de Lugh (Raspberry Pi), dans l'en-tête Authorization.
  const cleBot = (env.LUGH_CLE_BOT || '').trim();
  if (cleBot && cleBot.length < 32) erreurs.push('LUGH_CLE_BOT trop courte : 32 caractères minimum.');

  // Facultatif mais conseillé : chiffre les clés de double authentification dans Atlas (AES-256-GCM).
  // Ne jamais la changer ni la retirer une fois posée : les clés chiffrées deviendraient illisibles.
  const cle2fa = (env.LUGH_CLE_2FA || '').trim().toLowerCase();
  if (cle2fa && !/^[0-9a-f]{64}$/.test(cle2fa)) erreurs.push('LUGH_CLE_2FA invalide : 64 caractères hexadécimaux (openssl rand -hex 32).');
  if (!cle2fa && mode === 'production') {
    avertissements.push('LUGH_CLE_2FA absente : les clés de double authentification sont enregistrées en clair dans Atlas.');
  }

  const cleClaude = (env.ANTHROPIC_API_KEY || '').trim();
  if (!cleClaude && mode === 'production') {
    avertissements.push('ANTHROPIC_API_KEY absente : la méta de chaque jeu se met à jour par import manuel (page Méta).');
  }
  const modele = (env.LUGH_CLAUDE_MODELE || 'claude-sonnet-5-5').trim();
  if (!TARIFS_CLAUDE[modele]) avertissements.push(`Modèle ${modele} inconnu des tarifs : le coût affiché sera approximatif.`);

  // Sur Render, l'adresse publique est fournie automatiquement (RENDER_EXTERNAL_URL).
  let origine = (env.LUGH_ORIGINE || env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');
  if (origine) {
    try {
      origine = new URL(origine).origin;
    } catch {
      erreurs.push('LUGH_ORIGINE invalide : indique l’adresse complète, par exemple https://qg-esport.onrender.com');
    }
  }

  // Dernier recours si l'Administrateur général perd son téléphone et ses codes de secours : l'identifiant d'un compte
  // dont la double authentification est remise à zéro au démarrage. À retirer dès la reconnexion.
  const reinitialiser2fa = (env.LUGH_REINITIALISER_2FA || '').trim().toLowerCase();
  if (reinitialiser2fa) avertissements.push(`LUGH_REINITIALISER_2FA est défini (${reinitialiser2fa}) : retire-le des variables Render maintenant que le compte est débloqué.`);

  // Nombre de proxys de confiance devant Lugh : l'adresse du client est le N-ième élément de X-Forwarded-For en
  // partant de la droite (1 = le dernier, celui qu'ajoute le proxy de Render). À vérifier dans Administration → Service.
  const proxySauts = Number(env.LUGH_PROXY_SAUTS || 1);
  if (!Number.isInteger(proxySauts) || proxySauts < 1 || proxySauts > 5) erreurs.push(`LUGH_PROXY_SAUTS invalide (reçu : « ${String(env.LUGH_PROXY_SAUTS).slice(0, 40)} ») : mets seulement un chiffre de 1 à 5, sans guillemets ni texte (ex. 2).`);

  const surRender = env.RENDER === 'true';
  const simulation = mode === 'simulation';

  // Facultatif : « Valorant · Stats de l'équipe » (API Riot + Riot Sign On). Inactif tant qu'il manque une valeur.
  // LUGH_RIOT_DEMO (simulation seulement) branche le faux serveur Riot de src/riot/faux-riot.js.
  const riotDemo = simulation && env.LUGH_RIOT_DEMO === '1';
  const riot = {
    cle: (env.RIOT_API_KEY || '').trim(),
    clientId: (env.RIOT_RSO_CLIENT_ID || '').trim(),
    clientSecret: (env.RIOT_RSO_CLIENT_SECRET || '').trim(),
    redirectUri: (env.RIOT_RSO_REDIRECT_URI || '').trim(),
    cleChiffrement: (env.LUGH_CLE_RIOT || '').trim().toLowerCase(),
    demo: riotDemo,
  };
  if (riotDemo) {
    Object.assign(riot, { cle: 'RGAPI-demo', clientId: 'lugh-demo', clientSecret: 'demo', redirectUri: '/api/riot/retour', cleChiffrement: 'a'.repeat(64) });
  }
  const riotRemplies = ['cle', 'clientId', 'clientSecret', 'redirectUri', 'cleChiffrement'].filter((k) => riot[k]);
  if (riot.cleChiffrement && !/^[0-9a-f]{64}$/.test(riot.cleChiffrement)) erreurs.push('LUGH_CLE_RIOT invalide : 64 caractères hexadécimaux (openssl rand -hex 32).');
  if (riot.redirectUri && !riotDemo && !/^https:\/\/[^/]+\/api\/riot\/retour$/.test(riot.redirectUri)) erreurs.push('RIOT_RSO_REDIRECT_URI invalide : https://<ton-site>/api/riot/retour');
  if (riotRemplies.length && riotRemplies.length < 5) avertissements.push('Stats Valorant (Riot) inactives : il manque une des variables RIOT_API_KEY, RIOT_RSO_CLIENT_ID, RIOT_RSO_CLIENT_SECRET, RIOT_RSO_REDIRECT_URI, LUGH_CLE_RIOT.');
  riot.actif = riotRemplies.length === 5 && !erreurs.some((e) => /RIOT/.test(e));
  return {
    mode,
    port,
    mongodbUri,
    base: (env.LUGH_BASE || 'lugh').trim(),
    admin: {
      identifiant: (env.LUGH_ADMIN_ID || (simulation ? 'admin' : '')).trim().toLowerCase(),
      mdp: env.LUGH_ADMIN_MDP || (simulation ? 'simulation-lugh-2026' : ''),
    },
    secretCron,
    cleBot,
    cle2fa,
    reinitialiser2fa,
    riot,
    claude: {
      cle: cleClaude,
      modele,
      maxRecherches: Number(env.LUGH_MAX_RECHERCHES || 8),
    },
    origine,
    derriereProxy: surRender || env.LUGH_PROXY === '1',
    proxySauts,
    cookieSecurise: surRender || origine.startsWith('https://'),
    hsts: surRender,
    fuseau: 'Europe/Paris',
    version: '2.8.0',
    erreurs,
    avertissements,
  };
}
