// Rocket League — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://gamewave.fr/rocket-league/rocket-league-patch-v2-76-du-23-septembre-arrivee-de-la-saison-24-les-details/,
//   https://insider-gaming.com/when-does-rocket-league-season-24-start/, https://esports.gg/guides/rocket-league/season-24-rocket-league-breakdown/,
//   https://www.rocketleague.com/news/rocket-league-patch-notes-v2-66, https://www.epicgames.com/help/en-US/c-202300000001622/c-202300000001682/what-are-rocket-league-competitive-ranks-a202300000013438,
//   https://wecoach.gg/fr/blog/article/rocket-league-ranks-tiers-divisions-mmr, https://rocketleague.com/news/rocket-league-championship-series-2026-season,
//   https://blast.tv/rl/news/rlcs-2026-rulebook-changes, https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/2026/Boston_Major,
//   https://cdn.esportsworldcup.com/resources/uploads/EWC_26_Rocket_League_Rulebook_b345848f35.pdf, https://sn9jpk.media.zestyio.com/RLCS-2022-23-Official-Rules--09.16.22-.pdf,
//   https://esports.gg/news/rocket-league/rlcs-2026-world-championship-finals-overview-results/, https://www.sheepesports.com/us/articles/sources-rlcs-2027-to-introduce-new-partner-league-and-revamped-format-with-new-organizations-set/en,
//   https://ballchasing.com (catégories de statistiques des replays), https://cdn.jsdelivr.net/npm/trn-rocket-league@2.6.9/README.md (plateformes du tracker).
// Incertitudes : modèle d'URL du profil RL Tracker Network non testable d'ici (site bloqué par le proxy) et limité aux comptes Epic ;
//   règlement RLCS 2026 complet non consulté (pas de veto d'arène d'après le règlement RLCS 2022-23 et le règlement EWC 2026) ;
//   fin de la saison 24 vers le 9 décembre (esports.gg), non confirmée par Psyonix ; usage des voitures chez les pros : chiffres 2025
//   d'un site non officiel ; seuils (0,5 passe décisive, score de 400) estimés d'après les moyennes pro, sans statistique publique par rang ;
//   RLCS 2027 (ligue partenaire, pause au printemps 2027 pour Unreal Engine 6) : sources anonymes, seul le Kick-Off de Londres est confirmé ;
//   score de la finale des Worlds 2026 (4-0) donné par Sheep Esports, scores de parties incohérents sur esports.gg.
//
// Choix du modèle :
// - Pas de personnages ni de cartes à choisir : en RLCS, les arènes standard sont choisies par les admins, sans veto des équipes.
// - Rôles = positions de la rotation utilisées par les coachs. Chaque joueur passe par les trois en match ; le rôle du roster est la
//   position où il est le plus fort (pression, relais ou dernier défenseur).
// - Rangs : les 22 rangs du classé (Bronze I à Légende supersonique). Chaque rang compte 4 divisions (I à IV), non suivies ici :
//   le roster note le rang, pas la division.

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

const NIVEAUX = [
  ['bronze', 'Bronze'], ['argent', 'Argent'], ['or', 'Or'], ['platine', 'Platine'],
  ['diamant', 'Diamant'], ['champion', 'Champion'], ['grandchampion', 'Grand Champion'],
];
const CHIFFRES_ROMAINS = ['I', 'II', 'III'];

export default {
  id: 'rl',
  nom: 'Rocket League',
  court: 'RL',
  editeur: 'Psyonix (Epic Games)',
  genre: 'sport-auto',
  equipe: { titulaires: 3, remplacants: 1 },   // RLCS : 3 titulaires et 1 remplaçant au plus (plus un coach)

  vocabulaire: {
    personnage: null, personnages: null,
    carte: null, cartes: null,
    manche: 'but', manches: 'buts',
  },

  roles: [
    { id: 'premier', nom: 'Premier homme', court: 'PRE', resume: 'Met la pression sur le ballon et force l’adversaire à jouer vite.' },
    { id: 'deuxieme', nom: 'Deuxième homme', court: 'DEU', resume: 'Soutient l’action, récupère les ballons repoussés et prend le relais.' },
    { id: 'troisieme', nom: 'Troisième homme', court: 'TRO', resume: 'Dernier défenseur : protège le but et relance le jeu.' },
  ],
  camps: [],
  typesStrat: [
    { id: 'kickoff', nom: 'Kickoffs', camps: [], resume: 'Qui part, qui couvre et qui prend le boost à chaque engagement.' },
    { id: 'rotation', nom: 'Rotations', camps: [], resume: 'Ordre de passage, côté de retour et boosts ramassés en tournant.' },
    { id: 'defense', nom: 'Défense', camps: [], resume: 'Shadow defense, couverture du but et choix de celui qui challenge.' },
    { id: 'contre', nom: 'Contre-attaque', camps: [], resume: 'Punir un adversaire sorti ou à court de boost en deux touches.' },
    { id: 'boost', nom: 'Gestion du boost', camps: [], resume: 'Contrôle des gros boosts, vol de boost adverse et petits pads sur la route.' },
    { id: 'mural', nom: 'Jeu mural et aérien', camps: [], resume: 'Centres, passes par le mur et attaques aériennes à deux.' },
    { id: 'finmatch', nom: 'Fin de match', camps: [], resume: 'Protéger une avance, revenir au score et jouer la prolongation.' },
    { id: 'demo', nom: 'Démolitions', camps: [], resume: 'Démolir pour ouvrir le but ou retarder la défense adverse.' },
  ],
  typesBloc: [
    { id: 'freeplay', nom: 'Freeplay (jeu libre)', duree: 20 },
    { id: 'trainingpacks', nom: 'Packs d’entraînement', duree: 30 },
    { id: 'workshop', nom: 'Maps d’entraînement (workshop)', duree: 30 },   // maps de la communauté, PC uniquement
    { id: 'ranked2v2', nom: 'Classé 2v2', duree: 60 },
  ],
  rangs: [
    ...NIVEAUX.flatMap(([id, nom], i) => CHIFFRES_ROMAINS.map((chiffre, j) => ({
      id: `${id}${j + 1}`,
      nom: `${nom} ${chiffre}`,
      n: i * 3 + j + 1,
    }))),
    { id: 'ssl', nom: 'Légende supersonique', n: 22 },
  ],
  chiffres: [
    { id: 'score', nom: 'Score moyen', unite: '', min: 0, max: 1500, decimales: 0, aide: 'Score moyen par match en classé 3v3 sur la semaine (profil du jeu ou tracker).' },
    { id: 'buts', nom: 'Buts par match', unite: '', min: 0, max: 5, decimales: 2, aide: 'Buts ÷ matchs joués sur la semaine (tracker ou ballchasing).' },
    { id: 'arrets', nom: 'Arrêts par match', unite: '', min: 0, max: 8, decimales: 2, aide: 'Arrêts ÷ matchs joués sur la semaine (tracker ou ballchasing).' },
    { id: 'passes', nom: 'Passes décisives par match', unite: '', min: 0, max: 5, decimales: 2, aide: 'Passes décisives ÷ matchs joués sur la semaine (tracker ou ballchasing).' },
    { id: 'tirs', nom: 'Réussite au tir', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Buts ÷ tirs cadrés × 100 (« Shooting % » sur ballchasing).' },
  ],
  // Un score par partie : les buts. Une série se joue en BO5 ou en BO7 (RLCS 2026 : groupes en BO5, playoffs en BO7).
  score: { type: 'simple' },
  veto: {
    type: 'aucun',   // arènes standard imposées par les organisateurs : aucun choix d'arène pour les équipes
    formats: [],
    notes: '',
  },
  checklistMatch: [
    { id: 'replays', nom: 'Replays de l’adversaire revus (kickoffs, défense, joueur clé)' },
    { id: 'kickoffs', nom: 'Kickoffs répartis et variantes prêtes' },
    { id: 'plan', nom: 'Plan de match validé (rythme, boosts à contrôler, fin de match)' },
    { id: 'echauffement', nom: 'Échauffement fait (freeplay, packs, une partie à trois)' },
    { id: 'reglages', nom: 'Réglages, manette et connexion vérifiés' },
    { id: 'logistique', nom: 'Horaire, serveur, lobby et remplaçant confirmés' },
  ],
  profil: {
    site: 'RL Tracker Network',
    modele: 'https://rocketleague.tracker.network/rocket-league/profile/epic/{id}/overview',
    format: '^[^/?#]{3,16}$',
    aide: 'Pseudo Epic Games (3 à 16 caractères) ; le compte Epic doit être lié au jeu.',
  },
  meta: {
    sources: ['rocketleague.com', 'epicgames.com', 'liquipedia.net', 'blast.tv', 'ballchasing.com'],
    consigne: 'Vérifier la saison en cours et le dernier patch (rocketleague.com) : physique, hitbox, classé, modes ajoutés ou retirés.\n'
      + 'Relever le format RLCS en cours (étapes, BO5 ou BO7, Kick-Off, Majors, Worlds) et les résultats récents (Liquipedia, blast.tv).\n'
      + 'Noter les voitures et les hitbox des pros, et les tendances de jeu (kickoffs, rotations, démolitions, jeu aérien).\n'
      + 'Surveiller le passage à Unreal Engine 6 : date, pause compétitive, changements de physique ou de classé.',
    pool: false,
  },
  paliers: {
    rangs: ['Non classé à Bronze', 'Argent à Or', 'Platine à Diamant', 'Champion', 'Grand Champion, tournois amateurs', 'Légende supersonique, semi-pro'],
    resumes: [
      'Découvre le jeu : conduite, saut, boost, tirs simples et règles du classé.',
      'Frappe proprement au sol, revient défendre, ose les premiers aériens.',
      'Tourne avec ses coéquipiers, gère son boost, joue le mur et les aériens rapides.',
      'Contrôle le ballon, enchaîne les passes, kickoffs coordonnés et défense patiente.',
      'Lit l’adversaire, adapte le rythme, met sa mécanique au service de l’équipe.',
      'Constance au plus haut niveau, préparation d’adversaire et leadership.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Conduite, tirs, dribbles au sol, kickoffs, récupérations.' },
    { id: 'aerien', nom: 'Jeu aérien', resume: 'Aériens, jeu mural, contrôle et finition en l’air.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Rotations, boost, lecture du jeu, choix de passe.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, calme, coordination à trois.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que chaque position de la rotation attend de lui.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Choisir sa caméra et ses commandes, puis les garder', 'Réglages notés dans le roster et inchangés pendant 2 semaines.'),
    o('aerien-1-1', 'Toucher le ballon en l’air', '5 ballons touchés sur 10 dans un pack d’aériens débutant.'),
    o('jeu-1-1', 'Revenir derrière le ballon', 'Sur 3 replays, repasse du côté de son but dans 8 attaques adverses sur 10.'),
    o('comm-1-1', 'Annoncer ses intentions', '« Je prends », « à toi » et « je reste » utilisés à chaque partie, sur 3 parties.'),
    o('role-1-1', 'Comprendre les trois positions de la rotation', 'Expliquer au coach le travail du premier, du deuxième et du troisième homme.'),
    o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun message négatif, « Quel arrêt ! » ironique compris, sur 5 parties.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Frapper fort et cadrer au sol', '7 tirs cadrés sur 10 dans un pack de tirs débutant, avec un flip au contact.'),
    o('aerien-2-1', 'Décoller vite vers un ballon haut', 'Double saut et boost : 6 aériens sur 10 touchés vers le but dans un pack.'),
    o('jeu-2-1', 'Ramasser les petits boosts', 'Moins de 10 % du temps à 0 de boost sur 5 replays (ballchasing).'),
    o('comm-2-1', 'Annoncer son boost et sa position', '« 0 de boost » et « je suis dernier » annoncés en vocal, relevé sur 3 parties.'),
    o('role-2-1', 'Tenir la position de troisième homme', 'Sur 3 replays, ne sort pas en même temps que ses deux coéquipiers (une erreur par partie au plus).'),
    o('mental-2-1', 'S’arrêter après 2 défaites de suite', 'Pause d’au moins 15 minutes respectée pendant 1 mois en classé.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Garder le ballon au sol', 'Dribble sur le toit tenu 10 secondes en freeplay, 3 essais sur 5.'),
    o('aerien-3-1', 'Jouer le mur', '6 tirs cadrés sur 10 dans un pack de tirs depuis le mur.'),
    o('jeu-3-1', 'Jouer pour l’équipe plutôt que forcer', '0,5 passe décisive par match en moyenne sur 20 matchs classés 3v3.'),
    o('comm-3-1', 'Annoncer les rotations', '« Je sors », « je reviens », « gros boost à toi » à chaque changement de position, relevé en review.'),
    o('role-3-1', 'Bien jouer deuxième homme', 'Sur 3 replays, en position de reprendre le ballon dans 7 attaques sur 10.'),
    o('mental-3-1', 'Revoir ses replays chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Maîtriser le speed flip', 'Réussi 8 fois sur 10 en freeplay et utilisé à chaque kickoff en match.'),
    o('aerien-4-1', 'Contrôler le ballon en l’air', 'Air dribble depuis le sol ou le mur : 4 réussites sur 10 dans un pack.'),
    o('jeu-4-1', 'Éviter les double-commits', 'Moins de 2 double-commits par partie, relevé sur 5 replays de scrim.'),
    o('comm-4-1', 'Proposer des adaptations entre les parties', 'Une proposition concrète entre chaque partie d’une série, prise ou non par le capitaine.'),
    o('role-4-1', 'Presser sans se faire dribbler', 'En premier homme, 6 challenges sur 10 forcent un dégagement adverse, relevé en replay.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’un mauvais match faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Feinter et flicker en situation', 'Un flick ou une feinte réussi par partie en scrim, relevé sur 3 replays.'),
    o('aerien-5-1', 'Finir en l’air', 'Double touche, tir du plafond ou flip reset : 3 réussites sur 10 en pack, une tentative utile par scrim.'),
    o('jeu-5-1', 'Peser sur chaque match', 'Score moyen de 400 sur 20 matchs classés 3v3.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces courtes en fin de match et en prolongation, sans cri, relevées en VOD.'),
    o('role-5-1', 'Assumer sa spécialité', 'Pression, relais ou dernier défenseur : objectif chiffré fixé avec le coach et atteint sur un mois.'),
    o('mental-5-1', 'Gérer le stress des matchs officiels', 'Technique de respiration ou de retour au calme utilisée entre les parties d’une série.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Mécanique fiable sous pression', 'Moins d’une perte de balle sur geste raté par partie en officiel, relevé sur 5 replays.'),
    o('aerien-6-1', 'Mettre le jeu aérien au service de l’équipe', 'Plus de réussites que de pertes de balle sur ses actions aériennes, relevé sur 5 replays d’officiels.'),
    o('jeu-6-1', 'Lire l’adversaire et s’adapter', '2 habitudes adverses relevées par série et exploitées dès la partie suivante.'),
    o('comm-6-1', 'Tenir le cap après un but encaissé', 'Relance l’équipe par un plan, jamais par un reproche, sur toute une série.'),
    o('role-6-1', 'Être le référent de sa spécialité', 'Anime une séance de théorie (kickoffs, défense ou relances) chaque mois.'),
    o('mental-6-1', 'Routine de performance complète', 'Sommeil, alimentation, échauffement et récupération planifiés les semaines de match.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à trois deux fois par semaine', 'Deux sessions à trois par semaine, avec 10 minutes de débrief, pendant 1 mois.'),
    o('coll-1-2', 'Adopter des annonces communes', 'Liste des annonces de l’équipe notée dans l’espace de l’équipe et utilisée par tous en scrim.'),
    o('coll-2-1', 'Un plan de kickoff par type de départ', 'Qui part, qui couvre et qui prend le boost : écrit pour les départs en diagonale, décalé et au centre.'),
    o('coll-2-2', 'Scrimer chaque semaine', 'Au moins deux scrims contre des équipes de niveau proche chaque semaine pendant 1 mois.'),
    o('coll-3-1', 'Revue de replays collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois.'),
    o('coll-3-2', 'Encaisser moins de 2 buts par partie', 'Moyenne sur 10 parties de scrim contre des équipes de niveau proche.'),
    o('coll-4-1', 'Gagner la moitié des kickoffs', 'Ballon gagné ou neutralisé sur 50 % des kickoffs, relevé sur 20 kickoffs de scrim.'),
    o('coll-4-2', 'Plan de fin de match écrit', 'Conduite quand on mène ou qu’on est mené dans la dernière minute, appliquée en scrim.'),
    o('coll-5-1', 'Anti-strat avant chaque officiel', 'Fiche adversaire prête la veille de chaque match officiel.'),
    o('coll-5-2', 'Adapter entre les parties', 'Décision prise entre deux parties d’une série sur des faits, notée dans la fiche du match.'),
    o('coll-6-1', 'Préparation adverse systématique', 'Au moins 2 séries de l’adversaire analysées avant chaque officiel.'),
    o('coll-6-2', 'Viser les phases finales', 'Top 32 d’un tournoi ouvert européen de référence (Open RLCS ou équivalent).'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer à trois : rotation, kickoffs, annonces, premiers automatismes. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:20', 'freeplay', 'Échauffement en freeplay', 'Conduite, demi-tours, sauts et petits boosts.', 'individuel'),
        b(2, '20:20', '21:00', 'theorie', 'Rotations et kickoffs', 'Les trois positions de la rotation, qui part et qui couvre au kickoff.'),
        b(2, '21:00', '22:00', 'classe', 'Classé 3v3 à trois', 'Appliquer la rotation vue juste avant.'),
        b(2, '22:00', '22:15', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(3, '20:00', '20:30', 'trainingpacks', 'Packs débutants', 'Tirs au sol et premiers aériens.', 'individuel'),
        b(3, '20:30', '21:15', 'ranked2v2', 'Classé 2v2 en duo', 'Avec un coéquipier : revenir derrière le ballon.', 'individuel'),
        b(5, '20:00', '20:15', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:15', '21:30', 'scrim', 'Scrim amical', 'BO5 contre une équipe de niveau proche.'),
        b(5, '21:30', '21:50', 'debrief', 'Débrief', ''),
        b(6, '14:00', '14:20', 'freeplay', 'Freeplay', 'Dribbles au sol et récupérations.', 'individuel'),
        b(6, '14:20', '15:50', 'classe', 'Classé 3v3 à trois', 'Annonces communes à chaque action.'),
        b(6, '15:50', '16:30', 'vod', 'Replays', 'Revoir 3 buts encaissés de la semaine.'),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire le stratbook, enchaîner packs et scrims, revoir les replays chaque semaine.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'Replays du week-end', 'Scrim ou match du samedi : 3 buts marqués, 3 buts encaissés.'),
        b(1, '21:00', '21:45', 'theorie', 'Stratbook de la semaine', 'Kickoffs, défense et plan de boost à travailler.'),
        b(2, '19:30', '19:45', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '19:45', '20:30', 'trainingpacks', 'Packs de la semaine', 'Packs liés aux objectifs de chacun.', 'individuel'),
        b(2, '20:30', '22:30', 'scrim', 'Scrim BO7', ''),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '20:00', '20:45', 'workshop', 'Maps d’entraînement', 'Parcours aériens et dribbles sur PC, sinon packs d’aériens.', 'individuel'),
        b(3, '20:45', '22:00', 'ranked2v2', 'Classé 2v2 en duo', 'Duos de l’équipe : appels et passes.', 'individuel'),
        b(5, '19:30', '19:45', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:45', '21:45', 'scrim', 'Scrim BO7', ''),
        b(5, '21:45', '22:05', 'debrief', 'Débrief', ''),
        b(6, '14:00', '14:30', 'echauffement', 'Échauffement collectif', 'Freeplay puis kickoffs en partie privée.'),
        b(6, '14:30', '16:30', 'match', 'Tournoi ou match officiel', 'Tournoi en ligne du week-end.'),
        b(6, '16:30', '16:50', 'debrief', 'Débrief', ''),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour du match officiel : anti-strat, scrims de répétition, kickoffs du plan de match.',
      blocs: [
        b(2, '19:00', '19:30', 'echauffement', 'Échauffement', 'Freeplay et packs personnels.', 'individuel'),
        b(2, '19:30', '20:30', 'vod', 'Replays du dernier officiel', 'Kickoffs, rotations et buts encaissés.'),
        b(2, '20:30', '22:30', 'scrim', 'Scrim BO7', ''),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:45', 'trainingpacks', 'Packs personnels', 'Points faibles relevés en replay.', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrim BO7', ''),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '19:00', '20:00', 'theorie', 'Anti-strat', 'Fiche de l’adversaire : kickoffs, joueur clé, sorties de défense.'),
        b(4, '20:00', '22:00', 'scrim', 'Scrim contre un style proche', 'Une équipe qui joue comme l’adversaire du week-end.'),
        b(4, '22:00', '22:15', 'debrief', 'Débrief', ''),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '21:30', 'scrim', 'Scrim de répétition', ''),
        b(5, '21:30', '22:00', 'theorie', 'Plan de match', 'Kickoffs, rythme, boosts à contrôler, plan si mené.'),
        b(6, '13:00', '13:45', 'echauffement', 'Échauffement collectif et kickoffs', 'Partie privée : kickoffs du plan de match.'),
        b(6, '14:00', '17:00', 'match', 'Match officiel', ''),
        b(6, '17:00', '17:15', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait mardi.'),
        b(7, '11:00', '11:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Freeplay : conduite, demi-tours, sauts et petits boosts.' },
        { duree: 10, texte: 'Pack de tirs débutant : frapper avec un flip au contact.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', '2 packs d’entraînement avant chaque session', 'Une partie privée pour découvrir les kickoffs'],
      conseil: 'Garder la même caméra et les mêmes commandes : la mémoire musculaire se construit avec la régularité.',
    },
    2: {
      echauffement: [
        { duree: 10, texte: 'Freeplay : tirs forts au sol et premiers aériens.' },
        { duree: 10, texte: 'Pack d’aériens débutant.' },
        { duree: 10, texte: 'Une partie de classé 1v1 ou 2v2 pour se mettre en route.' },
      ],
      hebdo: ['4 sessions dont 2 à trois', 'Un pack de défense par semaine', 'Revoir 3 buts encaissés en replay'],
      conseil: 'Jouer souvent et peu longtemps vaut mieux qu’une longue session par semaine.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Freeplay : dribble sur le toit et contrôles.' },
        { duree: 10, texte: 'Pack de tirs depuis le mur.' },
        { duree: 10, texte: 'Pack de défense : arrêts et dégagements vers les côtés.' },
      ],
      hebdo: ['Revoir un de ses replays (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Classé 2v2 avec un coéquipier : appels et passes'],
      conseil: 'Chaque séance a un seul thème : mieux vaut un pack bien fait que dix survolés.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Freeplay : speed flips et wave dashes.' },
        { duree: 10, texte: 'Packs fixes de la semaine, scores notés.' },
        { duree: 15, texte: 'Classé 1v1 ou maps d’entraînement à intensité de match.' },
      ],
      hebdo: ['Un replay personnel et un replay d’un joueur pro de sa spécialité', 'Kickoffs révisés en partie privée', 'Deux activités physiques'],
      conseil: 'Suivre ses scores de packs d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Packs personnalisés sur ses points faibles.' },
        { duree: 10, texte: 'Maps d’entraînement ou freeplay : enchaînements aériens.' },
        { duree: 15, texte: 'Classé 2v2 à intensité de match, puis 5 minutes au calme.' },
      ],
      hebdo: ['Analyse de 2 adversaires potentiels', 'Une proposition de plan pour l’équipe (kickoff, défense ou boost)', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Routine de compétition identique chaque jour : freeplay et packs fixes.' },
        { duree: 10, texte: 'Kickoffs chronométrés en freeplay.' },
        { duree: 20, texte: 'Classé 1v1 ou duel contre un coéquipier.' },
      ],
      hebdo: ['Fiche adverse préparée pour chaque officiel', 'Séance de théorie animée sur sa spécialité (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la mécanique.',
    },
  },
  parRole: {
    premier: [
      'Kickoffs : speed flip et 3 variantes (frappe, feinte, ballon côté) répétés 20 fois en freeplay.',
      'Pression au ballon en partie privée : forcer un dégagement sans se faire dribbler, 10 répétitions.',
      'Après chaque challenge, revenir par un boost côté extérieur, relevé sur 3 replays.',
    ],
    deuxieme: [
      'Packs de reprises : remettre vers le but en une touche les ballons dégagés ou repoussés.',
      'Partie privée à 2 contre 1 : suivre l’action à distance de relais et reprendre les rebonds.',
      'Passer quand un coéquipier est mieux placé : 2 passes utiles par partie, relevé en replay.',
    ],
    troisieme: [
      'Packs de défense : arrêts, shadow defense et dégagements vers les côtés.',
      'Garder une moyenne de boost d’au moins 30 sur la partie (ballchasing) et ne jamais revenir défendre à 0.',
      'Relances longues vers un coéquipier plutôt qu’au centre, 10 répétitions en partie privée.',
    ],
  },
  seuils: {
    'jeu-3-1': { chiffre: 'passes', seuil: 0.5, sens: '>=' },
    'jeu-5-1': { chiffre: 'score', seuil: 400, sens: '>=' },
  },
  initiale: {
    verifieLe: '2026-10-18',
    patch: 'v2.76',
    patchDate: '2026-09-23',
    saison: 'Saison 24 (depuis le 23 septembre 2026)',
    mapPool: [],
    maps: [],
    personnages: [],
    tendances: [
      'Saison 24 (v2.76, 23 septembre) sans changement de physique ni de classé : duels d’honneur, mode Bullet Ball, tableau de score personnalisable et caméra libre au clavier-souris.',
      'Depuis la saison 22 (mars 2026) : indicateur de recharge des gros boosts, indicateur de flip reset et MMR visible en option ; le contrôle du boost se lit mieux des deux côtés.',
      'La hitbox Octane (Octane, Fennec) reste majoritaire chez les pros, le Dominus sert d’alternative pour les flicks ; aucune voiture récente n’a changé la méta.',
      'Team Falcons championne du monde (Fort Worth, 4-0 contre Spacestation) ; Karmine Corp a gagné le Major de Paris, Gentle Mates celui de Boston ; RLCS 2027 débute à Londres (9–13 déc.).',
    ],
    sources: [
      'https://gamewave.fr/rocket-league/rocket-league-patch-v2-76-du-23-septembre-arrivee-de-la-saison-24-les-details/',
      'https://insider-gaming.com/when-does-rocket-league-season-24-start/',
      'https://esports.gg/guides/rocket-league/season-24-rocket-league-breakdown/',
      'https://www.rocketleague.com/news/rocket-league-patch-notes-v2-66',
      'https://games.gg/news/rocket-league-season-22-introduces-key-gameplay-improvements/',
      'https://www.epicgames.com/help/en-US/c-202300000001622/c-202300000001682/what-are-rocket-league-competitive-ranks-a202300000013438',
      'https://wecoach.gg/fr/blog/article/rocket-league-ranks-tiers-divisions-mmr',
      'https://rocketleague.com/news/rocket-league-championship-series-2026-season',
      'https://blast.tv/rl/news/rlcs-2026-rulebook-changes',
      'https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/2026/Boston_Major',
      'https://cdn.esportsworldcup.com/resources/uploads/EWC_26_Rocket_League_Rulebook_b345848f35.pdf',
      'https://sn9jpk.media.zestyio.com/RLCS-2022-23-Official-Rules--09.16.22-.pdf',
      'https://esports.gg/news/rocket-league/rlcs-2026-world-championship-finals-overview-results/',
      'https://www.sheepesports.com/de/articles/team-falcons-dismantle-spacestation-gaming-to-win-the-rlcs-2026-world-championship/en',
      'https://www.sheepesports.com/de/articles/rlcs-2026-world-championship-power-rankings/en',
      'https://www.sheepesports.com/us/articles/sources-rlcs-2027-to-introduce-new-partner-league-and-revamped-format-with-new-organizations-set/en',
      'https://www.trophi.ai/post/rocket-league-ue6-revealed-at-rlcs-2026-paris-major',
      'https://immortalboost.com/blog/rocket-league/best-rocket-league-cars/',
      'https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/2021-22/Statistics',
    ],
  },
};
