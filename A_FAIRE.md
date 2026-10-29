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
- 29/10 : arrêt propre (SIGTERM, redéploiement Render) : les annonces planning en attente sont envoyées avant la fermeture de la base (`vider()`, test `discord-vider.test.js`). Design : bordures gauches colorées remplacées par bordure teintée + fond teinté (même couleur). Même traitement pour vues-equipe, vues-jeu et vues-perf (les traits de liaison restent).

- 19/10 : design final validé par Olivier.
- 19/10 : 2.1.0 : bot Discord côté appli (API `/api/bot/`, liaison par code puis confirmation du pseudo dans Mon compte, onglet Discord de l'administration : état du bot, réglages des rappels et des rôles, comptes liés).
- 19/10 : 2.2.0 : devise « Le soleil se lève avec nous. » sous le logo de la connexion ; annonces reprises dans #annonces sur Discord ; export de chaque jeu pour la sauvegarde hebdomadaire sur le Pi ; relecture indépendante et corrections ; zip rangé en trois envois GitHub ; 162 tests.
- 19/10 : premier déploiement fait par Olivier : Atlas, GitHub, Render (lugh-esport.onrender.com), première connexion, jeux activés, serveur Discord, bot sur le Pi, BOT Aulit sur le serveur.
- 19/10 : 2.3.0 : le bot branche lui-même le webhook de chaque jeu (et des annonces) qui n'en a pas ; un webhook retiré à la main n'est pas rebranché ; onglet Discord « Jeux sur Discord » ; 163 tests.
- 19/10 : 2.4.0 : suppression définitive d'un jeu désactivé (export proposé, nom à taper ; base, accès, annonces et point de restauration nettoyés) ; 2.4.1 : onglet Jeux en deux parties : « Tes jeux » (jeux créés seulement) et « Ajouter un jeu » replié ; 165 tests.
- 19/10 : 2.4.2 : un jeu désactivé ne lance plus aucune vérification de méta ni semaine type, même ouvert par l'Administrateur général ; 166 tests.
- 19/10 : 2.5.0 : Administration générale → Administratif (obligations légales et veille au bouton avec validation, livre des comptes et rôle Trésorier, documents types, autorisations des mineurs dans le roster, identité) ; page « Données et confidentialité » ; sauvegarde de la structure (téléchargement et `_structure.json` sur le Pi avec le bot 2.2.1) ; relecture indépendante corrigée (compte Trésorier protégé et soumis à la double authentification, clôture d'un exercice terminé seulement, ouverture cohérente, sources officielles BOFiP, CNIL et service-public) ; 177 tests.
- 19/10 : 2.6.0 : passage en société prévu dès le départ : forme juridique dans Identité (association, puis société SAS/SASU), sections d'obligations selon la forme (« Passer en société » en « Plus tard », « Gestion de la société »), deux livres des comptes séparés (association, société), indicateur « Prêt pour la société ? », procès-verbal d'AG et convention association–société ; relecture indépendante corrigée (identité fusionnée côté serveur, cessions jamais gratuites, 29 février) ; 181 tests.
- 23/10 : 2.7.0 : revue L99 du 23/10, « tout » : A jeux désactivés sauvegardés sur le Pi, fichier en échec refait, alerte au-delà de 8 jours ; B sauvegarde de la structure v2 (jeux, comptes sans secret, annonces) et reprise après sinistre ; C écritures partielles atomiques (lu, visites, connexion, correction d'annonce) ; D synchro du navigateur (fiche recréée), verrou de suppression, semaine automatique en création seule ; E `LUGH_REINITIALISER_2FA` réutilisable, RESTAURER / ANNULER vérifiés par le serveur, rappel /synchro ; F adresse vue dans Service, `LUGH_PROXY_SAUTS` ; G plafonds mensuels des vérifications manuelles (méta 10, veille 5) ; H clés 2FA chiffrées (`LUGH_CLE_2FA`) ; I une seule conversion heure civile → UTC, une seule comparaison en temps constant ; J historique du livre des comptes ; K documentation ; L voie A (`OUVRIR-A-UNE-STRUCTURE.md`). 209 tests, parcours navigateur de l’administration sans erreur, relecture indépendante (2 défauts corrigés : reprise qui continue après une écriture en échec, conversion des clés 2FA par écriture partielle).
- 23/10 : 2.7.0, correctifs de l'audit de sécurité (priorité haute) : « Compte existant » refusé à un Responsable pour un compte sans aucun jeu (il pouvait ensuite réinitialiser son mot de passe ou le supprimer) ; avertissement dans Service quand X-Forwarded-For ne ressemble pas à ce qu'ajoute le proxy (absent, trop court, adresse interne ou non IP), sans changer le calcul ni `LUGH_PROXY_SAUTS` ; 210 tests.
- 23/10 : 2.7.0, correctifs de l'audit de sécurité (priorités moyenne et basse) : écritures partielles des comptes et corps lu avant la fiche (une requête lente n'annule plus une désactivation, un mot de passe réinitialisé ni une suppression) ; essais de connexion, de mot de passe et de double authentification un par un par identifiant (une rafale ne donne plus ~40 essais au lieu de 5) ; restauration : plafond pour « equipe », doublons regroupés, avis et notes au nom d'autres comptes comptés au journal ; méta neutralisée avant Discord (pas de lien masqué) ; 214 tests.
- 23/10 : 2.7.1 : version distincte pour ce déploiement ; noms de jeu réservés (Administrateur, Responsable, Staff, Capitaine / IGL, Joueur, Remplaçant, Invité) refusés à la création et au renommage, sinon le bot Discord donnait ce rôle de fonction à tous les membres du jeu (audit du bot Lugh) ; 215 tests.
- 23/10 : noms de jeu uniques : un nom ou un nom court déjà pris par un autre jeu (actif ou désactivé ; casse, accents et espaces ignorés) est refusé à la création, au renommage par l'Administrateur général et dans les Réglages du jeu (le bot Discord nomme rôle et catégorie d'après eux et ne fait que bloquer un doublon) ; le nom court tiré du nom d'un « Autre jeu » s'allonge s'il est déjà pris ; `vues-admin.css` coupé en deux (`vues-reglages-jeu.css`, même ordre de cascade) ; 216 tests.
- 25/10 : `/api/sante` vérifie vraiment MongoDB Atlas (ping, 2 s au plus) : base coupée ou muette → 503 `{ ok: false, base: "injoignable" }`, sans adresse ni message brut ; le tableau de santé du Pi passe en « panne » au 2e contrôle raté ; `test/sante.test.js` ; 219 tests.
- 25/10 : 2.8.0 : prototype « Stats Valorant » (API Riot + Riot Sign On) prêt à montrer à Riot, masqué tant que les 5 variables Riot manquent : relier son compte (accord explicite), délier (tout effacé), Mes parties (KDA, ACS, agents, cartes), onglet Équipe pour le staff (joueurs reliés seulement) ; jetons chiffrés, limites de débit et 429 respectés ; faux serveur Riot pour les tests et la démo (`npm run simulation`) ; `docs/DEMANDE-RIOT.md` (formulaire en anglais + marche à suivre) ; confidentialité mise à jour ; 235 tests.
- 26/10/2026 : 2.8.1, mise en conformité légale : fenêtre « Mentions légales » (éditeur Aulit42369 anonyme, LCEN, hébergeur Render, base MongoDB Atlas), lisible avant connexion, liée depuis la connexion, Mes jeux, Mon compte et la confidentialité ; confidentialité complétée (responsable « Aulit42369, pour le compte de l’équipe », bases légales 6-1-a/b/c/f, destinataires Render, MongoDB, Discord, Riot, Anthropic sans donnée perso, transferts hors UE, CNIL, art. 45, candidatures) ; candidatures refusées effacées automatiquement (avec leurs avis) 6 mois après le refus ; « Supprimer mon compte » dans Mon compte (mot de passe exigé, pas pour l’Administrateur général) ; 238 tests.

- 28/10/2026 : conditions d’utilisation (`shared/administratif/conditions.js`, 3e fenêtre lisible sans compte, liée depuis la connexion, Mes jeux et Mon compte ; chaque fenêtre légale ouvre les deux autres) ; confidentialité : « Ce que ton navigateur garde » (cookie `lugh_session`, `localStorage` `lugh-theme`, `lugh-dernier-jeu`, `lugh-premiers-pas-masques-<jeu>`, cache `lugh-v1`), test qui rougit si une clé change ou si une nouvelle apparaît ; Mes jeux : `liensLegaux` n’était pas défini (erreur sur la page d’un compte sans jeu), liens légaux ajoutés en pied de page ; date de mise à jour légale 28/10/2026 ; `docs/` : PRD, TRD, APP_FLOW, DESIGN_BRIEF, BACKEND_SCHEMA, IMPLEMENTATION_PLAN ; 240 tests.

## En cours
- Rien.

## À faire
- Demande de clé de production Riot : suivre `docs/DEMANDE-RIOT.md` (captures en simulation, Register Product, puis les 5 variables dans Render).
- Après la validation Riot : relever `LIMITES_DEFAUT` (src/riot/client.js) aux limites de la clé, confirmer l'adresse de révocation RSO (src/riot/rso.js), tester une vraie liaison.
- Créer l'association (Administratif → Obligations → Créer l'association), puis renseigner son RNA dans Identité.
- Lancer la veille légale de temps en temps (avant l'assemblée générale par exemple) et relire les propositions.
- Créer les comptes et les Responsables, régler chaque jeu (Réglages du jeu) et suivre « Premiers pas ».
- Vérifier les points incertains notés dans les modèles (pool R6, profils publics, barèmes battle royale) à la première méta de chaque jeu.
- Exporter une sauvegarde de chaque jeu une fois par mois (Gestion du jeu → Sauvegarde).
- Avant de livrer Lugh à une autre structure : suivre `OUVRIR-A-UNE-STRUCTURE.md` (conditions d'usage du nom Lugh à écrire).
- Vérifier l'adresse vue par Lugh dans Service après le déploiement de la 2.7.0 (`LUGH_PROXY_SAUTS`).
- Après le premier vrai essai du bot : vérifier les rappels d'une vraie semaine et la synchronisation des rôles.

## Décisions prises
- 25/10 : Stats Valorant : prototype validé (« fais-le, on voit ce que ça donne ») ; 20 dernières parties, gardées 90 jours ; tableau Équipe visible du Responsable, head coach et coach adjoint ; un compte staff qui relie son propre compte apparaît aussi dans le tableau.
- 24/10 : idées refusées par Olivier (ne pas reproposer) : démo en ligne de Lugh (Lugh reste pour lui seul pour l'instant) ; page de candidature publique (même raison).
- 19/10 : départ en association, passage en société (SAS) prévu plus tard. Nom « Lugh » : pas de dépôt INPI pour l'instant ; il sera sans doute déposé au nom d'Olivier, puis prêté par licence à l'association (gratuite) et à la société.
- 19/10 : livre des comptes ouvert à l'Administrateur général et à un rôle Trésorier ; justificatifs hors de Lugh (numéro de pièce seulement) ; veille légale au bouton seulement (pas d'automatique) ; association pas encore créée.
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
- 23/10 : ouverture à d'autres structures par la voie A (une installation par structure) ; reprise après sinistre qui ne crée que ce qui manque ; plafonds manuels méta 10 / veille 5 par mois ; historique du livre jamais effacé par Lugh ; mot `ANNULER` pour annuler une restauration.
