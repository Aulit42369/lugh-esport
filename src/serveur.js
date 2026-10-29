// Point d'entrée : lit la configuration, connecte la base, prépare les données de départ, démarre le serveur HTTP.

import { createServer } from 'node:http';
import { lireConfig } from './config.js';
import { creerApp } from './app.js';
import { creerFabriqueMongo } from './stockage/mongo.js';
import { creerFabriqueMemoire } from './stockage/memoire.js';
import { amorcer } from './domaine/amorcage.js';
import { MARQUE } from '../shared/marque.js';

// Filet de sécurité : une promesse rejetée oubliée est journalisée au lieu d'arrêter le serveur.
process.on('unhandledRejection', (e) => console.error('✖ Promesse rejetée non traitée :', e?.message || e));

const config = lireConfig();
if (config.erreurs.length) {
  for (const e of config.erreurs) console.error(`✖ ${e}`);
  process.exit(1);
}
for (const a of config.avertissements) console.warn(`⚠ ${a}`);

const fabrique = config.mode === 'simulation'
  ? creerFabriqueMemoire()
  : creerFabriqueMongo({ uri: config.mongodbUri });

try {
  await fabrique.init();
} catch (e) {
  console.error(`✖ Connexion à MongoDB impossible : ${e.message}`);
  console.error('  Vérifie MONGODB_URI et l’accès réseau 0.0.0.0/0 dans Atlas (Network Access).');
  process.exit(1);
}

const app = await creerApp({ config, fabrique });
await amorcer(app.services);
if (config.mode === 'simulation') {
  const { remplirDemo } = await import('./domaine/demo.js');
  await remplirDemo(app.services);
}

const serveur = createServer((req, res) => {
  app.traiter(req, res);
});
serveur.headersTimeout = 30_000;
serveur.requestTimeout = 60_000;
serveur.listen(config.port, () => {
  console.log(`${MARQUE.nom} prêt sur le port ${config.port} (mode ${config.mode}, stockage ${fabrique.type}, ${app.services.registre.liste().length} jeu(x)).`);
  if (config.mode === 'simulation') console.log(`Ouvre http://localhost:${config.port} — comptes de démonstration dans le README.`);
});

function arreter(signal) {
  console.log(`Arrêt demandé (${signal})…`);
  serveur.close(async () => {
    await app.vider(); // annonces planning en attente envoyées avant la fermeture de la base
    app.arreter();
    await fabrique.fermer();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', () => arreter('SIGTERM'));
process.on('SIGINT', () => arreter('SIGINT'));
