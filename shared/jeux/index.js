// Catalogue des modèles de jeu, dans l'ordre proposé à l'Administrateur général.
// Chargé par le serveur uniquement : le navigateur reçoit la définition effective de son jeu, jamais tout le catalogue.
// Ajouter un jeu = écrire son modèle (voir valorant.js), l'importer ici, puis lancer npm test (modeles.test.js).

import valorant from './valorant.js';
import cs2 from './cs2.js';
import lol from './lol.js';
import r6 from './r6.js';
import ow2 from './ow2.js';
import rl from './rl.js';
import fc from './fc.js';
import apex from './apex.js';
import fortnite from './fortnite.js';
import autre from './autre.js';

const LISTE = [valorant, cs2, lol, r6, ow2, rl, fc, apex, fortnite, autre];

export const MODELES = Object.fromEntries(LISTE.map((m) => [m.id, m]));
export const ORDRE = LISTE.map((m) => m.id);
export const ID_AUTRE = 'autre';

export function modele(id) {
  return Object.hasOwn(MODELES, id) ? MODELES[id] : null;
}

// Résumé affichable d'un modèle (liste « Ajouter un jeu »).
export function resumeModele(m) {
  return {
    id: m.id,
    nom: m.nom,
    court: m.court || m.nom,
    editeur: m.editeur || '',
    genre: m.genre || 'autre',
    titulaires: m.equipe?.titulaires || 5,
    patch: m.initiale?.patch || '',
  };
}
