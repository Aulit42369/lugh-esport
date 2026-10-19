# Lugh — À faire

## Fait
- 18/10 : cadrage, ARCHITECTURE.md validée (Render + MongoDB Atlas, comptes maison, méta par l'API Claude ou import manuel).
- 18/10 : QG Valorant 1.0.0 puis 1.1.0 construits et testés, jamais déployés, remplacés par la 2.0.0 multi-jeux.
- 18/10 : décisions multi-jeux validées (M1 à M8, Q1, Q2, B6, D2, R1 à R4) ; ARCHITECTURE.md v3.
- 18/10 : socle multi-jeux : 10 modèles de jeu, définition effective avec les Réglages du jeu, schémas par jeu, contrôle automatique de chaque modèle.
- 18/10 : serveur multi-espaces : une base Atlas par jeu, comptes uniques avec métiers par jeu, Administrateur général et Responsable du jeu, routes /api/e/<jeu>, journal global, méta et Discord par jeu.
- 18-19/10 : interface multi-jeux : sélecteur de jeu, toutes les pages adaptées à chaque type de jeu (manches, score simple, classement ; veto de maps, draft, sans veto), administration générale, Gestion et Réglages du jeu.
- 19/10 : nouveautés N1 à N11 : vue d'ensemble de la structure, couleur par jeu, conflits d'agenda entre jeux et agenda .ics de tous ses jeux, tournois avec rappels, partenaires de scrim et fiabilité, comptes rendus de séance, Jour de match, annonces avec « lu par », double authentification (QR code, codes de secours, obligation activable), point de restauration automatique, charge d'entraînement.
- 19/10 : nom « Lugh » (dieu celte aux mille talents) ; identité : écusson (soleil levant traversé par la lance) et lettrage maison n° 2 ; plus aucun « QG ».
- 19/10 : 146 tests automatiques verts ; parcours navigateur sur 10 jeux et 6 comptes sans erreur ; relecture indépendante.

- 19/10 : design final validé par Olivier.
- 19/10 : 2.1.0 : bot Discord côté appli (API `/api/bot/`, liaison par code puis confirmation du pseudo dans Mon compte, onglet Discord de l'administration : état du bot, réglages des rappels et des rôles, comptes liés).
- 19/10 : 2.2.0 : devise « Le soleil se lève avec nous. » sous le logo de la connexion ; annonces reprises dans #annonces sur Discord ; export de chaque jeu pour la sauvegarde hebdomadaire sur le Pi ; relecture indépendante et corrections ; zip rangé en trois envois GitHub ; 162 tests.
- 19/10 : premier déploiement fait par Olivier : Atlas, GitHub, Render (lugh-esport.onrender.com), première connexion, jeux activés, serveur Discord, bot sur le Pi, BOT Aulit sur le serveur.
- 19/10 : 2.3.0 : le bot branche lui-même le webhook de chaque jeu (et des annonces) qui n'en a pas ; un webhook retiré à la main n'est pas rebranché ; onglet Discord « Jeux sur Discord » ; 163 tests.

## En cours
- Rien.

## À faire
- Créer les comptes et les Responsables, régler chaque jeu (Réglages du jeu) et suivre « Premiers pas ».
- Vérifier les points incertains notés dans les modèles (pool R6, profils publics, barèmes battle royale) à la première méta de chaque jeu.
- Exporter une sauvegarde de chaque jeu une fois par mois (Gestion du jeu → Sauvegarde).
- Revue L99 complète avant d'ouvrir Lugh à d'autres structures.
- Après le premier vrai essai du bot : vérifier les rappels d'une vraie semaine et la synchronisation des rôles.

## Décisions prises
- 18/10 : la méta n'écrit jamais le travail de l'équipe : les ajustements deviennent des suggestions.
- 18/10 : pas d'inscription : identifiant + mot de passe par personne, métiers cumulables.
- 18/10 : hébergement Render (gratuit) + MongoDB Atlas (gratuit) ; méta vérifiée à la première visite après chaque créneau (pas de cron externe).
- 18/10 : webhook Discord gardé en base, jamais affiché ni exporté ; aucune mention possible.
- 18/10 : fond sombre par défaut ; identité maison, aucun visuel officiel d'éditeur.
- 18/10 : recrutement visible des seuls métiers qui donnent leur avis.
- 18/10 : M1 un site, un espace par jeu, jeu dans l'adresse (#/valorant/planning) ; M2 une base Atlas par jeu — irréversible ; M3 un compte par personne, métiers par jeu ; M4 Administrateur général et Responsable du jeu ; M5 ajout d'un jeu depuis le site ; M6 modèles pour 9 jeux + « Autre jeu » ; M7 Réglages du jeu sans code.
- 18/10 : un élément d'un modèle se masque au lieu de se supprimer ; le type de score se fige au premier scrim.
- 19/10 : N1 à N11 acceptés et livrés dans la 2.0.0.
- 19/10 : double authentification proposée à tous, exigeable pour l'Administrateur général et les Responsables ; 10 codes de secours ; dernier recours par variable Render `LUGH_REINITIALISER_2FA`.
- 19/10 : agenda .ics en téléchargement, jamais en abonnement (pas de jeton secret dans une adresse).
- 19/10 : conflits entre jeux : seuls le jeu et l'horaire de l'autre séance sont montrés.
- 19/10 : un seul point de restauration par jeu, dans la base générale.
- 19/10 : couleurs de jeu inspirées des couleurs officielles sans les reproduire, palette fermée vérifiée en contraste ; fond sombre par défaut.
- 19/10 : charge d'entraînement : alerte au-delà de 20 h planifiées par semaine ou sans jour off (réglable par jeu).
- 19/10 : nom définitif « Lugh » : service et dépôt `lugh-esport`, appli « Lugh », id `/lugh`, caches `lugh-`, bases `lugh` et `lugh_<jeu>`, variables `LUGH_*`. Plus aucun « QG ».
- 19/10 : identité Lugh : écusson (piste C) et lettrage maison n° 2 (mélange New Rocker / Metamorphous) validés.
- 19/10 : bot Discord : D1 modération, journal et accueil confiés à BOT Aulit (déjà en place) ; D2 le bot Lugh garde la permission Administrateur (choix d'Olivier, risque noté) ; D3 le rôle Discord « Administrateur » suit l'Administrateur général de Lugh (choix d'Olivier, risque noté) ; D4 synchronisation toutes les 3 h pour ménager les heures gratuites de Render.
- 19/10 : devise « Le soleil se lève avec nous. » ; annonces reprises sur Discord ; sauvegarde hebdomadaire sur le Pi ; pas de réveil externe de Render (l'appli se réveille seule à la première ouverture).
