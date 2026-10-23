// Sauvegarde des données de la structure (hors jeux) : liste des jeux, comptes (sans aucun secret), annonces, identité,
// suivi des obligations, veille légale, livres des comptes de l'association et de la société (réglages et écritures)
// et autorisations des mineurs. Même rôle que l'export d'un jeu : copie hors de Render et d'Atlas, téléchargée par
// l'Administrateur général ou rangée chaque semaine sur le Pi par le bot (« _structure »). Relue par la reprise
// après sinistre (reprise-structure.js).
// Aucun secret dedans : ni mot de passe haché, ni session, ni double authentification, ni code Discord, ni clé, ni webhook.

import { MARQUE } from '../../shared/marque.js';
import { profilCompte } from '../auth/acces.js';

export const ID_SAUVEGARDE_STRUCTURE = '_structure';
export const FORMAT_STRUCTURE = { format: `${MARQUE.id}-structure`, version: 2 };
// Version 1 : sans jeux, comptes ni annonces ; toujours lisible par la reprise.
export const VERSIONS_LISIBLES = [1, 2];
export const PARAMETRES = ['structure-identite', 'structure-suivi', 'structure-comptes', 'structure-comptes-societe', 'structure-veille'];

export async function sauvegardeStructure(s) {
  const parametres = {};
  for (const id of PARAMETRES) {
    const doc = await s.global.lire('parametres', id);
    if (doc) parametres[id] = doc;
  }
  return {
    ...FORMAT_STRUCTURE,
    exporteLe: s.maintenant().toISOString(),
    jeux: (await s.global.lister('espaces')).map(({ _id, modele, nom, court, couleur, actif, ordre }) => ({
      _id, modele, nom, court, couleur: couleur || '', actif: actif !== false, ordre: ordre ?? null,
    })),
    // Liste blanche : rien d'autre ne sort de la fiche d'un compte.
    comptes: (await s.global.lister('comptes', {}, { tri: { creeLe: 1 } })).map((c) => {
      const { _id, identifiant, nomAffiche, admin, tresorier, actif, acces } = profilCompte(c);
      return { _id, identifiant, nomAffiche, admin, tresorier, actif, acces };
    }),
    annonces: (await s.global.lister('annonces')).map(({ _id, titre, texte, jeux, importante, expireLe, creeLe, par }) => ({
      _id, titre, texte, jeux: jeux || [], importante: !!importante, expireLe: expireLe || '', creeLe, par,
    })),
    parametres,
    ecritures: await s.global.lister('ecritures', {}, { tri: { date: 1, creeLe: 1 } }),
    autorisations: await s.global.lister('autorisations'),
  };
}
