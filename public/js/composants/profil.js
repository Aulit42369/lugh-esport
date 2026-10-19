// Liens externes d'un joueur : profil public du jeu (tracker.gg, op.gg, Leetify… selon le jeu) et chaîne Twitch.
// Ouverts dans un nouvel onglet ; aucune donnée n'est lue sur ces sites.

import { lienExterne } from '../ui.js';
import * as J from '../jeu.js';
import { lienTwitch as urlTwitch } from '/shared/validation.js';

export function lienProfil(idJeu, libelle = null) {
  const url = J.lienProfil(idJeu);
  return url ? lienExterne(url, libelle || J.def()?.profil?.site || 'profil', { classe: 'petit lien-tracker' }) : null;
}

export function lienTwitch(chaine) {
  const url = urlTwitch(chaine);
  return url ? lienExterne(url, `twitch.tv/${chaine}`, { classe: 'petit lien-tracker' }) : null;
}

// Libellé du champ « identifiant en jeu » : le site de profil dit quoi saisir (Riot ID, SteamID64, pseudo Epic…).
export function aideIdentifiant() {
  return J.def()?.profil?.aide || 'Identifiant ou pseudo en jeu (facultatif).';
}
