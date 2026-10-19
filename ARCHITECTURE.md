# Lugh — ARCHITECTURE.md

Version 3.7 — 19/10/2026 — décisions validées par Olivier (passage en société prévu : forme juridique, deux livres des comptes, M1 à M8, Q1, Q2, B6, D2, R1 à R4, N1 à N11, nom « Lugh », bot Discord D1 à D4, sauvegarde sur le Pi, annonces sur Discord, devise, jeux branchés sur Discord par le bot, suppression définitive d'un jeu désactivé, administratif de l'association : obligations et veille légale validée, livre des comptes et rôle Trésorier, documents types, autorisations des mineurs, page de confidentialité). Remplace les versions 3.0 (« QG Esport ») et 2.2 (QG Valorant 1.1.0), jamais déployées.

**Lugh** (le dieu celte aux mille talents) : espace privé d'une structure esport, **un espace par jeu** : roster, planning d'entraînement, présences, absences et charge d'entraînement, comptes rendus de séance, disponibilités, Jour de match, maps et compos, stratbook, bibliothèque, adversaires et veto, tournois, méta, scrims et partenaires de scrim, VOD review, progression du débutant complet à l'expert, programme individuel, bilan du mois, recrutement.
Au niveau de la structure : vue d'ensemble de tous les jeux, annonces avec « lu par », agenda .ics de tous ses jeux et conflits d'agenda entre jeux, double authentification.
Chaque personne a **un seul compte** (identifiant + mot de passe) et des **métiers par jeu** : elle ne voit que les jeux auxquels elle a accès.
L'**Administrateur général** active les jeux depuis une liste et gère tous les comptes ; chaque jeu a un ou plusieurs **Responsables du jeu** qui gèrent les comptes et les réglages de ce jeu seulement.
Un jeu = un **modèle** (Valorant, Counter-Strike 2, League of Legends, Rainbow Six Siege, Overwatch, Rocket League, EA SPORTS FC, Apex Legends, Fortnite, ou « Autre jeu ») + les **Réglages du jeu** modifiables sans code.

---

## 1. Modules

Règle : un fichier = une responsabilité, aucun au-delà d'environ 400 lignes (les modèles de jeu sont des données ; un modèle trop long est coupé en deux fichiers).

```
Lugh-2.0.0/
├── A_FAIRE.md  ARCHITECTURE.md  README.md  PIEGES.md
├── render.yaml                    Blueprint Render (service « lugh-esport », gratuit, Francfort, Node 22, santé /api/sante)
├── .env.example  .gitignore  .node-version  package.json      (1 seule dépendance : mongodb)
├── marque/                        logos hors application (fond sombre, fond clair) ; licences/ : licences OFL des polices
├── src/                           serveur Node.js
│   ├── serveur.js  simulation.js  config.js  app.js
│   ├── http/        routeur.js  outils.js  securite.js (CSP, CSRF, débit)  statique.js
│   ├── auth/        mdp.js (scrypt)  sessions.js  limiteur.js  acces.js (connexion, accès à un espace, 2FA exigée, projections)
│   │                totp.js (RFC 6238, codes de secours)  qr.js (QR code maison)  deuxfacteurs.js (vérification, remise à zéro)
│   ├── stockage/    memoire.js  mongo.js          une « fabrique » : base globale + une base par jeu
│   ├── espaces/
│   │   ├── registre.js            jeux activés et services de chaque espace (base, dépôt, méta, Discord, automatismes)
│   │   └── amorcage-jeu.js        création d'un espace : profil, postes à pourvoir, méta initiale, maps, semaine type
│   ├── domaine/
│   │   ├── depot.js               révisions, synchronisation, signature, écouteurs d'écriture (une instance par jeu)
│   │   ├── journal.js             journal global (qui, quoi, quel jeu), 90 jours
│   │   ├── collections.js         droits, cascades et plafonds des collections d'un jeu
│   │   ├── automatismes.js        à chaque visite d'un jeu : semaine créée depuis la semaine type, méta du lundi et du jeudi
│   │   ├── amorcage.js            premier démarrage : compte Administrateur général
│   │   ├── parametres.js          paramètres de la structure (double authentification exigée)
│   │   ├── restauration.js        sauvegarde, restauration, point de restauration automatique (annulation)
│   │   ├── veille.js              veille légale : consigne (recherche web limitée aux sites officiels), propositions à valider
│   │   ├── sauvegarde-structure.js  sauvegarde des données de la structure hors jeux (comptes, autorisations, suivi, identité, veille)
│   │   └── demo*.js               données de démonstration (simulation uniquement)
│   ├── routes/
│   │   ├── auth.js                session, connexion, déconnexion, mot de passe, mes jeux
│   │   ├── admin.js               administration générale : jeux (activation), état du service, journal
│   │   ├── comptes.js             comptes : Administrateur général (tous) et Responsable (son jeu)
│   │   ├── donnees.js             /api/e/:jeu : chargement, synchronisation, écritures génériques, visites
│   │   ├── perso.js               /api/e/:jeu : absences, chiffres, votes, passage à l'essai
│   │   ├── reglages.js            /api/e/:jeu : Réglages du jeu (couleur comprise), Discord, méta (import), sauvegarde et restauration
│   │   ├── deuxfacteurs.js        double authentification (activation, codes, désactivation) ; obligation et remise à zéro (admin)
│   │   ├── annonces.js            annonces de la structure, lectures (« lu par »)
│   │   ├── organisation.js        conflits d'agenda entre jeux, agenda .ics personnel (tous ses jeux)
│   │   ├── structure.js           vue d'ensemble de tous les jeux (Administrateur général)
│   │   ├── administratif.js       identité de l'association, suivi des obligations, veille légale, autorisations des mineurs, identité publique
│   │   ├── tresorerie.js          livres des comptes association et société (admin ou Trésorier) : écritures, réglages, clôture, rapprochement, export, indicateur de passage
│   │   └── meta.js                santé, vérification de la méta (Responsable ou cron facultatif)
│   ├── notifications/discord.js   webhook secret par jeu, événements filtrés, planning regroupé (2 min)
│   └── meta/        claude.js  consigne.js (construite depuis le modèle)  actualisation.js (une par jeu)
├── shared/                        code commun serveur + navigateur (source unique)
│   ├── administratif/            obligations.js (référentiel vérifié + changements validés), comptes.js (écritures, exercices, bilan, CSV),
│   │                              identite.js (formes, forme juridique, contexteStructure), documents.js + documents-statuts.js
│   │                              + documents-societe.js (modèles), confidentialite.js
│   ├── jeux/
│   │   ├── index.js               catalogue des modèles (ordre, chargement)
│   │   ├── commun.js              paliers, blocs communs, formats de série, valeurs par défaut d'un modèle
│   │   ├── definition.js          modèle + Réglages du jeu = définition effective ; aides (objectifs, ébauches, programme)
│   │   ├── reglages-jeu.js        forme et validation des Réglages du jeu
│   │   ├── controle.js            contrôle complet d'un modèle (identifiants, nombres, références)
│   │   └── valorant*.js  cs2.js  lol.js  r6.js  ow2.js  rl.js  fc.js  apex.js  fortnite.js  autre.js
│   ├── marque.js (nom et identifiants de la marque)  couleurs.js (palette des jeux, contrastes vérifiés)
│   ├── roles.js  referentiel.js  validation.js  temps.js
│   ├── schemas.js  schemas-plus.js  schemas-organisation.js  schemas-meta.js  schemas-comptes.js     formes des documents
│   ├── stats.js (manches, score simple, classement)  alertes.js (méta)  sante.js (moniteur de santé)  charge.js (charge d'entraînement)
│   ├── suivi.js (présences, chiffres, quoi de neuf, bilan)  organisation.js (tournois, partenaires, conflits)
│   ├── veto.js  discord.js  exports.js (agenda .ics, CSV)
├── public/                        application (modules ES, aucune dépendance)
│   ├── index.html  favicon.svg  manifest.webmanifest  sw.js  robots.txt  icones/ (marque, icônes)  fonts/ (OFL)
│   ├── css/  tokens.css  base.css  composants.css  signature.css  identite.css  impression.css
│   │         vues.css  vues-plus.css (+ vues-semaine, vues-jeu, vues-perf, vues-equipe, vues-admin)
│   └── js/   app.js (coquille, sélecteur de jeu)  navigation.js (pages, couleur du jeu)  api.js  etat.js  jeu.js
│             routeur.js  theme.js  installation.js  ui.js  icones.js
│             composants/  topo  parcours  jetons  grille  courbe  sorties  profil
│             vues/        connexion, deuxfacteurs, jeux (mes jeux), compte
│                          accueil (+ accueil-sections), planning (+ planning-suivi : conflits, comptes rendus),
│                          presences (charge), dispos, match (Jour de match)
│                          maps (+ maps-editeur, maps-outils), strats (+ strats-editeur), bibliotheque,
│                          adversaires (+ adversaires-editeur), tournois (+ tournois-editeur), meta (+ meta-sections)
│                          scrims (+ scrims-saisie), partenaires (+ partenaires-journal), vod, progression
│                          (+ progression-chiffres), programme, bilan
│                          roster, recrutement, gestion (+ gestion-comptes, gestion-service), reglages-jeu
│                          (+ reglages-listes, -score, -textes, -outils), admin (+ admin-structure, -jeux, -comptes,
│                          -annonces, -discord, -service, -commun), compte-discord (liaison Discord)
└── test/                          node --test, serveur de simulation, faux pilote MongoDB
```

---

## 2. Sources de vérité uniques

| Élément | Source unique |
|---|---|
| Thème (couleurs, typo, espacements ; sombre par défaut, clair, impression) | `public/css/tokens.css` (+ `impression.css`) ; choix par appareil : `public/js/theme.js` |
| Ce qui change d'un jeu à l'autre (rôles, camps, types de strat, blocs, rangs, chiffres, score, veto, checklist, profil public, vocabulaire, paliers, domaines, objectifs, ébauches, routines, méta initiale) | le modèle `shared/jeux/<modèle>.js` |
| Personnalisation d'un jeu (listes renommées, ajoutées ou masquées, textes des objectifs, vocabulaire, effectif, sources de la méta) | document `jeu/reglages` de la base du jeu, fusionné au modèle par `shared/jeux/definition.js` (le serveur envoie la définition effective au navigateur) |
| Métiers, permissions, accès par jeu | `shared/roles.js` (appliqués par le serveur, reflétés par l'interface) |
| Listes communes à tous les jeux (statuts, publics, jours, événements Discord…) | `shared/referentiel.js` |
| Forme et limites des documents | `shared/schemas*.js`, construits pour chaque jeu à partir de sa définition (validés par le serveur) |
| Cascades de suppression | `src/domaine/collections.js` (reflétées dans `public/js/etat.js` pour l'affichage immédiat) |
| Textes Discord, agenda, CSV | `shared/discord.js`, `shared/exports.js` |
| Configuration et secrets | variables d'environnement Render, lues uniquement par `src/config.js` ; webhook Discord de chaque jeu dans sa collection `reglages` |
| Méta d'un jeu | collection `meta` de sa base, écrite uniquement par l'actualisation (API ou import) |
| Liste des jeux activés, leur nom et leur couleur | collection `espaces` de la base globale |
| Nom de la marque, identifiants qui en découlent | `shared/marque.js` (les fichiers statiques reprennent les mêmes valeurs) |
| Palette des couleurs de jeu | `shared/couleurs.js` |
| Obligation de double authentification | document `structure` de la collection `parametres` (base globale) |

---

## 3. Persistance

Tout est dans MongoDB Atlas (gratuit, 1 cluster) : le disque de Render est effacé à chaque redéploiement, rien n'y est stocké.
**Une base globale `lugh`** et **une base par jeu `lugh_<jeu>`** (ex. `lugh_valorant`, `lugh_lol`) dans le même cluster : les données d'un jeu ne côtoient jamais celles d'un autre.

Base globale `lugh` :

| Collection | Contenu | Qui écrit |
|---|---|---|
| `comptes` | identifiant, mot de passe haché, `admin` (Administrateur général), `tresorier` (livre des comptes), `acces` par jeu (métiers, membre lié), actif, visites par jeu, double authentification (clé, dernier pas utilisé, empreintes des codes de secours), `discord` (identifiant et pseudo Discord liés), `discordCode` (empreinte du code de liaison en cours, 10 minutes), `discordAttente` (pseudo Discord à confirmer, 15 minutes) | Administrateur général ; Responsable pour son jeu ; la personne pour sa double authentification ; le serveur pour les visites |
| `sessions` | jeton haché, compte, expiration (effacée seule après 30 jours) | serveur |
| `espaces` | jeux créés : identifiant, modèle, nom, couleur, actif ou non, ordre | Administrateur général ; Responsable (nom, couleur) |
| `journal` | qui a fait quoi, dans quel jeu (90 jours) | serveur |
| `annonces` | annonces de la structure, jeux visés, expiration, lectures (100 au plus) | Administrateur général ; chacun pour « lu » |
| `restaurations` | point de restauration de chaque jeu (en-tête + morceaux de 4 Mo au plus) | serveur, juste avant une restauration |
| `parametres` | paramètres de la structure (double authentification exigée) ; `discord-annonces` (webhook du salon #annonces, secret) ; documents `structure-identite` (nom, RNA, SIRET, contact public, référent : rien de personnel), `structure-suivi` (statut de chaque obligation), `structure-veille` (changements validés, propositions, coût), `structure-comptes` (début d'exercice, ouverture, exercices clôturés, dernier rapprochement), `discord-bot-reglages`, `discord-bot-etat` (dernier état reçu du bot) et `discord-bot-delies` (comptes déliés depuis moins de 14 jours) : un document par écrivain, aucune écriture n'en écrase une autre | Administrateur général ; le bot pour son état |
| `ecritures` | livres des comptes : `livre` (`association` si absent, ou `societe`), date, recette / dépense / transfert, catégorie, montant en centimes, banque ou caisse, n° de pièce, tiers, note (5 000 au plus par livre ; justificatifs hors de Lugh) | Administrateur général et Trésorier ; un exercice clôturé est en lecture seule |
| `autorisations` | par jeu et par membre du roster : mineur (oui/non), dates de l'autorisation parentale et du droit à l'image, note ; jamais d'âge ; hors des données synchronisées du jeu | Responsable du jeu et Administrateur général ; supprimées avec le jeu |

Base de chaque jeu `lugh_<jeu>` (mêmes collections pour tous les jeux) :

| Collection | Contenu | Qui écrit |
|---|---|---|
| `jeu` | Réglages du jeu (personnalisation du modèle) | Responsable |
| `equipe`, `membres` | profil de l'équipe ; joueurs et staff (pseudo, identifiant en jeu, rôle, personnages) | Responsable, Head coach |
| `mapsEquipe`, `strats` | statut et préparation des maps, compos ; strats avec étapes, rôles et lineups reliés | staff, analyste, capitaine |
| `planning` | `modele` (semaine type) et une fiche par semaine ISO (créée seule le lundi) | coachs ; le serveur pour la création |
| `objectifs` | palier, objectifs et date d'atteinte (source unique du palier) ; fiche `equipe` | coachs ; le joueur pour son auto-évaluation |
| `scrims`, `vods`, `vodNotes` | résultats (manches, score simple ou classement selon le jeu) ; VOD ; notes horodatées | staff ; chacun pour ses notes |
| `dispos`, `absences`, `presences` | grille d'un membre par semaine ; absences prévues ; appel des séances | le membre, coachs, capitaine |
| `mesures` | chiffres d'un joueur pour une semaine (`<membre>_<semaine>`), selon les chiffres du jeu | le joueur, coachs |
| `adversaires`, `bibliotheque` | fiches anti-strat, prochain match, plan de veto ou de draft ; lineups, astuces et ressources | staff, capitaine ; tout joueur pour la bibliothèque |
| `candidats`, `votes` | recrutement (dont la chaîne Twitch) ; un avis par personne et par candidat | staff |
| `seances` | compte rendu d'une séance du planning (`<semaine>_<bloc>`) | coachs, capitaine |
| `tournois` | tournois : dates, date limite d'inscription, statut, roster inscrit, résultat | Responsable, coachs, capitaine |
| `partenaires` | carnet des partenaires de scrim : niveau, contact, créneaux, incidents (fiabilité calculée avec les scrims liés) | qui saisit les scrims |
| `meta`, `metaHistorique`, `suggestions` | méta courante du jeu ; 20 dernières versions ; ajustements proposés | actualisation uniquement ; suggestions traitées par les coachs |
| `reglages` | webhook Discord et événements choisis (**jamais synchronisé ni exporté**) | Responsable |
| `suppressions`, `compteurs` | synchronisation entre appareils | serveur |

- Atlas gratuit : 100 bases et 500 collections au plus. Une base de jeu compte 27 collections, la base globale 7 : **15 jeux au maximum** (plafond appliqué par le serveur), soit 412 collections.
- Chaque fiche porte `rev` et `maj` (qui, quand) : les autres appareils récupèrent les changements toutes les 20 secondes. Une modification des Réglages du jeu recharge la page des autres appareils.
- Écriture concurrente : si une fiche a changé pendant qu'on l'éditait, le serveur refuse (409) au lieu d'écraser ; les écritures d'une même fiche passent une par une (verrou en mémoire : un seul serveur, Render gratuit).
- Suppressions en cascade : une VOD emporte ses notes ; un membre ses chiffres, absences, dispos et objectifs ; un candidat ses avis.
- Désactiver un jeu le masque à tous sauf à l'Administrateur général ; ses données restent intactes et reviennent à la réactivation.
- Supprimer définitivement un jeu (Administrateur général, jeu désactivé seulement, nom du jeu tapé) : sa base est vidée collection par collection (l'utilisateur Atlas ne peut pas supprimer une base entière ; une base vide disparaît), **avant** de le retirer de la liste des jeux, pour qu'une interruption laisse un jeu listé qu'on peut supprimer de nouveau. Puis : accès des comptes à ce jeu retirés, point de restauration effacé, jeu retiré des annonces (une annonce qui ne visait que lui est supprimée, sinon elle viserait tous les jeux), entrée dans le journal général. Irréversible : l'export proposé juste avant et les sauvegardes du Pi sont les seules copies.
- Sauvegarde de la structure (hors jeux) : `GET /api/admin/administratif/sauvegarde` (Administrateur général) et `POST /api/bot/sauvegarde` avec `jeu: "_structure"` (bot, rangée chaque semaine dans `_structure.json` sur le Pi) : documents `parametres` structure-identite, -suivi, -comptes, -veille, collections `ecritures` et `autorisations` ; format `lugh-structure`, version 1. Restauration : à la main pour l'instant (voir A_FAIRE).
- Sauvegarde : export JSON d'un jeu (sans mots de passe ni webhook) ; avec le bot Discord, copie automatique de chaque jeu chaque semaine sur le Raspberry Pi (`~/lugh-bot/data/sauvegardes`, 8 semaines), seule copie hors de Render et d'Atlas ; restauration dans le même jeu seulement (comptes et méta intacts, fiches invalides ignorées, aucune notification). Juste avant d'appliquer une restauration, l'état actuel devient le **point de restauration** du jeu (un seul) : « Annuler la dernière restauration » le remet en place et crée à son tour un point.
- Survit à un redémarrage ou un redéploiement : tout, sauf les compteurs d'échecs de connexion et le message de planning Discord en attente (en mémoire).

---

## 4. Sécurité

- Secrets uniquement en variables d'environnement Render : `MONGODB_URI`, `LUGH_ADMIN_MDP`, `ANTHROPIC_API_KEY` (facultative), `LUGH_SECRET_CRON` (facultatif), `LUGH_CLE_BOT` (facultative, 32 caractères minimum). Jamais dans le dépôt, jamais dans une URL. La clé de double authentification d'un compte est en base (nécessaire pour vérifier les codes), jamais renvoyée après l'activation.
- **Séparation des jeux** : chaque requête d'un espace (`/api/e/<jeu>/…`) vérifie que le compte a un accès à ce jeu (ou est Administrateur général) ; sinon réponse « introuvable », comme pour un jeu qui n'existe pas. Les métiers et le membre lié sont ceux du compte **dans ce jeu**. Les autres comptes ne sont visibles qu'à travers le jeu partagé (nom affiché, métiers dans ce jeu).
- **Deux niveaux d'administration** :
  - Administrateur général : jeux, tous les comptes, journal complet, état du service ; il doit toujours en rester un actif.
  - Responsable du jeu : comptes et réglages de son jeu. Il ne peut changer le mot de passe, le nom, désactiver ou supprimer un compte que si ce compte n'a accès qu'à des jeux dont il est lui-même Responsable (sinon, prise de contrôle d'un autre jeu possible) ; il ne peut jamais toucher un Administrateur général.
- Webhook des annonces de la structure : même traitement (document `discord-annonces`, jamais renvoyé, seulement « …6 derniers caractères »). Une annonce importante mentionne @everyone dans #annonces, les autres personne ; un échec de Discord n'empêche jamais l'annonce dans Lugh.
- Webhook Discord : secret stocké dans la base du jeu, jamais renvoyé au navigateur (seulement « …6 derniers caractères »), absent de la synchronisation et de l'export ; format vérifié ; `allowed_mentions` vide : aucune mention possible.
- Mots de passe : scrypt avec sel, jamais stockés ni renvoyés en clair. 10 caractères minimum, sans l'identifiant. Mot de passe temporaire à changer à la première connexion.
- Sessions : jeton aléatoire dans un cookie `HttpOnly`, `Secure`, `SameSite=Lax` ; seule son empreinte SHA-256 est en base.
- Anti-force brute : 5 échecs sur un identifiant → blocage 15 minutes ; 20 échecs depuis une même adresse (la dernière de `X-Forwarded-For`, celle que Render ajoute) → blocage ; au plus 2 calculs scrypt simultanés et 40 en attente, au-delà 429. Un code de double authentification faux compte comme un échec.
- **Double authentification** (TOTP RFC 6238, HMAC-SHA1, 6 chiffres, 30 s, ±1 pas, pas déjà utilisé refusé) : activation par QR code (dessiné par le serveur, l'adresse otpauth n'est jamais une URL appelée), 10 codes de secours à usage unique conservés en empreinte SHA-256, autres sessions fermées à l'activation. L'Administrateur général peut l'exiger pour lui et les Responsables : tant qu'un compte concerné ne l'a pas activée, toute route autre que l'activation répond 403. Dernier recours : `LUGH_REINITIALISER_2FA` au démarrage (accès Render requis).
- Agenda personnel : téléchargement seulement (un abonnement demanderait un jeton dans l'adresse). Conflits entre jeux : seuls le jeu et l'horaire de l'autre séance sont montrés.
- Toute écriture exige l'en-tête `X-Lugh` et une origine identique au site (protection CSRF), sauf `/api/cron/` et `/api/bot/` qui n'utilisent aucun cookie : une clé dans l'en-tête `Authorization`, comparée en temps constant.
- **Forme juridique** (`structure-identite`, champs `forme`, `passagePrevu`, `seuilPassage`, `associationMaintenue`, société : nom, forme SAS/SASU, SIREN) : `contexteStructure()` décide des sections d'obligations visibles (`pour` : association, societe, passage), des documents du passage et des livres. Le livre de la société (`structure-comptes-societe`) n'est modifiable que si la forme est « société » ; une écriture reste dans son livre (lu sur l'écriture, jamais dans la requête). Changer de forme n'efface rien. Seuils chiffrés : `SEUILS` d'`obligations.js`, seule définition.
- **Administratif** : identité, suivi, veille et vue des mineurs réservés à l'Administrateur général ; livre des comptes à l'Administrateur général et aux comptes `tresorier` (un Trésorier ne rouvre pas un exercice clôturé ni ne change les réglages après une clôture ; seul un exercice terminé se clôture ; la date d'ouverture ne peut pas passer après une écriture existante) ; un compte `tresorier` n'est géré que par l'Administrateur général (un Responsable ne réinitialise ni son mot de passe, ni son nom, ni son état, ne le supprime pas et ne lui ajoute pas d'accès de jeu) et il est soumis à la double authentification exigée ; autorisations d'un jeu au Responsable de ce jeu (`comptes.gerer`). Seule route sans connexion ajoutée : `GET /api/public/structure` (nom et contact public, pour « Données et confidentialité »). Veille légale : sources https sur une liste fermée de sites officiels, propositions bornées (40), rien d'appliqué sans « Accepter ». Export tableur : cellules commençant par = + - @ neutralisées.
- **Bot Discord** (`/api/bot/…`, clé `LUGH_CLE_BOT`) : il lit les rôles attendus des comptes liés, les rappels des 27 prochaines heures, la semaine et les matchs d'une personne liée ; il n'écrit qu'une liaison, des absences (mêmes contrôles et même journal que l'appli) et le webhook d'un jeu ou des annonces **seulement là où Lugh n'en a pas** (`POST /api/bot/webhooks`, adresse contrôlée, jamais renvoyée ; un webhook retiré à la main est marqué `retire` et n'est pas rebranché). La synchro indique au bot les webhooks qui manquent ; le bot crée lui-même rôle, catégorie, salons et webhook de chaque jeu actif, sans jamais rien supprimer. Liaison : code de 6 caractères créé par la personne connectée (Mon compte), conservé en empreinte, valable 10 minutes, à usage unique ; 5 codes faux par compte Discord et par quart d'heure ; puis **confirmation dans Lugh du pseudo Discord qui a tapé le code** (15 minutes) : un code vu par un tiers (stream, écran partagé) ne suffit pas ; un compte Discord pour un seul compte Lugh. Absences déclarées par le bot : jamais en double (même jour, mêmes heures), le bot ne relance jamais une écriture. Délier (soi-même ou l'Administrateur général) ou supprimer un compte : le bot retire ses rôles Lugh. **Risques acceptés par Olivier (19/10)** : le bot a la permission Administrateur sur le serveur Discord, et le rôle Discord « Administrateur » suit le statut d'Administrateur général dans Lugh ; un compte Lugh volé ou la clé du bot volée ont donc des conséquences sur Discord (parade : double authentification exigée, clé uniquement dans Render et le `.env` du Pi).
- Recrutement : candidats et avis ne sont envoyés qu'aux comptes ayant `recrutement.voter` dans ce jeu. Lien Twitch d'un candidat : seulement un nom de chaîne (lettres, chiffres, `_`), transformé en lien `https://www.twitch.tv/…`.
- Robustesse : aucune tâche de fond (méta, message Discord regroupé) ne peut arrêter le serveur ; une promesse rejetée oubliée est journalisée.
- Restauration : Responsable du jeu, confirmation forte (taper RESTAURER), 15 Mo au plus, même jeu et même modèle exigés, chaque fiche revalidée avec la définition du jeu ; champs techniques déduits de l'identifiant ; plafonds vérifiés avant toute écriture ; point de restauration créé avant la première écriture.
- Navigateur : CSP stricte (`'self'` uniquement, aucun script ni style en ligne, aucun site externe), aucun texte saisi interprété comme du HTML, liens acceptés seulement en `https://`. Le service worker ne met **jamais** `/api/` en cache.
- Données personnelles : pseudo et identifiant en jeu facultatif uniquement — ni nom réel, ni âge, ni e-mail (une équipe peut compter des mineurs).

---

## 5. Identité

- Nom : « Lugh » et devise « Le soleil se lève avec nous. » (source unique `shared/marque.js` ; devise sous le logo de l’écran de connexion) ; appli installable « Lugh » : `id` du manifest **`/lugh`**, caches préfixés **`lugh-`** (fixés pour toujours ; le service worker ne supprime que ses propres caches).
- Identité : écusson (soleil levant traversé par la lance de Lugh, version simplifiée pour les petites tailles) et lettrage maison « LUGH » vectorisé ; or et ambre sur nuit, thème sombre par défaut, clair en option ; impression toujours sur fond blanc ; aucun visuel officiel d'éditeur (Riot, Valve, Ubisoft, Blizzard, Epic, EA, Psyonix).
- Couleur de chaque jeu : palette fermée de 14 teintes (`shared/couleurs.js`), inspirées des jeux sans les reproduire, contrastées à 4,5:1 sur les deux thèmes.
- Service Render et dépôt : `lugh-esport` ; base Atlas globale `lugh`, bases de jeu `lugh_<jeu>` ; variables `LUGH_*` ; cookie `lugh_session` ; en-tête anti-CSRF `X-Lugh`.
- Adresses : `#/<jeu>/<page>` (ex. `#/valorant/planning` ; l'accueil d'un jeu est `#/<jeu>`), `#/admin` (vue d'ensemble), `#/admin/<onglet>`, `#/compte`, `#/jeux`. Les identifiants de pages sont réservés : un « Autre jeu » ne peut pas s'appeler `admin`, `planning`…
- Identifiants des jeux : celui du modèle (`valorant`, `cs2`, `lol`, `r6`, `ow2`, `rl`, `fc`, `apex`, `fortnite`) ; pour « Autre jeu », tiré du nom (minuscules et chiffres) et **définitif** (c'est le nom de sa base).
- Identifiants des fiches : comptes `c-`, membres `m-`, strats `s-`, scrims `x-`, VOD `v-`, notes `n-`, absences `a-`, adversaires `d-`, bibliothèque `l-`, candidats `k-`, tournois `t-`, partenaires `e-`, annonces `an-` ; comptes rendus `<semaine>_<bloc>` ; maps et personnages en minuscules sans accent ; semaines ISO (`2026-W43`).
- Identifiants des objectifs (`meca-3-2`…), des rôles, des types et des chiffres d'un modèle : fixes (les données y sont rattachées) ; les Réglages du jeu masquent un élément au lieu de le supprimer.
- Versions de schéma : `meta.schema = 2` ; sauvegarde `format: lugh`, `version: 2`, avec le jeu et le modèle.

---

## 6. Dépendances externes

| Dépendance | Sert à | Si elle est coupée |
|---|---|---|
| Render (gratuit) | héberger le serveur | site inaccessible ; s'endort sans visite, réveil ≈ 1 min (écran « Ouverture… ») |
| MongoDB Atlas (gratuit) | toutes les données | le serveur répond « base indisponible », rien n'est perdu |
| API Claude + recherche web (facultative) | vérifier la méta de chaque jeu | statut « échec », ancienne méta gardée ; import manuel toujours possible |
| Discord (facultatif, un webhook par jeu) | annonces dans un salon | échec noté au journal, rien d'autre n'est bloqué |
| Bot Lugh sur le Raspberry Pi (facultatif) | rôles, rappels, commandes Discord | rien ne change dans l'appli ; l'onglet Discord de l'administration affiche « Silencieux » après 7 h sans nouvelles |
| Sites de profil (tracker.gg, op.gg, Leetify…) | lien vers le profil public d'un joueur | lien seulement, aucune donnée lue |
| Twitch | lien vers la chaîne d'un candidat | lien seulement |
| Application d'authentification (au choix de chacun) | codes de double authentification | rien côté serveur : codes de secours, ou remise à zéro par l'Administrateur général |

Vérification de la méta (par jeu) :
- déclenchée à la première visite **de ce jeu** après le lundi et le jeudi 7 h 45 (Paris) : 3 essais au plus par créneau, 3 h entre deux essais ; un jeu que personne n'ouvre ne coûte rien ; désactivable dans les Réglages du jeu ;
- sources autorisées : celles du modèle (notes de patch officielles d'abord), modifiables dans les Réglages du jeu ;
- la réponse (API ou import) est validée champ par champ avec la définition du jeu ; si elle est invalide, rien n'est écrit ;
- elle n'écrit que `meta`, `metaHistorique` et `suggestions`, jamais le travail de l'équipe ;
- coût estimé et cumulé par mois et par jeu, visible dans l'administration (≈ 0,10 à 0,35 $ par passage avec Sonnet 5.5).

---

## 7. Plan de tests

`npm test` (test natif de Node, aucune dépendance) sur un serveur de simulation : stockage en mémoire (une base par jeu), fausse API Claude, faux Discord, jamais de vrais services.

| Fichier | Vérifie |
|---|---|
| `modeles.test.js` | chaque modèle : identifiants, 6 domaines, objectifs par domaine et palier, collectifs, ébauches sans chevauchement, références (rôles, camps, blocs, maps, seuils), méta initiale valide ; définition effective avec Réglages du jeu |
| `auth.test.js` | connexion, mauvais mot de passe, blocage, cookie, changement obligatoire, déconnexion |
| `espaces.test.js` | activation d'un jeu, séparation des accès (introuvable sans accès), métiers par jeu, Responsable limité à son jeu, protection des comptes multi-jeux, dernier Administrateur général |
| `permissions.test.js` | chaque métier : ce qu'il peut et ne peut pas écrire ; dispos et notes à soi |
| `donnees.test.js` | écritures validées par la définition du jeu, synchronisation, suppressions, conflit 409, types de score |
| `securite.test.js` | en-têtes, CSRF, champs inconnus ignorés, liens non https refusés, aucun hachage exposé |
| `meta.test.js` | actualisation réussie, réponse invalide, reprise pause_turn, verrou, secret du cron, consigne propre au jeu |
| `logique.test.js`, `suivi.test.js` | stats (trois types de score), alertes, moniteur de santé, semaines ISO, veto, agenda .ics, CSV, textes Discord, bilan |
| `restauration.test.js` | sauvegarde et restauration silencieuse, jeu différent refusé, Réglages du jeu, point de restauration et annulation |
| `reglages.test.js` | Réglages du jeu, renommage, couleur, charge, conflit 409 |
| `deuxfacteurs.test.js` | TOTP (vecteurs RFC 6238), QR code, activation, connexion avec code ou code de secours, rejeu refusé, obligation, remise à zéro |
| `organisation.test.js` | annonces et lectures, vue d'ensemble, conflits entre jeux, agenda .ics personnel |
| `bot.test.js` | webhooks branchés par le bot (seulement s'ils manquent, jamais remplacés ni renvoyés, retirés à la main non rebranchés), sauvegarde hebdomadaire (export pour le Pi), annonces reprises sur Discord (webhook secret, @everyone si importante, échec sans perte), clé du bot, liaison (usage unique, expiration, essais limités, un Discord par compte), rôles attendus, rappels (heure d'été, filtres), /planning /match /absent, déliaison signalée |
| `administratif.test.js` | référentiel des obligations (identifiants, niveaux, sources), veille légale (sources officielles seulement, rien sans validation, import manuel, ajouts), livre des comptes (exercices décalés, soldes, bilan, montants saisis, export sans formule, Trésorier sans jeu, clôture d'un exercice terminé seulement et réouverture par l'admin seul, ouverture jamais après une écriture, rapprochement), compte Trésorier protégé des Responsables et soumis à la double authentification, sauvegarde de la structure (admin et bot), autorisations effacées avec le membre, veille hors format en échec et propositions en attente jamais perdues, documents et confidentialité, identité publique limitée, autorisations des mineurs (Responsable seulement, aucun âge) |
| `passage-societe.test.js` | sections selon la forme juridique, statut « Plus tard », sources du référentiel toutes officielles, catégories et hors résultat de la société, recettes commerciales sur 12 mois, passage de bout en bout (deux livres séparés, livre de la société verrouillé hors forme « société », indicateur, documents, veille, sauvegarde) |
| `robustesse.test.js` | écritures simultanées (409), restaurations simultanées, remise à zéro 2FA à usage unique, IP réelle derrière le proxy, motifs de profil dangereux |
| `mongo.test.js` | l'adaptateur MongoDB (plusieurs bases) contre un faux pilote |
| Parcours navigateur (Playwright) | plusieurs comptes et plusieurs jeux : activation, sélecteur de jeu, saisies, zéro erreur console |

Plus : captures PC (1440 px) et téléphone (390 px) en thème sombre, aucun débordement horizontal à 360 px, impression du bilan en PDF ; après mise en ligne, contrôle `/api/sante`, connexion, activation d'un jeu, écriture puis redéploiement pour vérifier la persistance.

---

## 8. Risques connus

| Risque | Parade |
|---|---|
| Disque Render effacé | aucune donnée sur disque, tout dans Atlas |
| Atlas refuse la connexion de Render | accès réseau `0.0.0.0/0` (Render gratuit n'a pas d'IP fixe) + mot de passe fort |
| Limite d'Atlas gratuit (500 collections) | 27 collections par jeu, 15 jeux au plus (412 collections) |
| Secret dans le dépôt | `.env` exclu, `.env.example` et `render.yaml` sans valeurs, contrôle à chaque livraison |
| Un compte voit un autre jeu | accès vérifié à chaque requête d'un espace ; un Responsable ne peut pas reprendre un compte présent dans un jeu qu'il ne gère pas |
| Perte du dernier Administrateur général | impossible de le supprimer, de le désactiver ou de lui retirer ce rôle |
| Mise à jour de la méta qui écrase le travail de l'équipe | elle n'écrit que la méta ; les ajustements deviennent des suggestions |
| Réponse de Claude fausse ou mal formée | validation stricte ; sources officielles exigées pour le patch et le map pool ; date de patch jamais en arrière |
| Coût de l'API | 2 créneaux par semaine et par jeu ouvert, 3 essais au plus, 8 recherches par passage, coût affiché par jeu, vérification automatique désactivable |
| Élément d'un modèle retiré alors que des fiches l'utilisent | les Réglages du jeu le masquent (toujours valide pour les fiches existantes) au lieu de le supprimer |
| Identifiant d'un « Autre jeu » mal choisi | proposé depuis le nom et affiché avant confirmation ; seul le nom reste modifiable ensuite |
| Rafale de notifications Discord | planning regroupé en un message 2 minutes après la dernière modification ; restauration silencieuse |
| Restauration par erreur | Responsable seul, mot RESTAURER à taper, même jeu exigé ; comptes et méta jamais touchés ; point de restauration automatique : « Annuler la dernière restauration » |
| Téléphone de double authentification perdu | 10 codes de secours ; remise à zéro par l'Administrateur général ; pour lui-même, variable `LUGH_REINITIALISER_2FA` |
| Vol du mot de passe d'un Responsable | double authentification exigeable ; sessions fermées à l'activation ; codes à usage unique |
| Saisie en cours effacée par une mise à jour | chaque formulaire a son brouillon : la page attend son enregistrement pour se redessiner |
| Version d'appli en cache après une mise à jour | service worker « réseau d'abord » : le code vient toujours du serveur quand il répond |
| Visuels protégés des éditeurs | identité et icônes maison, noms seulement, aucune image officielle |
| Fichiers géants | modules ≤ 400 lignes, contrôlé à chaque livraison |
| Bot qui garde l'appli Render éveillée et épuise les 750 h gratuites | synchronisation toutes les 3 h (≈ 90 h par mois) ; les commandes réveillent l'appli à la demande |
| Plus de 100 fichiers dans un envoi GitHub | zip livré déjà rangé en trois dossiers `envoi-1` à `envoi-3` |
