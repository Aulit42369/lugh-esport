// Valorant — semaines types (ébauches de planning), routines individuelles par palier et exercices par rôle.
// Ébauches : du collectif en soirée, de l'individuel court et régulier, un jour sans jeu, un débrief après chaque bloc à 5.
// Routines : le Range et les modes du jeu, et un logiciel d'aim au choix (Aim Lab, KovaaK's…).

const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

export const EBAUCHES = [
  {
    id: 'decouverte',
    nom: 'Découverte',
    pour: 'Paliers 1 et 2',
    volume: 'Environ 8 h par semaine',
    resume: 'Apprendre à jouer ensemble : rôles, callouts, économie, premiers automatismes. Beaucoup de jeu, peu de théorie.',
    blocs: [
      b(2, '20:00', '20:20', 'echauffement', 'Échauffement', 'Range puis un deathmatch.', 'individuel'),
      b(2, '20:20', '21:20', 'theorie', 'Callouts et rôles', 'Une map du pool : noms des zones, rôle de chacun en attaque et en défense.'),
      b(2, '21:20', '22:00', 'deathmatch', 'Deathmatch', 'Viser la tête, tirer à l’arrêt.', 'individuel'),
      b(3, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
      b(3, '20:20', '22:00', 'classe', 'Classé à 5', 'Deux parties en groupe : appliquer les callouts du mardi.'),
      b(3, '22:00', '22:20', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
      b(5, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
      b(5, '20:20', '21:30', 'practice', 'Default et achat groupé', 'Partie personnalisée : default d’attaque commun, rounds d’éco.'),
      b(5, '21:30', '22:00', 'vod', 'VOD courte', 'Revoir 3 rounds clés de la partie de mercredi.'),
      b(6, '15:00', '17:00', 'scrim', 'Scrim amical', 'Contre une équipe de niveau proche.'),
      b(6, '17:00', '17:20', 'debrief', 'Débrief', ''),
    ],
  },
  {
    id: 'progression',
    nom: 'Progression',
    pour: 'Paliers 3 et 4',
    volume: 'Environ 13 h par semaine',
    resume: 'Construire un stratbook, enchaîner practice et scrims, revoir les VOD chaque semaine.',
    blocs: [
      b(1, '20:00', '21:00', 'vod', 'VOD du week-end', 'Scrim ou match du samedi : 3 rounds gagnés, 3 rounds perdus.'),
      b(1, '21:00', '22:00', 'theorie', 'Stratbook de la semaine', 'Valider les strats à travailler en practice.'),
      b(2, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
      b(2, '20:00', '21:30', 'practice', 'Practice des exécutions', 'Exécutions de la semaine, 5 répétitions chacune.'),
      b(2, '21:30', '23:00', 'classe', 'Classé à 5', ''),
      b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
      b(3, '20:00', '22:00', 'scrim', 'Scrim BO2', 'Deux maps du pool.'),
      b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
      b(4, '20:00', '20:45', 'aim', 'Travail individuel', 'Programme individuel de chaque joueur.', 'individuel'),
      b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
      b(5, '20:00', '22:00', 'scrim', 'Scrim BO2', ''),
      b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
      b(6, '14:00', '15:00', 'practice', 'Retakes et post-plants', ''),
      b(6, '15:00', '17:00', 'scrim', 'Scrim ou tournoi', ''),
    ],
  },
  {
    id: 'competition',
    nom: 'Compétition',
    pour: 'Palier 5',
    volume: 'Environ 18 h par semaine',
    resume: 'Semaine construite autour du match officiel : anti-strat, scrims sur la map attendue, pistols.',
    blocs: [
      b(2, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
      b(2, '19:30', '20:30', 'vod', 'VOD du dernier officiel', ''),
      b(2, '20:30', '22:30', 'scrim', 'Scrim BO2', ''),
      b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
      b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
      b(3, '19:30', '21:00', 'practice', 'Nouvelles strats', 'Exécutions et fakes ajoutés cette semaine.'),
      b(3, '21:00', '23:00', 'scrim', 'Scrim BO2', ''),
      b(4, '19:00', '20:00', 'theorie', 'Anti-strat', 'Fiche de l’adversaire : pistols, setups, tendances.'),
      b(4, '20:00', '22:00', 'scrim', 'Scrim sur la map du match', ''),
      b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
      b(5, '19:30', '21:30', 'scrim', 'Scrim de répétition', ''),
      b(5, '21:30', '22:00', 'theorie', 'Plan de match', 'Veto, pistols, plan de mi-temps.'),
      b(6, '13:00', '14:00', 'practice', 'Pistols', 'Échauffement collectif et pistols de la map du match.'),
      b(6, '15:00', '17:30', 'match', 'Match officiel', ''),
      b(6, '17:30', '17:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait mardi.'),
      b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
    ],
  },
  {
    id: 'haut-niveau',
    nom: 'Haute performance',
    pour: 'Palier 6',
    volume: 'Environ 26 h par semaine',
    resume: 'Rythme semi-pro : sessions l’après-midi, deux blocs de scrims, récupération planifiée.',
    blocs: [
      b(1, '14:00', '15:30', 'vod', 'VOD du match', 'Analyse complète, actions notées pour chaque joueur.'),
      b(1, '15:30', '16:30', 'theorie', 'Plan de la semaine', ''),
      ...[2, 3, 4, 5].flatMap((j) => [
        b(j, '13:30', '14:15', 'echauffement', 'Échauffement et aim', 'Programme individuel.', 'individuel'),
        b(j, '14:15', '15:30', 'practice', 'Practice', j === 4 ? 'Anti-strat de l’adversaire.' : 'Exécutions, retakes, post-plants.'),
        b(j, '16:00', '18:00', 'scrim', 'Scrim bloc 1', ''),
        b(j, '18:30', '20:30', 'scrim', 'Scrim bloc 2', ''),
        b(j, '20:30', '21:00', 'debrief', 'Débrief', ''),
      ]),
      b(6, '13:00', '14:00', 'practice', 'Échauffement collectif et pistols', ''),
      b(6, '15:00', '18:00', 'match', 'Match officiel', ''),
      b(6, '18:00', '18:15', 'debrief', 'Débrief à chaud', ''),
      b(7, '11:00', '12:00', 'physique', 'Activité physique', '', 'individuel'),
    ],
  },
  {
    id: 'semaine-tournoi',
    nom: 'Semaine de tournoi',
    pour: 'Tous paliers',
    volume: 'Environ 9 h par semaine',
    resume: 'Volume réduit avant l’échéance : pistols, maps du veto, repos la veille.',
    blocs: [
      b(1, '20:00', '21:00', 'theorie', 'Veto et plan de tournoi', 'Maps à choisir, maps à bannir, compo de chaque map.'),
      b(2, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
      b(2, '20:00', '22:00', 'scrim', 'Scrim sur la map 1 du veto', ''),
      b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
      b(3, '20:00', '21:00', 'practice', 'Pistols et post-plants', ''),
      b(3, '21:00', '22:30', 'scrim', 'Scrim sur la map 2 du veto', ''),
      b(4, '20:00', '21:00', 'vod', 'VOD des scrims', 'Uniquement ce qui sert au tournoi.'),
      b(5, '20:00', '20:45', 'aim', 'Échauffement léger', 'Pas de classé tard : le repos fait partie de la préparation.', 'individuel'),
      b(6, '12:00', '13:00', 'practice', 'Échauffement collectif', ''),
      b(6, '13:00', '19:00', 'match', 'Tournoi', ''),
    ],
  },
];

export const ROUTINES = {
  1: {
    echauffement: [
      { duree: 10, texte: 'Range : cibles fixes, viseur à hauteur de tête, tir uniquement à l’arrêt.' },
      { duree: 10, texte: 'Deathmatch : une seule arme (Vandal ou Phantom), viser la tête.' },
    ],
    hebdo: ['3 sessions de jeu d’au moins 45 minutes', '2 deathmatchs avant chaque session', 'Découvrir une map du pool en partie personnalisée'],
    conseil: 'Jouer souvent et peu longtemps vaut mieux qu’une longue session par semaine.',
  },
  2: {
    echauffement: [
      { duree: 5, texte: 'Range : contre-strafe sur bots en mouvement, 20 éliminations.' },
      { duree: 10, texte: 'Logiciel d’aim : un exercice de suivi et un de clic sur cible.' },
      { duree: 10, texte: 'Deathmatch concentré sur le crosshair placement.' },
    ],
    hebdo: ['4 sessions dont 2 à 5', '3 deathmatchs par session', '2 placements d’utilitaire appris par map'],
    conseil: 'Noter sa sensibilité et ne plus la changer : la régularité construit la mémoire musculaire.',
  },
  3: {
    echauffement: [
      { duree: 10, texte: 'Logiciel d’aim : micro-ajustements et flicks courts.' },
      { duree: 10, texte: 'Range : spray contrôlé et taps à 20 mètres.' },
      { duree: 10, texte: 'Deathmatch : pré-viser chaque angle avant de le passer.' },
    ],
    hebdo: ['Revoir une de ses VOD (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Lineups de son agent révisés sur 2 maps'],
    conseil: 'Chaque séance d’aim a un seul thème : mieux vaut un exercice bien fait que dix survolés.',
  },
  4: {
    echauffement: [
      { duree: 10, texte: 'Logiciel d’aim : routine fixe de 3 exercices, scores notés.' },
      { duree: 10, texte: 'Range : contre-strafe, spray à 15 mètres, taps longue distance.' },
      { duree: 15, texte: 'Deathmatch ou match à mort en équipe à intensité de match.' },
    ],
    hebdo: ['Une VOD personnelle et une VOD d’un joueur pro de son rôle', 'Lineups de post-plant et de retake révisés', 'Deux activités physiques'],
    conseil: 'Suivre ses chiffres d’échauffement d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
  },
  5: {
    echauffement: [
      { duree: 10, texte: 'Logiciel d’aim : routine personnalisée sur ses points faibles.' },
      { duree: 10, texte: 'Range : situations de son rôle (entrée, tenue d’angle, retake).' },
      { duree: 15, texte: 'Deathmatch à intensité de match, puis 5 minutes de calme.' },
    ],
    hebdo: ['Analyse de 2 adversaires potentiels', 'Proposition d’une strat pour son rôle', 'Un jour complet sans jeu'],
    conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
  },
  6: {
    echauffement: [
      { duree: 15, texte: 'Logiciel d’aim : routine de compétition, identique chaque jour.' },
      { duree: 10, texte: 'Range : séquences de son rôle chronométrées.' },
      { duree: 20, texte: 'Deathmatch puis duel 1v1 contre un coéquipier.' },
    ],
    hebdo: ['Fiche anti-strat préparée pour chaque officiel', 'Séance de théorie animée sur son rôle (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
    conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la visée.',
  },
};

export const PAR_ROLE = {
  duelliste: [
    'Entrées au Range : 10 swings larges sur bots, en enchaînant deux angles.',
    'Practice : entrée sur un site avec un initiateur, flash puis swing dans les 0,5 seconde.',
    'Suivre son ratio premiers kills / premières morts chaque semaine.',
  ],
  initiateur: [
    'Lineups d’information sur chaque site du pool, réussis 9 fois sur 10.',
    'Combos avec le duelliste : flash ou révélation juste avant son entrée.',
    'Annoncer ce que la compétence a révélé en moins de 2 secondes.',
  ],
  controleur: [
    'Smokes d’exécution sur chaque site, posées depuis une position sûre.',
    'Timings : savoir quand les smokes tombent et combien de temps elles durent.',
    'Smokes de retake et de post-plant pour chaque site du pool.',
  ],
  sentinelle: [
    'Setups défensifs sur chaque site, variés pour ne pas être lus.',
    'Couverture des flancs en attaque : utilitaires posés au bon endroit au bon moment.',
    'Retarder une exécution seul jusqu’à l’arrivée des rotations.',
  ],
  flex: [
    'Deux rôles entretenus : un agent prêt dans chacun.',
    'Lineups essentiels des deux rôles révisés chaque semaine.',
    'Connaître la place de chaque agent dans les compos de l’équipe.',
  ],
};
