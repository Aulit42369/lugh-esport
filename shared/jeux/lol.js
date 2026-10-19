// League of Legends — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://wiki.leagueoflegends.com/en-us/V26.20, https://wiki.leagueoflegends.com/en-us/Patch/2026_Annual_Cycle, https://ddragon.leagueoflegends.com/cdn/16.20.1/data/fr_FR/champion.json, https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/fr_fr/v1/champion-summary.json, https://www.mobatrainer.com/lol/champions, https://wiki.leagueoflegends.com/en-us/Rank_(League_of_Legends), https://lolesports.com/en-us/news/season-start-2026-lol-esports/, https://blog.loltheory.gg/what-is-fearless-draft/, https://liquipedia.net/leagueoflegends/LCK/2026, https://liquipedia.net/leagueoflegends/Nexus_League/2026/Spring, https://gol.gg/tournament/tournament-picksandbans/MSI%202026/, https://op.gg/lol/leaderboards/tier?region=euw (liste complète dans initiale.sources)
// Incertitudes : fearless confirmé en LEC, LCK, MSI, Worlds et en playoffs de Nexus League, mais pas trouvé pour la LFL ni le Nexus Tour ;
//   remises à zéro du classé en 2026 : sources contradictoires (une par saison selon esports.gg, seul un reset des rangs Maître+ en 26.09 selon le wiki officiel) ;
//   op.gg n'accepte pas le # : l'identifiant se saisit « Pseudo-TAG » (test avec %23 en échec) ; nom français officiel de la saison 3 (« Classic ») non trouvé ;
//   rôles : part des rôles en Émeraude+ au patch 26.20 (mobatrainer) pour les champions polyvalents, sinon Meraki (patch 26.03) ; cas serrés : Yone 50/50 top-mid (classé mid),
//   Sylas 43 % mid / 41 % jungle, Ekko 52/48 mid-jungle, Diana 52/48 jungle-mid, Pantheon 42 % top / 38 % support ; Cho'Gath, Quinn, Naafiri et Qiyana surtout joués en jungle au 26.20 (top ou mid au 26.03 selon Meraki) ;
//   noms français des rangs (Fer… Maître, Grand Maître, Challenger) et des objectifs (larves du Néant, Héraut) tirés du client, non revérifiés en ligne (quota de recherche atteint) ;
//   Worlds 2026 en cours (Play-In jusqu'au 18 oct.) sans données de draft publiées : compsPro tirées de la finale du MSI 2026 (patch 26.13), avant les nerfs du 26.20 ;
//   gol.gg signale un bug de l'historique de Riot : chiffres du MSI possiblement incomplets, côtés bleu/rouge non affichés ; patch 26.21 attendu le 21 oct. (calendrier non officiel) ;
//   changements de la saison 2026 (Atakhan retiré, quêtes de rôle, Baron à 20 min) relevés sur les présentations de janvier, non revérifiés patch par patch ;
//   CS par minute et score de vision par minute : affichage exact sur op.gg/u.gg non vérifié (pages chargées en JavaScript), l'aide renvoie à l'écran de fin de partie.

import { INITIALE } from './lol-initiale.js';

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

export default {
  id: 'lol',
  nom: 'League of Legends',
  court: 'LoL',
  editeur: 'Riot Games',
  genre: 'moba',
  equipe: { titulaires: 5, remplacants: 2 },

  vocabulaire: {
    personnage: 'champion', personnages: 'champions',
    carte: null, cartes: null,
    manche: 'partie', manches: 'parties',
  },

  roles: [
    { id: 'top', nom: 'Top', court: 'TOP', resume: 'Tient seul la voie du haut, gagne ses duels et pèse sur la carte avec la téléportation.' },
    { id: 'jungle', nom: 'Jungle', court: 'JGL', resume: 'Farme la jungle, crée des avantages par les ganks et contrôle les objectifs neutres.' },
    { id: 'mid', nom: 'Mid', court: 'MID', resume: 'Tient la voie centrale, suit les mouvements du jungler et se déplace le premier.' },
    { id: 'adc', nom: 'ADC', court: 'ADC', resume: 'Tireur de la voie du bas : farme, survit et inflige les dégâts constants en combat.' },
    { id: 'support', nom: 'Support', court: 'SUP', resume: 'Protège ou engage pour son ADC, pose la vision et accompagne le jungler.' },
  ],
  camps: [
    { id: 'bleu', nom: 'Côté bleu' }, { id: 'rouge', nom: 'Côté rouge' },
  ],
  typesStrat: [
    { id: 'debut', nom: 'Début de partie', camps: [], resume: 'Niveau 1, premier chemin du jungler et lanes à aider dans les premières minutes.' },
    { id: 'invade', nom: 'Invade', camps: [], resume: 'Entrer à plusieurs dans la jungle adverse au niveau 1 ou lui voler des camps.' },
    { id: 'prio', nom: 'Prio et lane swap', camps: [], resume: 'Placer les lanes pour gagner la priorité avant un objectif ou éviter un mauvais duel.' },
    { id: 'larves', nom: 'Larves et Héraut', camps: [], resume: 'Prendre les larves du Néant et le Héraut sans perdre de tempo ailleurs.' },
    { id: 'drake', nom: 'Setup dragon', camps: [], resume: 'Vagues poussées, vision et placement dans la minute avant un dragon.' },
    { id: 'baron', nom: 'Setup Baron', camps: [], resume: 'Vision, vagues et position avant de lancer ou de contester le Baron Nashor.' },
    { id: 'engage', nom: 'Teamfight et engage', camps: [], resume: 'Qui lance le combat, sur qui, et où se placent les carries.' },
    { id: 'split', nom: 'Split push', camps: [], resume: 'Un joueur pousse une lane à l’opposé pendant que les quatre autres menacent un objectif.' },
    { id: 'siege', nom: 'Siège', camps: [], resume: 'Casser des tourelles en groupe sans offrir d’engage à l’adversaire.' },
    { id: 'fin', nom: 'Fin de partie', camps: [], resume: 'Dragon ancestral, Baron et inhibiteurs : convertir l’avance sans offrir de retour.' },
  ],
  typesBloc: [
    { id: 'laning', nom: 'Laning et Practice Tool', duree: 45 },
    { id: 'soloq', nom: 'Classé solo/duo', duree: 120 },
    { id: 'champions', nom: 'Pool de champions', duree: 60 },
    { id: 'draft', nom: 'Préparation de draft', duree: 45 },
  ],
  rangs: [
    { id: 'fer4', nom: 'Fer IV', n: 1 }, { id: 'fer3', nom: 'Fer III', n: 2 }, { id: 'fer2', nom: 'Fer II', n: 3 }, { id: 'fer1', nom: 'Fer I', n: 4 },
    { id: 'bronze4', nom: 'Bronze IV', n: 5 }, { id: 'bronze3', nom: 'Bronze III', n: 6 }, { id: 'bronze2', nom: 'Bronze II', n: 7 }, { id: 'bronze1', nom: 'Bronze I', n: 8 },
    { id: 'argent4', nom: 'Argent IV', n: 9 }, { id: 'argent3', nom: 'Argent III', n: 10 }, { id: 'argent2', nom: 'Argent II', n: 11 }, { id: 'argent1', nom: 'Argent I', n: 12 },
    { id: 'or4', nom: 'Or IV', n: 13 }, { id: 'or3', nom: 'Or III', n: 14 }, { id: 'or2', nom: 'Or II', n: 15 }, { id: 'or1', nom: 'Or I', n: 16 },
    { id: 'platine4', nom: 'Platine IV', n: 17 }, { id: 'platine3', nom: 'Platine III', n: 18 }, { id: 'platine2', nom: 'Platine II', n: 19 }, { id: 'platine1', nom: 'Platine I', n: 20 },
    { id: 'emeraude4', nom: 'Émeraude IV', n: 21 }, { id: 'emeraude3', nom: 'Émeraude III', n: 22 }, { id: 'emeraude2', nom: 'Émeraude II', n: 23 }, { id: 'emeraude1', nom: 'Émeraude I', n: 24 },
    { id: 'diamant4', nom: 'Diamant IV', n: 25 }, { id: 'diamant3', nom: 'Diamant III', n: 26 }, { id: 'diamant2', nom: 'Diamant II', n: 27 }, { id: 'diamant1', nom: 'Diamant I', n: 28 },
    { id: 'maitre', nom: 'Maître', n: 29 }, { id: 'grandmaitre', nom: 'Grand Maître', n: 30 }, { id: 'challenger', nom: 'Challenger', n: 31 },
  ],
  chiffres: [
    { id: 'kda', nom: 'KDA', unite: '', min: 0, max: 20, decimales: 2, aide: '(Kills + assists) / morts, moyenne des 20 dernières parties classées (résumé du profil op.gg).' },
    { id: 'cs', nom: 'CS par minute', unite: '', min: 0, max: 12, decimales: 1, aide: 'Sbires et monstres tués par minute, moyenne des parties classées de la semaine (op.gg ou écran de fin de partie).' },
    { id: 'kp', nom: 'Participation aux kills', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Part des kills de l’équipe avec un kill ou un assist du joueur, 20 dernières parties classées (résumé du profil op.gg).' },
    { id: 'vision', nom: 'Score de vision par minute', unite: '', min: 0, max: 5, decimales: 2, aide: 'Score de vision de l’écran de fin de partie divisé par la durée, moyenne de la semaine.' },
  ],
  score: { type: 'simple' },   // une partie = victoire ou défaite ; une série se note en parties gagnées (ex. 3-2)
  veto: {
    type: 'draft',
    formats: [],
    notes: 'Draft de tournoi : 5 bans et 5 picks par équipe en deux phases (3 bans chacun puis picks 1-2-2-1, 2 bans chacun puis picks 1-2-1) ; depuis 2026, l’équipe prioritaire choisit le côté ou l’ordre de draft (First Selection) et l’autre prend l’option restante. Fearless complet dans les séries en Bo3 et Bo5 (LEC, LCK, MSI, Worlds, hors Bo1 du Swiss) : un champion joué dans la série est interdit aux deux équipes jusqu’à la fin, sans remise à zéro en partie 5 ; en France, la Nexus League l’applique en playoffs, à vérifier dans le règlement de la LFL et du Nexus Tour.',
  },
  checklistMatch: [
    { id: 'vod', nom: 'Drafts et VOD de l’adversaire revues' },
    { id: 'draft', nom: 'Plan de draft validé (bans, priorités, réponses)' },
    { id: 'pool', nom: 'Champions de chacun prêts pour toute la série (fearless)' },
    { id: 'debut', nom: 'Niveau 1 et premier chemin du jungler prévus pour chaque côté' },
    { id: 'objectifs', nom: 'Plan d’objectifs fixé : larves, dragons, Baron' },
    { id: 'logistique', nom: 'Horaire, code du tournoi, comptes et remplaçant confirmés' },
  ],
  profil: {
    site: 'OP.GG',
    modele: 'https://op.gg/lol/summoners/euw/{id}',
    format: '^[^#/?]{3,16}[#-][A-Za-z0-9]{3,5}$',
    separateur: '-', // op.gg attend « Pseudo-TAG » : le # du Riot ID est remplacé par un tiret dans l'adresse
    aide: 'Riot ID du serveur EUW : Pseudo#TAG (ex. Nova#EUW).',
  },
  meta: {
    sources: ['leagueoflegends.com', 'wiki.leagueoflegends.com', 'lolesports.com', 'lol.fandom.com', 'liquipedia.net', 'gol.gg', 'op.gg', 'u.gg'],
    consigne: [
      'Vérifie le patch en cours et la date du suivant dans les notes de patch officielles : champions, objets et systèmes de la Faille modifiés.',
      'Contrôle la liste complète des champions (nouveau champion, refonte) et le rôle principal de chacun en classé.',
      'Relève les champions les plus présents (picks + bans) et les compos gagnantes du dernier grand événement (LEC, LCK, MSI, Worlds) sur gol.gg ou Leaguepedia, avec le patch joué.',
      'Vérifie le format compétitif : fearless, First Selection, Bo1, Bo3 ou Bo5 en LEC, à Worlds et dans les ligues françaises (LFL, Nexus League, Nexus Tour).',
      'Ignore les fuites, le PBE et les rumeurs.',
    ].join('\n'),
    pool: false,
  },
  paliers: {
    rangs: ['Non classé à Fer', 'Bronze à Argent', 'Or à Platine', 'Émeraude à Diamant', 'Maître, tournois amateurs', 'Grand Maître et Challenger, semi-pro'],
    resumes: [
      'Découvre la Faille, les rôles, les champions et le but d’une partie.',
      'Maîtrise les bases : farmer, survivre à la phase de lane, deux champions dans son rôle.',
      'Gère ses vagues, joue avec la carte et la vision, annonce les timers.',
      'Joue les objectifs en équipe, prépare les drafts, tient son rôle dans chaque compo.',
      'Lit l’adversaire, s’adapte au fil d’une série fearless, assume un rôle précis en compétition.',
      'Constance à haut niveau, pool de compétition complet, leadership et préparation d’adversaire.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Derniers coups, combos, esquives, placement en combat.' },
    { id: 'lane', nom: 'Phase de lane', resume: 'Vagues, échanges, retours en base, début de partie du jungler.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Carte, vision, objectifs, rotations, tempo.' },
    { id: 'comm', nom: 'Communication', resume: 'Pings, annonces, timers, calme.' },
    { id: 'role', nom: 'Rôle', resume: 'Mission du poste et pool de champions.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Réussir ses derniers coups', 'En Practice Tool, sans objet : 50 CS en 10 minutes, deux séances de suite.'),
    o('lane-1-1', 'Survivre à la phase de lane', 'Au plus une mort avant 10 minutes, en moyenne sur 5 parties.'),
    o('jeu-1-1', 'Comprendre le but d’une partie', 'Expliquer au coach : détruire le Nexus, et ce que rapportent tourelles, dragons, larves du Néant et Baron.'),
    o('comm-1-1', 'Signaler ce qu’on voit', 'Ping ou annonce à chaque adversaire qui disparaît ou apparaît, sur 3 parties.'),
    o('role-1-1', 'Choisir un rôle principal', 'Rôle fixé avec le coach et 2 champions de ce rôle joués 10 parties chacun.'),
    o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun message négatif ni ping provocateur sur 5 parties.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Maîtriser les combos de ses champions', 'Combo principal de ses 2 champions réussi 9 fois sur 10 sur un mannequin en Practice Tool.'),
    o('lane-2-1', 'Revenir en base au bon moment', 'Retour avec la vague poussée et l’or d’un objet prévu, sur 3 parties revues (jungle : après un camp ou une action).'),
    o('jeu-2-1', 'Poser des balises toute la partie', 'Score de vision d’au moins 0,8 par minute en moyenne sur 20 parties classées.'),
    o('comm-2-1', 'Annoncer les sorts d’invocateur', 'Flash et TP adverses annoncés avec leur heure de retour (« flash mid 12:30 »), sur 5 parties.'),
    o('role-2-1', 'Construire un pool de 3 champions', '3 champions du rôle joués 20 parties chacun, dont un jouable en premier choix.'),
    o('mental-2-1', 'S’arrêter après 2 défaites de suite', 'Pause d’au moins 15 minutes respectée pendant 1 mois en classé.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Atteindre 80 CS à 10 minutes en Practice Tool', 'Sans objet, trois séances de suite, score noté dans l’espace de l’équipe.'),
    o('lane-3-1', 'Gérer ses vagues', 'Pousser, geler ou laisser revenir la vague au bon moment : 3 cas justes relevés en VOD (jungle : chemin adverse annoncé avant 3 min 30).'),
    o('jeu-3-1', 'Participer aux combats de l’équipe', 'Participation aux kills d’au moins 50 % en moyenne sur 20 parties classées.'),
    o('comm-3-1', 'Annoncer les timers d’objectifs', 'Dragons, larves et Baron annoncés une minute avant leur apparition, relevé en review sur 3 parties à 5.'),
    o('role-3-1', 'Atteindre les chiffres de base de son rôle', 'Sur 20 parties classées : 7 CS par minute en top, mid et ADC ; 5,5 en jungle ; 1,5 de score de vision par minute en support.'),
    o('mental-3-1', 'Revoir ses propres parties chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Tenir un KDA de 3', 'KDA moyen d’au moins 3 sur 20 parties classées.'),
    o('lane-4-1', 'Sortir de la lane avec l’avance', 'Plus de CS ou d’or que son vis-à-vis à 15 minutes dans 6 parties sur 10, relevé dans le replay.'),
    o('jeu-4-1', 'Préparer chaque objectif', 'Vague poussée et vision posée une minute avant chaque dragon, larves ou Baron, sur 3 VOD.'),
    o('comm-4-1', 'Proposer des plans en cours de partie', 'Au moins une proposition utile par partie (objectif, vague, engage), prise ou non par le shotcaller.'),
    o('role-4-1', 'Connaître sa mission dans chaque compo', 'Rôle en combat (engage, protection, split, poke) expliqué et appliqué en scrim pour chaque compo du stratbook.'),
    o('mental-4-1', 'Entretenir sa forme', '7 heures de sommeil et 2 activités physiques par semaine pendant 1 mois.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Être constant', 'Moins de 10 % d’écart de CS par minute et de KDA entre la meilleure et la pire semaine du mois.'),
    o('lane-5-1', 'Jouer ses matchups difficiles', 'Plan écrit (niveaux 1 à 6, objets, dangers) pour les 5 pires matchups de son rôle, appliqué en scrim.'),
    o('jeu-5-1', 'Gérer le tempo de la partie', 'Choix entre objectif, split push ou retour en base justifié en review sur 5 parties.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en combat et autour du Baron, sans cri ni parole inutile, relevées en VOD.'),
    o('role-5-1', 'Préparer un pool fearless', '5 champions prêts pour un Bo5 fearless, dont 2 jouables en premier choix, validés en scrim.'),
    o('mental-5-1', 'Gérer le stress des matchs officiels', 'Technique de respiration ou de retour au calme utilisée entre les parties d’une série.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Atteindre des chiffres semi-pro', 'Objectifs chiffrés du rôle (CS par minute, KDA, vision) fixés avec le coach et tenus sur 2 mois de scrims.'),
    o('lane-6-1', 'Préparer son vis-à-vis', 'Fiche du joueur adverse (champions, habitudes, timings) prête avant chaque match officiel.'),
    o('jeu-6-1', 'Jouer les conditions de victoire', 'Conditions de victoire des deux compos annoncées après chaque draft d’officiel et suivies, relevé en VOD.'),
    o('comm-6-1', 'Tenir le cap après une erreur', 'Relance l’équipe par un plan, jamais par un reproche, relevé en VOD de match officiel.'),
    o('role-6-1', 'Pool de compétition complet', '7 champions prêts en match officiel, chacun joué en scrim dans le mois.'),
    o('mental-6-1', 'Routine de performance complète', 'Sommeil, alimentation, échauffement et récupération planifiés les semaines de match.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à 5 deux fois par semaine', 'Deux sessions à 5 (Flex ou parties personnalisées) chaque semaine pendant 1 mois.'),
    o('coll-1-2', 'Adopter un vocabulaire commun', 'Mêmes noms pour les camps, buissons et zones de la carte, notés dans l’espace de l’équipe.'),
    o('coll-2-1', 'Un début de partie par côté', 'Niveau 1 et premier chemin du jungler écrits pour le côté bleu et le côté rouge.'),
    o('coll-2-2', 'Débriefer chaque session', '10 minutes de débrief à la fin de chaque session à 5 pendant 1 mois.'),
    o('coll-3-1', 'Contester les objectifs ensemble', 'Aucun dragon ni Baron contesté à 3 contre 5 pendant 1 mois de scrims.'),
    o('coll-3-2', 'Revue VOD collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois.'),
    o('coll-4-1', 'Setups d’objectifs écrits', 'Setups larves, dragon et Baron écrits dans le stratbook et appliqués en scrim.'),
    o('coll-4-2', 'Trois compos maîtrisées', 'Trois compos types (engage, protection ou poke, split) jouées en scrim avec leur plan écrit.'),
    o('coll-5-1', 'Préparer chaque officiel', 'Fiche adversaire (drafts, champions, habitudes du jungler) prête la veille de chaque match officiel.'),
    o('coll-5-2', 'Adapter la draft dans la série', 'Plan de draft revu entre chaque partie d’une série, noté dans la fiche du match.'),
    o('coll-6-1', 'Tenir un Bo5 fearless', '25 champions prêts dans l’équipe (5 par joueur au moins), sans compo improvisée en scrim fearless.'),
    o('coll-6-2', 'Stratbook à jour sous 72 h', 'Mise à jour après chaque patch dans les 3 jours.'),
  ],
  seuils: {
    'jeu-2-1': { chiffre: 'vision', seuil: 0.8, sens: '>=' },
    'jeu-3-1': { chiffre: 'kp', seuil: 50, sens: '>=' },
    'meca-4-1': { chiffre: 'kda', seuil: 3, sens: '>=' },
  },
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer ensemble : rôles, pings, début de partie, premiers automatismes. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:20', 'echauffement', 'Échauffement', 'Practice Tool : derniers coups et combo principal.', 'individuel'),
        b(2, '20:20', '21:20', 'theorie', 'Rôles et carte', 'Mission de chaque rôle, camps de la jungle, valeur des objectifs.'),
        b(2, '21:20', '22:00', 'laning', 'Laning en 1v1', '1v1 personnalisés par lane, 2v2 en bas ; le jungler chronomètre son premier tour de jungle.', 'individuel'),
        b(3, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:20', '22:00', 'classe', 'Flex à 5', 'Deux parties en groupe : appliquer les pings et les rôles du mardi.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(5, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:20', '21:20', 'theorie', 'Début de partie', 'Niveau 1, premier chemin du jungler, premiers retours en base.'),
        b(5, '21:20', '22:00', 'vod', 'VOD courte', 'Les 15 premières minutes d’une partie de mercredi.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim amical', 'Deux parties contre une équipe de niveau proche.'),
        b(6, '17:00', '17:20', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire un stratbook, enchaîner scrims et VOD, travailler ses matchups et son pool.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'VOD du week-end', 'Scrim ou match du samedi : draft, 15 premières minutes, combats clés.'),
        b(1, '21:00', '21:45', 'theorie', 'Stratbook de la semaine', 'Setups d’objectifs et compos à travailler.'),
        b(2, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '20:00', '20:45', 'laning', 'Matchups', '1v1 et Practice Tool sur les matchups de la semaine.', 'individuel'),
        b(2, '20:45', '22:00', 'classe', 'Flex à 5', 'Appliquer le setup d’objectif du lundi.'),
        b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrim (2 parties)', 'Une partie côté bleu, une côté rouge.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '20:00', '20:45', 'soloq', 'Classé solo/duo', 'Programme individuel : un objectif précis par partie.', 'individuel'),
        b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:00', '22:00', 'scrim', 'Scrim (2 parties)', ''),
        b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(6, '14:15', '15:00', 'draft', 'Préparation de draft', 'Bans et priorités contre l’adversaire du jour.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim ou tournoi', ''),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour du match officiel : anti-strat, scrims fearless, plan de draft partie par partie.',
      blocs: [
        b(2, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '19:30', '20:30', 'vod', 'VOD du dernier officiel', ''),
        b(2, '20:30', '22:30', 'scrim', 'Scrim (2 parties)', ''),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '19:30', '20:30', 'champions', 'Pool fearless', 'Chaque joueur prépare 5 champions pour un Bo5 fearless.', 'individuel'),
        b(3, '20:30', '22:45', 'scrim', 'Scrim fearless (3 parties)', ''),
        b(4, '19:00', '20:00', 'theorie', 'Anti-strat', 'Fiche de l’adversaire : drafts, chemins du jungler, habitudes.'),
        b(4, '20:00', '22:00', 'scrim', 'Scrim contre un style proche', 'Équipe qui joue comme l’adversaire du samedi.'),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '21:30', 'scrim', 'Scrim de répétition', ''),
        b(5, '21:30', '22:00', 'draft', 'Plan de draft du match', 'Bans, premiers choix et réponses prévues partie par partie.'),
        b(6, '13:00', '14:00', 'echauffement', 'Échauffement collectif', 'Practice Tool puis 1v1 courts.'),
        b(6, '15:00', '17:30', 'match', 'Match officiel', ''),
        b(6, '17:30', '17:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait mardi.'),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Practice Tool : derniers coups sans objet, compter les CS.' },
        { duree: 5, texte: 'Combo principal de son champion sur un mannequin, 10 fois de suite.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', 'Deux champions de son rôle, pas plus', 'Une partie revue avec un coéquipier ou le coach'],
      conseil: 'Deux champions bien connus valent mieux que dix survolés : le pool s’élargit plus tard.',
    },
    2: {
      echauffement: [
        { duree: 10, texte: 'Practice Tool : derniers coups sous tourelle et avec une compétence.' },
        { duree: 10, texte: 'Combos de ses deux champions sur un mannequin, avec Flash.' },
        { duree: 5, texte: 'Préparer la partie : matchup probable, chemin du jungler adverse.' },
      ],
      hebdo: ['4 sessions dont 2 à 5', '10 parties classées dans son rôle principal', 'Une VOD personnelle : chaque mort avant 10 minutes expliquée'],
      conseil: 'Couper le chat de tous les joueurs en classé : l’énergie va au jeu, pas aux disputes.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Practice Tool : 10 minutes de farm sans objet, score noté.' },
        { duree: 10, texte: 'Combos et annulations d’animation de ses champions.' },
        { duree: 10, texte: '1v1 personnalisé contre un coéquipier : premier kill ou 100 CS.' },
      ],
      hebdo: ['Revoir une de ses parties (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Matchups de ses champions révisés sur un site de stats'],
      conseil: 'Chaque session a un seul thème : vagues, vision ou échanges, pas tout à la fois.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Practice Tool : routine fixe (farm, combos, Flash), scores notés.' },
        { duree: 10, texte: 'Situations de son rôle : niveau 1, premier retour, combo avec Flash.' },
        { duree: 15, texte: '1v1 personnalisé sur le matchup le plus probable de la semaine.' },
      ],
      hebdo: ['Une VOD personnelle et une VOD d’un joueur pro de son rôle', 'Un nouveau champion testé en partie normale avant le classé', 'Deux activités physiques'],
      conseil: 'Suivre ses chiffres d’une semaine sur l’autre : une baisse de CS ou de vision annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Practice Tool : routine personnalisée sur ses points faibles.' },
        { duree: 10, texte: 'Combos de son pool fearless, un champion différent chaque jour.' },
        { duree: 15, texte: '1v1 à intensité de match, puis 5 minutes de calme.' },
      ],
      hebdo: ['Analyse de 2 adversaires potentiels (drafts, champions)', 'Chaque champion du pool fearless joué au moins une fois', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Practice Tool : routine de compétition, identique chaque jour.' },
        { duree: 10, texte: 'Situations de son rôle chronométrées.' },
        { duree: 20, texte: '1v1 contre un coéquipier puis revue du plan de jeu du jour.' },
      ],
      hebdo: ['Fiche du vis-à-vis préparée pour chaque officiel', 'Séance de théorie animée sur son rôle (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation de la draft et la récupération font la différence autant que la mécanique.',
    },
  },
  parRole: {
    top: [
      'Practice Tool : échanges des niveaux 1 à 3 sur son matchup principal, avec et sans vague.',
      'Gestion de vague : geler devant sa tourelle puis lancer une poussée lente, 5 fois en partie personnalisée.',
      'Téléportation : une TP utile par partie (combat, objectif ou retour en lane), relevée en VOD.',
    ],
    jungle: [
      'Premier tour de jungle chronométré des deux côtés, sans perte de PV inutile.',
      'Suivi du jungler adverse : position annoncée à 3 min 30 et à chaque apparition.',
      'Smite sur dragon et Baron : 10 sur 10 en Practice Tool, avec un coéquipier qui frappe aussi l’objectif.',
    ],
    mid: [
      'Derniers coups sous pression : 10 minutes de 1v1 sans perdre un seul sbire canon.',
      'Roams : bouger après avoir poussé sa vague, 2 roams utiles par partie relevés en VOD.',
      'Combos de burst avec Flash sur un mannequin, réussis 9 fois sur 10.',
    ],
    adc: [
      'Kiting : 2 minutes d’attaque-déplacement sur un mannequin en Practice Tool, sans clic perdu.',
      'Placement en combat : rester à portée maximale de la cible la plus proche, relevé sur 3 combats par VOD.',
      '2v2 en bas avec son support : premier kill ou 100 CS, sur les matchups de la semaine.',
    ],
    support: [
      'Plan de vision par phase (début, dragon, Baron) écrit et appliqué en scrim.',
      'Engage ou protection : timing de son action sur 5 situations revues en VOD.',
      'Roams avec le jungler : un mouvement utile après chaque retour en base, relevé en VOD.',
    ],
  },
  initiale: INITIALE,
};
