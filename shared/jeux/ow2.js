// Overwatch (nommé « Overwatch 2 » jusqu’au 10 février 2026, date où Blizzard a retiré le « 2 ») — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://overwatch.blizzard.com/en-us/news/patch-notes/,
//   https://overwatch.blizzard.com/fr-fr/news/patch-notes/, https://overwatch.blizzard.com/fr-fr/heroes/,
//   https://esports.gg/news/overwatch/overwatch-subroles-explained, https://overwatch.weirdgloop.org/w/Competitive_Play,
//   https://overwatch.weirdgloop.org/w/Maps, https://owtics.gg/en-US/esports/tournament/2026-owcs-emea-stage-3,
//   https://owtics.gg/en-US/esports/tournament/2026-owcs-na-stage-3, https://owtv.gg/news/owwc-online-qualifier-details,
//   https://owtv.gg/news/full-detailed-owcs-2026-season-format, https://dotesports.com/overwatch/guides/overwatch-ewc-2026-schedule-results-standings,
//   https://esports.overwatch.com/news/owcs-2026-stage-3-viewers-guide, https://www.counterwatch.gg/stats/overwatch/heroes/doctrine
// Incertitudes :
//   - Répartition DPS hitscan / DPS flex et main support / support flex : convention de la scène, pas une classification
//     officielle (le jeu a 10 sous-rôles). Règle suivie : hitscan = sous-rôle Tireur (Sharpshooter) + fusils (Bastion,
//     Emre, Sierra, Soldat : 76) ; Emre et Sierra classés « hitscan » d’après des guides (Mobalytics, allthings.how).
//     Supports récents (Jetpack Cat, Mizuki : main ; Doctrine, Sombra : flex) classés d’après leur kit et les guides.
//   - Choix des maps OWCS NA/EMEA 2026 : règlement officiel non trouvé en ligne ; règle déduite des événements 2026
//     au format OWCS (pré-saison de Séoul, qualifications de la Coupe du monde) et des règles OWCS antérieures.
//   - Ordre des bans de héros : « choisit de bannir en premier ou en second » (players.com.ua) ou « bannit en
//     premier » (Dot Esports) pour la tête de série puis le perdant de la map précédente.
//   - Numéro de patch : Blizzard date ses notes de patch sans numéro public ; patch noté par sa date.
//   - Noms français de quelques maps (Circuit royal, Péninsule Antarctique) et du rang Émeraude non vérifiés sur le client.
//   - Pool OWCS = étape 3 NA/EMEA (identique dans les deux régions) ; les pools Corée, Japon et Chine diffèrent.
//   - Clash exclu : retiré du compétitif en saison 15 (2025) et de la partie rapide en saison 1 2026.
//   - compsPro omis : aucune compo complète par map publiée et vérifiable pour l’étape 3 (une semaine jouée).
//   - Quota de recherche web épuisé en fin de vérification : tracker.gg non vérifié (Overbuff est fermé).

import { INITIALE } from './ow2-initiale.js';

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

// Rangs : 9 niveaux de 5 divisions (5 = la plus basse), Émeraude entre Platine et Diamant.
const NIVEAUX_RANG = [
  ['bronze', 'Bronze'], ['argent', 'Argent'], ['or', 'Or'], ['platine', 'Platine'], ['emeraude', 'Émeraude'],
  ['diamant', 'Diamant'], ['maitre', 'Maître'], ['grandmaitre', 'Grand maître'], ['champion', 'Champion'],
];

export default {
  id: 'ow2',
  nom: 'Overwatch',
  court: 'OW',
  editeur: 'Blizzard Entertainment',
  genre: 'fps-heros',
  equipe: { titulaires: 5, remplacants: 2 },   // 5v5 ; OWCS 2026 : 6 à 7 joueurs par équipe

  vocabulaire: {
    personnage: 'héros', personnages: 'héros',
    carte: 'map', cartes: 'maps',
    // Le score d’un match est le nombre de maps gagnées dans la série (FT3 : 3-1, FT2 en scrim court…).
    // Les points de map (pourcentage de contrôle, distance d’escorte, points de flashpoint) ne font pas un score
    // comparable d’un mode à l’autre : ils vont dans les notes du match.
    manche: 'map', manches: 'maps',
  },

  roles: [                          // postes d’un 5v5 : 1 tank, 2 DPS, 2 supports
    { id: 'tank', nom: 'Tank', court: 'TNK', resume: 'Crée l’espace, encaisse et décide quand l’équipe engage.' },
    { id: 'hitscan', nom: 'DPS hitscan', court: 'HIT', resume: 'Tient les angles longs, punit les cibles volantes et gagne les duels à distance.' },
    { id: 'flexdps', nom: 'DPS flex', court: 'FLX', resume: 'Plonge, prend les flancs ou spamme les goulets selon la compo.' },
    { id: 'mainsup', nom: 'Main support', court: 'MSU', resume: 'Soigne en continu, garde le tank en vie et apporte mobilité ou protection.' },
    { id: 'flexsup', nom: 'Support flex', court: 'FSU', resume: 'Apporte dégâts, picks et gros cooldowns, et protège la ligne arrière.' },
  ],
  camps: [                          // seulement en Escorte et en Hybride ; Contrôle, Push et Flashpoint sont symétriques
    { id: 'att', nom: 'Attaque' }, { id: 'def', nom: 'Défense' },
  ],
  typesStrat: [
    { id: 'dive', nom: 'Dive', camps: [], resume: 'Plonger à plusieurs sur une cible isolée de la ligne arrière avec un tank et des héros mobiles.' },
    { id: 'brawl', nom: 'Rush / brawl', camps: [], resume: 'Avancer groupés au corps à corps derrière le tank et gagner le fight par la durabilité et les soins.' },
    { id: 'poke', nom: 'Poke', camps: [], resume: 'User l’adversaire à distance derrière une barrière, puis engager quand ses ressources sont épuisées.' },
    { id: 'controle', nom: 'Plan Contrôle', camps: [], resume: 'Prise et tenue du point : entrée, place de chacun, gestion de la fin de manche à 99 %.' },
    { id: 'push', nom: 'Plan Push', camps: [], resume: 'Escorter ou reprendre le robot, choisir quand contester et quand regrouper.' },
    { id: 'flashpoint', nom: 'Plan Flashpoint', camps: [], resume: 'Course vers chaque nouveau point : chemin de rotation, timing d’arrivée et prise à 5.' },
    { id: 'attaque', nom: 'Attaque escorte et hybride', camps: ['att'], resume: 'Prise du premier point et avancée du convoi, ultimes gardés pour les checkpoints.' },
    { id: 'defense', nom: 'Défense escorte et hybride', camps: ['def'], resume: 'Tenir les goulets, reculer au bon moment et punir les retours échelonnés.' },
    { id: 'spawn', nom: 'Plan de spawn', camps: [], resume: 'Après un fight perdu : retour groupé, contournement ou abandon du point.' },
    { id: 'ultimes', nom: 'Gestion des ultimes', camps: [], resume: 'Ordre des ultimes, combos et réponses aux ultimes adverses selon le compte de chaque équipe.' },
  ],
  typesBloc: [
    { id: 'aim', nom: 'Aim (champ de tir, deathmatch)', duree: 45 },
    { id: 'herospool', nom: 'Pool de héros et swaps', duree: 60 },
    { id: 'custom', nom: 'Partie perso (atelier, 1v1, fights)', duree: 90 },
  ],
  rangs: [                          // système classé de la saison 5 (octobre 2026), ordre croissant
    ...NIVEAUX_RANG.flatMap(([id, nom], i) => [5, 4, 3, 2, 1].map((d, j) => ({ id: `${id}${d}`, nom: `${nom} ${d}`, n: i * 5 + j + 1 }))),
    { id: 'top500', nom: 'Top 500', n: 46 },   // classement Challenger (pas un niveau), trié par rang depuis la saison 5
  ],
  chiffres: [                       // profil de carrière officiel, onglet Parties compétitives (moyennes par 10 min)
    { id: 'elim10', nom: 'Éliminations / 10 min', unite: '', min: 0, max: 50, decimales: 1, aide: 'Profil de carrière, Parties compétitives, héros principal : éliminations, moyenne par 10 min.' },
    { id: 'morts10', nom: 'Morts / 10 min', unite: '', min: 0, max: 20, decimales: 1, aide: 'Morts, moyenne par 10 min sur le héros principal (plus bas = mieux).' },
    { id: 'degats10', nom: 'Dégâts / 10 min', unite: '', min: 0, max: 30000, decimales: 0, aide: 'Dégâts infligés aux héros, moyenne par 10 min sur le héros principal.' },
    { id: 'soins10', nom: 'Soins / 10 min', unite: '', min: 0, max: 30000, decimales: 0, aide: 'Supports : soins prodigués, moyenne par 10 min sur le héros principal.' },
    { id: 'winrate', nom: 'Victoires', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Pourcentage de victoires en compétitif sur la saison en cours (profil de carrière ou site de stats).' },
  ],
  score: { type: 'simple' },        // maps gagnées dans la série
  veto: {
    type: 'aucun',
    formats: [],
    notes: 'Pas de veto de maps en OWCS : la map 1 est une map de Contrôle choisie par la tête de série (ou le gagnant d’un 1v1 sur certains événements), puis le perdant de chaque map choisit la suivante dans un mode pas encore joué. '
      + 'Bans de héros : 1 par équipe et par map, d’un autre rôle que le ban adverse, un même héros une seule fois par série ; l’ordre revient à la tête de série, puis au perdant de la map précédente. '
      + 'Sur FACEIT, veto par mode : bans puis pick de la map, l’autre équipe choisit le côté.',
  },
  checklistMatch: [
    { id: 'vod', nom: 'VOD de l’adversaire revues' },
    { id: 'bans', nom: 'Bans de héros prévus pour chaque map' },
    { id: 'maps', nom: 'Map de Contrôle d’ouverture et maps par mode choisies' },
    { id: 'compos', nom: 'Compos et swaps fixés pour chaque mode' },
    { id: 'ultimes', nom: 'Combos d’ultimes et plan de spawn répétés' },
    { id: 'logistique', nom: 'Horaire, code du lobby et remplaçant confirmés' },
  ],
  profil: {                         // profil de carrière officiel (Overbuff a fermé)
    site: 'Profil de carrière Overwatch',
    modele: 'https://overwatch.blizzard.com/fr-fr/career/{id}/',
    format: '^[^\\s#-]{3,12}[#-][0-9]{4,6}$',
    separateur: '-', // le profil de carrière attend « Pseudo-12345 » : le # du BattleTag devient un tiret dans l'adresse
    aide: 'BattleTag : Pseudo#12345 ; profil de carrière réglé sur « Public » dans les options du jeu (Social).',
  },
  meta: {
    sources: ['overwatch.blizzard.com', 'esports.overwatch.com', 'owtics.gg', 'owtv.gg', 'liquipedia.net'],
    consigne: 'Lire les notes de patch officielles depuis la dernière vérification : héros ajoutés, refontes, changements de rôle (Sombra est passée soutien en saison 5) et perks modifiés. '
      + 'Vérifier le map pool OWCS de l’étape en cours (NA/EMEA) et les nouvelles maps, qui peuvent y entrer dès leur sortie. '
      + 'Relever les héros les plus joués et les plus bannis en OWCS et en Grand maître/Champion. '
      + 'Contrôler les règles en vigueur : bans de héros, choix des maps, format des séries, niveaux de rang et Top 500.',
    pool: true,
  },
  paliers: {
    rangs: ['Non classé à Bronze', 'Argent à Or', 'Platine à Émeraude', 'Diamant à Maître', 'Grand maître, tournois amateurs', 'Champion et Top 500, semi-pro'],
    resumes: [
      'Découvre le jeu, les rôles, les cinq modes et quelques héros.',
      'Maîtrise les bases : rester avec l’équipe, viser juste, trois héros dans son rôle.',
      'Utilise ses capacités avec un but, communique clairement, comprend les compos.',
      'Compte les ultimes, gagne ses duels de rôle, s’adapte par des swaps.',
      'Lit l’adversaire, s’adapte entre les maps, tient son rôle malgré les bans.',
      'Constance à haut niveau, préparation adverse, leadership et plan de bans.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Visée, tracking, déplacements, duels.' },
    { id: 'ult', nom: 'Ultimes et capacités', resume: 'Cooldowns, économie d’ultimes, combos, réponses aux ultimes adverses.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Placement, timing des fights, spawns, lecture de la compo adverse.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, calme, coordination.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que son poste attend de lui : pool de héros, mission en fight, swaps.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Régler son jeu une fois pour toutes', 'Sensibilité, champ de vision (103) et réticule notés dans le roster, inchangés pendant 2 semaines.'),
    o('ult-1-1', 'Connaître le kit de son héros principal', 'Décrire au coach chaque capacité, son temps de recharge et son ultime, puis les lancer sans hésiter au champ de tir.'),
    o('jeu-1-1', 'Comprendre les cinq modes', 'Expliquer au coach comment on gagne en Contrôle, Escorte, Hybride, Push et Flashpoint.'),
    o('comm-1-1', 'Annoncer chaque ennemi vu', 'Héros et endroit (« Tracer dans notre dos ») à chaque contact, sur 3 parties.'),
    o('role-1-1', 'Choisir un poste principal', 'Poste fixé avec le coach et 2 héros de ce poste joués 10 parties chacun.'),
    o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun message négatif en vocal ou en chat sur 5 parties.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'S’échauffer avant de jouer', 'Champ de tir puis deathmatch, 15 minutes avant chaque session, 2 semaines de suite.'),
    o('ult-2-1', 'Ne pas mourir avec son ultime chargé', 'Sur 3 VOD, aucune mort avec l’ultime prêt depuis plus de 30 secondes.'),
    o('jeu-2-1', 'Jouer à portée de son équipe', 'Sur 3 VOD, au moins 7 morts sur 10 à portée de soin ou d’aide d’un coéquipier.'),
    o('comm-2-1', 'Annoncer les ultimes', 'Son ultime prêt et les ultimes adverses utilisés annoncés à chaque fight, sur 3 parties.'),
    o('role-2-1', 'Trois héros prêts dans son poste', 'Héros principal et 2 héros de secours joués 15 parties chacun, notés dans le roster.'),
    o('mental-2-1', 'S’arrêter après 2 défaites de suite', 'Pause d’au moins 15 minutes respectée pendant 1 mois en classé.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Travailler le tracking', 'Score de référence d’un exercice de suivi (logiciel d’aim) noté, puis amélioré de 10 % en 1 mois.'),
    o('ult-3-1', 'Combiner son ultime avec un coéquipier', '2 combos d’ultimes de la compo répétés en partie perso et réussis 4 fois sur 5.'),
    o('jeu-3-1', 'Mourir moins de 7 fois par 10 minutes', 'Morts / 10 min à 7 ou moins en compétitif sur la saison (profil de carrière).'),
    o('comm-3-1', 'Annoncer les capacités clés adverses', 'Annonces du type « sleep d’Ana utilisé », « Suzu partie » relevées à chaque fight en review.'),
    o('role-3-1', 'Connaître sa mission dans chaque compo', 'Expliquer son rôle en dive, en brawl et en poke, puis l’appliquer en scrim sans rappel du coach.'),
    o('mental-3-1', 'Revoir ses propres VOD chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Prendre l’avantage sur son vis-à-vis', 'Sur 5 VOD de scrim, plus de duels gagnés que perdus contre le joueur du même poste en face.'),
    o('ult-4-1', 'Compter les ultimes', 'Avant chaque fight, ultimes des deux équipes annoncés juste 7 fois sur 10, relevé en review.'),
    o('jeu-4-1', 'Gagner plus de parties qu’on n’en perd', '52 % de victoires ou plus en compétitif sur la saison en cours.'),
    o('comm-4-1', 'Proposer des adaptations en cours de match', 'Au moins une proposition utile par match (swap, cible, timing), retenue ou non par le shotcaller.'),
    o('role-4-1', 'Avoir un swap prêt pour chaque menace', 'Un héros de réponse préparé contre les 3 picks adverses les plus gênants du moment et joué en scrim.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’un mauvais match faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Être constant', 'Moins de 15 % d’écart de dégâts ou de soins par 10 min entre la meilleure et la pire semaine du mois.'),
    o('ult-5-1', 'Contrer les ultimes adverses', 'Réponse prévue (capacité ou ultime) aux 2 ultimes adverses les plus dangereux de chaque compo, appliquée en scrim.'),
    o('jeu-5-1', 'Ne pas offrir le premier pick', 'Première mort de l’équipe dans moins de 2 fights sur 10, relevé sur 5 VOD de scrim.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en fin de map et en prolongation, sans cri ni parole inutile, relevées en VOD.'),
    o('role-5-1', 'Rester fort quand son héros est banni', '2 héros de son poste joués au niveau scrim en plus du héros principal, prêts le jour du match.'),
    o('mental-5-1', 'Gérer le stress des matchs officiels', 'Technique de respiration ou de retour au calme utilisée entre les maps importantes.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Tenir des repères semi-pro', 'Repères du poste (dégâts ou soins, morts par 10 min) fixés avec le coach et tenus 2 mois en scrim de haut niveau.'),
    o('ult-6-1', 'Mettre ses ultimes au service du plan', 'Ultime lancé au signal du shotcaller ou gardé pour le fight suivant : choix validé en VOD 8 fois sur 10.'),
    o('jeu-6-1', 'Adapter le plan entre deux maps', 'Changement de compo, de cible ou de timing décidé sur des faits relevés pendant la map précédente.'),
    o('comm-6-1', 'Tenir le cap après un fight perdu', 'Relance l’équipe par une annonce de plan (regroupement, prochain timing), jamais par un reproche.'),
    o('role-6-1', 'Être le référent de son poste', 'Anime chaque mois une séance de théorie sur son poste : héros du patch, bans, contres.'),
    o('mental-6-1', 'Routine de performance complète', 'Sommeil, alimentation, échauffement et récupération planifiés les semaines de match.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à 5 deux fois par semaine', 'Deux sessions à 5 chaque semaine pendant 1 mois.'),
    o('coll-1-2', 'Adopter des callouts communs', 'Même nom pour chaque zone des maps du pool, noté dans l’espace de l’équipe.'),
    o('coll-2-1', 'Regrouper avant chaque fight', 'Aucun fight engagé à 4 contre 5 après un retour de spawn, sur 5 scrims revus.'),
    o('coll-2-2', 'Un plan par map d’escorte et d’hybride', 'Attaque et défense écrites dans le stratbook pour chaque map d’Escorte et d’Hybride du pool.'),
    o('coll-3-1', 'Trois compos de base maîtrisées', 'Dive, brawl et poke écrites dans le stratbook avec les héros de chaque joueur, jouées en scrim.'),
    o('coll-3-2', 'Revue VOD collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois.'),
    o('coll-4-1', 'Plan d’ultimes écrit par compo', 'Ordre des ultimes et combos de chaque compo dans le stratbook, appliqués en scrim.'),
    o('coll-4-2', 'Gagner la moitié des maps de scrim', '50 % de maps gagnées sur 20 maps de scrim contre des équipes de niveau égal.'),
    o('coll-5-1', 'Préparer chaque match officiel', 'Fiche adverse (bans habituels, compos par mode, joueurs clés) prête la veille de chaque officiel.'),
    o('coll-5-2', 'Plan de choix de maps', 'Map de Contrôle d’ouverture et map à choisir dans chaque mode après une défaite, fixées avant chaque officiel.'),
    o('coll-6-1', 'Map pool complet', 'Toutes les maps du pool OWCS jouables en match officiel, préparation d’au moins 70 % dans l’espace de l’équipe.'),
    o('coll-6-2', 'Stratbook à jour sous 72 h', 'Compos, bans et plans mis à jour dans les 3 jours après chaque patch.'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer ensemble : postes, callouts, modes, regroupement. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:20', 'echauffement', 'Échauffement', 'Champ de tir puis deathmatch.', 'individuel'),
        b(2, '20:20', '21:20', 'theorie', 'Modes et callouts', 'Une map par mode : objectif, noms des zones, place de chaque poste.'),
        b(2, '21:20', '21:50', 'aim', 'Aim', 'Deathmatch ou logiciel d’aim : suivre la cible sans à-coups.', 'individuel'),
        b(3, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:20', '21:50', 'classe', 'Classé à 5', 'Deux parties en groupe : appliquer les callouts du mardi.'),
        b(3, '21:50', '22:10', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(5, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:20', '21:30', 'custom', 'Partie perso : regroupement', 'Revenir du spawn à 5 et entrer en fight ensemble sur une map de Contrôle.'),
        b(5, '21:30', '22:00', 'vod', 'VOD courte', 'Revoir 3 fights de la partie de mercredi.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim amical', 'Contre une équipe de niveau proche, 4 maps de modes différents.'),
        b(6, '17:00', '17:20', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire un stratbook par mode, enchaîner parties perso et scrims, revoir les VOD chaque semaine.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'VOD du week-end', 'Scrim ou match du samedi : 3 fights gagnés, 3 fights perdus.'),
        b(1, '21:00', '21:30', 'theorie', 'Stratbook de la semaine', 'Compos, plans par mode et ordre des ultimes à travailler.'),
        b(2, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '20:00', '21:15', 'custom', 'Partie perso', 'Combos d’ultimes et entrées en fight de la semaine, 5 répétitions chacun.'),
        b(2, '21:15', '22:15', 'classe', 'Classé à 5', ''),
        b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrim', '4 maps de modes différents.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '20:00', '20:30', 'aim', 'Travail individuel', 'Programme individuel de chaque joueur.', 'individuel'),
        b(4, '20:30', '21:00', 'herospool', 'Pool de héros', 'Héros de secours et swaps contre les picks du moment.', 'individuel'),
        b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:00', '22:00', 'scrim', 'Scrim', ''),
        b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(6, '15:00', '17:00', 'scrim', 'Scrim ou tournoi', ''),
        b(6, '17:00', '17:20', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour du match officiel : préparation adverse, scrims sur les maps attendues, plan de bans et de maps, lundi sans jeu.',
      blocs: [
        b(2, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '19:30', '20:30', 'vod', 'VOD du dernier officiel', 'Fights décisifs, bans et choix de maps des deux équipes.'),
        b(2, '20:30', '22:30', 'scrim', 'Scrim', '4 maps de modes différents.'),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '19:30', '20:00', 'custom', 'Nouveaux plans', 'Compos et combos d’ultimes ajoutés cette semaine.'),
        b(3, '20:00', '22:00', 'scrim', 'Scrim', 'Héros principal banni : jouer le plan B.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '18:00', '18:45', 'aim', 'Travail individuel', 'Programme individuel de chaque joueur.', 'individuel'),
        b(4, '19:00', '20:00', 'theorie', 'Préparation adverse', 'Fiche de l’adversaire : bans habituels, compos par mode, joueurs clés.'),
        b(4, '20:00', '22:00', 'scrim', 'Scrim sur les maps attendues', ''),
        b(4, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '20:30', 'scrim', 'Scrim de répétition', '2 maps attendues contre une équipe de style proche.'),
        b(5, '20:30', '21:00', 'theorie', 'Plan de match', 'Map de Contrôle d’ouverture, map choisie par mode, bans et plan B.'),
        b(6, '13:30', '14:15', 'custom', 'Échauffement collectif', 'Entrées en fight et combos d’ultimes de la compo du jour.'),
        b(6, '15:00', '18:00', 'match', 'Match officiel', ''),
        b(6, '18:00', '18:15', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait mardi.'),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'Champ de tir : cibles fixes puis mobiles, viser le centre de la cible.' },
        { duree: 10, texte: 'Deathmatch : un seul héros, rester calme et suivre sa cible.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', 'Un deathmatch avant chaque session', 'Découvrir une map de chaque mode en partie perso'],
      conseil: 'Jouer souvent et peu longtemps vaut mieux qu’une longue session par semaine.',
    },
    2: {
      echauffement: [
        { duree: 5, texte: 'Champ de tir : tracking sur les robots mobiles.' },
        { duree: 10, texte: 'Logiciel d’aim : un exercice de suivi et un de clic sur cible.' },
        { duree: 10, texte: 'Deathmatch sur son héros principal.' },
      ],
      hebdo: ['4 sessions dont 2 à 5', 'Un héros de secours joué 5 parties', 'Une VOD de 10 minutes : ses morts uniquement'],
      conseil: 'Noter sa sensibilité et ne plus la changer : la régularité construit la mémoire musculaire.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : tracking et micro-ajustements.' },
        { duree: 10, texte: 'Code d’atelier d’entraînement : visée ou déplacements de son héros.' },
        { duree: 10, texte: 'Deathmatch : jouer les couverts et les angles, pas seulement viser.' },
      ],
      hebdo: ['Revoir une de ses VOD (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Un héros de réponse préparé contre le pick adverse du moment'],
      conseil: 'Chaque séance d’aim a un seul thème : mieux vaut un exercice bien fait que dix survolés.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine fixe de 3 exercices, scores notés.' },
        { duree: 10, texte: 'Champ de tir : enchaînements de capacités de son héros principal.' },
        { duree: 15, texte: 'Deathmatch ou 1v1 en partie perso à intensité de match.' },
      ],
      hebdo: ['Une VOD personnelle et une VOD d’un joueur pro de son poste', 'Combos d’ultimes de la compo révisés', 'Deux activités physiques'],
      conseil: 'Suivre ses chiffres d’échauffement d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine personnalisée sur ses points faibles.' },
        { duree: 10, texte: 'Partie perso : situations de son poste (entrée, peel, duel contre son vis-à-vis).' },
        { duree: 15, texte: 'Deathmatch à intensité de match, puis 5 minutes de calme.' },
      ],
      hebdo: ['Analyse de 2 adversaires potentiels (bans, compos)', 'Plan B prêt si son héros principal est banni', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Logiciel d’aim : routine de compétition, identique chaque jour.' },
        { duree: 10, texte: 'Partie perso : séquences de son poste chronométrées.' },
        { duree: 20, texte: 'Deathmatch puis 1v1 contre un coéquipier.' },
      ],
      hebdo: ['Fiche adverse préparée pour chaque officiel', 'Séance de théorie animée sur son poste (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la visée.',
    },
  },
  parRole: {
    tank: [
      'Partie perso : entrée sur un point avec les supports, puis repli dès que la barrière ou la capacité défensive tombe.',
      'VOD : noter à chaque fight le moment de l’engagement et l’état des ressources de l’équipe.',
      'Duels de tank en partie perso sur 2 héros de style différent (dive et brawl).',
    ],
    hitscan: [
      'Logiciel d’aim : tracking et flicks à longue distance, 15 minutes par jour.',
      'Partie perso : tenir un angle long contre une cible volante (Pharah, Écho) et la faire tomber.',
      'Suivre chaque semaine ses dégâts et ses éliminations par 10 min.',
    ],
    flexdps: [
      'Partie perso : prendre un flanc par une route différente à chaque fight et revenir vers l’équipe en moins de 5 secondes.',
      'Champ de tir : combos de capacités de son héros sur une cible à mi-vie, 20 répétitions.',
      'VOD : relever les fights où son entrée a créé un pick et ceux où elle est arrivée trop tard.',
    ],
    mainsup: [
      'Partie perso : soins continus sur le tank en restant hors de vue de la ligne arrière adverse.',
      'Mobilité et boosts (vitesse, saut, Ange gardien) annoncés à l’équipe avant chaque engagement.',
      'Suivre chaque semaine ses soins et ses morts par 10 min.',
    ],
    flexsup: [
      'Logiciel d’aim : clics précis pour les capacités qui se visent (sleep, kunaï, grenade).',
      'Partie perso : protéger la ligne arrière d’un dive (Tracer, Genji, Winston) avec ses cooldowns.',
      'VOD : relever chaque cooldown majeur (sleep, Suzu, immortalité) et son effet sur le fight.',
    ],
  },
  seuils: {
    'jeu-3-1': { chiffre: 'morts10', seuil: 7, sens: '<=' },
    'jeu-4-1': { chiffre: 'winrate', seuil: 52, sens: '>=' },
  },
  initiale: INITIALE,
};
