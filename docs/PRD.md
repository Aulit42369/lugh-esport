# Lugh — PRD (besoin produit)

Rédigé le 28/10/2026 à partir du code et des docs du dépôt (version 2.8.1). Les points non écrits dans le code ont été proposés par Claude le 29/10/2026, à corriger si besoin.

## 1. Le besoin

Une jeune structure esport (association en création, passage en société prévu plus tard) a besoin d'**un seul endroit privé** pour organiser ses équipes, **jeu par jeu** : qui joue quand, ce qu'on travaille, comment on progresse, qui on recrute. Aujourd'hui ces informations seraient éparpillées (Discord, tableurs, messages). Lugh les rassemble, avec des droits par métier et sans exposer les données des membres, dont des mineurs.

Objectifs :
- un espace par jeu (Valorant, CS2, LoL, R6, Overwatch, Rocket League, EA FC, Apex, Fortnite, ou « Autre jeu »), 15 jeux au plus ;
- faire gagner du temps au staff (planning, présences, méta vérifiée automatiquement, rappels Discord) ;
- suivre la progression de chaque joueur, du débutant à l'expert ;
- tenir l'administratif de l'association (obligations, livre des comptes, documents, mineurs) ;
- coût nul ou presque (Render et Atlas gratuits, API Claude facultative).

## 2. Utilisateurs

| Qui | Besoin principal |
|---|---|
| **Administrateur général** (Olivier) | activer les jeux, gérer tous les comptes, vue d'ensemble, annonces, administratif, sécurité |
| **Responsable du jeu** | comptes et réglages de son jeu, Discord, sauvegarde et restauration |
| **Head coach, coach adjoint, analyste** | planning, stratbook, scrims, VOD, progression, recrutement |
| **Capitaine / IGL** | compos, strats, scrims, présences |
| **Joueur, remplaçant** | ses dispos, absences, chiffres, notes de VOD, auto-évaluation |
| **Invité** | lecture seule |
| **Trésorier** | livre des comptes de la structure |

Un compte par personne, sans inscription, avec des métiers par jeu.

## 3. Fonctions

- **La semaine** : accueil et « Premiers pas », planning d'entraînement (semaine type), présences et charge d'entraînement, disponibilités, absences, Jour de match (téléphone), comptes rendus de séance.
- **Le jeu** : maps et compos, stratbook, bibliothèque, adversaires et veto (ou draft), tournois, méta du jeu (API Claude le lundi et le jeudi, ou import manuel ; jamais d'écriture dans le travail de l'équipe, seulement des suggestions).
- **La performance** : scrims et statistiques, partenaires de scrim et fiabilité, VOD review, progression par paliers, programme individuel, bilan du mois, Stats Valorant (API Riot, facultatif, en attente de clé).
- **L'équipe** : roster, recrutement (avis du staff, chaîne Twitch), Gestion et Réglages du jeu sans code.
- **La structure** : vue d'ensemble, annonces avec « lu par », agenda `.ics` de tous ses jeux, conflits d'agenda entre jeux, double authentification.
- **Administratif** : obligations légales et veille au bouton, livre des comptes (association, puis société), documents types, autorisations des mineurs, identité, sauvegarde et reprise après sinistre.
- **Discord** : webhooks par jeu, bot sur le Raspberry Pi (rôles, rappels, commandes, sauvegarde hebdomadaire).
- **Conformité** : Données et confidentialité, Conditions d'utilisation, Mentions légales (lisibles sans compte), suppression de son compte.
- **Appli installable** (PWA) sur téléphone et ordinateur.

## 4. Hors périmètre

- Inscription libre, formulaire de candidature hébergé par Lugh, démo en ligne (refusés le 24/10). Depuis le 14/11, une **vitrine publique** existe (voir § 6), sans aucune collecte : « Postuler » renvoie vers le Discord ou le contact.
- Visuels officiels des éditeurs de jeux.
- Abonnement d'agenda (jeton secret dans une adresse) : téléchargement seulement.
- Rang, adversaires ou temps réel dans Stats Valorant (règles Riot).
- Comptabilité officielle, TVA, impôt sur les sociétés (restent chez le comptable).
- Plusieurs instances de serveur.

## 5. Mesure du succès

Cibles à 6 mois (fin avril 2027) : espace Valorant utilisé chaque semaine (planning et présences remplis) ; au moins 80 % des annonces lues par les membres concernés ; coût mensuel de la méta et de l'hébergement maintenu à 0 € (hors API Claude facultative). Appui : équipe naissante, hébergement gratuit visé. (proposé par Claude le 29/10/2026, à corriger si besoin). Indices disponibles : visites par jeu, « lu par » des annonces, présences, coût de la méta par mois.

## 6. Vitrine publique (demande d'Olivier du 14/11/2026)

Une page d'accueil **publique** à https://lugh.aulit42369.fr présente la structure ; l'espace privé passe sous `/app/` (bouton « Connexion »), les anciens liens `/#/…` y sont renvoyés.
- **Contenu** : nom public et présentation (Administratif → Identité), jeux actifs, profil public de chaque équipe (nom, tag, devise, circuit), membres **qui ont choisi d'apparaître** (pseudo, rôle, statut, photo), places ouvertes au recrutement par jeu, résultats des tournois terminés.
- **Recrutement** : nombre de places réglé par le staff du jeu (Roster → Profil de l'équipe, défaut 0 = rien d'affiché) ; bouton « Postuler » vers le lien choisi dans Identité (invitation Discord…), sinon le contact public, sinon pas de bouton.
- **Consentement** : case « Apparaître sur la vitrine publique » dans Mon compte, décochée par défaut ; photo ajoutée et retirée par la personne elle-même ; le staff peut masquer un membre ; photo d'un mineur montrée seulement avec le droit à l'image enregistré.
- **Hors périmètre** : formulaire de candidature, statistiques détaillées, vrais noms, réseaux sociaux des joueurs.
- **Succès** : chaque jeu qui recrute affiche ses places ; zéro donnée privée dans `/api/public/vitrine` (testé).
