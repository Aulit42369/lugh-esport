// Valorant — échelle d'objectifs du débutant complet (palier 1) à l'expert (palier 6), et objectifs d'équipe.
// Identifiants fixes « domaine-palier-numéro » : la progression des joueurs y est rattachée, ne jamais les renuméroter.
// Chaque objectif a un critère vérifiable par le coach (VOD, stats, practice).

const o = (id, texte, critere) => {
  const [domaine, palier] = id.split('-');
  return { id, domaine, palier: Number(palier), texte, critere };
};

export const OBJECTIFS = [
  // ——— Palier 1 · Débutant complet ———
  o('meca-1-1', 'Choisir une sensibilité et la garder', 'Sensibilité notée dans le roster et inchangée pendant 2 semaines.'),
  o('meca-1-2', 'Garder le viseur à hauteur de tête', 'Sur 3 rounds revus en VOD, le viseur ne descend jamais vers le sol en se déplaçant.'),
  o('meca-1-3', 'S’arrêter avant de tirer', '10 duels de deathmatch gagnés en tirant à l’arrêt, sans courir.'),
  o('util-1-1', 'Connaître les 4 compétences de son agent', 'Les décrire (coût, recharge, ultime) et les lancer sans hésiter au Range.'),
  o('util-1-2', 'Utiliser ses compétences à chaque round', 'Sur 3 parties, aucune compétence achetée encore disponible à sa mort.'),
  o('jeu-1-1', 'Comprendre l’objectif du round', 'Expliquer au coach : poser ou désamorcer le spike, ou éliminer l’équipe adverse.'),
  o('jeu-1-2', 'Acheter avec l’équipe', 'Suivre l’annonce commune (achat complet ou éco) sur 5 parties.'),
  o('comm-1-1', 'Annoncer chaque ennemi vu', 'Nombre et endroit (« deux en A long ») à chaque contact, sur 3 parties.'),
  o('comm-1-2', 'Connaître les callouts du pool', 'Nommer 10 zones de chaque map du pool sur une mini-carte vierge.'),
  o('role-1-1', 'Choisir un rôle principal', 'Rôle fixé avec le coach et 2 agents de ce rôle joués 10 parties chacun.'),
  o('role-1-2', 'Comprendre la mission de son rôle', 'L’expliquer en une phrase, par exemple : un contrôleur coupe les lignes de vue.'),
  o('mental-1-1', 'Rester positif avec ses coéquipiers', 'Aucun message négatif envers un coéquipier sur 5 parties.'),
  o('mental-1-2', 'Jouer régulièrement plutôt que longtemps', '3 sessions d’au moins 45 minutes par semaine pendant 1 mois.'),

  // ——— Palier 2 · Débutant ———
  o('meca-2-1', 'Contre-strafe à chaque tir', 'Au Range, 20 éliminations de bots en mouvement avec un arrêt net avant chaque tir.'),
  o('meca-2-2', 'Taper au-delà de 20 mètres', 'Tirs en 1 ou 2 balles à distance ; 15 % de headshots en moyenne sur 10 parties classées.'),
  o('meca-2-3', 'S’échauffer avant de jouer', 'Routine d’échauffement de 20 minutes avant chaque session, 2 semaines de suite.'),
  o('util-2-1', 'Apprendre 2 placements d’utilitaire par map', 'Réussis 4 fois sur 5 en partie personnalisée, sur chaque map du pool.'),
  o('util-2-2', 'Donner un but à chaque compétence', 'En review, chaque compétence utilisée a une raison claire (info, entrée, retard).'),
  o('jeu-2-1', 'Jouer près d’un coéquipier', 'Sur 3 VOD, au moins 6 morts sur 10 pouvaient être échangées par un coéquipier.'),
  o('jeu-2-2', 'Comprendre les rounds d’éco', 'Expliquer quand l’équipe économise et pourquoi garder son arme compte.'),
  o('comm-2-1', 'Faire des annonces courtes', 'Format qui, où, combien, état (« Jett A main, touchée »), relevé en review.'),
  o('comm-2-2', 'Se taire après sa mort, sauf info utile', 'Respecté sur 5 parties consécutives.'),
  o('role-2-1', 'Deux agents maîtrisés dans son rôle', 'Résultats cohérents sur 20 parties avec chacun, plus un agent de secours.'),
  o('role-2-2', 'Connaître ses placements de départ', 'Positions d’attaque et de défense de son rôle validées par le coach sur chaque map du pool.'),
  o('mental-2-1', 'S’arrêter après 2 défaites de suite', 'Pause d’au moins 15 minutes respectée pendant 1 mois en classé.'),
  o('mental-2-2', 'Préserver son sommeil', 'Pas de session après minuit la veille d’un scrim ou d’un match, pendant 1 mois.'),

  // ——— Palier 3 · Intermédiaire ———
  o('meca-3-1', 'Pré-viser les angles courants', 'Sur 3 VOD, viseur déjà sur l’angle à l’apparition de l’ennemi dans 7 duels sur 10.'),
  o('meca-3-2', 'Atteindre 20 % de headshots', 'Moyenne sur 20 parties classées.'),
  o('meca-3-3', 'Choisir le bon peek', 'Jiggle pour l’info, swing large pour le duel : démontré en practice sur 3 angles par map.'),
  o('util-3-1', 'Combiner ses utilitaires avec un coéquipier', '2 combos par map du pool (ex. flash puis entrée) réussis 4 fois sur 5 en practice.'),
  o('util-3-2', 'Garder un utilitaire pour la fin du round', 'Une compétence encore disponible dans 7 fins de round sur 10 (post-plant ou retake).'),
  o('jeu-3-1', 'Tourner sur l’info', 'Chemins de rotation les plus courts connus et utilisés sur chaque map du pool.'),
  o('jeu-3-2', 'Jouer le post-plant à distance', 'Couvrir le spike depuis une position sûre au lieu de rester dessus, sur 5 parties.'),
  o('jeu-3-3', 'Connaître les seuils d’économie', 'Expliquer les montants d’achat complet, de force-buy et d’éco utilisés par l’équipe.'),
  o('comm-3-1', 'Donner les infos de timing', 'Annonces du type « trois ont tourné il y a 10 s » présentes en review.'),
  o('comm-3-2', 'Débriefer sans reproche', 'Après chaque scrim : un point positif et un point à corriger, formulés sur le jeu.'),
  o('role-3-1', 'Connaître son rôle dans chaque exécution', 'Rôle récité et exécuté sans erreur en practice pour chaque exec du stratbook.'),
  o('role-3-2', 'Adapter son agent à la map', 'Agents par map renseignés dans le roster et validés par le coach.'),
  o('mental-3-1', 'Revoir ses propres VOD chaque semaine', '3 erreurs et 1 point fort notés dans l’espace de l’équipe chaque semaine pendant 1 mois.'),
  o('mental-3-2', 'Avoir une routine d’avant-match', 'Échauffement, vérification du matériel et 5 minutes au calme avant chaque scrim.'),

  // ——— Palier 4 · Confirmé ———
  o('meca-4-1', 'Atteindre 23 % de headshots', 'Moyenne sur 20 parties classées, sans baisse sur les 2 dernières semaines.'),
  o('meca-4-2', 'Contrôler le spray à mi-distance', 'Au Range, 6 balles sur 10 dans la cible à 15 mètres avec le fusil principal.'),
  o('meca-4-3', 'Gagner ses duels d’ouverture de rôle', 'Entrée : plus de premiers kills que de premières morts ; ancre : survit au premier contact dans 6 cas sur 10.'),
  o('util-4-1', 'Lineups de post-plant et de retake', '2 par site sur chaque map du pool, réussis 9 fois sur 10.'),
  o('util-4-2', 'Synchroniser ses utilitaires sur l’exec', 'Exécution complète lancée en moins de 5 secondes en practice.'),
  o('jeu-4-1', 'Échanger systématiquement', '7 morts de l’équipe sur 10 échangées dans les 3 secondes, relevé en VOD.'),
  o('jeu-4-2', 'Lire l’économie adverse', 'Type d’achat adverse annoncé correctement dans 8 rounds sur 10.'),
  o('jeu-4-3', 'Gérer les situations à 2 contre 2', 'Plan annoncé (jouer ensemble, isoler, temps) sur chaque 2v2 revu en VOD.'),
  o('comm-4-1', 'Proposer des adaptations en cours de match', 'Au moins une proposition utile par match, prise ou non par l’IGL.'),
  o('comm-4-2', 'Communiquer en retake', 'Position, utilitaire disponible et plan annoncés avant chaque retake.'),
  o('role-4-1', 'Tenir son rôle dans toutes les compos du pool', 'Aucune compo du map pool où le joueur ne connaît pas sa mission.'),
  o('role-4-2', 'Jouer un rôle secondaire', '2 agents d’un autre rôle prêts à être joués en scrim.'),
  o('mental-4-1', 'Débriefer à froid', 'Analyse d’un mauvais match faite le lendemain, jamais à chaud.'),
  o('mental-4-2', 'Entretenir sa forme', '7 heures de sommeil et 2 activités physiques par semaine pendant 1 mois.'),

  // ——— Palier 5 · Avancé ———
  o('meca-5-1', 'Être constant', 'Moins de 10 % d’écart de headshots et de dégâts entre la meilleure et la pire semaine du mois.'),
  o('meca-5-2', 'Maîtriser l’arme de son rôle', 'Operator, Sheriff ou fusil selon le rôle : objectif chiffré fixé avec le coach et atteint.'),
  o('util-5-1', 'Créer des utilitaires inédits', 'Un nouveau lineup ou setup par map et par mois ajouté au stratbook.'),
  o('util-5-2', 'Utiliser l’utilitaire pour contrer', 'Contre-utilitaire préparé contre les 2 compétences adverses les plus gênantes de chaque map.'),
  o('jeu-5-1', 'Repérer les habitudes adverses', '2 habitudes adverses relevées par mi-temps et transmises à l’IGL.'),
  o('jeu-5-2', 'Gérer le tempo', 'Jouer lent ou rapide selon le score et l’économie : choix justifié en review.'),
  o('comm-5-1', 'Rester clair sous pression', 'Annonces nettes en clutch et en retake, sans cri ni parole inutile, relevées en VOD.'),
  o('comm-5-2', 'Diriger son secteur', 'Coordonne le joueur voisin sur son site sans attendre l’IGL.'),
  o('role-5-1', 'Spécialisation maîtrisée', 'Entry, lurk, ancre, initiateur principal ou IGL : objectif de rôle chiffré atteint sur un mois.'),
  o('role-5-2', 'Proposer des strats pour son rôle', '2 propositions par mois ajoutées au stratbook.'),
  o('mental-5-1', 'Gérer le stress des matchs officiels', 'Technique de respiration ou de retour au calme utilisée entre les rounds importants.'),
  o('mental-5-2', 'Doser sa charge d’entraînement', 'Au moins un jour sans jeu par semaine, aucune session de plus de 6 heures.'),

  // ——— Palier 6 · Expert ———
  o('meca-6-1', 'Atteindre des chiffres semi-pro', 'Objectifs chiffrés du rôle (headshots, premiers kills, survie) tenus sur 2 mois.'),
  o('meca-6-2', 'S’adapter au style de l’adversaire', 'Ajuste ses angles et ses timings dès la deuxième mi-temps, relevé en VOD.'),
  o('util-6-1', 'Utilitaires synchronisés avec l’IGL', 'Exécutions lancées à la seconde annoncée sur toutes les maps du pool.'),
  o('util-6-2', 'Rester imprévisible', '3 variantes d’utilitaires pour l’exécution principale de chaque map.'),
  o('jeu-6-1', 'Préparer un adversaire', 'Fiche anti-strat (pistols, setups, tendances) prête avant chaque match officiel.'),
  o('jeu-6-2', 'Adapter le plan à la mi-temps', 'Changements décidés sur des faits relevés pendant la première mi-temps.'),
  o('comm-6-1', 'Communiquer à la seconde près', 'Exécutions et retakes annoncés sans retard ni chevauchement de voix.'),
  o('comm-6-2', 'Tenir le cap après un mauvais round', 'Relance l’équipe par une annonce de plan, jamais par un reproche.'),
  o('role-6-1', 'Être le référent de son rôle', 'Anime une séance de théorie sur son rôle chaque mois.'),
  o('role-6-2', 'Deux rôles au niveau compétition', 'Peut jouer un second rôle en match officiel sans baisse de niveau.'),
  o('mental-6-1', 'Routine de performance complète', 'Sommeil, alimentation, échauffement et récupération planifiés les semaines de match.'),
  o('mental-6-2', 'Gérer la pression de la scène', 'Préparation mentale des LAN ou des finales (visualisation, routine) appliquée.'),
];

export const COLLECTIFS = [
  o('coll-1-1', 'Jouer à 5 deux fois par semaine', 'Deux sessions à 5 chaque semaine pendant 1 mois.'),
  o('coll-1-2', 'Adopter des callouts communs', 'Même nom pour chaque zone de chaque map du pool, noté dans l’espace de l’équipe.'),
  o('coll-1-3', 'Débriefer chaque session', '10 minutes de débrief à la fin de chaque session à 5.'),
  o('coll-2-1', 'Un default d’attaque par map', 'Default commun écrit dans le stratbook pour chaque map du pool.'),
  o('coll-2-2', 'Acheter ensemble', 'Aucun achat complet à 3 contre 5 pendant 1 mois de scrims.'),
  o('coll-2-3', 'Un plan de pistol par côté', 'Pistol d’attaque et de défense écrits pour chaque map du pool.'),
  o('coll-3-1', 'Deux exécutions par site', '2 exécutions par site sur chaque map du pool, maîtrisées en practice.'),
  o('coll-3-2', 'Setups et retakes écrits', 'Setup défensif et retake de base écrits pour chaque site.'),
  o('coll-3-3', 'Revue VOD collective hebdomadaire', 'Une revue d’équipe par semaine pendant 1 mois.'),
  o('coll-4-1', 'Échanger 70 % des morts', 'Mesuré sur 5 scrims revus en VOD.'),
  o('coll-4-2', 'Post-plant écrit pour chaque site', 'Positions et utilitaires de post-plant dans le stratbook.'),
  o('coll-4-3', 'Gagner la moitié des pistols', '50 % de pistols gagnés sur 20 mi-temps de scrim.'),
  o('coll-5-1', 'Anti-strat avant chaque officiel', 'Fiche adversaire prête la veille de chaque match officiel.'),
  o('coll-5-2', 'Adapter à la mi-temps', 'Décision de mi-temps prise sur des faits, notée dans la fiche du match.'),
  o('coll-5-3', 'Quatre maps prêtes', '4 maps du pool en Pick ou Confort, préparation d’au moins 70 %.'),
  o('coll-6-1', 'Map pool complet', '6 maps sur 7 jouables en match officiel de haut niveau.'),
  o('coll-6-2', 'Stratbook à jour sous 72 h', 'Mise à jour après chaque patch dans les 3 jours.'),
  o('coll-6-3', 'Préparation adverse systématique', 'Au moins 2 VOD analysées par adversaire officiel.'),
];
