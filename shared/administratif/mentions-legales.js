// Mentions légales de Lugh (loi n° 2004-575 du 21 juin 2004, LCEN), lisibles avant même la connexion.
// Éditeur anonyme (personne physique, à titre non professionnel) : son identité est connue de l'hébergeur.

export const CONTACT_EDITEUR = 'aulit42369@gmail.com';
export const MISE_A_JOUR_LEGALE = '05/11/2026';

export function texteMentionsLegales({ nom = '' } = {}) {
  return [
    { titre: 'Le service', texte: `Lugh, l’espace privé d’organisation de l’équipe esport ${nom || 'Lugh'} (accès sur compte uniquement).` },
    { titre: 'Éditeur et directeur de la publication', texte: 'Aulit42369, personne physique éditant ce service à titre non professionnel, qui a choisi de rester anonyme. Ses éléments d’identification ont été communiqués à l’hébergeur, comme le permet la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN).' },
    { titre: 'Contact', texte: `${CONTACT_EDITEUR} (y compris pour tes données personnelles).` },
    { titre: 'Hébergeur', texte: 'OVH SAS, 2 rue Kellermann, 59100 Roubaix, France. Téléphone : 1007. https://www.ovhcloud.com (serveur de l’éditeur situé à Beauharnois, Canada), adresse https://lugh.aulit42369.fr.' },
    { titre: 'Base de données', texte: 'Sur ce même serveur (MongoDB installé par l’éditeur) : aucun prestataire de base de données.' },
    { titre: 'Ancienne adresse', texte: 'https://lugh-esport.onrender.com renvoie automatiquement vers https://lugh.aulit42369.fr (Render Services, Inc., États-Unis, ne fait plus que ce renvoi, sans base de données).' },
    { titre: 'Données personnelles', texte: 'Tout est expliqué dans « Données et confidentialité ».' },
    { titre: 'Jeux cités', texte: 'Les noms, logos et visuels des jeux appartiennent à leurs éditeurs. Lugh n’est ni approuvé ni sponsorisé par eux.' },
    { titre: 'Mise à jour', texte: MISE_A_JOUR_LEGALE },
  ];
}
