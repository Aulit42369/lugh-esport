// Page « Données et confidentialité » de Lugh, lisible par un ado, avant même la connexion. Construite depuis
// l'identité de la structure (nom, contact) ; le reste décrit ce que Lugh fait réellement de ses données.

import { CONTACT_EDITEUR, MISE_A_JOUR_LEGALE } from './mentions-legales.js';

export function texteConfidentialite({ nom = '', contact = '' } = {}) {
  const ecrire = `${CONTACT_EDITEUR}${contact && contact !== CONTACT_EDITEUR ? ` (ou ${contact})` : ''}`;
  return [
    { titre: 'Qui s’occupe de tes données ?', texte: `Le responsable du traitement est Aulit42369, pour le compte de l’équipe ${nom || 'Lugh'}, qui utilise l’appli Lugh pour organiser ses équipes. Pour toute question : ${ecrire}.` },
    { titre: 'Ce que Lugh garde sur toi', liste: [
      'Ton identifiant de connexion et ton nom affiché (souvent ton pseudo). Pas de date de naissance, pas d’adresse.',
      'Tes accès : les jeux et ton rôle dans chacun (joueur, coach…).',
      'La vie de l’équipe : planning, disponibilités, absences, résultats, notes et objectifs.',
      'Si tu lies ton compte Discord : ton identifiant et ton pseudo Discord.',
      'Si tu relies ton compte Riot (Stats Valorant, seulement si tu coches la case) : ton Riot ID, un identifiant technique Riot, et tes 20 dernières parties Valorant (carte, agent, éliminations, morts, assistances, score de combat, résultat). Jamais ton mot de passe Riot, ton rang, ni les autres joueurs de la partie. Visible par toi et par le staff de ton jeu.',
      'Un journal des connexions et des actions importantes, effacé au bout de 90 jours.',
      'Si tu as moins de 18 ans : seulement l’indication « mineur » et les dates où tes parents ont signé les autorisations (jamais ton âge). Seuls le Responsable de ton jeu et l’Administrateur général le voient.',
      'Si tu candidates pour entrer dans l’équipe : ton pseudo, ton identifiant dans le jeu, ton rôle, ton rang, tes personnages, ta chaîne Twitch, tes disponibilités, d’où vient ta candidature, et les notes et avis du staff. Seul le staff qui recrute les voit.',
      'Si tu paies une cotisation ou reçois un remboursement : ton nom ou ton pseudo dans le livre des comptes de la structure, que seuls le trésorier et l’Administrateur général voient, gardé le temps exigé pour les comptes (jusqu’à 10 ans).',
    ] },
    { titre: 'Pourquoi, et ce qui l’autorise', texte: 'Uniquement pour organiser les entraînements, les matchs et le suivi de l’équipe. Rien n’est vendu, rien ne sert à la publicité.', liste: [
      'Ton compte et la vie de l’équipe : nécessaires à ton adhésion à l’équipe (article 6-1-b du RGPD).',
      'Ta candidature : nécessaire pour l’étudier, à ta demande (article 6-1-b du RGPD).',
      'Le livre des comptes : obligation légale de tenir une comptabilité (article 6-1-c du RGPD).',
      'Les liaisons Discord et Riot : ton accord (article 6-1-a du RGPD), que tu peux retirer à tout moment en déliant ton compte.',
      'Le journal des connexions : la sécurité des comptes (intérêt légitime, article 6-1-f du RGPD).',
    ] },
    { titre: 'Qui reçoit tes données', liste: [
      'Le staff de ton jeu, selon son rôle, et l’Administrateur général.',
      'Render Services, Inc. (hébergement de l’appli) et MongoDB, Inc. (base de données MongoDB Atlas), qui ne font que stocker.',
      'Discord Inc. : si le salon de ton jeu est branché, Lugh y publie le planning, les annonces et les rappels, qui peuvent contenir ton pseudo ; si tu lies ton compte, le bot de l’équipe lit ton identifiant Discord pour te donner tes rôles.',
      'Riot Games : seulement si tu relies ton compte Riot.',
      'Anthropic (l’IA qui vérifie la méta des jeux) ne reçoit jamais rien sur toi.',
    ] },
    { titre: 'Données hors de l’Union européenne', texte: 'Render, MongoDB et Discord sont des sociétés américaines : même si tes données sont stockées en Europe, elles peuvent être consultées depuis les États-Unis. Ces transferts sont encadrés par le Data Privacy Framework UE–États-Unis (décision d’adéquation du 10 juillet 2023) lorsque le prestataire y adhère, sinon par les clauses contractuelles types de la Commission européenne.' },
    { titre: 'Où et comment', liste: [
      'Chez Render (Francfort, Allemagne) et MongoDB Atlas (Europe), plus une sauvegarde chaque semaine sur un ordinateur de la structure.',
      'Ton mot de passe n’est jamais stocké en clair. Ta session tient dans un cookie, valable 30 jours, sans aucun traceur publicitaire.',
      'Stats Valorant : les données viennent de Riot Games, seulement après ton accord sur le site de Riot. Les clés de connexion Riot sont chiffrées.',
    ] },
    { titre: 'Ce que ton navigateur garde', texte: 'Aucun traceur, aucune publicité, aucune mesure d’audience. Seulement ce qui fait marcher Lugh, sans rien à accepter :', liste: [
      'Le cookie « lugh_session » : ta connexion. Protégé (HttpOnly, Secure, SameSite=Lax), il dure 30 jours et s’efface quand tu te déconnectes.',
      'Dans le stockage local de ton navigateur (localStorage), jamais envoyé au serveur :',
      '« lugh-theme » : ton thème, sombre ou clair (choisi dans Mon compte).',
      '« lugh-dernier-jeu » : le dernier jeu que tu as ouvert, pour y revenir directement.',
      '« lugh-premiers-pas-masques-<jeu> » (une clé par jeu, ex. lugh-premiers-pas-masques-valorant) : tu as masqué la liste « Premiers pas » de l’accueil de ce jeu.',
      'Le cache « lugh-v1 » de l’appli (service worker) : une copie des pages, styles et polices pour que Lugh s’ouvre même quand le serveur se réveille. Jamais tes données : elles passent toujours par le réseau.',
      'Pour tout effacer : déconnecte-toi, puis efface les données du site dans les réglages de ton navigateur.',
    ] },
    { titre: 'Combien de temps', texte: 'Tant que ton compte existe. Quand il est supprimé, tes données personnelles le sont aussi ; ce que tu as écrit pour l’équipe reste, signé « un ancien compte ». Parties Riot : 90 jours au plus ; « Délier » (page Stats Valorant), la suppression de ton compte ou le retrait de ton accord chez Riot effacent tout de suite ta liaison et tes parties. Candidature refusée : effacée automatiquement, avec les avis du staff, 6 mois après le refus ; candidature acceptée : elle devient ta fiche du roster.' },
    { titre: 'Tes droits', texte: `Tu peux voir tes données, les corriger, les faire supprimer, en limiter l’usage, t’y opposer ou les récupérer : écris à ${ecrire}. Réponse dans le mois. Tu peux aussi supprimer toi-même ton compte (Mon compte → Supprimer mon compte). Si tu n’es pas satisfait, tu peux faire une réclamation à la CNIL sur www.cnil.fr (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).` },
    { titre: 'Si tu as moins de 15 ans', texte: 'Tes parents doivent être d’accord, avec toi, pour que tu utilises Lugh et le serveur Discord (article 45 de la loi Informatique et Libertés). Ils ont les mêmes droits que toi sur tes données.' },
    { titre: 'Ton image et ta voix', texte: 'La structure ne diffuse jamais l’image ou la voix d’un mineur (stream, vidéo, photo) sans l’autorisation écrite de ses parents.' },
    { titre: 'Mise à jour', texte: MISE_A_JOUR_LEGALE },
  ];
}
