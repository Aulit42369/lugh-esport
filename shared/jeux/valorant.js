// Valorant — modèle de jeu.
// Vérifié le 18/10/2026. Sources : playvalorant.com (notes de patch 13.08), liquipedia.net, vlr.gg, thespike.gg.
// Incertitudes : aucune sur les listes ; la méta initiale détaille les siennes (Hush attendu en 13.09).

import { OBJECTIFS, COLLECTIFS } from './valorant-progression.js';
import { EBAUCHES, ROUTINES, PAR_ROLE } from './valorant-entrainement.js';
import { INITIALE } from './valorant-initiale.js';

const NIVEAUX = ['Fer', 'Bronze', 'Argent', 'Or', 'Platine', 'Diamant', 'Ascendant', 'Immortel'];
const sansAccent = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default {
  id: 'valorant',
  nom: 'Valorant',
  court: 'VAL',
  editeur: 'Riot Games',
  genre: 'fps-tactique',
  equipe: { titulaires: 5, remplacants: 2 },
  vocabulaire: { personnage: 'agent', personnages: 'agents', carte: 'map', cartes: 'maps', manche: 'round', manches: 'rounds' },

  roles: [
    { id: 'duelliste', nom: 'Duelliste', court: 'DUE', resume: 'Ouvre les sites et crée l’espace pour l’équipe.' },
    { id: 'initiateur', nom: 'Initiateur', court: 'INI', resume: 'Récupère l’info et prépare chaque entrée.' },
    { id: 'controleur', nom: 'Contrôleur', court: 'CON', resume: 'Coupe les lignes de vue et donne le rythme du round.' },
    { id: 'sentinelle', nom: 'Sentinelle', court: 'SEN', resume: 'Verrouille un site et surveille les flancs.' },
    { id: 'flex', nom: 'Flex', court: 'FLX', resume: 'Couvre deux rôles selon la map et la compo.' },
  ],
  camps: [
    { id: 'att', nom: 'Attaque' },
    { id: 'def', nom: 'Défense' },
  ],
  typesStrat: [
    { id: 'default', nom: 'Default', camps: ['att'], resume: 'Placement de début de round pour prendre l’info sans s’engager.' },
    { id: 'execute', nom: 'Exécution', camps: ['att'], resume: 'Prise de site coordonnée avec tous les utilitaires.' },
    { id: 'fake', nom: 'Fake', camps: ['att'], resume: 'Faire tourner la défense avant de frapper ailleurs.' },
    { id: 'postplant', nom: 'Post-plant', camps: ['att'], resume: 'Positions et utilitaires pour défendre le spike posé.' },
    { id: 'setup', nom: 'Setup', camps: ['def'], resume: 'Répartition défensive de base et rôles de chacun.' },
    { id: 'stack', nom: 'Stack', camps: ['def'], resume: 'Surcharger un site sur lecture ou anti-strat.' },
    { id: 'retake', nom: 'Retake', camps: ['def'], resume: 'Reprendre un site après la pose du spike.' },
    { id: 'pistol', nom: 'Pistol', camps: ['att', 'def'], resume: 'Plan du premier round de chaque mi-temps.' },
    { id: 'eco', nom: 'Éco / force', camps: ['att', 'def'], resume: 'Round à petit budget : surprendre ou garder l’argent.' },
    { id: 'antieco', nom: 'Anti-éco', camps: ['att', 'def'], resume: 'Ne pas offrir d’armes à une équipe sans argent.' },
  ],
  typesBloc: [
    { id: 'aim', nom: 'Aim et mécanique', duree: 45 },
    { id: 'deathmatch', nom: 'Deathmatch', duree: 30 },
    { id: 'practice', nom: 'Practice (execs, retakes)', duree: 90 },
  ],
  rangs: [
    ...NIVEAUX.flatMap((nom) => [1, 2, 3].map((d) => ({ id: `${sansAccent(nom)}${d}`, nom: `${nom} ${d}` }))),
    { id: 'radiant', nom: 'Radiant' },
  ],
  chiffres: [
    { id: 'hs', nom: 'Headshots', unite: '%', min: 0, max: 100, decimales: 1, aide: 'Pourcentage de headshots sur la semaine (fin de partie ou tracker.gg).' },
    { id: 'acs', nom: 'ACS moyen', unite: '', min: 0, max: 600, decimales: 0, aide: 'Score de combat moyen par round.' },
    { id: 'kd', nom: 'K/D', unite: '', min: 0, max: 10, decimales: 2, aide: 'Éliminations divisées par les morts.', repere: { valeur: 1, libelle: 'équilibre' } },
  ],
  score: { type: 'manches', gagnant: 13, miTemps: 12, pistols: true },
  // Ordres de veto habituels avec un pool de 7 maps ; A = l'équipe qui commence le veto.
  veto: {
    type: 'cartes',
    formats: [
      { id: 'bo1', nom: 'BO1', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'ban'], ['B', 'ban'], ['A', 'ban'], ['B', 'ban'], [null, 'decisive']] },
      { id: 'bo3', nom: 'BO3', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], ['A', 'ban'], ['B', 'ban'], [null, 'decisive']] },
      { id: 'bo5', nom: 'BO5', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], ['A', 'pick'], ['B', 'pick'], [null, 'decisive']] },
    ],
    notes: '',
  },
  checklistMatch: [
    { id: 'vod', nom: 'VOD de l’adversaire revues' },
    { id: 'veto', nom: 'Plan de veto validé' },
    { id: 'compos', nom: 'Compos fixées pour les maps probables' },
    { id: 'pistols', nom: 'Pistols répétés' },
    { id: 'antistrat', nom: 'Anti-strats travaillées en practice' },
    { id: 'logistique', nom: 'Horaire, lien du lobby et remplaçant confirmés' },
  ],
  profil: {
    site: 'tracker.gg',
    modele: 'https://tracker.gg/valorant/profile/riot/{id}/overview',
    format: '^[^#]{2,16}#[A-Za-z0-9]{2,5}$',
    aide: 'Riot ID au format Pseudo#TAG.',
  },
  meta: {
    sources: ['playvalorant.com', 'liquipedia.net', 'vlr.gg', 'thespike.gg', 'strafe.com', 'tracker.gg'],
    consigne: [
      'Le patch et sa date viennent des notes de patch officielles (playvalorant.com) ; le map pool compétitif du wiki ou de Liquipedia.',
      'Note les maps entrées ou sorties au dernier changement d’acte, et les changements d’équilibrage d’agents depuis le patch de la base.',
      'Compos pro : les plus jouées en VCT (Masters, Champions, ligues internationales) sur chaque map du pool, 1 à 3 par map, avec leur source.',
      '« circuit » décrit l’étape en cours de VALORANT Premier (étape, dates, format), ou null.',
    ].join('\n'),
    pool: true,
  },
  paliers: {
    rangs: ['Non classé à Fer', 'Bronze à Argent', 'Or à Platine', 'Diamant à Ascendant', 'Immortel, tournois amateurs', 'Radiant, semi-pro'],
    resumes: [
      'Découvre le jeu, les agents, l’économie et les maps.',
      'Maîtrise les bases : visée à hauteur de tête, tir à l’arrêt, un agent par rôle.',
      'Joue avec des utilitaires utiles, communique clairement, comprend les rounds.',
      'Exécute des plans d’équipe, trade, gère l’économie et le post-plant.',
      'Lit l’adversaire, s’adapte en cours de match, assume un rôle précis.',
      'Constance à haut niveau, anti-strat, leadership et préparation d’adversaire.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Visée, tir, déplacements, duels.' },
    { id: 'util', nom: 'Utilitaires', resume: 'Compétences, lineups, timings, combos.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Placement, info, rotations, économie.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, calme, coordination.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que son rôle attend de lui à chaque round.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  seuils: {
    'meca-2-2': { chiffre: 'hs', seuil: 15, sens: '>=' },
    'meca-3-2': { chiffre: 'hs', seuil: 20, sens: '>=' },
    'meca-4-1': { chiffre: 'hs', seuil: 23, sens: '>=' },
  },
  objectifs: OBJECTIFS,
  collectifs: COLLECTIFS,
  ebauches: EBAUCHES,
  routines: ROUTINES,
  parRole: PAR_ROLE,
  initiale: INITIALE,
};
