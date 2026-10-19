// Sauvegarde des données de la structure (hors jeux) : identité, suivi des obligations, veille légale, livres des
// comptes de l'association et de la société (réglages et écritures) et autorisations des mineurs. Même rôle que
// l'export d'un jeu : copie hors de Render et d'Atlas, téléchargée par l'Administrateur général ou rangée chaque semaine sur le Pi par le bot (« _structure »).
// Aucun secret dedans : ni mot de passe, ni clé, ni webhook.

import { MARQUE } from '../../shared/marque.js';

export const ID_SAUVEGARDE_STRUCTURE = '_structure';
export const FORMAT_STRUCTURE = { format: `${MARQUE.id}-structure`, version: 1 };
const PARAMETRES = ['structure-identite', 'structure-suivi', 'structure-comptes', 'structure-comptes-societe', 'structure-veille'];

export async function sauvegardeStructure(s) {
  const parametres = {};
  for (const id of PARAMETRES) {
    const doc = await s.global.lire('parametres', id);
    if (doc) parametres[id] = doc;
  }
  return {
    ...FORMAT_STRUCTURE,
    exporteLe: s.maintenant().toISOString(),
    parametres,
    ecritures: await s.global.lister('ecritures', {}, { tri: { date: 1, creeLe: 1 } }),
    autorisations: await s.global.lister('autorisations'),
  };
}
