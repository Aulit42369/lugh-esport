// Fortnite — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-2026-official-rules, https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-solos-2026-official-rules, https://www.fortnite.com/competitive/fncs-2026-overview, https://beebom.com/fortnite-global-championship-2026-results/, https://beebom.com/fortnite-update-42-40-patch-notes/, https://insider-gaming.com/fortnite-chapter-7-season-4-v42-00-patch-notes/, https://www.epicgames.com/help/fr/c-Category_Fortnite/c-Fortnite_Gameplay/comment-jouer-au-mode-classe-de-fortnite-a000086834, https://www.thespike.gg/fortnite/beginner-guides/ranked-2026-changes-explained
// Incertitudes : format principal 2026 = duos (Majors, Global Championship), mais les FNCS Solos sont en cours (finale les
//   26 et 27 oct.) ; 2 Majors dans le règlement officiel contre 3 annoncés en début d'année ; barème du Global Championship
//   absent du règlement FNCS (barème des finales de Major retenu) ; lobby de 50 duos déduit du Global Championship et du
//   barème (points jusqu'à la 25e place) ; fin de la saison 4 au 31 octobre donnée par la presse, non confirmée par Epic ;
//   loot pool compétitif et statut des consoles Override en tournoi non vérifiés (seuls les Sprites sans pouvoirs en
//   classé sont confirmés) ; modèle d'URL fortnitetracker.com non ouvrable (robots).

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

// Rangs du classé (aide Epic en français) : Bronze à Diamant en 3 divisions (I la plus basse), puis Élite, Champion, Unreal.
// Même échelle pour Battle Royale, Zéro construction et Recharge ; l’appli suit le classé Battle Royale (avec construction).
const RANGS = [
  ...['Bronze', 'Argent', 'Or', 'Platine', 'Diamant'].flatMap((nom, i) => ['I', 'II', 'III'].map((d, j) => ({
    id: `${nom.toLowerCase()}${j + 1}`,
    nom: `${nom} ${d}`,
    n: i * 3 + j + 1,
  }))),
  { id: 'elite', nom: 'Élite', n: 16 },
  { id: 'champion', nom: 'Champion', n: 17 },
  { id: 'unreal', nom: 'Unreal', n: 18 },
];

export default {
  id: 'fortnite',
  nom: 'Fortnite',
  court: 'Fortnite',
  editeur: 'Epic Games',
  genre: 'battle-royale',
  equipe: { titulaires: 2, remplacants: 1 },   // FNCS 2026 en duos (Majors et Global Championship)

  vocabulaire: {
    personnage: null, personnages: null,   // skins sans effet sur le jeu
    carte: null, cartes: null,             // une seule île par saison, imposée à tous les lobbys : aucun choix ni veto, donc
                                           // pas de map pool. L'enjeu est le spot d'atterrissage, noté en strat « atterrissage ».
    manche: 'partie', manches: 'parties',
  },

  roles: [
    { id: 'igl', nom: 'IGL', court: 'IGL', resume: 'Choisit spot, rotations et moments de combat ; garde le duo en vie.' },
    { id: 'fragger', nom: 'Fragger', court: 'FRA', resume: 'Prend les combats, met la pression et finit les éliminations.' },
    { id: 'support', nom: 'Support / builder', court: 'SUP', resume: 'Couvre, construit, garde les matériaux et sécurise les rotations.' },
  ],
  camps: [],
  typesStrat: [
    { id: 'atterrissage', nom: 'Atterrissage', camps: [], resume: 'Spot, trajectoire de vol et partage du butin au sol.' },
    { id: 'contest', nom: 'Contest', camps: [], resume: 'Garder son spot quand un autre duo y atterrit.' },
    { id: 'rotation', nom: 'Rotation', camps: [], resume: 'Chemin, timing et mobilité vers la zone suivante.' },
    { id: 'zone', nom: 'Contrôle de zone', camps: [], resume: 'Prendre une position solide dans le cercle et la garder.' },
    { id: 'tarp', nom: 'Tarping', camps: [], resume: 'Traverser à découvert à l’abri de ses rampes et de ses murs.' },
    { id: 'surge', nom: 'Storm surge', camps: [], resume: 'Infliger assez de dégâts pour ne pas subir la surge en fin de partie.' },
    { id: 'ressources', nom: 'Gestion des ressources', camps: [], resume: 'Matériaux, soins et mobilité gardés pour la fin de partie.' },
    { id: 'endgame', nom: 'Fin de partie', camps: [], resume: 'Hauteur, matériaux et timing des derniers cercles.' },
  ],
  typesBloc: [
    { id: 'build', nom: 'Créatif : construction et édition', duree: 30 },
    { id: 'piecescontrol', nom: 'Pieces control', duree: 45 },
    { id: 'zonewars', nom: 'Zone wars', duree: 45 },
    { id: 'pubs', nom: 'Parties publiques', duree: 60 },
  ],
  rangs: RANGS,
  chiffres: [
    { id: 'placement', nom: 'Placement moyen', unite: '', min: 1, max: 50, decimales: 1, aide: 'Place moyenne du duo sur les parties de cup de la semaine (onglet Compétition du jeu).' },
    { id: 'elims', nom: 'Éliminations par partie', unite: '', min: 0, max: 15, decimales: 1, aide: 'Moyenne de la semaine en classé ou en cup (fin de partie ou Fortnite Tracker).' },
    { id: 'top10', nom: 'Top 10', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Part des parties de cup finies dans les 10 premiers duos.' },
    { id: 'kd', nom: 'K/D', unite: '', min: 0, max: 20, decimales: 2, aide: 'Éliminations divisées par les morts sur la saison (Fortnite Tracker).' },
  ],
  // Barème officiel FNCS 2026 (duos), finales des Majors : top 1 65 pts, 2e 56, 3e 52, 4e 48, 5e 44, 6e 40, puis 2 pts de
  // moins par place jusqu'à la 25e (2 pts), 26e à 50e 0 ; 4 pts par élimination. Autres étapes : 2 pts par élimination
  // (Play-In), 3 (Heats, où le top 1 vaut 1 000 pts et la qualification), 1 (LCQ). FNCS Solos 2026 : top 1 60 pts … 50e 1 pt,
  // 4 pts par élimination en finale.
  score: {
    type: 'classement',
    equipes: 50,
    bareme: {
      places: [65, 56, 52, 48, 44, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, ...new Array(25).fill(0)],
      elimination: 4,
    },
  },
  veto: {
    type: 'aucun',
    formats: [],
    notes: 'Pas de draft : chaque duo choisit son spot librement, mais tout accord entre équipes sur les zones d’atterrissage est interdit (collusion, règlement FNCS 8.2.2). Un spot se garde en gagnant ses contests : toujours prévoir un spot de repli.',
  },
  checklistMatch: [
    { id: 'spot', nom: 'Spot principal et spot de repli choisis' },
    { id: 'rotations', nom: 'Sorties et rotations préparées selon la zone' },
    { id: 'voisins', nom: 'Duos voisins et contests probables identifiés' },
    { id: 'bareme', nom: 'Barème et objectif de points de la session fixés' },
    { id: 'reglages', nom: 'Réglages, raccourcis et connexion vérifiés' },
    { id: 'logistique', nom: 'Horaire, inscription et double authentification vérifiés' },
  ],
  profil: {
    site: 'Fortnite Tracker',
    modele: 'https://fortnitetracker.com/profile/all/{id}',
    format: '^\\S.{1,14}\\S$',
    aide: 'Pseudo Epic (3 à 16 caractères) ; activer les statistiques publiques dans les paramètres du jeu.',
  },
  meta: {
    sources: ['fortnite.com', 'epicgames.com', 'fortnitetracker.com', 'liquipedia.net', 'esports.gg', 'dotesports.com'],
    consigne: 'Vérifier la saison et la dernière mise à jour (notes de patch Epic), le loot pool compétitif (armes, soins, mobilité ajoutés ou retirés), le format FNCS en cours (duos ou solos, étapes, dates), le barème officiel et les règles (storm surge, matériaux), et les rangs du classé. Noter tout changement d’île en début de chapitre ou de saison.',
    pool: false,
  },
  paliers: {
    rangs: ['Non classé à Bronze', 'Argent à Or', 'Platine à Diamant', 'Élite à Champion', 'Unreal, cups et divisions FNCS', 'Top Unreal, FNCS Division 1'],
    resumes: [
      'Découvre l’île, les armes, la construction de base et le classé.',
      'Maîtrise les bases : murs, rampes, soins, sortie de tempête à temps.',
      'Joue en duo : rotations, annonces de dégâts, combats choisis.',
      'Construit et édite sous pression, gère matériaux et fins de partie.',
      'Lit le lobby, joue cups et divisions FNCS avec un rôle précis.',
      'Constance en FNCS, préparation des sessions et leadership.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Visée, changements d’arme, tir sous pression.' },
    { id: 'build', nom: 'Construction et édition', resume: 'Murs, rampes, 90°, éditions, pieces control.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Spot, rotations, zone, ressources, fins de partie.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, dégâts, matériaux, calme.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que son rôle apporte au duo.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Choisir une sensibilité et la garder', 'Sensibilité notée dans le roster et inchangée pendant 2 semaines.'),
    o('build-1-1', 'Fixer ses raccourcis de construction', 'Raccourcis notés dans le roster ; 20 boucles mur-rampe-sol sans erreur de touche en créatif.'),
    o('jeu-1-1', 'Sortir de la tempête à temps', 'Aucune mort dans la tempête sur 5 parties d’affilée.'),
    o('comm-1-1', 'Annoncer chaque ennemi vu', 'Direction (boussole) et distance à chaque contact, sur 3 parties.'),
    o('role-1-1', 'Choisir un rôle dans le duo', 'Rôle fixé avec le coach et tenu sur 10 parties en duo.'),
    o('mental-1-1', 'Jouer régulièrement plutôt que longtemps', '3 sessions d’au moins 45 minutes par semaine pendant 1 mois.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Changer d’arme sans temps mort', 'En créatif, pompe puis arme automatique en moins d’une seconde, 10 fois de suite.'),
    o('build-2-1', 'Monter en 90° proprement', 'En créatif, 5 montées en 90° d’affilée sans tomber.'),
    o('jeu-2-1', 'Garder matériaux et soins', 'Au moins 500 matériaux et 2 soins avant le 4e cercle, sur 5 parties revues.'),
    o('comm-2-1', 'Annoncer ses dégâts', 'Dégâts annoncés à chaque échange (« 120 sur celui de la rampe »), relevés sur 3 parties.'),
    o('role-2-1', 'Connaître ses missions de base', 'Expliquer au coach ce que son rôle fait à l’atterrissage, en rotation et en fin de partie.'),
    o('mental-2-1', 'Couper après une série de morts rapides', 'Pause d’au moins 15 minutes après 3 éliminations avant la mi-partie, respectée pendant 1 mois.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Atteindre 1,5 élimination par partie', 'Moyenne d’au moins 1,5 élimination par partie sur 20 parties classées.'),
    o('build-3-1', 'Éditer vite et juste', 'En créatif, parcours d’éditions (porte, fenêtre, coin) sous 15 secondes, 5 fois de suite.'),
    o('jeu-3-1', 'Tourner tôt', 'Rotation lancée avant la fermeture du cercle dans 8 parties sur 10, relevé en VOD.'),
    o('comm-3-1', 'Annoncer l’état du duo', 'Matériaux, soins et mobilité annoncés avant chaque rotation, relevés en review.'),
    o('role-3-1', 'Tenir son rôle en contest', 'Plan de contest (qui prend quoi, qui couvre) appliqué sur 5 contests revus.'),
    o('mental-3-1', 'Revoir ses propres VOD chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Tirer juste à distance', 'En créatif, 7 tirs sur 10 sur cible mobile à 50 m avec le fusil de la saison.'),
    o('build-4-1', 'Gagner le pieces control', 'En pieces control, 6 rounds sur 10 gagnés contre un joueur de même niveau.'),
    o('jeu-4-1', 'Placement moyen dans le top 15 en cup', 'Placement moyen de 15 ou mieux sur les cups du mois.'),
    o('comm-4-1', 'Proposer des options en cours de partie', 'Au moins une proposition utile par partie (rotation, combat, position), prise ou non par l’IGL.'),
    o('role-4-1', 'Connaître le rôle de son partenaire', 'Missions du partenaire appliquées sur 5 parties d’entraînement sans baisse de placement.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’une mauvaise cup faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Être constant', 'Moins de 20 % d’écart d’éliminations par partie entre la meilleure et la pire semaine du mois.'),
    o('build-5-1', 'Garder la hauteur en fin de partie', 'Hauteur gardée ou reprise dans 6 fins de partie sur 10 en scrims, relevé en VOD.'),
    o('jeu-5-1', 'Repérer les habitudes du lobby', '2 habitudes adverses (spot, rotation, style) relevées par session et transmises à l’IGL.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en fin de partie, sans cri ni parole inutile, relevées en VOD.'),
    o('role-5-1', 'Spécialisation maîtrisée', 'Objectif chiffré de son rôle (éliminations, survie, matériaux) fixé avec le coach et atteint sur un mois.'),
    o('mental-5-1', 'Gérer le stress des sessions officielles', 'Technique de respiration ou de retour au calme utilisée entre les parties d’une session.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Atteindre des chiffres semi-pro', 'Objectifs chiffrés du rôle (éliminations, dégâts, survie) tenus sur 2 mois de scrims et de cups.'),
    o('build-6-1', 'Construire en zone mobile', 'Protections refaites et position tenue dans 7 fins de partie sur 10 en scrims de haut niveau.'),
    o('jeu-6-1', 'Préparer une session officielle', 'Fiche de session (spot, voisins, contests, objectif de points) prête avant chaque FNCS ou cup.'),
    o('comm-6-1', 'Tenir le cap après une mauvaise partie', 'Relance le duo par une annonce de plan, jamais par un reproche, relevé en VOD.'),
    o('role-6-1', 'Être le référent de son rôle', 'Anime une séance de théorie sur son rôle chaque mois.'),
    o('mental-6-1', 'Gérer la pression de la scène', 'Préparation mentale des sessions FNCS ou des LAN (visualisation, routine) appliquée.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer en duo deux fois par semaine', 'Deux sessions en duo chaque semaine pendant 1 mois.'),
    o('coll-1-2', 'Adopter des annonces communes', 'Mêmes mots pour les directions, les dégâts et les matériaux, notés dans l’espace de l’équipe.'),
    o('coll-2-1', 'Un spot pour la saison', 'Spot principal, partage du butin et sortie écrits dans le stratbook.'),
    o('coll-2-2', 'Débriefer chaque session', '10 minutes de débrief à la fin de chaque session en duo.'),
    o('coll-3-1', 'Rotations écrites depuis le spot', '2 chemins de sortie selon la zone, écrits dans le stratbook.'),
    o('coll-3-2', 'Revue VOD hebdomadaire', 'Une revue du duo par semaine pendant 1 mois.'),
    o('coll-4-1', 'Un spot de repli et un plan de contest', 'Spot de repli et plan de contest écrits et testés en cup.'),
    o('coll-4-2', 'Plan de fin de partie écrit', 'Rôles du duo en zone mobile (qui construit, qui tire, qui garde les matériaux) appliqués en scrim.'),
    o('coll-5-1', 'Monter en division FNCS', 'Une division gagnée en Divisional Cups pendant la saison.'),
    o('coll-5-2', 'Fiche du lobby avant chaque session', 'Duos voisins, contests probables et objectif de points notés la veille.'),
    o('coll-6-1', 'Atteindre la Division 1', 'Duo en Division 1 FNCS, porte d’entrée des Play-Ins des Majors.'),
    o('coll-6-2', 'Stratbook à jour sous 72 h', 'Spot, rotations et butin revus dans les 3 jours après chaque mise à jour ou nouvelle saison.'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer en duo : construction de base, spot, sortie de tempête, annonces. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:30', 'build', 'Créatif : construction', 'Murs, rampes et 90°, sans pression de temps.', 'individuel'),
        b(2, '20:30', '21:15', 'theorie', 'Spot et sortie', 'Choisir le spot du duo sur l’île de la saison et son chemin de sortie.'),
        b(2, '21:15', '22:00', 'pubs', 'Parties publiques en duo', 'Annonces de la séance appliquées.'),
        b(3, '20:00', '20:20', 'echauffement', 'Échauffement', 'Créatif : éditions de base.', 'individuel'),
        b(3, '20:20', '22:00', 'classe', 'Classé en duo', 'Atterrir au spot choisi mardi, sortir de la tempête à temps.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(5, '20:00', '20:45', 'zonewars', 'Zone wars', 'Rotations et fins de partie en accéléré.'),
        b(5, '20:45', '21:30', 'classe', 'Classé en duo', ''),
        b(5, '21:30', '22:00', 'vod', 'VOD courte', 'Revoir 2 morts de la semaine.'),
        b(6, '15:00', '16:45', 'scrim', 'Scrims ou tournoi communautaire', 'Contre des duos de niveau proche.'),
        b(6, '16:45', '17:00', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire un stratbook de spot et de rotations, enchaîner pieces control, scrims et cups, revoir les VOD chaque semaine.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'VOD des cups', 'Morts évitables, rotations, fins de partie.'),
        b(1, '21:00', '21:45', 'theorie', 'Spot et rotations', 'Sorties selon la zone, plan de contest.'),
        b(2, '19:30', '20:00', 'build', 'Créatif : échauffement', 'Routine de construction et d’édition.', 'individuel'),
        b(2, '20:00', '20:45', 'piecescontrol', 'Pieces control en duo', ''),
        b(2, '20:45', '22:15', 'classe', 'Classé en duo', ''),
        b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrims', 'Lobby de scrims : rotations et fins de partie.'),
        b(3, '22:00', '22:15', 'debrief', 'Débrief', ''),
        b(4, '20:00', '21:00', 'zonewars', 'Zone wars', 'Rotations et fins de partie.'),
        b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:00', '22:00', 'match', 'Cup', 'Cup en jeu (onglet Compétition).'),
        b(5, '22:00', '22:15', 'debrief', 'Débrief', ''),
        b(6, '14:00', '16:30', 'scrim', 'Scrims ou cup du week-end', ''),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour de la session officielle : fiche du lobby, scrims, fins de partie et objectif de points.',
      blocs: [
        b(1, '19:30', '20:30', 'vod', 'VOD de la session officielle', 'Spot, rotations, fins de partie, décisions de l’IGL.'),
        b(1, '20:30', '21:15', 'theorie', 'Plan de la semaine', 'Spot, contests probables, rotations, objectif de points.'),
        b(2, '19:00', '19:30', 'build', 'Créatif : routine', '', 'individuel'),
        b(2, '19:30', '20:15', 'piecescontrol', 'Pieces control en duo', ''),
        b(2, '20:15', '22:00', 'scrim', 'Scrims', ''),
        b(2, '22:00', '22:15', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '19:30', '20:15', 'zonewars', 'Zone wars', 'Fins de partie : hauteur, protections refaites, surge.'),
        b(3, '20:15', '22:00', 'match', 'Cup', ''),
        b(3, '22:00', '22:15', 'debrief', 'Débrief', ''),
        b(4, '19:00', '20:00', 'theorie', 'Fiche du lobby', 'Duos voisins, contests probables, barème de la session.'),
        b(4, '20:00', '21:45', 'scrim', 'Scrims de répétition', ''),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '21:00', 'scrim', 'Scrims', ''),
        b(5, '21:00', '21:30', 'theorie', 'Plan de session', 'Objectif de points, spot de repli, règles de fin de partie.'),
        b(6, '13:30', '14:15', 'build', 'Échauffement en créatif', '', 'individuel'),
        b(6, '15:00', '18:30', 'match', 'Session officielle', 'FNCS, Divisional Cup ou tournoi.'),
        b(6, '18:30', '18:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait lundi.'),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Créatif : murs, rampes et sols en boucle, sans pression de temps.' },
        { duree: 10, texte: 'Créatif : tir sur cibles fixes au fusil, puis au pompe.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', 'Découvrir l’île de la saison et choisir un spot', 'Raccourcis de construction fixés et notés'],
      conseil: 'Jouer souvent et peu longtemps vaut mieux qu’une longue session par semaine.',
    },
    2: {
      echauffement: [
        { duree: 10, texte: 'Créatif : 90° et éditions de base (porte, fenêtre).' },
        { duree: 10, texte: 'Logiciel d’aim ou créatif : suivi de cible et tir au pompe à courte distance.' },
        { duree: 10, texte: 'Créatif : box fight 1v1 contre un coéquipier.' },
      ],
      hebdo: ['4 sessions dont 2 en duo', 'Une partie revue pour vérifier la sortie de tempête', 'Le spot de la saison reconnu (coffres, butin, sorties)'],
      conseil: 'Noter sa sensibilité et ses raccourcis, puis ne plus y toucher : la régularité construit la mémoire musculaire.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Créatif : parcours d’éditions chronométré.' },
        { duree: 10, texte: 'Logiciel d’aim : suivi et micro-ajustements.' },
        { duree: 10, texte: 'Pieces control 1v1, un seul thème par séance.' },
      ],
      hebdo: ['Revoir une de ses VOD (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions du duo', 'Une séance de zone wars'],
      conseil: 'Chaque séance a un seul thème : mieux vaut un exercice bien fait que dix survolés.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Créatif : routine fixe de 3 parcours, temps notés.' },
        { duree: 10, texte: 'Pieces control contre un joueur de même niveau.' },
        { duree: 15, texte: 'Zone wars à intensité de cup.' },
      ],
      hebdo: ['Une VOD personnelle et une VOD d’un pro de son rôle', 'Fins de partie travaillées en zone wars', 'Deux activités physiques'],
      conseil: 'Suivre ses temps de créatif d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Créatif : routine personnalisée sur ses points faibles.' },
        { duree: 10, texte: 'Pieces control sur les situations de son rôle.' },
        { duree: 15, texte: 'Zone wars à intensité de cup, puis 5 minutes de calme.' },
      ],
      hebdo: ['Analyse des duos voisins de spot', 'Proposition d’une rotation ou d’un plan de fin de partie', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de FNCS.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Créatif : routine de compétition, identique chaque jour.' },
        { duree: 10, texte: 'Pieces control chronométré sur les situations de son rôle.' },
        { duree: 20, texte: 'Zone wars de haut niveau, puis 5 minutes de calme.' },
      ],
      hebdo: ['Fiche de session préparée pour chaque FNCS ou cup', 'Séance de théorie animée sur son rôle (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la mécanique.',
    },
  },
  parRole: {
    igl: [
      'Annoncer en scrim la zone suivante et le chemin de rotation avant chaque fermeture.',
      'Préparer avant chaque session le spot de repli et la règle de contest.',
      'Après chaque partie, noter une décision de rotation à garder et une à changer.',
    ],
    fragger: [
      'Créatif : 20 éditions-tirs (éditer, tirer, refermer) en moins de 3 secondes chacune.',
      'Pieces control : 10 rounds par séance contre un joueur de même niveau.',
      'Suivre ses éliminations et ses dégâts par partie chaque semaine.',
    ],
    support: [
      'Créatif : protéger un coéquipier attaqué (murs, toit) en moins d’une seconde, 10 fois.',
      'Garder 500 matériaux de chaque type pour la fin de partie, sur 5 parties.',
      'Zone wars : traverser 200 m à découvert derrière ses rampes et ses murs (tarping).',
    ],
  },
  seuils: {
    'meca-3-1': { chiffre: 'elims', seuil: 1.5, sens: '>=' },
    'jeu-4-1': { chiffre: 'placement', seuil: 15, sens: '<=' },
  },
  initiale: {
    verifieLe: '2026-10-18',
    patch: '42.40',
    patchDate: '2026-10-15',
    saison: 'Chapitre 7 · Saison 4 « Override »',
    // Une seule île par saison, sans choix : pas de map pool ni de liste de maps (voir vocabulaire.carte).
    mapPool: [],
    maps: [],
    personnages: [],
    tendances: [
      'FNCS 2026 en duos : Global Championship à Anvers les 26 et 27 septembre (50 duos, 12 parties), gagné par le duo de HavoK avec 525 points, 2 de plus que celui d’AURA.',
      'FNCS Solos en cours : Heats les 17 et 18 octobre, LCQ les 19 et 20, finale les 26 et 27 octobre ; barème propre (top 1 à 60 points, 4 points par élimination en finale).',
      'Saison 4 « Override » : la 42.40 du 15 octobre est sa dernière grosse mise à jour (Midas’ Masterpiece retiré) ; fin annoncée par la presse au 31 octobre, puis une mini-saison.',
      'En duo, rotations plus tôt pour rester au-dessus du seuil de storm surge et fins de partie plus agressives ; en classé, les Sprites sont présents mais sans pouvoirs.',
    ],
    sources: [
      'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-2026-official-rules',
      'https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-solos-2026-official-rules',
      'https://www.fortnite.com/competitive/fncs-2026-overview',
      'https://beebom.com/fortnite-global-championship-2026-results/',
      'https://techwiser.com/fortnite-fncs-global-championship-2026-live-results/',
      'https://beebom.com/fortnite-update-42-40-patch-notes/',
      'https://insider-gaming.com/fortnite-chapter-7-season-4-v42-00-patch-notes/',
      'https://www.shacknews.com/article/150316/fortnite-chapter-7-season-4-start-date',
      'https://www.igeeksblog.com/fortnite-chapter-7-season-4-end-date/',
      'https://www.epicgames.com/help/fr/c-Category_Fortnite/c-Fortnite_Gameplay/comment-jouer-au-mode-classe-de-fortnite-a000086834',
      'https://www.thespike.gg/fortnite/beginner-guides/ranked-2026-changes-explained',
      'https://www.playnews.gg/en/guides/fortnite-override-sprites-ranked-abilities-disabled',
      'https://allthings.how/fncs-2026-explained-format-major-1-schedule-summit-lan-and-duo-meta-shifts/',
      'https://tracker.gg/articles/fortnite-fncs-2026-duos-return-10-000-000-prize-pool-and-the-full-road-to-the-global-championship',
      'https://www.epicgames.com/help/en-US/account-c-202300000001645/display-name-c-202300000001753/what-are-the-rules-for-creating-my-display-name-a202300000016056',
    ],
  },
};
