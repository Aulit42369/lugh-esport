// Page « Données et confidentialité » de Lugh, lisible par un ado, avant même la connexion. Construite depuis
// l'identité de la structure (nom, contact) ; le reste décrit ce que Lugh fait réellement de ses données.

export function texteConfidentialite({ nom = '', contact = '' } = {}) {
  const qui = nom || 'La structure';
  return [
    { titre: 'Qui s’occupe de tes données ?', texte: `${qui}, qui utilise l’appli Lugh pour organiser ses équipes.${contact ? ` Pour toute question : ${contact}.` : ' Pour toute question, adresse-toi au Responsable de ton jeu.'}` },
    { titre: 'Ce que Lugh garde sur toi', liste: [
      'Ton identifiant de connexion et ton nom affiché (souvent ton pseudo). Pas de date de naissance, pas d’adresse.',
      'Tes accès : les jeux et ton rôle dans chacun (joueur, coach…).',
      'La vie de l’équipe : planning, disponibilités, absences, résultats, notes et objectifs.',
      'Si tu lies ton compte Discord : ton identifiant et ton pseudo Discord.',
      'Si tu relies ton compte Riot (Stats Valorant, seulement si tu coches la case) : ton Riot ID, un identifiant technique Riot, et tes 20 dernières parties Valorant (carte, agent, éliminations, morts, assistances, score de combat, résultat). Jamais ton mot de passe Riot, ton rang, ni les autres joueurs de la partie. Visible par toi et par le staff de ton jeu.',
      'Un journal des connexions et des actions importantes, effacé au bout de 90 jours.',
      'Si tu as moins de 18 ans : seulement l’indication « mineur » et les dates où tes parents ont signé les autorisations (jamais ton âge). Seuls le Responsable de ton jeu et l’Administrateur général le voient.',
      'Si tu paies une cotisation ou reçois un remboursement : ton nom ou ton pseudo dans le livre des comptes de la structure, que seuls le trésorier et l’Administrateur général voient, gardé le temps exigé pour les comptes (jusqu’à 10 ans).',
    ] },
    { titre: 'Pourquoi', texte: 'Uniquement pour organiser les entraînements, les matchs et le suivi de l’équipe. Rien n’est vendu, rien ne sert à la publicité.' },
    { titre: 'Où et comment', liste: [
      'Chez Render (Francfort, Allemagne) et MongoDB Atlas (Europe), plus une sauvegarde chaque semaine sur un ordinateur de la structure.',
      'Ton mot de passe n’est jamais stocké en clair. Ta session tient dans un cookie, valable 30 jours, sans aucun traceur publicitaire.',
      'La méta des jeux est vérifiée avec l’aide d’une IA : elle ne reçoit jamais d’information sur toi.',
      'Stats Valorant : les données viennent de Riot Games, seulement après ton accord sur le site de Riot. Les clés de connexion Riot sont chiffrées.',
    ] },
    { titre: 'Combien de temps', texte: 'Tant que ton compte existe. Quand il est supprimé, tes données personnelles le sont aussi ; ce que tu as écrit pour l’équipe reste, signé « un ancien compte ». Parties Riot : 90 jours au plus ; « Délier » (page Stats Valorant), la suppression de ton compte ou le retrait de ton accord chez Riot effacent tout de suite ta liaison et tes parties.' },
    { titre: 'Tes droits', texte: `Tu peux demander à voir tes données, les corriger ou les faire supprimer : ${contact ? `écris à ${contact}` : 'demande au Responsable de ton jeu'}. Réponse dans le mois. Tu peux aussi te plaindre auprès de la CNIL (cnil.fr).` },
    { titre: 'Si tu as moins de 15 ans', texte: 'Tes parents doivent être d’accord, avec toi, pour que tu utilises Lugh et le serveur Discord. Ils ont les mêmes droits que toi sur tes données.' },
    { titre: 'Ton image et ta voix', texte: 'La structure ne diffuse jamais l’image ou la voix d’un mineur (stream, vidéo, photo) sans l’autorisation écrite de ses parents.' },
  ];
}
