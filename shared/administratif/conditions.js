// Conditions d'utilisation de Lugh, lisibles par un ado, avant même la connexion. Espace privé d'une équipe esport
// associative : accès sur invitation, gratuit, sans publicité. Construites depuis l'identité de la structure (nom, contact).

import { CONTACT_EDITEUR, MISE_A_JOUR_LEGALE } from './mentions-legales.js';

export function texteConditions({ nom = '', contact = '' } = {}) {
  const equipe = nom || 'Lugh';
  const ecrire = `${CONTACT_EDITEUR}${contact && contact !== CONTACT_EDITEUR ? ` (ou ${contact})` : ''}`;
  return [
    { titre: 'À quoi sert Lugh', texte: `Lugh est l’espace privé d’organisation de l’équipe esport ${equipe} : planning, entraînements, matchs, stratégies, progression et vie de l’équipe. Il est édité par Aulit42369 (voir « Mentions légales »). En utilisant Lugh, tu acceptes ces conditions.` },
    { titre: 'Qui peut l’utiliser', liste: [
      `Seulement les membres et le staff de l’équipe ${equipe}. Il n’y a pas d’inscription : ton compte est créé par l’Administrateur général ou le Responsable de ton jeu.`,
      'Tu ne vois que les jeux auxquels tu as accès, avec ce que ton rôle permet (joueur, coach, Responsable…).',
      'Si tu as moins de 15 ans, tes parents doivent être d’accord, avec toi, pour que tu utilises Lugh.',
    ] },
    { titre: 'Ton compte', liste: [
      'Il est personnel : ne le prête pas et ne donne jamais ton mot de passe ni tes codes de secours, même à un membre du staff.',
      'Choisis un mot de passe que tu n’utilises nulle part ailleurs. La double authentification est conseillée, et peut être exigée pour le staff.',
      `Si tu penses que quelqu’un utilise ton compte, préviens tout de suite le Responsable de ton jeu ou écris à ${ecrire}.`,
    ] },
    { titre: 'Les règles de l’équipe', liste: [
      'Respect de tout le monde : pas d’insulte, de harcèlement, de discrimination ni de contenu choquant dans les notes, comptes rendus, avis ou annonces.',
      'Ce qui est dans Lugh reste dans l’équipe : stratégies, compos, notes sur les adversaires, avis sur les candidats et informations sur les membres ne se partagent pas à l’extérieur.',
      'Pas de tentative d’accès à un jeu, un compte ou une page qui ne t’est pas ouvert, ni de tentative de casser ou surcharger le service.',
    ] },
    { titre: 'Ce que tu écris', texte: 'Tes notes, comptes rendus, disponibilités et avis servent à l’équipe. Si ton compte est supprimé, ce que tu as écrit pour l’équipe reste, signé « un ancien compte ». Le staff peut corriger ou retirer un contenu qui ne respecte pas ces règles.' },
    { titre: 'Services liés (facultatifs)', texte: 'Lier ton compte Discord ou ton compte Riot (Stats Valorant) est un choix : tu peux le défaire à tout moment. Ces services gardent leurs propres règles. Lugh n’est ni approuvé ni sponsorisé par les éditeurs des jeux.' },
    { titre: 'Disponibilité', texte: 'Lugh est gratuit, sans publicité, et tourne sur un hébergement gratuit : il peut mettre une minute à se réveiller ou être indisponible un moment. Il est fourni tel quel, sans garantie de disponibilité. Une sauvegarde est faite chaque semaine, mais garde ailleurs ce qui est vraiment important pour toi.' },
    { titre: 'Suspension et départ', texte: 'En cas de non-respect de ces règles ou quand tu quittes l’équipe, l’Administrateur général ou le Responsable de ton jeu peut retirer ton accès, désactiver ou supprimer ton compte. Tu peux aussi supprimer toi-même ton compte (Mon compte → Supprimer mon compte).' },
    { titre: 'Tes données', texte: 'Tout est expliqué dans « Données et confidentialité ».' },
    { titre: 'Changements', texte: 'Ces conditions peuvent évoluer avec Lugh ; la date de mise à jour est indiquée ci-dessous. En cas de changement important, l’équipe te prévient (annonce dans Lugh).' },
    { titre: 'Droit applicable et contact', texte: `Ces conditions relèvent du droit français. Une question ou un désaccord : écris d’abord à ${ecrire}, on cherche une solution à l’amiable.` },
    { titre: 'Mise à jour', texte: MISE_A_JOUR_LEGALE },
  ];
}
