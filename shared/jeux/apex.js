// Apex Legends — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://www.ea.com/games/apex-legends/news/marked-patch-notes, https://www.ea.com/games/apex-legends/news/marked-midseason-patch-notes, https://help.ea.com/en/articles/apex-legends/abilities/, https://help.ea.com/fr/articles/apex-legends/ranked/, https://liquipedia.net/apexlegends/ALGS/2026-27, https://liquipedia.net/apexlegends/Apex_Legends_Global_Series/2026/Split_2/Playoffs, https://apexlegendsstatus.com/algs/Y6-Split2/Pro-League/EMEA/Overview, https://apexlegendsstatus.com/algs/Y6-Split1/ALGS-Playoffs/Global/Overview, https://esports.gg/news/apex-legends/how-do-algs-legend-bans-work/, https://esports.gg/news/apex-legends/algs-poi-draft-how-does-it-work/, https://www.esports.net/news/apex-legends/apex-legends-reveals-algs-year-6-roadmap-all-events-details
// Incertitudes : pool des Split 2 Playoffs (Las Vegas, 29 oct. – 1er nov.) non publié, mapPool = les 3 maps de la Pro League Split 2 ;
//   annexe POI draft du règlement ALGS non consultée (« draft inchangé » en Year 6, apparition directe au spot depuis 2024) ;
//   barème relevé pour les finales (Liquipedia), supposé identique en Pro League ; compos pro sans détail par map (mêmes trios
//   repris sous chaque map) ; classes officielles EA (Revenant escarmoucheur, Ash assaut) contredites par d'autres sources ;
//   divisions IV à I de Novice déduites de « chaque rang est découpé en quatre divisions » ; modèle d'URL apex.tracker.gg
//   (plateforme origin) non ouvrable (robots) ; date et contenu de la saison 31 (vers le 3 novembre) non annoncés.

import { INITIALE } from './apex-initiale.js';

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

// Rangs du classé (aide EA en français) : Novice à Diamant en 4 divisions (IV la plus basse), puis Maître et Prédateur Apex
// (750 meilleurs joueurs de Maître par plateforme).
const DIVISIONS = ['IV', 'III', 'II', 'I'];
const RANGS = [
  ...['Novice', 'Bronze', 'Argent', 'Or', 'Platine', 'Diamant'].flatMap((nom, i) => DIVISIONS.map((d, j) => ({
    id: `${nom.toLowerCase()}${4 - j}`,
    nom: `${nom} ${d}`,
    n: i * 4 + j + 1,
  }))),
  { id: 'maitre', nom: 'Maître', n: 25 },
  { id: 'predateur', nom: 'Prédateur Apex', n: 26 },
];

export default {
  id: 'apex',
  nom: 'Apex Legends',
  court: 'Apex',
  editeur: 'Electronic Arts',
  genre: 'battle-royale',
  equipe: { titulaires: 3, remplacants: 1 },   // trios en ALGS

  vocabulaire: {
    personnage: 'légende', personnages: 'légendes',
    carte: 'map', cartes: 'maps',               // rotation de maps imposée par l'ALGS : pas de veto, mais un pool à préparer
    manche: 'partie', manches: 'parties',
  },

  roles: [
    { id: 'igl', nom: 'IGL', court: 'IGL', resume: 'Décide spot, rotations et combats ; tient l’info de zone pour l’escouade.' },
    { id: 'fragger', nom: 'Fragger', court: 'FRA', resume: 'Ouvre les combats et transforme les knocks en éliminations.' },
    { id: 'support', nom: 'Support', court: 'SUP', resume: 'Soigne, relève, couvre et gère les ressources de l’escouade.' },
    { id: 'ancre', nom: 'Ancre', court: 'ANC', resume: 'Verrouille la position en zone : bâtiment, défenses, angles.' },
  ],
  camps: [],
  typesStrat: [
    { id: 'atterrissage', nom: 'Atterrissage', camps: [], resume: 'Spot drafté ou choisi, partage du butin et sortie du POI.' },
    { id: 'contest', nom: 'Contest', camps: [], resume: 'Gagner un atterrissage disputé, hors draft (scrims, tournois ouverts).' },
    { id: 'rotation', nom: 'Rotation', camps: [], resume: 'Chemin et timing pour rejoindre l’anneau suivant.' },
    { id: 'zone', nom: 'Contrôle de zone', camps: [], resume: 'Prendre et tenir un bâtiment ou une hauteur dans l’anneau.' },
    { id: 'bordure', nom: 'Jeu en bordure', camps: [], resume: 'Avancer le long du bord de l’anneau pour couvrir ses arrières.' },
    { id: 'thirdparty', nom: 'Troisième équipe', camps: [], resume: 'Arriver sur un combat déjà engagé au bon moment.' },
    { id: 'ressources', nom: 'Gestion des ressources', camps: [], resume: 'Soins, munitions, ultimes et bouclier EVO prêts avant chaque rotation.' },
    { id: 'endgame', nom: 'Fin de partie', camps: [], resume: 'Positions et décisions des derniers anneaux.' },
  ],
  typesBloc: [
    { id: 'champtir', nom: 'Champ de tir', duree: 30 },
    { id: 'mouvement', nom: 'Mouvement', duree: 20 },
    { id: 'pubs', nom: 'Parties publiques', duree: 60 },
  ],
  rangs: RANGS,
  chiffres: [
    { id: 'degats', nom: 'Dégâts moyens', unite: '', min: 0, max: 3000, decimales: 0, aide: 'Dégâts moyens par partie en classé (statistiques du jeu ou Apex Tracker).' },
    { id: 'kills', nom: 'Éliminations par partie', unite: '', min: 0, max: 10, decimales: 1, aide: 'Kills moyens par partie en classé sur la semaine.' },
    { id: 'kd', nom: 'KD', unite: '', min: 0, max: 10, decimales: 2, aide: 'Éliminations divisées par les morts, classé de la saison (Apex Tracker).' },
    { id: 'top5', nom: 'Top 5', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Part des parties classées finies dans les 5 premières escouades.' },
  ],
  // Barème officiel ALGS 2026-27 (Year 6), lobby de 20 trios : 1re place 12 pts, 2e 9, 3e 7, 4e 5, 5e 4, 6e et 7e 3,
  // 8e à 10e 2, 11e à 15e 1, 16e à 20e 0, plus 1 pt par élimination, sans plafond. Finales en « match point » : une équipe
  // qui a atteint 50 pts gagne le tournoi en remportant une partie suivante.
  score: {
    type: 'classement',
    equipes: 20,
    bareme: { places: [12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], elimination: 1 },
  },
  veto: {
    type: 'aucun',
    formats: [],
    notes: 'POI draft en serpent avant chaque journée ALGS : un spot par équipe et par map, chaque équipe démarre à son spot, donc presque plus de contest (sauf scrims et tournois ouverts). Après chaque partie d’une série, la légende la plus jouée est bannie jusqu’à la fin de la série.',
  },
  checklistMatch: [
    { id: 'spots', nom: 'Spots draftés ou choisis sur chaque map du jour' },
    { id: 'rotations', nom: 'Sorties et rotations préparées depuis chaque spot' },
    { id: 'compos', nom: 'Compo et légendes de secours fixées (bans)' },
    { id: 'voisins', nom: 'Équipes voisines et leurs rotations revues' },
    { id: 'bareme', nom: 'Barème et format (match point) relus' },
    { id: 'logistique', nom: 'Horaire, code du lobby et remplaçant confirmés' },
  ],
  profil: {
    site: 'Apex Legends Tracker (tracker.gg)',
    modele: 'https://apex.tracker.gg/apex/profile/origin/{id}/overview',
    format: '^\\S{4,16}$',
    aide: 'Pseudo EA (4 à 16 caractères) du compte PC, Steam compris ; sur console, chercher son profil PlayStation ou Xbox sur le site.',
  },
  meta: {
    sources: ['ea.com', 'help.ea.com', 'apexlegendsstatus.com', 'liquipedia.net', 'esports.gg', 'dotesports.com'],
    consigne: 'Vérifier la saison et la dernière mise à jour (notes de patch EA, mi-saison comprise), les légendes ajoutées ou modifiées et leur classe officielle, la rotation de maps des événements ALGS en cours (Pro League, Challenger Circuit, Playoffs) et du classé, le barème et les règles ALGS (POI draft, bans de légende, match point), puis les trios les plus joués sur apexlegendsstatus.com.',
    pool: true,
  },
  paliers: {
    rangs: ['Non classé à Novice', 'Bronze à Argent', 'Or à Platine', 'Diamant', 'Maître, Challenger Circuit', 'Prédateur Apex, semi-pro'],
    resumes: [
      'Découvre le jeu, les légendes, les maps et le butin.',
      'Maîtrise les bases : recul, soins à couvert, une légende par rôle.',
      'Joue en escouade : rotations sur l’info, annonces claires, combats choisis.',
      'Exécute un plan de partie : spot, rotations, contrôle de zone, troisième équipe.',
      'Lit le lobby, s’adapte aux bans et à la zone, assume un rôle précis.',
      'Constance en tournoi, préparation des adversaires et leadership.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Visée, recul, mouvement, duels.' },
    { id: 'rot', nom: 'Rotations et zone', resume: 'Anneaux, timings, positions, bord de zone.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Choix des combats, info, troisième équipe, ressources.' },
    { id: 'comm', nom: 'Communication', resume: 'Pings, annonces de dégâts, calme, coordination.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que son rôle et sa légende apportent à l’escouade.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Choisir une sensibilité et la garder', 'Sensibilité notée dans le roster et inchangée pendant 2 semaines.'),
    o('rot-1-1', 'Rester dans l’anneau', 'Aucune mort causée par l’anneau sur 5 parties d’affilée.'),
    o('jeu-1-1', 'Se soigner à couvert', 'Sur 3 parties revues, aucun soin lancé à découvert pendant un combat.'),
    o('comm-1-1', 'Pinger chaque ennemi vu', 'Ping ennemi posé à chaque contact, relevé sur 3 parties revues.'),
    o('role-1-1', 'Choisir un rôle et deux légendes', 'Rôle fixé avec le coach et 2 légendes de ce rôle jouées 10 parties chacune.'),
    o('mental-1-1', 'Jouer régulièrement plutôt que longtemps', '3 sessions d’au moins 45 minutes par semaine pendant 1 mois.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Contrôler le recul de ses deux armes', 'Au champ de tir, 7 balles sur 10 sur la cible à 20 m avec chacune de ses deux armes.'),
    o('rot-2-1', 'Bouger avant la fermeture', 'Aucun dégât d’anneau subi avant le 3e anneau, sur 5 parties revues.'),
    o('jeu-2-1', 'Entrer en combat avec soins et munitions', 'Avant le 3e anneau : au moins 2 batteries, 4 cellules et 4 seringues, sur 5 parties revues.'),
    o('comm-2-1', 'Connaître les POI du pool', 'Nommer 15 POI de chaque map du pool sur une carte vierge.'),
    o('role-2-1', 'Utiliser ses compétences à chaque combat', 'Sur 3 parties revues, aucune tactique ni ultime chargé encore disponible à sa mort.'),
    o('mental-2-1', 'Couper après une série de parties ratées', 'Pause d’au moins 15 minutes après 3 éliminations avant le top 10, respectée pendant 1 mois.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Atteindre 500 dégâts moyens par partie', 'Moyenne d’au moins 500 dégâts par partie sur 20 parties classées.'),
    o('rot-3-1', 'Tourner sur l’info de zone', 'Prochain anneau connu avant chaque rotation (console, balise ou coéquipier), sur 5 parties.'),
    o('jeu-3-1', 'Choisir ses combats', 'En review, chaque combat engagé a une raison annoncée (info, avantage, zone) dans 7 cas sur 10.'),
    o('comm-3-1', 'Annoncer les dégâts infligés', 'Annonce chiffrée à chaque échange (« bouclier cassé », « 100 sur la Wraith »), relevée en review.'),
    o('role-3-1', 'Adapter sa légende à la map', 'Légende par map du pool renseignée dans le roster et validée par le coach.'),
    o('mental-3-1', 'Revoir ses propres VOD chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Atteindre 700 dégâts moyens par partie', 'Moyenne d’au moins 700 dégâts par partie sur 20 parties classées.'),
    o('rot-4-1', 'Finir régulièrement dans le top 5', 'Top 5 dans au moins 35 % des parties classées du mois.'),
    o('jeu-4-1', 'Profiter des combats voisins', 'Sur 5 scrims revus, 6 combats voisins sur 10 exploités (troisième équipe ou rotation libre).'),
    o('comm-4-1', 'Proposer des options en cours de partie', 'Au moins une proposition utile par partie (rotation, combat, position), prise ou non par l’IGL.'),
    o('role-4-1', 'Préparer des légendes de secours', '2 légendes d’une autre classe prêtes pour les bans et jouées en scrim.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’une mauvaise journée de scrims faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Être constant', 'Moins de 15 % d’écart de dégâts moyens entre la meilleure et la pire semaine du mois.'),
    o('rot-5-1', 'Choisir bord ou centre selon la zone', 'Plan de rotation (bord, centre, attente) annoncé et justifié en review sur 5 scrims.'),
    o('jeu-5-1', 'Repérer les habitudes du lobby', '2 habitudes adverses (spot, rotation, style) relevées par journée de scrims et transmises à l’IGL.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en combat et en fin de partie, sans cri ni parole inutile, relevées en VOD.'),
    o('role-5-1', 'Spécialisation maîtrisée', 'Objectif chiffré de son rôle (dégâts, survie, relèves, info) fixé avec le coach et atteint sur un mois.'),
    o('mental-5-1', 'Gérer le stress des tournois', 'Technique de respiration ou de retour au calme utilisée entre les parties d’une journée officielle.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Atteindre des chiffres semi-pro', 'Objectifs chiffrés du rôle (dégâts, knocks, survie) tenus sur 2 mois de scrims de haut niveau.'),
    o('rot-6-1', 'Gagner les fins de partie de haut niveau', 'Top 3 dans 30 % des parties de scrims de haut niveau sur un mois.'),
    o('jeu-6-1', 'Préparer une journée officielle', 'Fiche des équipes voisines (spots, rotations, compos) prête avant chaque journée de tournoi.'),
    o('comm-6-1', 'Tenir le cap après une mauvaise partie', 'Relance l’escouade par une annonce de plan, jamais par un reproche, relevé en VOD.'),
    o('role-6-1', 'Deux rôles au niveau compétition', 'Peut jouer un second rôle en tournoi sans baisse de niveau.'),
    o('mental-6-1', 'Routine de performance complète', 'Sommeil, alimentation, échauffement et récupération planifiés les semaines de tournoi.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à 3 deux fois par semaine', 'Deux sessions en escouade complète chaque semaine pendant 1 mois.'),
    o('coll-1-2', 'Adopter des noms de POI communs', 'Même nom pour chaque POI et chaque bâtiment clé des maps du pool, noté dans l’espace de l’équipe.'),
    o('coll-2-1', 'Un spot par map du pool', 'Spot principal et sortie écrits dans le stratbook pour chaque map du pool.'),
    o('coll-2-2', 'Débriefer chaque session', '10 minutes de débrief à la fin de chaque session à 3.'),
    o('coll-3-1', 'Rotations écrites depuis chaque spot', '2 chemins de sortie par spot, selon la zone, écrits dans le stratbook.'),
    o('coll-3-2', 'Revue VOD collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois.'),
    o('coll-4-1', 'Deux spots par map pour le draft', 'Un spot principal et un spot de repli maîtrisés sur chaque map du pool.'),
    o('coll-4-2', 'Placement moyen dans le top 10', 'Placement moyen de 10 ou mieux sur 4 semaines de scrims.'),
    o('coll-5-1', 'Compos de rechange prêtes', 'Deux compos par map, jouables après le ban de n’importe quelle légende de l’équipe.'),
    o('coll-5-2', 'Fiche du lobby avant chaque tournoi', 'Spots, rotations et compos des équipes voisines notés la veille de chaque journée officielle.'),
    o('coll-6-1', 'Plan pour le format match point', 'Plan écrit avant et après le seuil des 50 points, appliqué sur 3 finales de scrims ou de tournoi.'),
    o('coll-6-2', 'Stratbook à jour sous 72 h', 'Spots, rotations et compos revus dans les 3 jours après chaque mise à jour ou changement de pool.'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer à 3 : maps, POI, soins, pings, premières rotations. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:30', 'champtir', 'Champ de tir', 'Recul de ses deux armes, puis mannequins en mouvement.', 'individuel'),
        b(2, '20:30', '21:15', 'theorie', 'Map et POI', 'Une map du pool : noms des POI, spot de l’équipe, sortie.'),
        b(2, '21:15', '22:00', 'pubs', 'Parties publiques à 3', 'Pings et annonces de la séance appliqués.'),
        b(3, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:20', '22:00', 'classe', 'Classé à 3', 'Atterrir au spot choisi mardi, se soigner à couvert.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(5, '20:00', '20:20', 'mouvement', 'Mouvement', 'Glissades, sauts et soins en déplacement.', 'individuel'),
        b(5, '20:20', '21:20', 'classe', 'Classé à 3', ''),
        b(5, '21:20', '21:50', 'vod', 'VOD courte', 'Revoir 2 combats de la semaine.'),
        b(6, '15:00', '16:45', 'scrim', 'Scrim ou tournoi communautaire', 'Contre des équipes de niveau proche.'),
        b(6, '16:45', '17:00', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire un stratbook de spots et de rotations, enchaîner scrims et classé, revoir les VOD chaque semaine.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'VOD du week-end', 'Scrims du samedi : 2 bonnes rotations, 2 erreurs de zone.'),
        b(1, '21:00', '21:45', 'theorie', 'Spots et rotations', 'Valider les sorties et rotations à travailler.'),
        b(2, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '20:00', '20:45', 'champtir', 'Champ de tir à 3', 'Combos de compétences de la compo, soins et rechargements.'),
        b(2, '20:45', '22:15', 'classe', 'Classé à 3', 'Appliquer les rotations validées lundi.'),
        b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrims', '4 à 6 parties sur 2 maps du pool.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '20:00', '20:45', 'champtir', 'Travail individuel', 'Programme individuel de chaque joueur.', 'individuel'),
        b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:00', '22:00', 'scrim', 'Scrims', ''),
        b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(6, '14:00', '16:30', 'scrim', 'Scrims ou tournoi', 'Tournoi communautaire ou qualification ouverte.'),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour de la journée officielle : fiche du lobby, scrims sur les maps du jour, plan de match point.',
      blocs: [
        b(1, '19:30', '20:30', 'vod', 'VOD de la journée officielle', 'Rotations, fins de partie, décisions de l’IGL.'),
        b(1, '20:30', '21:15', 'theorie', 'Plan de la semaine', 'Spots, rotations et compos selon les bans probables.'),
        b(2, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '19:30', '22:00', 'scrim', 'Scrims', '6 parties sur 2 maps du pool.'),
        b(2, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '19:30', '20:00', 'champtir', 'Combos de la compo', 'Compétences enchaînées sur une entrée et une défense de bâtiment.'),
        b(3, '20:00', '22:00', 'scrim', 'Scrims', ''),
        b(3, '22:00', '22:15', 'debrief', 'Débrief', ''),
        b(4, '19:00', '20:00', 'theorie', 'Fiche du lobby', 'Équipes voisines : spots, rotations, compos.'),
        b(4, '20:00', '21:45', 'scrim', 'Scrims sur les maps du tournoi', ''),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '21:00', 'scrim', 'Scrims de répétition', ''),
        b(5, '21:00', '21:30', 'theorie', 'Plan de tournoi', 'Spots, sorties, plan de match point.'),
        b(6, '13:30', '14:15', 'champtir', 'Échauffement collectif', 'Champ de tir à 3 : recul, combos, soins rapides.'),
        b(6, '15:00', '18:30', 'match', 'Journée officielle', 'Tournoi, Challenger Circuit ou Pro League.'),
        b(6, '18:30', '18:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait lundi.'),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Champ de tir : cibles fixes à 20 m, recul de son arme principale.' },
        { duree: 10, texte: 'Champ de tir : mannequins en mouvement à courte distance, viser le haut du corps.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', 'Découvrir une map du pool et ses POI', '2 légendes de son rôle essayées au champ de tir'],
      conseil: 'Jouer souvent et peu longtemps vaut mieux qu’une longue session par semaine.',
    },
    2: {
      echauffement: [
        { duree: 5, texte: 'Champ de tir : recul de ses deux armes, 7 balles sur 10 à 20 m.' },
        { duree: 10, texte: 'Logiciel d’aim : un exercice de suivi et un de clic sur cible.' },
        { duree: 10, texte: 'Mouvement : glissades, sauts de mur et soins en déplacement.' },
      ],
      hebdo: ['4 sessions dont 2 à 3', 'Une partie revue pour vérifier les soins à couvert', '15 POI appris par map du pool'],
      conseil: 'Noter sa sensibilité et ne plus la changer : la régularité construit la mémoire musculaire.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : suivi de cibles rapides, le cœur du tir sur Apex.' },
        { duree: 10, texte: 'Champ de tir : changements d’arme, rechargements et recul à 30 m.' },
        { duree: 10, texte: 'Mouvement : enchaînements de glissade et de saut, puis tir en sortie de glissade.' },
      ],
      hebdo: ['Revoir une de ses VOD (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Rotations de son spot révisées sur 2 maps'],
      conseil: 'Chaque séance d’aim a un seul thème : mieux vaut un exercice bien fait que dix survolés.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine fixe de 3 exercices de suivi, scores notés.' },
        { duree: 10, texte: 'Champ de tir : recul à 30 m et combos de compétences de sa légende.' },
        { duree: 15, texte: 'Match à mort de Mixtape ou partie publique à intensité de match.' },
      ],
      hebdo: ['Une VOD personnelle et une VOD d’un joueur pro de son rôle', '2 légendes de secours entretenues pour les bans', 'Deux activités physiques'],
      conseil: 'Suivre ses chiffres d’échauffement d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine personnalisée sur ses points faibles.' },
        { duree: 10, texte: 'Champ de tir : situations de son rôle (entrée, tenue de porte, relève à couvert).' },
        { duree: 15, texte: 'Partie publique à intensité de match, puis 5 minutes de calme.' },
      ],
      hebdo: ['Analyse de 2 équipes du lobby (spots, rotations)', 'Proposition d’une rotation ou d’un plan de fin de partie', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de tournoi.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Logiciel d’aim : routine de compétition, identique chaque jour.' },
        { duree: 10, texte: 'Champ de tir : séquences de son rôle chronométrées.' },
        { duree: 20, texte: 'Match à mort de Mixtape ou partie publique, puis 5 minutes de calme.' },
      ],
      hebdo: ['Fiche du lobby préparée pour chaque journée officielle', 'Séance de théorie animée sur son rôle (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la visée.',
    },
  },
  parRole: {
    igl: [
      'Annoncer en scrim l’anneau suivant et le chemin de rotation avant chaque fermeture.',
      'Repérer consoles d’anneau et balises sur la route de sortie de chaque spot du pool.',
      'Après chaque partie, noter une décision de rotation à garder et une à changer.',
    ],
    fragger: [
      'Champ de tir : knock puis changement de cible sur 3 mannequins en moins de 5 secondes.',
      'Entrées de bâtiment : 5 répétitions avec la compétence de mobilité de sa légende.',
      'Suivre ses dégâts et son ratio knocks / morts chaque semaine.',
    ],
    support: [
      'Relèves à couvert : bouclier, fumée ou compétence posée avant chaque relève.',
      'Annoncer avant chaque rotation les soins et munitions qui manquent à l’escouade.',
      'Bannières : chemin vers la balise de réapparition la plus proche prévu avant chaque combat.',
    ],
    ancre: [
      'Défenses de sa légende posées sur 3 bâtiments clés par map du pool, en moins de 10 secondes.',
      'Relever le prochain anneau à la console à chaque rotation et l’annoncer à l’IGL.',
      'Tenir seul une entrée de bâtiment jusqu’au retour de l’escouade, en scrim.',
    ],
  },
  seuils: {
    'meca-3-1': { chiffre: 'degats', seuil: 500, sens: '>=' },
    'meca-4-1': { chiffre: 'degats', seuil: 700, sens: '>=' },
    'rot-4-1': { chiffre: 'top5', seuil: 35, sens: '>=' },
  },
  initiale: INITIALE,
};
