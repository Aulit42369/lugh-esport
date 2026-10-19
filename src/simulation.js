// Lance l’appli en mode simulation : base en mémoire et données de démonstration, sans Atlas ni clé API.
process.env.LUGH_MODE = 'simulation';
await import('./serveur.js');
