// Mentions légales de Lugh (loi n° 2004-575 du 21 juin 2004, LCEN), lisibles avant même la connexion.
// Éditeur anonyme (personne physique, à titre non professionnel) : son identité est connue de l'hébergeur.

export const CONTACT_EDITEUR = 'aulit42369@gmail.com';
export const MISE_A_JOUR_LEGALE = '28/10/2026';

export function texteMentionsLegales({ nom = '' } = {}) {
  return [
    { titre: 'Le service', texte: `Lugh, l’espace privé d’organisation de l’équipe esport ${nom || 'Lugh'} (accès sur compte uniquement).` },
    { titre: 'Éditeur et directeur de la publication', texte: 'Aulit42369, personne physique éditant ce service à titre non professionnel, qui a choisi de rester anonyme. Ses éléments d’identification ont été communiqués à l’hébergeur, comme le permet la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN).' },
    { titre: 'Contact', texte: `${CONTACT_EDITEUR} (y compris pour tes données personnelles).` },
    { titre: 'Hébergeur', texte: 'Render Services, Inc., 525 Brannan St, Suite 300, San Francisco, CA 94107, États-Unis. Contact : https://render.com/contact' },
    { titre: 'Base de données', texte: 'MongoDB, Inc. (MongoDB Atlas), 1633 Broadway, 38th Floor, New York, NY 10019, États-Unis.' },
    { titre: 'Données personnelles', texte: 'Tout est expliqué dans « Données et confidentialité ».' },
    { titre: 'Jeux cités', texte: 'Les noms, logos et visuels des jeux appartiennent à leurs éditeurs. Lugh n’est ni approuvé ni sponsorisé par eux.' },
    { titre: 'Mise à jour', texte: MISE_A_JOUR_LEGALE },
  ];
}
