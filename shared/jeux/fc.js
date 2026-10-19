// EA SPORTS FC 27 — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://www.sortiraparis.com/en/what-to-do-in-paris/gaming/articles/349429-ea-sports-fc-27-release-date-cover-art-featuring-mbappe-and-bellingham-new-features-and-platforms,
//   https://www.ea.com/en/games/ea-sports-fc/fc-27/news/which-fc27-mode-is-right-for-you, https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-the-grounds-deep-dive,
//   https://www.ea.com/games/ea-sports-fc/fc-27/news/fc27-title-update-v1-0-4, https://gamewave.fr/fc-27/fc-27-maj-v1-0-1-du-23-septembre-le-patch-notes/,
//   https://help.ea.com/help/ea-sports-fc/fc-ultimate-team-rivals, https://help.ea.com/fi/articles/ea-sports-fc/ultimate-team-champions/,
//   https://www.ea.com/games/ea-sports-fc/fc-pro/news/fc-pro-27-deep-dive, https://www.redbull.com/fr-fr/ea-fc-27-meilleures-formations-tactiques,
//   https://forums.ea.com/discussions/fc-27-feedback-en/fc-27-clubs-%E2%80%93-competitive-11v11-training--matchday-improvements/13763929.
// Incertitudes : structure exacte des ligues Clubs de FC 27 (nombre de divisions, remises à zéro, rythme des Playoffs) non publiée
//   par EA, seules la division Élite, les montées et descentes et les Playoffs sont confirmées ; noms français exacts des menus
//   (jeux techniques, arène et centre d'entraînement) non vérifiés en jeu ; Rush à plusieurs coéquipiers dans The Grounds probable
//   mais non confirmé ; statistiques individuelles de Clubs (note, passes et tacles réussis) reprises des éditions précédentes ;
//   méta tactique relevée sur des sites non officiels ; seuils (80 % de passes, note de 7,5, 1,5 but encaissé) fixés comme repères
//   de coach, sans statistique publique par niveau ; aucun site de profil public fiable pour Clubs (profil : null).
//
// Choix du format : ce modèle sert une équipe Clubs (11 contre 11, un joueur humain par poste).
// La compétition officielle d'EA (FC Pro 27) se joue en 1 contre 1 sur Ultimate Team, mais une structure de joueurs 1v1
// n'utiliserait ni les rôles, ni les compos, ni les présences, ni les objectifs collectifs de l’appli. Une équipe Clubs a besoin
// de tout le hub : roster de 11 titulaires et de remplaçants, soirs de match à 11 (présences), amicaux contre d'autres clubs
// (scrims), ligues communautaires (matchs officiels), plan de jeu (stratbook), vidéo des matchs (Clubs ne garde que des
// résumés) et progression par poste.
// Rangs : Clubs n'a pas de rang individuel (les divisions de ligue appartiennent au club). Le repère de niveau individuel est
// la Division Rivals d'Ultimate Team, seule échelle classée officielle (et porte d'entrée de la FC Pro : division 5 ou mieux).
// Un joueur 1v1 de la structure peut aussi utiliser l'espace : rang Rivals, bloc « Rivals », planning individuel.
// Le nom et l'abréviation changent chaque année avec l'édition (sortie fin septembre).

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

export default {
  id: 'fc',
  nom: 'EA SPORTS FC 27',
  court: 'FC 27',
  editeur: 'Electronic Arts',
  genre: 'football',
  equipe: { titulaires: 11, remplacants: 5 },   // Clubs : 11 joueurs humains (gardien compris) ; des remplaçants pour couvrir les absences

  vocabulaire: {
    personnage: null, personnages: null,
    carte: null, cartes: null,
    manche: 'but', manches: 'buts',
  },

  // Les 4 familles de postes de Clubs (gardien, défenseur, milieu, attaquant), comme les familles d'archétypes du jeu.
  roles: [
    { id: 'gardien', nom: 'Gardien', court: 'GAR', resume: 'Protège le but, commande sa défense et relance proprement.' },
    { id: 'defenseur', nom: 'Défenseur', court: 'DEF', resume: 'Tient sa ligne, couvre la profondeur et gagne ses duels ; latéraux compris.' },
    { id: 'milieu', nom: 'Milieu', court: 'MIL', resume: 'Récupère, oriente le jeu et relie la défense à l’attaque.' },
    { id: 'attaquant', nom: 'Attaquant', court: 'ATT', resume: 'Prend la profondeur, crée le danger et finit les actions ; ailiers compris.' },
  ],
  camps: [],
  typesStrat: [
    { id: 'formation', nom: 'Formation et consignes', camps: [], resume: 'Système de départ, style de construction, approche défensive et rôle de chaque poste.' },
    { id: 'pressing', nom: 'Pressing', camps: [], resume: 'Qui presse, quand et où : déclencheurs et pressing à la perte.' },
    { id: 'blocdef', nom: 'Organisation défensive', camps: [], resume: 'Hauteur de ligne, bloc compact, couverture et suivi des appels.' },
    { id: 'construction', nom: 'Sortie de balle', camps: [], resume: 'Relance depuis le gardien et circuits de passes pour passer la première ligne adverse.' },
    { id: 'transition', nom: 'Jeu de transition', camps: [], resume: 'Contre-attaque dès la récupération, repli immédiat à la perte.' },
    { id: 'cpaoff', nom: 'Coups de pied arrêtés offensifs', camps: [], resume: 'Corners, coups francs et touches : tireur, placements et appels.' },
    { id: 'cpadef', nom: 'Coups de pied arrêtés défensifs', camps: [], resume: 'Zone ou individuelle : rôle de chacun et sortie après le dégagement.' },
    { id: 'gestion', nom: 'Gestion du score', camps: [], resume: 'Garder une avance, revenir au score, gérer la fatigue en fin de match.' },
    { id: 'tab', nom: 'Tirs au but', camps: [], resume: 'Ordre des tireurs et préparation du gardien pour les coupes et les tournois.' },
  ],
  typesBloc: [
    { id: 'entrainement', nom: 'Jeux techniques et arène d’entraînement', duree: 30 },
    { id: 'dropin', nom: 'Drop-in 11v11 à son poste', duree: 60 },
    { id: 'rush', nom: 'Rush entre coéquipiers', duree: 45 },
    { id: 'rivals', nom: 'Rivals (Ultimate Team)', duree: 60 },
  ],
  // Division Rivals d'Ultimate Team : 11 divisions, de la division 10 à la division 1, puis la division Élite.
  rangs: [
    ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((d, i) => ({ id: `div${d}`, nom: `Division ${d}`, n: i + 1 })),
    { id: 'elite', nom: 'Division Élite', n: 11 },
  ],
  chiffres: [
    { id: 'note', nom: 'Note de match', unite: '/10', min: 0, max: 10, decimales: 1, aide: 'Note moyenne des matchs de la semaine (fin de match ou statistiques du club).' },
    { id: 'passes', nom: 'Passes réussies', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Pourcentage de passes réussies sur la semaine (statistiques du joueur dans Clubs).' },
    { id: 'tacles', nom: 'Tacles réussis', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Pourcentage de tacles réussis sur la semaine ; les gardiens laissent vide.' },
    { id: 'contrib', nom: 'Buts et passes décisives par match', unite: '', min: 0, max: 5, decimales: 2, aide: '(Buts + passes décisives) ÷ matchs joués sur la semaine.' },
    { id: 'encaisses', nom: 'Buts encaissés par match', unite: '', min: 0, max: 10, decimales: 2, aide: 'Buts encaissés par l’équipe ÷ matchs joués par le joueur sur la semaine.' },
  ],
  score: { type: 'simple' },   // un score par match : buts marqués et encaissés
  veto: {
    type: 'aucun',
    formats: [],
    notes: '',
  },
  checklistMatch: [
    { id: 'compo', nom: 'Compo, postes et remplaçants confirmés' },
    { id: 'tactique', nom: 'Tactique et consignes enregistrées dans le club' },
    { id: 'adversaire', nom: 'Matchs de l’adversaire revus (système, joueurs clés)' },
    { id: 'cpa', nom: 'Coups de pied arrêtés répartis (tireurs, marquages)' },
    { id: 'capture', nom: 'Enregistrement ou stream du match lancé' },
    { id: 'logistique', nom: 'Horaire, lobby, connexion et capitaine confirmés' },
  ],
  profil: null,
  meta: {
    sources: ['ea.com', 'help.ea.com', 'forums.ea.com', 'liquipedia.net', 'fut.gg'],
    consigne: 'Vérifier l’édition en cours (sortie fin septembre) et la dernière mise à jour (ea.com) : gameplay (défense, passes, tirs, gardiens, coups de pied arrêtés) et Clubs (archétypes, ligues, Playoffs, The Grounds).\n'
      + 'Relever les formations et consignes utilisées par les équipes 11v11 compétitives et par les pros (fut.gg, Liquipedia).\n'
      + 'Noter le calendrier de la saison en cours et tout changement de Rivals ou de Champions (divisions, qualification).\n'
      + 'Signaler une nouvelle édition : nom, date de sortie, nouveautés de Clubs.',
    pool: false,
  },
  paliers: {
    rangs: ['Division 10 à 8 en Rivals', 'Division 7 à 5', 'Division 4 à 3', 'Division 2 à 1', 'Division Élite, ligues 11v11', 'Division Élite, haut des ligues 11v11, semi-pro'],
    resumes: [
      'Découvre les commandes, son poste et les règles du jeu à onze.',
      'Tient son poste, joue simple et parle avec ses voisins.',
      'Applique la tactique de l’équipe, défend en manuel, joue en peu de touches.',
      'Maîtrise son rôle dans deux systèmes, presse au bon moment, gère les transitions.',
      'Lit l’adversaire, s’adapte en cours de match, devient un cadre de l’équipe.',
      'Constance à haut niveau, préparation d’adversaire et leadership.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Technique', resume: 'Contrôle, passes, tirs, dribbles, défense manuelle.' },
    { id: 'tact', nom: 'Tactique', resume: 'Placement dans le système, consignes, pressing collectif.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Lecture, appels, transitions, choix de jeu.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, calme, coordination à onze.' },
    { id: 'role', nom: 'Poste', resume: 'Ce que son poste attend de lui dans chaque phase de jeu.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Apprendre les commandes de base', 'Centre d’entraînement terminé : déplacements, passes, tirs et coups de pied arrêtés.'),
    o('tact-1-1', 'Rester dans sa zone', 'Sur 2 matchs revus, reste dans son couloir 8 fois sur 10 quand le ballon est loin.'),
    o('jeu-1-1', 'Jouer simple', 'Moins de 3 pertes de balle en dribble par match, sur 3 matchs.'),
    o('comm-1-1', 'Demander et annoncer le ballon', '« Seul », « derrière toi » et « je monte » utilisés à chaque match, relevé en vocal.'),
    o('role-1-1', 'Choisir un poste principal', 'Poste fixé avec le coach et joué 10 matchs avec un archétype adapté.'),
    o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun reproche en vocal ou par message sur 5 matchs.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Défendre en manuel', 'Sur 2 matchs revus, se place entre l’attaquant et le but avant de tacler dans 7 duels sur 10.'),
    o('tact-2-1', 'Connaître la formation et sa place', 'Dessiner la formation de l’équipe et sa zone en attaque et en défense, validé par le coach.'),
    o('jeu-2-1', 'Jouer en deux touches', 'Sur 2 matchs revus, 6 passes sur 10 jouées en deux touches ou moins.'),
    o('comm-2-1', 'Faire des annonces courtes', 'Format qui, où, quoi (« 9 seul au second poteau ») relevé en review.'),
    o('role-2-1', 'Connaître les tâches de son poste', '3 tâches en attaque et 3 en défense, validées par le coach.'),
    o('mental-2-1', 'Préserver son sommeil', 'Pas de session après minuit la veille d’un match officiel, pendant 1 mois.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Atteindre 80 % de passes réussies', 'Moyenne sur 10 matchs (statistiques du joueur dans Clubs).'),
    o('tact-3-1', 'Appliquer le pressing de l’équipe', 'Déclencheurs du stratbook respectés sur 3 matchs revus (passe en retrait, contrôle raté, touche).'),
    o('jeu-3-1', 'Faire les bons appels', 'Un appel en profondeur ou de soutien à chaque attaque de l’équipe, relevé sur 2 matchs.'),
    o('comm-3-1', 'Annoncer le marquage', '« Je prends le 10 », « couvre-moi » annoncés à chaque phase défensive, relevé en review.'),
    o('role-3-1', 'Régler son archétype pour son poste', 'Archétype et attributs validés par le coach selon le système de l’équipe.'),
    o('mental-3-1', 'Revoir ses matchs chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Garder le ballon sous pression', 'Moins de 2 pertes de balle sous pressing par match, relevé sur 3 matchs.'),
    o('tact-4-1', 'Défendre en bloc compact', '1,5 but encaissé par match au plus, en moyenne sur le mois.'),
    o('jeu-4-1', 'Gérer les transitions', 'Après une perte, repli ou pressing dans les 3 secondes, 8 fois sur 10 en review.'),
    o('comm-4-1', 'Proposer des ajustements à la mi-temps', 'Au moins une proposition utile par match, prise ou non par le capitaine.'),
    o('role-4-1', 'Tenir son poste dans deux systèmes', 'Connaît sa mission dans les 2 formations de l’équipe, validé en amical.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’un mauvais match faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Être constant', 'Moins de 0,5 point d’écart de note moyenne entre la meilleure et la pire semaine du mois.'),
    o('tact-5-1', 'S’adapter au système adverse', 'Ajustement de position proposé et appliqué dès la mi-temps, relevé en VOD.'),
    o('jeu-5-1', 'Repérer les habitudes adverses', '2 habitudes adverses relevées par mi-temps et transmises au capitaine.'),
    o('comm-5-1', 'Diriger sa ligne', 'Coordonne ses voisins de ligne sans attendre le capitaine, relevé en VOD.'),
    o('role-5-1', 'Peser sur les matchs', 'Note moyenne de 7,5 sur 10 matchs officiels ou amicaux de niveau.'),
    o('mental-5-1', 'Gérer le stress des matchs officiels', 'Technique de retour au calme utilisée à la mi-temps et après un but encaissé.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Technique de niveau semi-pro', 'Objectifs chiffrés du poste (passes, duels, note) tenus sur 2 mois.'),
    o('tact-6-1', 'Maîtriser trois plans de jeu', 'Pressing haut, bloc médian et jeu de contre joués en officiel sans baisse de niveau.'),
    o('jeu-6-1', 'Préparer un adversaire', 'Fiche adverse (système, joueurs clés, coups de pied arrêtés) prête avant chaque officiel.'),
    o('comm-6-1', 'Tenir le cap après un but encaissé', 'Relance l’équipe par une consigne, jamais par un reproche, relevé en VOD.'),
    o('role-6-1', 'Être le référent de son poste', 'Anime une séance de théorie sur son poste chaque mois.'),
    o('mental-6-1', 'Routine de performance complète', 'Sommeil, alimentation, échauffement et récupération planifiés les semaines de match.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à onze deux soirs par semaine', 'Deux sessions à 11 par semaine, avec 10 minutes de débrief, pendant 1 mois.'),
    o('coll-1-2', 'Une formation de référence', 'Formation et consignes de base enregistrées dans le club et notées dans le stratbook.'),
    o('coll-2-1', 'Effectif complet les soirs de match', 'Aucun match officiel joué à moins de 11 pendant 1 mois, remplaçants prévenus.'),
    o('coll-2-2', 'Coups de pied arrêtés répartis', 'Tireurs, appels et marquages des corners et coups francs écrits dans le stratbook.'),
    o('coll-3-1', 'Plan de pressing commun', 'Déclencheurs et rôles de pressing écrits et appliqués sur 5 amicaux.'),
    o('coll-3-2', 'Revue vidéo collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois, à partir d’un match enregistré.'),
    o('coll-4-1', 'Deux systèmes maîtrisés', 'Passage d’une formation à l’autre en cours de match sans désorganisation, sur 5 amicaux.'),
    o('coll-4-2', 'Gagner la moitié des amicaux de niveau', 'Au moins 50 % de victoires sur 10 amicaux contre des clubs de niveau proche.'),
    o('coll-5-1', 'Anti-strat avant chaque officiel', 'Fiche adversaire prête la veille de chaque match officiel.'),
    o('coll-5-2', 'Adapter à la mi-temps', 'Décision de mi-temps prise sur des faits, notée dans la fiche du match.'),
    o('coll-6-1', 'Préparation adverse systématique', 'Au moins 2 matchs analysés par adversaire officiel.'),
    o('coll-6-2', 'Plan de jeu à jour sous 72 h', 'Tactiques revues dans les 3 jours après chaque mise à jour de gameplay.'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer à onze : postes, formation, annonces, premiers automatismes. Beaucoup de matchs, peu de théorie.',
      blocs: [
        b(2, '20:30', '20:45', 'echauffement', 'Échauffement', 'Jeux techniques : passes et contrôles.', 'individuel'),
        b(2, '20:45', '21:15', 'theorie', 'Formation et postes', 'La formation de l’équipe, la zone et les tâches de chaque poste.'),
        b(2, '21:15', '22:30', 'classe', 'Ligue Clubs à onze', 'Tenir sa position, jouer simple.'),
        b(2, '22:30', '22:45', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(3, '20:30', '21:00', 'entrainement', 'Jeux techniques et arène', 'Centre d’entraînement, puis exercices de son poste.', 'individuel'),
        b(3, '21:00', '22:00', 'dropin', 'Drop-in à son poste', 'Rester dans sa zone, annoncer le ballon.', 'individuel'),
        b(5, '20:30', '20:45', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:45', '22:15', 'scrim', 'Amicaux', 'Deux amicaux contre un club de niveau proche.'),
        b(5, '22:15', '22:35', 'debrief', 'Débrief', ''),
        b(6, '15:00', '15:15', 'echauffement', 'Échauffement', '', 'individuel'),
        b(6, '15:15', '16:45', 'classe', 'Ligue Clubs à onze', 'Appliquer les annonces de la semaine.'),
        b(6, '16:45', '17:15', 'vod', 'Vidéo courte', 'Revoir 3 buts encaissés : placement de chacun.'),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire le plan de jeu, enchaîner amicaux et ligue, revoir la vidéo chaque semaine.',
      blocs: [
        b(1, '20:30', '21:30', 'vod', 'Vidéo du week-end', 'Match du samedi : 3 actions réussies, 3 buts encaissés.'),
        b(1, '21:30', '22:15', 'theorie', 'Plan tactique de la semaine', 'Pressing, coups de pied arrêtés, ajustements.'),
        b(2, '20:15', '20:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '20:30', '22:30', 'scrim', 'Amicaux', 'Trois amicaux : appliquer le plan de pressing.'),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '20:00', '20:45', 'entrainement', 'Arène d’entraînement', 'Exercices de son poste : centres, frappes, relances, sorties.', 'individuel'),
        b(3, '20:45', '21:45', 'rush', 'Rush entre coéquipiers', 'Par lignes : appels, une-deux et duels.'),
        b(4, '20:30', '22:30', 'classe', 'Ligue Clubs à onze', 'Matchs de ligue et Playoffs du moment.'),
        b(4, '22:30', '22:45', 'debrief', 'Débrief', ''),
        b(5, '20:15', '20:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:30', '22:00', 'scrim', 'Amicaux', 'Coups de pied arrêtés du stratbook en situation.'),
        b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(6, '14:45', '15:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(6, '15:00', '17:00', 'match', 'Match officiel ou coupe', 'Ligue ou coupe communautaire.'),
        b(6, '17:00', '17:20', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour des matchs officiels : anti-strat, amicaux sur le plan du match, coups de pied arrêtés.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'Vidéo du dernier officiel', 'Pressing, transitions, coups de pied arrêtés.'),
        b(1, '21:00', '22:30', 'match', 'Match de ligue', 'Ligue communautaire 11v11.'),
        b(1, '22:30', '22:45', 'debrief', 'Débrief', ''),
        b(2, '19:30', '20:00', 'entrainement', 'Jeux techniques ciblés', 'Programme individuel de chaque joueur.', 'individuel'),
        b(2, '20:00', '20:15', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '20:15', '22:15', 'scrim', 'Amicaux de haut niveau', ''),
        b(2, '22:15', '22:35', 'debrief', 'Débrief', ''),
        b(3, '19:30', '20:15', 'entrainement', 'Programme individuel', 'Exercices de poste en arène d’entraînement.', 'individuel'),
        b(3, '20:15', '21:00', 'theorie', 'Anti-strat', 'Fiche de l’adversaire : système, joueurs clés, coups de pied arrêtés.'),
        b(3, '21:00', '22:30', 'match', 'Match de ligue', ''),
        b(3, '22:30', '22:45', 'debrief', 'Débrief', ''),
        b(4, '20:00', '20:15', 'echauffement', 'Échauffement', '', 'individuel'),
        b(4, '20:15', '22:15', 'scrim', 'Amicaux sur le plan du match', 'Contre un club qui joue le système de l’adversaire.'),
        b(4, '22:15', '22:35', 'debrief', 'Débrief', ''),
        b(5, '20:00', '20:45', 'theorie', 'Plan de match', 'Compo, consignes, coups de pied arrêtés, plan si mené.'),
        b(5, '20:45', '22:15', 'classe', 'Ligue Clubs à onze', 'Rodage du plan de match.'),
        b(6, '14:30', '15:00', 'echauffement', 'Échauffement collectif', 'Rush ou drop-in à plusieurs, puis rappel des consignes.'),
        b(6, '15:00', '17:30', 'match', 'Match officiel ou coupe', ''),
        b(6, '17:30', '17:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait lundi.'),
        b(7, '11:00', '11:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Jeux techniques : passes courtes et contrôles.' },
        { duree: 10, texte: 'Arène d’entraînement : frappes à l’entrée de la surface, des deux pieds.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', 'Centre d’entraînement terminé dans le mois', 'Un drop-in à son poste avant chaque session à onze'],
      conseil: 'Rester à son poste même quand le ballon est loin : c’est le premier réflexe du jeu à onze.',
    },
    2: {
      echauffement: [
        { duree: 5, texte: 'Jeux techniques : passes au sol et passes lobées.' },
        { duree: 10, texte: 'Arène d’entraînement : défense manuelle face à un attaquant, se placer avant de tacler.' },
        { duree: 10, texte: 'Drop-in : dix minutes à son poste, jeu en deux touches.' },
      ],
      hebdo: ['4 sessions dont 2 à onze', 'Pourcentage de passes réussies noté chaque semaine', 'Revoir 3 actions de son poste dans les résumés du match'],
      conseil: 'Garder les mêmes réglages de manette et de caméra : la régularité construit les automatismes.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Jeux techniques : passes en profondeur et centres.' },
        { duree: 10, texte: 'Arène d’entraînement : situation de son poste (relance, centre, frappe ou sortie).' },
        { duree: 10, texte: 'Drop-in ou Rush : appliquer les déclencheurs de pressing.' },
      ],
      hebdo: ['Revoir un de ses matchs (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Une séance de Rush avec ses voisins de ligne'],
      conseil: 'Chaque séance a un seul thème : mieux vaut un exercice bien fait que dix survolés.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Jeux techniques : routine fixe de 3 exercices, scores notés.' },
        { duree: 10, texte: 'Arène d’entraînement : jeu en une touche sous pression.' },
        { duree: 15, texte: 'Drop-in à intensité de match.' },
      ],
      hebdo: ['Un de ses matchs et un match d’un joueur de haut niveau à son poste revus', 'Coups de pied arrêtés de son poste révisés', 'Deux activités physiques'],
      conseil: 'Suivre sa note et ses pourcentages d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Jeux techniques ciblés sur ses points faibles.' },
        { duree: 10, texte: 'Arène d’entraînement : situations de son poste face à un bloc haut.' },
        { duree: 15, texte: 'Rush ou drop-in à intensité de match, puis 5 minutes au calme.' },
      ],
      hebdo: ['Analyse de 2 adversaires potentiels', 'Une proposition tactique pour son poste', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Routine de compétition identique chaque jour : jeux techniques et arène.' },
        { duree: 10, texte: 'Coups de pied arrêtés de son poste, répétés à l’identique.' },
        { duree: 20, texte: 'Rush ou drop-in avec les titulaires.' },
      ],
      hebdo: ['Fiche adverse préparée pour chaque officiel', 'Séance de théorie animée sur son poste (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la technique.',
    },
  },
  parRole: {
    gardien: [
      'Arène d’entraînement : sorties sur centres et face-à-face, placement avant chaque tir.',
      'Relances courtes et longues vers les latéraux, 20 répétitions.',
      'Annoncer la ligne et le marquage sur chaque coup de pied arrêté adverse.',
    ],
    defenseur: [
      'Défense manuelle en arène d’entraînement : se placer entre l’attaquant et le but, tacler au bon moment.',
      'Monter et descendre avec sa ligne : aucun adversaire remis en jeu par un retard, sur 3 matchs revus.',
      'En latéral, un débordement et un repli complet par mi-temps, relevé en review.',
    ],
    milieu: [
      'Jeux techniques de passes : au sol et en profondeur, scores notés chaque semaine.',
      'Contrôle orienté vers l’avant avant chaque passe, travaillé en drop-in.',
      'Couvrir le latéral ou le milieu qui monte, relevé sur 3 matchs.',
    ],
    attaquant: [
      'Arène d’entraînement : frappes en une touche, finesse et frappe enroulée, 20 de chaque côté.',
      'Appels en profondeur au moment de la passe, sans être hors-jeu, relevés en review.',
      'Pressing de la première ligne : orienter le défenseur adverse vers le côté.',
    ],
  },
  seuils: {
    'meca-3-1': { chiffre: 'passes', seuil: 80, sens: '>=' },
    'tact-4-1': { chiffre: 'encaisses', seuil: 1.5, sens: '<=' },
    'role-5-1': { chiffre: 'note', seuil: 7.5, sens: '>=' },
  },
  initiale: {
    verifieLe: '2026-10-18',
    patch: 'Mise à jour 1.0.4',
    patchDate: '2026-10-07',
    saison: 'FC 27 · saison 1 (17 septembre – 22 octobre 2026)',
    mapPool: [],
    maps: [],
    personnages: [],
    tendances: [
      'Aucun rééquilibrage de gameplay depuis la sortie : la 1.0.1 (23 septembre) a seulement accru l’effet de la fatigue sur l’endurance en 11 contre 11 ; la 1.0.4 (7 octobre) ne corrige que des bugs.',
      'Défense plus manuelle (moins d’interventions automatiques de l’IA), duels physiques plus disputés, appels sans ballon plus nets et corners repensés (placements et trajectoires plus contrôlés).',
      'Méta tactique : 4-4-1-1 (34 % des pros selon fut.gg) et 4-2-1-3 au lancement ; deux semaines après la sortie, beaucoup de blocs très hauts avec pressing et piège du hors-jeu.',
      'Clubs se joue dans The Grounds (PS5, Xbox Series, PC, Switch 2) : archétypes tous débloqués, réinitialisation gratuite, ligues par divisions puis Playoffs, tournois 11v11 à règles spéciales.',
    ],
    sources: [
      'https://www.sortiraparis.com/en/what-to-do-in-paris/gaming/articles/349429-ea-sports-fc-27-release-date-cover-art-featuring-mbappe-and-bellingham-new-features-and-platforms',
      'https://www.ea.com/en/games/ea-sports-fc/fc-27/news/which-fc27-mode-is-right-for-you',
      'https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-the-grounds-deep-dive',
      'https://www.ea.com/games/ea-sports-fc/fc-27/news/fc27-title-update-v1-0-4',
      'https://gamewave.fr/fc-27/fc-27-maj-v1-0-1-du-23-septembre-le-patch-notes/',
      'https://www.games2egypt.com/news/11343/ea-sports-fc-27-gameplay-revealed-smarter-ai-manual-defending-improved-dribbling-and-authentic-gameplay-2-0',
      'https://help.ea.com/help/ea-sports-fc/fc-ultimate-team-rivals',
      'https://help.ea.com/fi/articles/ea-sports-fc/ultimate-team-champions/',
      'https://supercoinsy.com/article/fc-27-division-rivals-ranks-and-rewards-explained',
      'https://timesaver.gg/blog/fc-27-season-1-ends-october-22-what-expires-carries-over',
      'https://timesaver.gg/blog/fc-27-update-1-0-4-patch-notes-dribbling-not-nerfed',
      'https://www.ea.com/games/ea-sports-fc/fc-pro/news/fc-pro-27-deep-dive',
      'https://www.redbull.com/fr-fr/ea-fc-27-meilleures-formations-tactiques',
      'https://www.dexerto.com/wikis/ea-fc-27/best-formations-and-custom-tactics/',
      'https://liquidfc.gg/ea-fc-27/clubs',
      'https://forums.ea.com/discussions/fc-27-general-discussion-en/remove-current-division-and-playoffs-from-clubs-/13585849',
      'https://forums.ea.com/discussions/fc-27-feedback-en/fc-27-clubs-%E2%80%93-competitive-11v11-training--matchday-improvements/13763929',
    ],
  },
};
