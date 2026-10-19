// Rainbow Six Siege X — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://news.ubisoft.com/en-us/article/1yzD1EJhuk6vXsTt8eP1hf/rainbow-six-siege-operation-split-fire-midseason-update-legend-division-arrives-noor-buffs-and-a-final-ranked-map-rotation,
//   https://mp1st.com/title-updates-and-patches/rainbow-six-siege-split-fire-update-released-september-1-patch-3-46-1-000-151,
//   https://www.ubisoft.com/en-gb/game/rainbow-six/siege/game-info/operators,
//   https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/5fzYRZKVVHqqRkkv3m4MyF/ranked-30-update,
//   https://staticctf.ubisoft.com/p0f8o8d25gmk/4vLmovz8mJb3XUEdtHZBJA/6197432ac2a70efae6b9c243bc9c0b40/Global_Rulebook_BLASTR6_Season_2026_Kickoff_Update.pdf,
//   https://esports.gg/news/rainbow-six-siege/r6-finals-ewc-2026-winners-overview/ (liste complète dans initiale.sources)
// Incertitudes : map pool pro = règlement BLAST R6 de mars 2026 (avec Consulate), mais la rotation classée du 15/10/2026
//   range Villa parmi les « Pro Maps » à la place de Consulate : changement possible pour le Major d’Osaka ou la saison
//   2027, aucun règlement à jour trouvé ; prolongation décrite par les seuls réglages du lobby (3 rounds ou illimitée,
//   écart 2, changement de camp 1), scores 8-6 et 8-7 constatés à l’EWC 2026 ; numéro de la mise à jour du 15/10
//   non publié ; modèle d’URL de R6 Tracker non vérifiable en direct (page protégée) ; règles du nom Ubisoft tirées
//   d’un guide tiers ; KOST absent du jeu, relevé à la main ; répartition des opérateurs par rôle = choix maison.
//
// Opérateurs : 78 au 18/10/2026 (39 attaquants, 39 défenseurs), chacun n’existe que d’un côté → `camp` + personnagesParCamp.
// Rôles : rôles de joueur. Chaque opérateur reçoit le rôle qu’il sert le plus souvent :
//   attaque → entry (premier contact), breacher (ouvre murs renforcés, trappes, sols), support (utilitaires
//   d’exécution, anti-gadget, plant), flex (info, chasse aux roamers, contrôle de map) ;
//   défense → ancre (tient le site), roamer (joue hors site), support (anti-gadget, pièges, déni de zone).
//   Un joueur garde un rôle principal (ex. un breacher joue souvent ancre en défense) : à ajuster selon la compo.

import { INITIALE } from './r6-initiale.js';

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

// Classé 3.0 (depuis le 2 juin 2026) : 8 rangs de 5 divisions (V à I), puis la division Légende (depuis le 15/10/2026).
const RANGS_R6 = [['cuivre', 'Cuivre'], ['bronze', 'Bronze'], ['argent', 'Argent'], ['or', 'Or'], ['platine', 'Platine'], ['emeraude', 'Émeraude'], ['diamant', 'Diamant'], ['champion', 'Champion']];
const DIVISIONS = [[5, 'V'], [4, 'IV'], [3, 'III'], [2, 'II'], [1, 'I']];

export default {
  id: 'r6',
  nom: 'Rainbow Six Siege X',
  court: 'R6',
  editeur: 'Ubisoft',
  genre: 'fps-tactique',
  equipe: { titulaires: 5, remplacants: 2 },

  vocabulaire: {
    personnage: 'opérateur', personnages: 'opérateurs',
    carte: 'map', cartes: 'maps',
    manche: 'round', manches: 'rounds',
  },

  roles: [
    { id: 'entry', nom: 'Entry', court: 'ENT', resume: 'Prend le premier contact en attaque et ouvre l’espace sur le site.' },
    { id: 'breacher', nom: 'Breacher', court: 'BRE', resume: 'Ouvre les murs renforcés, les trappes et les sols pour créer l’accès au site.' },
    { id: 'support', nom: 'Support', court: 'SUP', resume: 'Met ses gadgets au service de l’équipe : anti-gadget, fumées, flashs, pièges.' },
    { id: 'flex', nom: 'Flex', court: 'FLX', resume: 'Info et contrôle de map : chasse les roamers et comble le rôle qui manque.' },
    { id: 'ancre', nom: 'Ancre', court: 'ANC', resume: 'Tient le site en défense jusqu’au bout et empêche la pose du défuseur.' },
    { id: 'roamer', nom: 'Roamer', court: 'ROA', resume: 'Joue hors du site en défense pour retarder l’attaque et prendre les flancs.' },
  ],
  camps: [
    { id: 'att', nom: 'Attaque' }, { id: 'def', nom: 'Défense' },
  ],
  personnagesParCamp: true,
  typesStrat: [
    { id: 'default', nom: 'Default', camps: ['att'], resume: 'Drones, contrôle de map et prise d’info avant de choisir l’entrée.' },
    { id: 'execute', nom: 'Exécution', camps: ['att'], resume: 'Ouverture coordonnée du site : anti-gadget, hard breach, entrée et plant.' },
    { id: 'fake', nom: 'Fake', camps: ['att'], resume: 'Faire tourner la défense avant de frapper ailleurs.' },
    { id: 'postplant', nom: 'Post-plant', camps: ['att'], resume: 'Positions et gadgets pour protéger le défuseur posé.' },
    { id: 'setup', nom: 'Setup', camps: ['def'], resume: 'Site choisi, renforts, gadgets et position de chacun pendant la préparation.' },
    { id: 'roam', nom: 'Roam', camps: ['def'], resume: 'Plan des roamers : où retarder, quand revenir vers le site.' },
    { id: 'denial', nom: 'Denial', camps: ['def'], resume: 'Empêcher la pose du défuseur : gadgets et tirs à travers sols et murs.' },
    { id: 'retake', nom: 'Retake', camps: ['def'], resume: 'Reprendre le site et désactiver le défuseur après le plant.' },
  ],
  typesBloc: [
    { id: 'aim', nom: 'Aim et recul', duree: 45 },
    { id: 'arcade', nom: 'Arcade (deathmatch, 1v1, 3v3)', duree: 30 },
    { id: 'drone', nom: 'Drones et préparation', duree: 45 },
    { id: 'practice', nom: 'Practice (exécutions, retakes)', duree: 90 },
  ],
  rangs: [
    ...RANGS_R6.flatMap(([id, nom], i) => DIVISIONS.map(([d, romain], j) => ({ id: `${id}${d}`, nom: `${nom} ${romain}`, n: i * 5 + j + 1 }))),
    { id: 'legende', nom: 'Légende', n: 41 },
  ],
  chiffres: [
    { id: 'kd', nom: 'K/D', unite: '', min: 0, max: 5, decimales: 2, aide: 'Éliminations divisées par morts en classé sur la semaine (R6 Tracker).' },
    { id: 'victoires', nom: 'Victoires', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Part des parties classées gagnées dans la semaine (R6 Tracker).' },
    { id: 'hs', nom: 'HS %', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Part des éliminations à la tête (R6 Tracker).' },
    { id: 'kost', nom: 'KOST', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Rounds avec un kill, l’objectif, la survie ou un échange : relevé sur les scrims de la semaine.' },
  ],
  // Format pro (règlement BLAST R6 2026) : 12 rounds réglementaires, changement de camp après le 6e, premier à 7.
  // À 6-6, prolongation de 3 rounds au plus (ou illimitée selon la compétition, avec 2 rounds d’écart) : 8-6 ou 8-7.
  // Pas d’économie, donc pas de round pistol.
  score: { type: 'manches', gagnant: 7, miTemps: 6, pistols: false },
  // Règlement BLAST R6 2026 (mars), pool de 9 maps ; A = vainqueur du tirage au sort qui choisit de bannir en premier.
  // BO1 : 7 bans alternés, puis B choisit la map parmi les 2 restantes (A choisit son camp).
  // BO3 : 4 bans, 2 picks, 2 bans, décisive. BO5 en élimination simple : 2 bans, 2 picks, 2 bans, 2 picks, décisive
  // (en double élimination, l’équipe du haut de tableau commence par un pick).
  veto: {
    type: 'cartes',
    formats: [
      { id: 'bo1', nom: 'BO1', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'ban'], ['B', 'ban'], ['A', 'ban'], ['B', 'ban'], ['A', 'ban'], ['B', 'pick']] },
      { id: 'bo3', nom: 'BO3', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], ['A', 'ban'], ['B', 'ban'], [null, 'decisive']] },
      { id: 'bo5', nom: 'BO5', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], ['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], [null, 'decisive']] },
    ],
    notes: 'Bans d’opérateurs (BLAST R6 2026) : chaque équipe bannit 2 opérateurs adverses avant le round 1, puis 1 de plus avant le round 4. '
      + 'Remise à zéro au changement de camp (même schéma aux rounds 7 et 10) ; aucun nouveau ban en prolongation.',
  },
  checklistMatch: [
    { id: 'vod', nom: 'VOD de l’adversaire revues' },
    { id: 'veto', nom: 'Plan de veto validé' },
    { id: 'bans', nom: 'Bans d’opérateurs choisis pour chaque camp' },
    { id: 'setups', nom: 'Setups et renforts fixés pour les maps probables' },
    { id: 'antistrat', nom: 'Anti-strats travaillées (roamers, sites préférés)' },
    { id: 'logistique', nom: 'Horaire, lien du lobby et remplaçant confirmés' },
  ],
  profil: {
    site: 'R6 Tracker',
    modele: 'https://r6.tracker.network/r6siege/profile/ubi/{id}/overview',
    format: '^[A-Za-z0-9._-]{3,15}$',
    aide: 'Nom Ubisoft : 3 à 15 caractères (lettres, chiffres, point, tiret, tiret bas).',
  },
  meta: {
    sources: ['ubisoft.com', 'siege.gg', 'liquipedia.net', 'esports.gg', 'r6.tracker.network'],
    consigne: 'Vérifie d’abord les notes de patch Ubisoft : saison et mise à jour en cours (Y11S3.x…), opérateurs ajoutés ou modifiés, maps retravaillées et classé (Ranked 3.0, division Légende). '
      + 'Vérifie dans le dernier règlement BLAST R6 le map pool compétitif (9 maps, Villa ou Consulate), l’ordre de veto, les bans d’opérateurs et la prolongation. '
      + 'Relève sur siege.gg ou Liquipedia les opérateurs les plus choisis et bannis du dernier Major ou de l’EWC, et les maps les plus jouées. '
      + 'Ignore le serveur de test et les fuites.',
    pool: true,
  },
  paliers: {
    rangs: ['Non classé à Cuivre', 'Bronze à Argent', 'Or', 'Platine à Émeraude', 'Diamant, tournois amateurs', 'Champion et Légende, semi-pro'],
    resumes: [
      'Découvre les opérateurs, les maps, les drones et les renforts.',
      'Maîtrise les bases : viseur à hauteur de tête, recul, drone avant d’entrer.',
      'Utilise ses gadgets avec un but, communique clairement, comprend le temps du round.',
      'Exécute des plans d’équipe : breach, anti-gadget, plant et denial.',
      'Lit l’adversaire, s’adapte en cours de match, tient un rôle précis.',
      'Constance à haut niveau, anti-strat, bans préparés et leadership.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Visée, recul, peeks, lean, duels.' },
    { id: 'util', nom: 'Gadgets et destruction', resume: 'Drones, renforts, hard breach, gadgets et utilitaires.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Info, temps du round, placement, plant et denial.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, calme, coordination.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que son rôle attend de lui à chaque round.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Régler ses sensibilités et les garder', 'Sensibilité et multiplicateur de visée notés dans le roster, inchangés pendant 2 semaines.'),
    o('util-1-1', 'Renforcer et droner à chaque round', 'Sur 3 parties : ses renforts posés pendant la préparation en défense, son drone utilisé avant d’entrer en attaque.'),
    o('jeu-1-1', 'Comprendre le round', 'Explique au coach : poser le défuseur ou éliminer l’équipe adverse en attaque, le défendre en défense, et à quoi sert la préparation.'),
    o('comm-1-1', 'Annoncer chaque ennemi vu', 'Nombre, étage et pièce (« un en haut, cuisine ») à chaque contact, sur 3 parties.'),
    o('role-1-1', 'Choisir un rôle principal', 'Rôle fixé avec le coach, 2 opérateurs de ce rôle joués 10 parties chacun.'),
    o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun reproche ni tir allié volontaire sur 5 parties.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Contrôler le recul de son arme', 'Au stand de tir, 20 balles sur 30 dans la silhouette à 15 m avec son arme principale.'),
    o('util-2-1', 'Connaître les renforts de chaque site', 'Plan de renforts récité pour chaque site du pool ; aucun renfort gaspillé sur 3 VOD.'),
    o('jeu-2-1', 'Jouer à portée d’échange', 'Sur 3 VOD, au moins 6 morts sur 10 pouvaient être échangées par un coéquipier.'),
    o('comm-2-1', 'Faire des annonces courtes', 'Format qui, où, état (« Ash en haut, salle à manger, touchée ») relevé en review.'),
    o('role-2-1', 'Connaître ses positions de départ', 'Positions d’attaque et de défense de son rôle validées par le coach sur chaque map du pool.'),
    o('mental-2-1', 'S’arrêter après deux défaites de suite', 'Pause d’au moins 15 minutes respectée pendant 1 mois en classé.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Atteindre 45 % de headshots', 'Moyenne d’au moins 45 % sur 4 semaines (R6 Tracker).'),
    o('util-3-1', 'Coordonner breach et anti-gadget', 'Une ouverture par map du pool (hard breach protégé par l’anti-gadget) réussie 4 fois sur 5 en practice.'),
    o('jeu-3-1', 'Décider sur l’info et le chrono', 'Entrer, attendre ou changer de site selon le drone et le temps restant : choix justifiés en review sur 3 parties.'),
    o('comm-3-1', 'Donner les infos de timing', 'Annonces du type « roamer vu à l’étage il y a 15 s » relevées en review.'),
    o('role-3-1', 'Connaître son rôle dans chaque plan', 'Rôle récité et exécuté sans erreur en practice pour chaque exécution et chaque setup du stratbook.'),
    o('mental-3-1', 'Revoir ses VOD chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Atteindre un K/D de 1,0', 'K/D moyen d’au moins 1,0 sur 4 semaines (R6 Tracker).'),
    o('util-4-1', 'Protéger et empêcher le plant', 'Sur chaque site du pool : 2 façons de couvrir le défuseur en attaque et 2 de l’empêcher en défense, réussies 9 fois sur 10.'),
    o('jeu-4-1', 'Planter avec du temps', 'Défuseur posé avec au moins 30 s restantes dans 7 plants sur 10, relevé en VOD.'),
    o('comm-4-1', 'Communiquer en retake', 'Position, gadgets restants et plan annoncés avant chaque retake.'),
    o('role-4-1', 'Jouer un second rôle', '2 opérateurs d’un autre rôle prêts à être joués en scrim.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’un mauvais match faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Être constant', 'Moins de 10 % d’écart de K/D et de headshots entre la meilleure et la pire semaine du mois.'),
    o('util-5-1', 'Créer des setups inédits', 'Un nouveau setup ou une nouvelle ouverture par map et par mois ajouté au stratbook.'),
    o('jeu-5-1', 'Peser sur chaque round', 'KOST moyen d’au moins 65 % sur 4 semaines de scrims.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en clutch et en retake, sans cri ni parole inutile, relevées en VOD.'),
    o('role-5-1', 'Objectif chiffré de rôle atteint', 'Objectif fixé avec le coach (ex. entry : plus de premiers kills que de premières morts) tenu sur un mois.'),
    o('mental-5-1', 'Gérer le stress des officiels', 'Technique de respiration ou de retour au calme utilisée aux temps morts et au changement de camp.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Chiffres semi-pro sur la durée', 'K/D d’au moins 1,1 et KOST d’au moins 70 % tenus sur 2 mois de scrims et d’officiels.'),
    o('util-6-1', 'Rester imprévisible', '3 variantes d’ouverture ou de setup pour le site principal de chaque map du pool.'),
    o('jeu-6-1', 'Préparer un adversaire', 'Fiche anti-strat (bans, sites défendus, roamers, habitudes) prête avant chaque officiel.'),
    o('comm-6-1', 'Tenir le cap après un mauvais round', 'Relance l’équipe par une annonce de plan, jamais par un reproche, relevé en VOD.'),
    o('role-6-1', 'Deux rôles au niveau compétition', 'Peut jouer un second rôle en officiel sans baisse de ses chiffres.'),
    o('mental-6-1', 'Gérer la pression de la scène', 'Préparation mentale des LAN et des finales (visualisation, routine) appliquée.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à 5 deux fois par semaine', 'Deux sessions à 5 chaque semaine pendant 1 mois.'),
    o('coll-1-2', 'Adopter des callouts communs', 'Même nom pour chaque pièce de chaque map du pool, noté dans l’espace de l’équipe.'),
    o('coll-2-1', 'Un default et deux setups par map', 'Default d’attaque et setup des 2 sites les plus joués écrits pour chaque map du pool.'),
    o('coll-2-2', 'Bans d’opérateurs préparés', 'Liste de bans en attaque et en défense écrite pour chaque map du pool.'),
    o('coll-3-1', 'Deux exécutions par map', '2 exécutions (anti-gadget, breach, plant) par map du pool, maîtrisées en practice.'),
    o('coll-3-2', 'Revue VOD collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois.'),
    o('coll-4-1', 'Échanger 70 % des morts', 'Mesuré sur 5 scrims revus en VOD.'),
    o('coll-4-2', 'Post-plant et retake écrits', 'Post-plant et retake de chaque site joué écrits dans le stratbook.'),
    o('coll-5-1', 'Anti-strat avant chaque officiel', 'Fiche adversaire (bans, sites défendus, roamers) prête la veille de chaque match officiel.'),
    o('coll-5-2', 'Cinq maps prêtes', '5 maps du pool en Pick ou Confort, préparation d’au moins 70 %.'),
    o('coll-6-1', 'Map pool complet', '7 maps sur 9 jouables en officiel de haut niveau.'),
    o('coll-6-2', 'Stratbook à jour sous 72 h', 'Mise à jour dans les 3 jours après chaque patch ou changement de map.'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer ensemble : rôles, callouts, drones, renforts, premiers setups. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:20', 'echauffement', 'Échauffement', 'Stand de tir puis Arcade.', 'individuel'),
        b(2, '20:20', '21:20', 'theorie', 'Maps et rôles', 'Une map du pool : étages, sites, murs destructibles, rôle de chacun en attaque et en défense.'),
        b(2, '21:20', '22:00', 'drone', 'Drones et renforts', 'Partie personnalisée : parcours de drone en préparation, plan de renforts d’un site.'),
        b(3, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:20', '22:00', 'classe', 'Classé à 5', 'Deux parties en groupe (3 rangs d’écart au plus, 2 en Diamant et Champion).'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(5, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:20', '21:30', 'practice', 'Default et setup de base', 'Partie personnalisée : default d’attaque et setup de défense communs.'),
        b(5, '21:30', '22:00', 'vod', 'VOD courte', 'Revoir 3 rounds clés de la partie de mercredi.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim amical', 'Contre une équipe de niveau proche, en 12 rounds.'),
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
        b(1, '21:00', '21:45', 'theorie', 'Stratbook de la semaine', 'Valider les exécutions, setups et bans à travailler.'),
        b(2, '19:30', '20:00', 'echauffement', 'Échauffement', 'Stand de tir puis Arcade.', 'individuel'),
        b(2, '20:00', '21:30', 'practice', 'Practice des exécutions', 'Anti-gadget, hard breach et plant : 5 répétitions par site.'),
        b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrim BO2', 'Deux maps du pool.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '20:00', '20:45', 'aim', 'Travail individuel', 'Programme individuel : aim, recul, gadgets de ses opérateurs.', 'individuel'),
        b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:00', '22:00', 'scrim', 'Scrim BO2', ''),
        b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(6, '14:00', '15:00', 'practice', 'Retakes et denial', 'Reprendre chaque site et empêcher le plant.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim ou tournoi', ''),
        b(6, '17:00', '17:15', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour du match officiel : anti-strat, bans, scrims sur la map attendue, lundi sans jeu.',
      blocs: [
        b(2, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '19:30', '20:30', 'vod', 'VOD du dernier officiel', ''),
        b(2, '20:30', '22:30', 'scrim', 'Scrim BO2', ''),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '19:30', '21:00', 'practice', 'Nouvelles exécutions et setups', 'Ouvertures, fakes et setups ajoutés cette semaine.'),
        b(3, '21:00', '23:00', 'scrim', 'Scrim BO2', ''),
        b(4, '19:00', '20:00', 'theorie', 'Anti-strat et bans', 'Fiche de l’adversaire : bans habituels, sites défendus, roamers.'),
        b(4, '20:00', '22:00', 'scrim', 'Scrim sur la map du match', ''),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '21:30', 'scrim', 'Scrim de répétition', ''),
        b(5, '21:30', '22:00', 'theorie', 'Plan de match', 'Veto, bans d’opérateurs, setups et plan de changement de camp.'),
        b(6, '13:00', '13:30', 'arcade', 'Arcade d’avant-match', '', 'individuel'),
        b(6, '13:30', '14:15', 'drone', 'Préparation et drones', 'Parcours de drone et renforts des maps du veto.'),
        b(6, '15:00', '17:30', 'match', 'Match officiel', ''),
        b(6, '17:30', '17:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait mardi.'),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Stand de tir : cibles fixes, viseur à hauteur de tête, tir en rafales courtes.' },
        { duree: 10, texte: 'Arcade : deathmatch avec une seule arme, viser la tête.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', 'Une map du pool explorée en partie personnalisée (étages, sites, murs)', '2 opérateurs par camp découverts'],
      conseil: 'Apprendre les maps compte autant que viser : savoir quel mur se casse fait gagner des rounds.',
    },
    2: {
      echauffement: [
        { duree: 5, texte: 'Stand de tir : contrôle du recul à 15 m, 3 chargeurs.' },
        { duree: 10, texte: 'Logiciel d’aim : un exercice de suivi et un de clic sur cible.' },
        { duree: 10, texte: 'Arcade 1v1 : pré-viser portes et fenêtres avant de les passer.' },
      ],
      hebdo: ['4 sessions dont 2 à 5', 'Plan de renforts d’un site appris par map', 'Un parcours de drone de préparation répété par map'],
      conseil: 'Garder ses sensibilités, y compris en visée : changer de réglage efface la mémoire musculaire.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : micro-ajustements et flicks courts.' },
        { duree: 10, texte: 'Stand de tir : recul de son arme principale avec ses accessoires de match.' },
        { duree: 10, texte: 'Arcade : entrer dans chaque pièce le viseur déjà placé.' },
      ],
      hebdo: ['Revoir une de ses VOD (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Gadgets de ses opérateurs révisés sur 2 maps'],
      conseil: 'Chaque séance d’aim a un seul thème : mieux vaut un exercice bien fait que dix survolés.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine fixe de 3 exercices, scores notés.' },
        { duree: 10, texte: 'Stand de tir : recul, coup par coup à longue distance, changement d’arme.' },
        { duree: 15, texte: 'Arcade 3v3 ou deathmatch à intensité de match.' },
      ],
      hebdo: ['Une VOD personnelle et une VOD d’un pro de son rôle', 'Post-plant et denial révisés sur chaque site', 'Deux activités physiques'],
      conseil: 'Suivre ses chiffres d’échauffement d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine personnalisée sur ses points faibles.' },
        { duree: 10, texte: 'Partie personnalisée : situations de son rôle (entrée, tenue de site, retake).' },
        { duree: 15, texte: 'Arcade à intensité de match, puis 5 minutes de calme.' },
      ],
      hebdo: ['Analyse de 2 adversaires potentiels (bans, sites, roamers)', 'Proposition d’une strat ou d’un setup pour son rôle', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Logiciel d’aim : routine de compétition, identique chaque jour.' },
        { duree: 10, texte: 'Partie personnalisée : séquences de son rôle chronométrées (breach, plant, retake).' },
        { duree: 20, texte: 'Arcade puis duels en 1v1 contre un coéquipier.' },
      ],
      hebdo: ['Fiche anti-strat préparée pour chaque officiel', 'Séance de théorie animée sur son rôle (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la visée.',
    },
  },
  parRole: {
    entry: [
      'Stand de tir : entrées en pré-visant deux angles, 20 répétitions.',
      'Practice : entrée juste après le flash ou l’anti-gadget du support, dans la seconde.',
      'Suivre chaque semaine son ratio premiers kills / premières morts en scrim.',
    ],
    breacher: [
      'Hard breach de chaque site du pool en partie personnalisée : chemin, chrono, gadgets à détruire avant.',
      'Coordination avec l’anti-gadget (Thatcher, Kali, Twitch) : 5 ouvertures réussies sur 5.',
      'Une ouverture de secours prête quand le mur est protégé (Bandit, Kaid, Mute).',
    ],
    support: [
      'Utilitaires d’exécution de chaque site : fumées, flashs et anti-gadget lancés au bon moment.',
      'Post-plant : une position par site pour couvrir le défuseur.',
      'Garder son drone et un gadget pour la fin du round.',
    ],
    flex: [
      'Un opérateur prêt dans deux rôles différents pour chaque camp.',
      'Info : drone en vie jusqu’au plant, roamers annoncés en moins de 2 secondes.',
      'Chasse aux roamers avec Jackal, Lion ou Dokkaebi en partie personnalisée.',
    ],
    ancre: [
      'Deux angles sûrs et un plan de repli par site, revus en VOD.',
      'Denial du défuseur : gadgets et tirs à travers sols et murs répétés sur chaque site.',
      'Retake seul ou à deux : 5 situations répétées en partie personnalisée.',
    ],
    roamer: [
      'Chemins de roam de chaque map avec des repères de temps (2:30, 2:00, 1:30).',
      'Runouts et spawn peeks : savoir quand les tenter, revus en VOD.',
      'Revenir vers le site à temps : jamais trop loin quand le défuseur est posé.',
    ],
  },
  seuils: {
    'meca-3-1': { chiffre: 'hs', seuil: 45, sens: '>=' },
    'meca-4-1': { chiffre: 'kd', seuil: 1, sens: '>=' },
    'jeu-5-1': { chiffre: 'kost', seuil: 65, sens: '>=' },
  },
  initiale: INITIALE,
};
