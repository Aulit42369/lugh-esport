// Forme des comptes : un compte par personne, des accès par jeu (métiers et membre lié dans ce jeu).

import { texte, booleen, identifiant, tableau, objet, dictionnaire, MOTIFS } from './validation.js';

const membre = () => identifiant(MOTIFS.membre);
const metiers = (min) => tableau(texte({ max: 20, requis: true }), { min, max: 8 });

// Accès à un jeu. Sans métier, l'entrée ne donne aucun accès (sauf à l'Administrateur général, Responsable partout)
// mais garde le membre lié : c'est le cas d'un Administrateur général qui est aussi joueur ou coach dans un jeu.
export const accesJeu = objet({
  metiers: metiers(0),
  membreId: membre(),
});

const base = {
  identifiant: texte({ max: 24, requis: true, motif: MOTIFS.identifiantConnexion, message: '3 à 24 caractères : minuscules, chiffres, point, tiret' }),
  nomAffiche: texte({ max: 32, requis: true }),
};

// Création par l'Administrateur général : accès à plusieurs jeux possible.
export const creationCompte = objet({
  ...base,
  admin: booleen(),
  acces: dictionnaire(MOTIFS.jeu, accesJeu, { max: 15 }),
});

// Création par un Responsable : accès à son jeu seulement.
// nomAffiche n'est exigé que pour un nouveau compte (contrôlé par la route), pas pour donner l'accès à un compte existant.
export const creationCompteJeu = objet({
  identifiant: base.identifiant,
  nomAffiche: texte({ max: 32 }),
  metiers: metiers(1),
  membreId: membre(),
});

// Modification par l'Administrateur général.
export const modificationCompte = objet({
  nomAffiche: texte({ max: 32, requis: true }),
  actif: booleen({ defaut: true }),
  admin: booleen(),
  acces: dictionnaire(MOTIFS.jeu, accesJeu, { max: 15 }),
});

// Modification par un Responsable : accès à son jeu ; nom et activation seulement si le compte ne sort pas de ses jeux.
export const modificationCompteJeu = objet({
  metiers: metiers(1),
  membreId: membre(),
  nomAffiche: texte({ max: 32 }),
  actif: booleen({ defaut: true }),
});
