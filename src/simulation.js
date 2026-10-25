// Lance l’appli en mode simulation : base en mémoire et données de démonstration, sans Atlas ni clé API.
process.env.LUGH_MODE = 'simulation';
process.env.LUGH_RIOT_DEMO ??= '1'; // Stats Valorant avec le faux serveur Riot (aucun appel réel)
await import('./serveur.js');
