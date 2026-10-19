// Counter-Strike 2 — modèle de jeu.
// Vérifié le 18/10/2026. Sources : https://www.dust2.us/news/75298/breaking-valve-announce-the-return-of-cache-to-active-duty-after-seven-years,
//   https://dotesports.com/counter-strike/news/cs2-season-5-update-patch-notes, https://www.explosion.com/game-guides/counter-strike-2-patch-notes/,
//   https://www.dust2.us/news/71819/breaking-valve-roll-out-massive-change-to-how-reloading-ammo-works-in-latest-update,
//   https://github.com/ValveSoftware/counter-strike_rules_and_regs/blob/main/major-supplemental-rulebook.md,
//   https://csdb.gg/faceit-ranks/, https://csdb.gg/premier-ranks/, https://leetify.com/blog/leetify-rating-explained,
//   https://en.wikipedia.org/wiki/IEM_Cologne_Major_2026 (liste complète dans initiale.sources)
// Incertitudes : seuils d’Elo FACEIT relevés sur csdb.gg (mise à jour du 12/07/2026), pas sur une page officielle FACEIT ;
//   équivalences Premier des paliers seulement indicatives (aucune table officielle) ; BO5 absent du règlement Valve :
//   ordre standard (2 bans puis 4 picks) confirmé par la finale du Major de Cologne 2026 ; contenu de la mise à jour du
//   14/10/2026 lu sur des sites relais (counter-strike.net ne s’affiche pas sans JavaScript) ; format du Major de
//   Singapour (BO1 en ouverture des phases suisses) susceptible de changer d’ici novembre.
//
// Choix des rangs : les équipes amateurs recrutent et jouent leurs ligues sur FACEIT ; le niveau FACEIT (1 à 10, puis
//   le badge Challenger = 1 000 meilleurs niveaux 10 de chaque région) est donc la référence. Elo par niveau :
//   1 = 100–500, 2 = 501–750, 3 = 751–900, 4 = 901–1 050, 5 = 1 051–1 200, 6 = 1 201–1 350, 7 = 1 351–1 530,
//   8 = 1 531–1 750, 9 = 1 751–2 000, 10 = 2 001 et plus. L’Elo exact se suit chaque semaine dans les chiffres.
//   Le CS Rating de Premier (bandes de 5 000 : gris, bleu clair, bleu, violet, rose, rouge, or à 30 000) est cité dans
//   les paliers pour les joueurs sans FACEIT ; les groupes de compétences par map (Silver à Global Elite) ne servent plus
//   de repère d’équipe.

import { INITIALE } from './cs2-initiale.js';

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};
const b = (jour, debut, fin, type, titre, details = '', pour = 'equipe') => ({ jour, debut, fin, type, titre, details, pour });

export default {
  id: 'cs2',
  nom: 'Counter-Strike 2',
  court: 'CS2',
  editeur: 'Valve',
  genre: 'fps-tactique',
  equipe: { titulaires: 5, remplacants: 2 },

  vocabulaire: {
    personnage: null, personnages: null,
    carte: 'map', cartes: 'maps',
    manche: 'round', manches: 'rounds',
  },

  roles: [
    { id: 'entry', nom: 'Entry', court: 'ENT', resume: 'Entre le premier sur le site et crée l’espace pour l’équipe.' },
    { id: 'awper', nom: 'AWPer', court: 'AWP', resume: 'Prend les duels d’ouverture à l’AWP et verrouille un axe.' },
    { id: 'support', nom: 'Support', court: 'SUP', resume: 'Lance les grenades d’exécution et échange l’entry.' },
    { id: 'lurker', nom: 'Lurker', court: 'LUR', resume: 'Joue à l’opposé de l’équipe pour l’info, les flancs et les rotations coupées.' },
    { id: 'igl', nom: 'IGL', court: 'IGL', resume: 'Appelle les plans, gère l’économie et adapte la stratégie en match.' },
  ],
  // Ids de 2 caractères minimum imposés par le serveur : « t » est refusé. On reprend att / def comme Valorant et R6
  // (les T attaquent, les CT défendent), les noms affichés restent T et CT.
  camps: [
    { id: 'att', nom: 'Terroristes (T)' }, { id: 'def', nom: 'Anti-terroristes (CT)' },
  ],
  typesStrat: [
    { id: 'default', nom: 'Default', camps: ['att'], resume: 'Placement de début de round pour prendre l’info sans s’engager.' },
    { id: 'execute', nom: 'Exécution', camps: ['att'], resume: 'Prise de site coordonnée avec toutes les grenades, en bloc ou en split.' },
    { id: 'fake', nom: 'Fake', camps: ['att'], resume: 'Montrer un site avec des grenades et du bruit, puis frapper ailleurs.' },
    { id: 'postplant', nom: 'Post-plant', camps: ['att'], resume: 'Positions et grenades pour défendre la bombe posée.' },
    { id: 'setup', nom: 'Setup', camps: ['def'], resume: 'Répartition CT de base : qui tient quoi, qui tourne.' },
    { id: 'stack', nom: 'Stack', camps: ['def'], resume: 'Surcharger un site sur lecture ou anti-strat.' },
    { id: 'retake', nom: 'Retake', camps: ['def'], resume: 'Reprendre un site après la pose de la bombe.' },
    { id: 'pistol', nom: 'Pistol', camps: [], resume: 'Plan du premier round de chaque mi-temps.' },
    { id: 'eco', nom: 'Éco / force', camps: [], resume: 'Round à petit budget : forcer pour surprendre ou garder l’argent.' },
    { id: 'antieco', nom: 'Anti-éco', camps: [], resume: 'Ne pas offrir d’armes à une équipe sans argent.' },
  ],
  typesBloc: [
    { id: 'aim', nom: 'Aim et mécanique', duree: 45 },
    { id: 'deathmatch', nom: 'Deathmatch', duree: 30 },
    { id: 'grenades', nom: 'Grenades (lineups)', duree: 45 },
    { id: 'practice', nom: 'Practice serveur (exécutions, retakes)', duree: 90 },
  ],
  rangs: [
    { id: 'faceit1', nom: 'FACEIT niveau 1', n: 1 },
    { id: 'faceit2', nom: 'FACEIT niveau 2', n: 2 },
    { id: 'faceit3', nom: 'FACEIT niveau 3', n: 3 },
    { id: 'faceit4', nom: 'FACEIT niveau 4', n: 4 },
    { id: 'faceit5', nom: 'FACEIT niveau 5', n: 5 },
    { id: 'faceit6', nom: 'FACEIT niveau 6', n: 6 },
    { id: 'faceit7', nom: 'FACEIT niveau 7', n: 7 },
    { id: 'faceit8', nom: 'FACEIT niveau 8', n: 8 },
    { id: 'faceit9', nom: 'FACEIT niveau 9', n: 9 },
    { id: 'faceit10', nom: 'FACEIT niveau 10', n: 10 },
    { id: 'challenger', nom: 'FACEIT Challenger', n: 11 },
  ],
  chiffres: [
    { id: 'kd', nom: 'K/D', unite: '', min: 0, max: 5, decimales: 2, aide: 'Éliminations divisées par morts sur les parties de la semaine (FACEIT ou Leetify).' },
    { id: 'adr', nom: 'ADR', unite: '', min: 0, max: 300, decimales: 0, aide: 'Dégâts moyens par round (fin de partie, FACEIT ou Leetify).' },
    { id: 'hs', nom: 'HS %', unite: '%', min: 0, max: 100, decimales: 0, aide: 'Part des éliminations à la tête (FACEIT ou Leetify).' },
    { id: 'rating', nom: 'Leetify Rating', unite: '', min: -20, max: 20, decimales: 2, aide: 'Note Leetify centrée sur 0 : au-dessus de +2,09 = bon, au-dessus de +5,12 = excellent.' },
    { id: 'elo', nom: 'Elo FACEIT', unite: '', min: 100, max: 5000, decimales: 0, aide: 'Elo affiché sur le profil FACEIT en fin de semaine.' },
  ],
  // MR12 : 24 rounds réglementaires, premier à 13, changement de camp après 12 rounds ; à 12-12, prolongation en MR3
  // (blocs de 6 rounds, premier à 4 rounds dans le bloc). Premier round de chaque mi-temps = pistol.
  score: { type: 'manches', gagnant: 13, miTemps: 12, pistols: true },
  // Séquences du règlement Valve des Majors (Major Supplemental Rulebook, pool de 7 maps) ; A = équipe qui commence,
  // choisie par la mieux classée. BO1 : A retire 2 maps, B en retire 3, A en retire 1, B choisit son camp.
  // BO3 : après les deux picks, B retire avant A. BO5 (non défini par Valve) : 2 bans puis 4 picks alternés, comme à la
  // finale du Major de Cologne 2026. Pour info, les ligues ESEA de FACEIT jouent leurs BO1 en 1-2-2-1.
  veto: {
    type: 'cartes',
    formats: [
      { id: 'bo1', nom: 'BO1', etapes: [['A', 'ban'], ['A', 'ban'], ['B', 'ban'], ['B', 'ban'], ['B', 'ban'], ['A', 'ban'], [null, 'decisive']] },
      { id: 'bo3', nom: 'BO3', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], ['B', 'ban'], ['A', 'ban'], [null, 'decisive']] },
      { id: 'bo5', nom: 'BO5', etapes: [['A', 'ban'], ['B', 'ban'], ['A', 'pick'], ['B', 'pick'], ['A', 'pick'], ['B', 'pick'], [null, 'decisive']] },
    ],
    notes: '',
  },
  checklistMatch: [
    { id: 'vod', nom: 'Démos de l’adversaire revues' },
    { id: 'veto', nom: 'Plan de veto validé' },
    { id: 'grenades', nom: 'Grenades des maps probables révisées' },
    { id: 'pistols', nom: 'Pistols et rounds de force répétés' },
    { id: 'antistrat', nom: 'Anti-strats travaillées en practice' },
    { id: 'logistique', nom: 'Horaire, serveur ou lobby et remplaçant confirmés' },
  ],
  profil: {
    site: 'Leetify',
    modele: 'https://leetify.com/app/profile/{id}',
    format: '^7656119[0-9]{10}$',
    aide: 'SteamID64 : 17 chiffres commençant par 7656119, visible sur steamid.io ou dans l’URL du profil Steam.',
  },
  meta: {
    sources: ['counter-strike.net', 'store.steampowered.com', 'hltv.org', 'liquipedia.net', 'dust2.us', 'faceit.com'],
    consigne: 'Vérifie d’abord les notes de mise à jour officielles (counter-strike.net ou Steam) : date de la dernière mise à jour, saison Premier en cours, 7 maps de l’Active Duty, changements d’armes, d’économie ou de mécaniques (rechargement, bombe). '
      + 'Vérifie le format du prochain Major (BO1, BO3, BO5 et ordre de veto) dans le règlement Valve ou sur Liquipedia. '
      + 'Relève sur HLTV ou Liquipedia les maps les plus jouées et bannies du dernier tournoi tier 1 et le vainqueur du dernier Major. '
      + 'Vérifie les paliers d’Elo FACEIT s’ils ont changé. Ignore les fuites et les rumeurs.',
    pool: true,
  },
  paliers: {
    rangs: [
      'Non classé à FACEIT 2 (≈ Premier sous 5 000)',
      'FACEIT 3 à 4 (≈ Premier 5 000 à 9 999)',
      'FACEIT 5 à 6 (≈ Premier 10 000 à 14 999)',
      'FACEIT 7 à 8 (≈ Premier 15 000 à 19 999)',
      'FACEIT 9 à 10, tournois amateurs (≈ Premier 20 000 et plus)',
      'FACEIT 10 au-delà de 2 500 Elo, Challenger, semi-pro',
    ],
    resumes: [
      'Découvre le jeu, l’économie, les grenades et les maps.',
      'Maîtrise les bases : viseur à hauteur de tête, contre-strafe, achats en équipe.',
      'Lance des grenades utiles, communique clairement, comprend l’économie.',
      'Exécute des plans d’équipe, échange ses coéquipiers, gère post-plant et retakes.',
      'Lit l’adversaire, s’adapte en cours de match, tient un rôle précis.',
      'Constance à haut niveau, anti-strat, leadership et préparation d’adversaire.',
    ],
  },
  domaines: [
    { id: 'meca', nom: 'Mécanique', resume: 'Visée, spray, déplacements, duels.' },
    { id: 'util', nom: 'Grenades', resume: 'Smokes, flashs, molotovs, HE : lineups, timings, combos.' },
    { id: 'jeu', nom: 'Sens du jeu', resume: 'Placement, info, rotations, économie.' },
    { id: 'comm', nom: 'Communication', resume: 'Annonces, calme, coordination.' },
    { id: 'role', nom: 'Rôle', resume: 'Ce que son rôle attend de lui à chaque round.' },
    { id: 'mental', nom: 'Mental et hygiène', resume: 'Tilt, routine, sommeil, discipline.' },
  ],
  objectifs: [
    // ——— Palier 1 · Débutant complet ———
    o('meca-1-1', 'Choisir une sensibilité et la garder', 'Sensibilité et viseur notés dans le roster, inchangés pendant 2 semaines.'),
    o('util-1-1', 'Connaître les 4 grenades', 'Explique le rôle de la smoke, de la flash, de la molotov et de la HE, et les lance sans hésiter sur un serveur local.'),
    o('jeu-1-1', 'Comprendre le round et l’achat', 'Explique au coach : poser ou désamorcer la bombe, et quand l’équipe achète, force ou économise.'),
    o('comm-1-1', 'Annoncer chaque ennemi vu', 'Nombre et zone (« deux B appart ») à chaque contact, sur 3 parties.'),
    o('role-1-1', 'Choisir un rôle principal', 'Rôle fixé avec le coach et noté dans le roster ; mission expliquée en une phrase.'),
    o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun reproche en vocal ou au chat sur 5 parties.'),

    // ——— Palier 2 · Débutant ———
    o('meca-2-1', 'Contre-strafe avant chaque tir', 'Sur aim_botz, 30 éliminations en s’arrêtant net avant de tirer, validées par le coach.'),
    o('util-2-1', 'Deux smokes et une flash par map', 'Lancées 4 fois sur 5 sur un serveur local, sur chaque map du pool.'),
    o('jeu-2-1', 'Jouer à portée d’échange', 'Sur 3 démos, au moins 6 morts sur 10 pouvaient être échangées par un coéquipier.'),
    o('comm-2-1', 'Faire des annonces courtes', 'Format qui, où, état (« un en court B, il est à 20 ») relevé en review.'),
    o('role-2-1', 'Connaître ses positions de départ', 'Positions T et CT de son rôle validées par le coach sur chaque map du pool.'),
    o('mental-2-1', 'S’arrêter après deux défaites de suite', 'Pause d’au moins 15 minutes respectée pendant 1 mois en FACEIT ou en Premier.'),

    // ——— Palier 3 · Intermédiaire ———
    o('meca-3-1', 'Atteindre 70 d’ADR', 'ADR moyen d’au moins 70 sur 4 semaines (Leetify ou FACEIT).'),
    o('util-3-1', 'Combiner ses grenades avec un coéquipier', '2 combos par map du pool (smoke puis flash d’entrée) réussis 4 fois sur 5 en practice.'),
    o('jeu-3-1', 'Tourner sur l’info', 'Sur 3 démos, aucune rotation lancée sans info ni annonce ; chemins les plus courts connus sur chaque map.'),
    o('comm-3-1', 'Donner les infos de timing', 'Annonces du type « trois sont passés mid il y a 10 s » relevées en review.'),
    o('role-3-1', 'Connaître son rôle dans chaque exécution', 'Rôle récité et exécuté sans erreur en practice pour chaque exécution du stratbook.'),
    o('mental-3-1', 'Revoir ses démos chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),

    // ——— Palier 4 · Confirmé ———
    o('meca-4-1', 'Atteindre 80 d’ADR', 'ADR moyen d’au moins 80 sur 4 semaines (Leetify ou FACEIT).'),
    o('util-4-1', 'Grenades de post-plant et de retake', '2 par site sur chaque map du pool, réussies 9 fois sur 10.'),
    o('jeu-4-1', 'Lire l’économie adverse', 'Type d’achat adverse annoncé correctement dans 8 rounds sur 10, relevé sur démo.'),
    o('comm-4-1', 'Proposer des adaptations en match', 'Au moins une proposition utile par match, prise ou non par l’IGL.'),
    o('role-4-1', 'Tenir son rôle des deux côtés', 'Mission T et CT connue sur toutes les maps du pool, validée par le coach.'),
    o('mental-4-1', 'Débriefer à froid', 'Analyse d’un mauvais match faite le lendemain, jamais à chaud.'),

    // ——— Palier 5 · Avancé ———
    o('meca-5-1', 'Atteindre un Leetify Rating de +2', 'Leetify Rating moyen d’au moins +2 sur 4 semaines.'),
    o('util-5-1', 'Créer des grenades inédites', 'Un nouveau lineup ou une nouvelle exécution par map et par mois ajouté au stratbook.'),
    o('jeu-5-1', 'Repérer les habitudes adverses', '2 habitudes adverses relevées par mi-temps et transmises à l’IGL.'),
    o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en clutch et en retake, sans cri ni parole inutile, relevées sur démo.'),
    o('role-5-1', 'Objectif chiffré de rôle atteint', 'Objectif fixé avec le coach (ex. entry : plus de duels d’ouverture gagnés que perdus) tenu sur un mois.'),
    o('mental-5-1', 'Gérer le stress des officiels', 'Technique de respiration ou de retour au calme utilisée aux temps morts et à la mi-temps.'),

    // ——— Palier 6 · Expert ———
    o('meca-6-1', 'Chiffres semi-pro sur la durée', 'ADR d’au moins 85 et Leetify Rating d’au moins +2 tenus sur 2 mois.'),
    o('util-6-1', 'Rester imprévisible', '3 variantes de grenades pour l’exécution principale de chaque map du pool.'),
    o('jeu-6-1', 'Préparer un adversaire', 'Fiche anti-strat (pistols, setups CT, habitudes d’éco) prête avant chaque officiel.'),
    o('comm-6-1', 'Tenir le cap après un mauvais round', 'Relance l’équipe par une annonce de plan, jamais par un reproche, relevé sur démo.'),
    o('role-6-1', 'Deux rôles au niveau compétition', 'Peut jouer un second rôle en officiel sans baisse de ses chiffres.'),
    o('mental-6-1', 'Gérer la pression de la scène', 'Préparation mentale des LAN et des finales (visualisation, routine) appliquée.'),
  ],
  collectifs: [
    o('coll-1-1', 'Jouer à 5 deux fois par semaine', 'Deux sessions à 5 (FACEIT, Premier ou scrim) chaque semaine pendant 1 mois.'),
    o('coll-1-2', 'Adopter des callouts communs', 'Même nom pour chaque zone de chaque map du pool, noté dans l’espace de l’équipe.'),
    o('coll-2-1', 'Un default T et un setup CT par map', 'Écrits dans le stratbook pour chaque map du pool.'),
    o('coll-2-2', 'Acheter ensemble', 'Aucun round de scrim avec des achats mélangés (complet et éco) pendant 1 mois.'),
    o('coll-3-1', 'Deux exécutions par site', '2 exécutions par site sur chaque map du pool, maîtrisées en practice.'),
    o('coll-3-2', 'Revue de démo collective chaque semaine', 'Une revue d’équipe par semaine pendant 1 mois.'),
    o('coll-4-1', 'Échanger 70 % des morts', 'Mesuré sur 5 scrims revus en démo.'),
    o('coll-4-2', 'Gagner la moitié des pistols', '50 % de pistols gagnés sur 20 mi-temps de scrim.'),
    o('coll-5-1', 'Anti-strat avant chaque officiel', 'Fiche adversaire prête la veille de chaque match officiel.'),
    o('coll-5-2', 'Quatre maps prêtes', '4 maps du pool en Pick ou Confort, préparation d’au moins 70 %.'),
    o('coll-6-1', 'Map pool complet', '6 maps sur 7 jouables en officiel de haut niveau.'),
    o('coll-6-2', 'Stratbook à jour sous 72 h', 'Mise à jour dans les 3 jours après chaque changement de map pool ou mise à jour majeure.'),
  ],
  ebauches: [
    {
      id: 'decouverte',
      nom: 'Découverte',
      pour: 'Paliers 1 et 2',
      volume: 'Environ 8 h par semaine',
      resume: 'Apprendre à jouer ensemble : rôles, callouts, grenades de base, achats groupés. Beaucoup de jeu, peu de théorie.',
      blocs: [
        b(2, '20:00', '20:20', 'echauffement', 'Échauffement', 'aim_botz puis un deathmatch.', 'individuel'),
        b(2, '20:20', '21:20', 'theorie', 'Callouts et rôles', 'Une map du pool : noms des zones, rôle de chacun côté T et côté CT.'),
        b(2, '21:20', '22:00', 'grenades', 'Grenades de base', 'Deux smokes et une flash par joueur sur la map du jour, serveur local.', 'individuel'),
        b(3, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:20', '22:00', 'classe', 'FACEIT ou Premier à 5', 'Deux parties en groupe : appliquer les callouts du mardi.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', 'Un point positif, un point à corriger par joueur.'),
        b(5, '20:00', '20:20', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:20', '21:30', 'practice', 'Default et achats groupés', 'Serveur privé : default T commun, rounds d’éco et de force.'),
        b(5, '21:30', '22:00', 'vod', 'Démo courte', 'Revoir 3 rounds clés de la partie de mercredi.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim amical', 'Contre une équipe de niveau proche, en MR12.'),
        b(6, '17:00', '17:20', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'progression',
      nom: 'Progression',
      pour: 'Paliers 3 et 4',
      volume: 'Environ 13 h par semaine',
      resume: 'Construire un stratbook, enchaîner practice et scrims, revoir les démos chaque semaine.',
      blocs: [
        b(1, '20:00', '21:00', 'vod', 'Démo du week-end', 'Scrim ou match du samedi : 3 rounds gagnés, 3 rounds perdus.'),
        b(1, '21:00', '21:45', 'theorie', 'Stratbook de la semaine', 'Valider les exécutions et les retakes à travailler en practice.'),
        b(2, '19:30', '20:00', 'echauffement', 'Échauffement', 'Deathmatch puis spray de l’AK et de la M4.', 'individuel'),
        b(2, '20:00', '21:30', 'practice', 'Practice des exécutions', 'Exécutions de la semaine, 5 répétitions chacune avec toutes les grenades.'),
        b(3, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '20:00', '22:00', 'scrim', 'Scrim BO2', 'Deux maps du pool.'),
        b(3, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(4, '20:00', '20:45', 'aim', 'Travail individuel', 'Programme individuel : aim, puis grenades de la semaine.', 'individuel'),
        b(5, '19:30', '20:00', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '20:00', '22:00', 'scrim', 'Scrim BO2', ''),
        b(5, '22:00', '22:20', 'debrief', 'Débrief', ''),
        b(6, '14:00', '15:00', 'practice', 'Retakes et post-plants', 'Mode Retakes puis serveur privé sur les sites de la semaine.'),
        b(6, '15:00', '17:00', 'scrim', 'Scrim ou tournoi', ''),
        b(6, '17:00', '17:15', 'debrief', 'Débrief', ''),
      ],
    },
    {
      id: 'competition',
      nom: 'Compétition',
      pour: 'Paliers 5 et 6',
      volume: 'Environ 18 h par semaine',
      resume: 'Semaine construite autour du match officiel : anti-strat, scrims sur la map attendue, pistols, lundi sans jeu.',
      blocs: [
        b(2, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(2, '19:30', '20:30', 'vod', 'Démo du dernier officiel', ''),
        b(2, '20:30', '22:30', 'scrim', 'Scrim BO2', ''),
        b(2, '22:30', '22:50', 'debrief', 'Débrief', ''),
        b(3, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(3, '19:30', '21:00', 'practice', 'Nouvelles exécutions', 'Exécutions et fakes ajoutés cette semaine.'),
        b(3, '21:00', '23:00', 'scrim', 'Scrim BO2', ''),
        b(4, '19:00', '20:00', 'theorie', 'Anti-strat', 'Fiche de l’adversaire : pistols, setups CT, habitudes d’éco.'),
        b(4, '20:00', '22:00', 'scrim', 'Scrim sur la map du match', ''),
        b(5, '19:00', '19:30', 'echauffement', 'Échauffement', '', 'individuel'),
        b(5, '19:30', '21:30', 'scrim', 'Scrim de répétition', ''),
        b(5, '21:30', '22:00', 'theorie', 'Plan de match', 'Veto, pistols, plan de mi-temps.'),
        b(6, '13:00', '13:30', 'deathmatch', 'Deathmatch d’avant-match', '', 'individuel'),
        b(6, '13:30', '14:15', 'practice', 'Pistols et retakes', 'Pistols et retakes de la map du match.'),
        b(6, '15:00', '17:30', 'match', 'Match officiel', ''),
        b(6, '17:30', '17:45', 'debrief', 'Débrief à chaud', 'Dix minutes, sans reproche ; l’analyse se fait mardi.'),
        b(7, '18:00', '18:45', 'physique', 'Activité physique', 'Marche, course ou vélo.', 'individuel'),
      ],
    },
  ],
  routines: {
    1: {
      echauffement: [
        { duree: 10, texte: 'aim_botz : cibles fixes, viseur à hauteur de tête, tir uniquement à l’arrêt.' },
        { duree: 10, texte: 'Deathmatch : une seule arme (AK-47 ou M4), viser la tête.' },
      ],
      hebdo: ['3 sessions de jeu d’au moins 45 minutes', '2 deathmatchs avant chaque session', 'Découvrir une map du pool sur un serveur local'],
      conseil: 'Jouer souvent et peu longtemps vaut mieux qu’une longue session par semaine.',
    },
    2: {
      echauffement: [
        { duree: 5, texte: 'aim_botz : contre-strafe, 30 éliminations en s’arrêtant net.' },
        { duree: 10, texte: 'Logiciel d’aim : un exercice de suivi et un de clic sur cible.' },
        { duree: 10, texte: 'Deathmatch concentré sur le placement du viseur.' },
      ],
      hebdo: ['4 sessions dont 2 à 5', '3 deathmatchs par session', '2 smokes et une flash apprises par map'],
      conseil: 'Noter sa sensibilité et ne plus la changer : la régularité construit la mémoire musculaire.',
    },
    3: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : micro-ajustements et flicks courts.' },
        { duree: 10, texte: 'Serveur local : spray de l’AK et de la M4 sur un mur, puis taps à longue distance.' },
        { duree: 10, texte: 'Deathmatch : pré-viser chaque angle avant de le passer.' },
      ],
      hebdo: ['Revoir une de ses démos (3 erreurs, 1 point fort notés dans l’espace de l’équipe)', '2 heures de travail individuel hors sessions d’équipe', 'Grenades de son rôle révisées sur 2 maps'],
      conseil: 'Depuis mars 2026, recharger jette les balles restantes du chargeur : on recharge à couvert, jamais par réflexe.',
    },
    4: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine fixe de 3 exercices, scores notés.' },
        { duree: 10, texte: 'Serveur local : spray, transferts de spray et taps à longue distance.' },
        { duree: 15, texte: 'Deathmatch ou mode Retakes à intensité de match.' },
      ],
      hebdo: ['Une démo personnelle et une démo d’un pro de son rôle', 'Grenades de post-plant et de retake révisées', 'Deux activités physiques'],
      conseil: 'Suivre ses chiffres d’échauffement d’une semaine sur l’autre : une baisse annonce souvent de la fatigue.',
    },
    5: {
      echauffement: [
        { duree: 10, texte: 'Logiciel d’aim : routine personnalisée sur ses points faibles.' },
        { duree: 10, texte: 'Serveur local : situations de son rôle (entrée, tenue d’angle, retake).' },
        { duree: 15, texte: 'Deathmatch à intensité de match, puis 5 minutes de calme.' },
      ],
      hebdo: ['Analyse de 2 adversaires potentiels', 'Proposition d’une strat pour son rôle', 'Un jour complet sans jeu'],
      conseil: 'La constance compte plus que le pic : protéger le sommeil et la récupération les semaines de match.',
    },
    6: {
      echauffement: [
        { duree: 15, texte: 'Logiciel d’aim : routine de compétition, identique chaque jour.' },
        { duree: 10, texte: 'Serveur local : séquences de son rôle chronométrées.' },
        { duree: 20, texte: 'Deathmatch puis duels en 1v1 contre un coéquipier.' },
      ],
      hebdo: ['Fiche anti-strat préparée pour chaque officiel', 'Séance de théorie animée sur son rôle (une par mois)', 'Récupération planifiée : sommeil, sport, jour off'],
      conseil: 'À ce niveau, la préparation mentale et physique fait la différence autant que la visée.',
    },
  },
  parRole: {
    entry: [
      'Deathmatch : swings larges sur angles pré-visés, en enchaînant deux angles, 15 minutes.',
      'Practice : entrée sur chaque site derrière la flash du support, swing dans la demi-seconde.',
      'Suivre chaque semaine son ratio de duels d’ouverture gagnés et perdus (Leetify).',
    ],
    awper: [
      'aim_botz à l’AWP : 100 flicks courts puis 100 tirs sur cibles en mouvement, sans rester zoomé.',
      'Une position d’ouverture et une position de repli à l’AWP, côté T et côté CT, sur chaque map du pool.',
      'Suivre ses kills d’ouverture à l’AWP et les AWP perdues sans échange.',
    ],
    support: [
      'Lineups de smoke et de flash d’exécution sur chaque site, réussis 9 fois sur 10.',
      'Pop-flashs pour l’entry : timing répété en practice jusqu’à 4 réussites sur 5.',
      'Se placer pour échanger l’entry dans les 2 secondes, relevé sur démo.',
    ],
    lurker: [
      'Timings de lurk sur chaque map : moment où couper la rotation, noté avec le chrono.',
      'Un lurk revu sur démo par semaine : déplacements silencieux, info donnée au bon moment.',
      'Duels isolés : 1v1 sur angles serrés contre un coéquipier.',
    ],
    igl: [
      'Default T et setup CT de chaque map écrits et tenus à jour dans le stratbook.',
      'Appels de mi-round : revoir 10 rounds par semaine et noter le bon appel.',
      'Annoncer l’achat de l’équipe avant chaque round en scrim, avec l’argent du round suivant.',
    ],
  },
  seuils: {
    'meca-3-1': { chiffre: 'adr', seuil: 70, sens: '>=' },
    'meca-4-1': { chiffre: 'adr', seuil: 80, sens: '>=' },
    'meca-5-1': { chiffre: 'rating', seuil: 2, sens: '>=' },
  },
  initiale: INITIALE,
};
