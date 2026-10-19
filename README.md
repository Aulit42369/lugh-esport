# Lugh — l'espace privé de la structure, un espace par jeu

**Lugh** porte le nom du dieu celte « aux mille talents », celui qu'on laissa entrer chez les dieux parce qu'il maîtrisait tous les arts à la fois. C'est le site privé d'une jeune structure esport : **un espace par jeu** (Valorant, Counter-Strike 2, League of Legends, Rainbow Six Siege, Overwatch, Rocket League, EA SPORTS FC, Apex Legends, Fortnite, ou tout « Autre jeu »).

Dans chaque jeu :
- **la semaine** : accueil, planning d'entraînement, présences et charge d'entraînement, disponibilités, et le « Jour de match » pensé pour le téléphone ;
- **le jeu** : maps et compos, stratbook, bibliothèque, adversaires et veto (ou draft), tournois, méta du jeu ;
- **la performance** : scrims et statistiques, partenaires de scrim, VOD review, progression du débutant complet à l'expert avec les chiffres de chaque joueur, programme individuel, bilan du mois ;
- **l'équipe** : roster, recrutement (avec la chaîne Twitch des candidats), Gestion du jeu, Réglages du jeu.

Ce qui tient tout ensemble :
- **Un compte par personne** (identifiant et mot de passe, sans inscription) avec des **métiers par jeu** : chacun ne voit que ses jeux. Un agenda `.ics` regroupe tous ses jeux, et une alerte prévient quand une personne a deux séances au même moment dans deux jeux.
- **L'Administrateur général** active les jeux, gère tous les comptes et voit la **vue d'ensemble** de la structure. Il publie des **annonces**, avec la liste de qui les a lues.
- **Le Responsable du jeu** gère les comptes et les réglages de son jeu.
- **La double authentification** (application d'authentification et codes de secours) est proposée à tous, et peut être exigée pour l'Administrateur général et les Responsables.
- **Les Réglages du jeu** se modifient sans code : rôles, rangs, chiffres suivis, types de strat, blocs, vocabulaire, objectifs, couleur du jeu, seuils de charge…
- **La méta** de chaque jeu est vérifiée le lundi et le jeudi, avec une clé API Claude (facultative) ou par import en deux copier-coller.

Version 2.0.0. Remplace le « QG Valorant » 1.1.0, qui n'a jamais été déployé.

---

## Ce qu'il faut

| Service | Rôle | Coût |
|---|---|---|
| GitHub (dépôt privé) | héberge le code | gratuit |
| Render (Web Service, plan Free) | fait tourner le site | gratuit (veille après 15 min sans visite, réveil en 1 min environ) |
| MongoDB Atlas (cluster M0) | garde toutes les données (une base générale + une base par jeu) | gratuit (512 Mo, 15 jeux au plus) |
| Une appli d'authentification (Google Authenticator, Aegis, Microsoft Authenticator…) | double authentification | gratuit, facultatif mais conseillé |
| API Claude (facultatif) | vérifie la méta de chaque jeu ouvert | 0,10 à 0,35 $ par passage et par jeu |
| Webhook Discord (facultatif, un par jeu) | annonces dans un salon | gratuit |

---

## Installation (une seule fois, 30 minutes environ)

### 1. MongoDB Atlas : la base de données
1. cloud.mongodb.com : crée un cluster **M0 (Free)**, région Europe (Francfort ou Paris).
2. **Database Access** → *Add New Database User* :
   - nom `lugh` ;
   - mot de passe généré par Atlas (bouton *Autogenerate*), note-le ;
   - rôle **Read and write to any database**. C'est indispensable : Lugh crée une base par jeu.
3. **Network Access** → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`). Render gratuit n'a pas d'adresse fixe.
4. **Database** → *Connect* → *Drivers* : copie la chaîne `mongodb+srv://lugh:<password>@…`, puis remplace `<password>` par le mot de passe noté. Cette chaîne est ta `MONGODB_URI`.

### 2. GitHub : le code
1. Crée un dépôt **privé** nommé `lugh-esport`.
2. Dézippe le zip livré et ouvre le dossier `Lugh-2.3.0`. GitHub accepte 100 fichiers au plus par envoi : le zip est déjà rangé en **trois dossiers**, `envoi-1`, `envoi-2` et `envoi-3`. Pour chacun, dans l'ordre : sur GitHub, à la **racine** du dépôt, *Add file → Upload files* ; ouvre le dossier sur ton PC, sélectionne tout ce qu'il contient (*Ctrl+A*), glisse-le dans la page, puis *Commit changes*.
   - `envoi-1` : `public` (sans ses vues) et `shared`, 94 fichiers.
   - `envoi-2` : `src`, `test`, `marque`, `licences` et les fichiers de la racine, 82 fichiers. Les fichiers qui commencent par un point (`.gitignore`, `.node-version`, `.env.example`) sont cachés sous Windows : *Affichage → Éléments masqués*.
   - `envoi-3` : `public/js/vues`, 51 fichiers. Il complète le dossier `public` du premier envoi.
3. Vérifie quatre choses : `package.json` et `render.yaml` sont à la racine du dépôt (pas dans un sous-dossier, ni dans `envoi-2`) ; `public/index.html` existe ; `public/js/vues/accueil.js` existe ; `shared/jeux/valorant.js` existe.

### 3. Render : le site (Blueprint, tout est pré-réglé)
1. dashboard.render.com : connecte ton compte GitHub.
2. *New* → **Blueprint** → choisis le dépôt `lugh-esport`. Render lit `render.yaml` : service gratuit `lugh-esport`, Francfort, Node 22, contrôle de santé.
3. Render demande trois valeurs :

| Clé | Valeur |
|---|---|
| `MONGODB_URI` | la chaîne Atlas de l'étape 1 |
| `LUGH_ADMIN_ID` | ton identifiant d'Administrateur général, en minuscules (ex. `olivier`) |
| `LUGH_ADMIN_MDP` | un mot de passe provisoire de 10 caractères minimum, sans ton identifiant dedans |

4. Clique *Apply* et attends « Live ». Dans *Logs*, tu dois lire : `Lugh prêt sur le port … (mode production, stockage mongo, 0 jeu(x))`.

### 4. Première connexion
1. Ouvre l'adresse du service : `https://lugh-esport.onrender.com`, ou celle que Render affiche. Connecte-toi avec `LUGH_ADMIN_ID` et `LUGH_ADMIN_MDP`, puis choisis ton mot de passe personnel.
2. **Mon compte → Double authentification → Activer** :
   - scanne le QR code avec ton application d'authentification ;
   - tape le code à 6 chiffres affiché ;
   - **range les 10 codes de secours** (fichier téléchargé ou papier). Chacun ne sert qu'une fois, si tu perds ton téléphone.
3. **Administration générale → Jeux** : active les jeux de la structure (interrupteur « Activé »). Pour un jeu absent de la liste : *Autre jeu*, puis son nom. L'identifiant proposé est définitif, car c'est le nom de sa base.
4. **Administration générale → Comptes** :
   - crée un compte par personne, avec ses métiers dans chaque jeu ;
   - donne le métier « Responsable du jeu » à la personne qui gère ce jeu ;
   - le mot de passe temporaire ne s'affiche **qu'une fois** : envoie-le en message privé.
5. Facultatif : **Administration générale → Comptes**, section « Double authentification », interrupteur sur **Exigée**. L'obligation vise l'Administrateur général et les Responsables, qui devront l'activer à leur prochaine connexion. La section liste les comptes qui ne l'ont pas encore activée.
6. Dans chaque jeu, suis la liste **Premiers pas** de l'Accueil, puis ouvre **Réglages du jeu** pour adapter le modèle : rôles, rangs, chiffres, vocabulaire, couleur du jeu, seuils de charge…

### 5. Facultatif : méta automatique (clé API Claude)
1. platform.claude.com → *Billing* : ajoute quelques dollars de crédit. Puis *API Keys* → *Create Key* (nom `lugh`) et copie la clé.
2. Render → *Environment* → ajoute `ANTHROPIC_API_KEY` avec la clé comme valeur → *Save Changes*.
3. Contrôle : **Administration générale → Service** doit afficher « Clé API Claude : configurée ». Chaque jeu peut couper sa vérification automatique dans ses Réglages.

### 6. Facultatif : notifications Discord (un salon par jeu)
Avec le bot Discord de la structure (section 8), **rien à faire** : il crée le salon et branche le webhook de chaque jeu tout seul. Sinon, à la main :
1. Dans Discord : paramètres du salon → *Intégrations* → *Webhooks* → *Nouveau webhook* → *Copier l'URL*.
2. Dans Lugh, dans le jeu : **Gestion du jeu → Notifications Discord** → colle l'adresse → choisis les événements → *Enregistrer* → *Envoyer un test*.

L'adresse reste secrète : elle n'est jamais réaffichée ni envoyée aux navigateurs. Aucune mention @everyone n'est possible.

### 7. Facultatif : un nom de domaine à toi
Render → *Settings* → *Custom Domains*. Ajoute aussi la variable `LUGH_ORIGINE` avec l'adresse complète (ex. `https://lugh.mondomaine.fr`), sinon les enregistrements sont refusés.

### 8. Facultatif : le bot Discord de la structure
Rôles Discord synchronisés avec les métiers de Lugh, rappels avant les séances et les matchs, commandes `/planning`, `/match`, `/absent`, `/lier`, et **sauvegarde de tous les jeux chaque semaine sur le Raspberry Pi** (Atlas gratuit n'en fait aucune). Le bot tourne sur le Raspberry Pi ; il est livré à part (zip `lugh-bot-maj-…`, voir son README). Côté Lugh, une seule chose :
1. Sur le Pi, crée une clé : `openssl rand -hex 32` (64 caractères).
2. Render → *Environment* → ajoute `LUGH_CLE_BOT` avec cette clé → *Save Changes*. La même clé va dans le fichier `.env` du bot.
3. Contrôle : **Administration générale → Discord** affiche « Jamais vu », puis « En ligne » dès que le bot a démarré. Chacun lie ensuite son compte depuis **Mon compte → Discord**. Il obtient un code, le tape avec `/lier` sur Discord, puis confirme son pseudo Discord dans Lugh.

4. Webhooks : le bot branche lui-même le webhook de chaque jeu et celui des annonces là où Lugh n'en a pas (il ne remplace jamais une adresse collée à la main, et ne rebranche pas un webhook que tu as retiré). Chaque nouvelle annonce part alors aussi dans #annonces (case décochable ; une annonce importante y mentionne @everyone).

5. **Nouveau jeu** : active-le dans **Administration générale → Jeux**. À sa synchronisation suivante (ou tout de suite avec `/synchro` sur Discord), le bot crée son rôle, sa catégorie `🎮 NOM DU JEU`, ses salons et son webhook, et met à jour #bienvenue. L'onglet **Discord → Jeux sur Discord** montre où en est chaque jeu. Le bot ne supprime jamais rien : un jeu désactivé garde ses salons, à archiver à la main si tu veux. Évite de renommer un jeu dans Lugh une fois installé : le bot créerait un rôle et une catégorie au nouveau nom.

Le bot interroge Lugh toutes les 3 h : l'appli gratuite se réveille environ 8 fois par jour, soit à peu près 90 h par mois sur les 750 h gratuites que Render partage entre tes services.

### 9. Facultatif : Lugh comme une appli
- Android (Chrome) : menu ⋮ → *Installer l'application*.
- iPhone (Safari) : *Partager* → *Sur l'écran d'accueil*.
- Ordinateur : icône d'installation dans la barre d'adresse, ou **Mon compte** → *Installer l'appli*.

---

## Accès et métiers

| Qui | Peut faire |
|---|---|
| Administrateur général | tout, dans tous les jeux, plus les jeux, tous les comptes, la vue d'ensemble, les annonces et la sécurité |
| Responsable du jeu | tout dans son jeu : comptes du jeu, Réglages du jeu, Discord, sauvegarde et restauration. Il ne peut pas reprendre un compte qui a aussi accès à un jeu qu'il ne gère pas. |
| Head coach | profil d'équipe, roster, maps et compos, stratbook, planning, présences et comptes rendus, objectifs et chiffres de tous, scrims et partenaires, tournois, VOD, adversaires, méta, recrutement, dispos de tous |
| Coach adjoint | comme le head coach, sauf le profil d'équipe, le roster, la méta et les décisions de recrutement (il donne son avis) |
| Analyste | stratbook, scrims et partenaires, VOD, adversaires, bibliothèque ; avis sur les candidats |
| Capitaine / IGL | maps et compos, stratbook, scrims et partenaires, tournois, VOD, présences et comptes rendus, adversaires, bibliothèque, ses chiffres ; avis sur les candidats |
| Joueur, Remplaçant | ses dispos, ses absences, ses chiffres, ses notes de VOD, son auto-évaluation, la bibliothèque |
| Invité | lecture seule |

Le recrutement (candidats et avis) n'est visible que des métiers qui donnent leur avis.

---

## Double authentification : si quelqu'un perd son téléphone

1. **Il a ses codes de secours** : il tape un code de secours à la place du code de l'application. Ensuite : *Mon compte → Renouveler les codes*, ou désactiver puis réactiver la double authentification avec le nouveau téléphone.
2. **Il n'a plus ses codes** : l'Administrateur général ouvre *Administration générale → Comptes → (le compte) → Réinitialiser la double authentification*. La personne se reconnecte avec son seul mot de passe et réactive.
3. **C'est l'Administrateur général, sans codes de secours** : Render → *Environment* → ajoute `LUGH_REINITIALISER_2FA` avec son identifiant comme valeur → *Save Changes* (le service redémarre). Il se reconnecte avec son mot de passe, réactive la double authentification, puis **supprime aussitôt `LUGH_REINITIALISER_2FA`**. Tant que la variable existe, l'administration affiche un avertissement.

---

## Méta : automatique ou manuelle, jeu par jeu

- **Avec la clé API** : à la première visite d'un jeu après le lundi et le jeudi 7 h 45 (Paris), Claude vérifie le patch, les maps, les personnages, l'équilibrage et les compos pro sur les sources du jeu, notes de patch officielles d'abord. Trois essais au plus par créneau. Un jeu que personne n'ouvre ne coûte rien.
- **Sans clé** : page **Méta** du jeu → *Copier la consigne* → conversation claude.ai avec la recherche web activée → copie toute la réponse → colle-la → *Importer*.
- La réponse est contrôlée champ par champ. Si elle est incomplète ou plus ancienne, **rien n'est remplacé**. La méta ne touche jamais au travail de l'équipe : elle crée des **suggestions**.

---

## Sauvegarde et restauration (par jeu)

**Gestion du jeu → Sauvegarde** :
- **Exporter** télécharge un fichier JSON du jeu, sans mot de passe ni webhook. Fais-le une fois par mois.
- **Sauvegarde automatique** (avec le bot Discord) : chaque semaine, l'export de chaque jeu est copié sur le Raspberry Pi (8 semaines gardées). Pour en récupérer une sur ton PC : `scp aulit@192.168.1.26:~/lugh-bot/data/sauvegardes/AAAA-MM-JJ/valorant.json .` (le dossier le plus récent : `ssh aulit@192.168.1.26 ls ~/lugh-bot/data/sauvegardes`), puis *Restaurer* comme ci-dessous.
- **Restaurer** n'accepte qu'une sauvegarde du même jeu, après avoir tapé `RESTAURER`. Les comptes, la méta et Discord ne bougent pas.
- **Avant chaque restauration, l'état actuel du jeu est gardé automatiquement.** *Annuler la dernière restauration* le remet en place. Il n'y a qu'un seul point, gardé jusqu'à la restauration suivante.

---

## Mise à jour du code

Dézippe le nouveau zip, toujours complet. Dépose son contenu dans le dépôt en trois envois, comme à l'installation : contenu de `envoi-1`, puis de `envoi-2`, puis de `envoi-3`, toujours à la racine. Render redéploie tout seul. Les données ne bougent pas, elles sont dans Atlas.

---

## Tester sur ton PC (facultatif)

Avec Node.js 22 ou plus récent : `npm install`, `npm test`, `npm run simulation`, puis http://localhost:3000. La base est en mémoire, avec des données de démonstration : Valorant très rempli et League of Legends.

| Identifiant | Mot de passe | Accès |
|---|---|---|
| `admin` | `simulation-lugh-2026` | Administrateur général |
| `coach` | `tactique-2026` | Head coach Valorant |
| `vesper` | `stratbook-26` | Capitaine + joueur Valorant |
| `kairo` | `entrainement-26` | Joueur Valorant |
| `lune` | `responsable-26` | Responsable + joueur League of Legends |
| `mistral` | `deux-jeux-26` | Joueur Valorant + remplaçant League of Legends |

Vrai serveur sur ton PC : copie `.env.example` en `.env`, remplis-le, puis `npm run local`. Sous Windows, vérifie que le fichier ne s'est pas enregistré en `.env.txt`.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| La page met une minute à s'ouvrir | Render gratuit dormait | normal : l'écran d'ouverture s'affiche pendant le réveil |
| « Connexion à MongoDB impossible » dans les journaux | mot de passe ou accès réseau Atlas | vérifie `MONGODB_URI`, et `0.0.0.0/0` dans *Network Access* |
| Un jeu ne s'active pas (« not authorized ») | utilisateur Atlas limité à une seule base | rôle *Read and write to any database* dans *Database Access* |
| « LUGH_ADMIN_MDP refusé » | moins de 10 caractères, ou contient l'identifiant | change la valeur dans *Environment* |
| Impossible de se connecter avec `LUGH_ADMIN_ID` | la base contenait déjà des comptes | `LUGH_ADMIN_*` ne sert qu'à la toute première fois |
| Code de double authentification refusé | heure du téléphone décalée, ou code déjà utilisé | règle l'heure automatique du téléphone, attends le code suivant ; sinon, code de secours |
| Une personne ne voit pas un jeu | pas d'accès à ce jeu, ou jeu désactivé | Administration générale → Comptes ou Jeux |
| « Méta refusée » à l'import | réponse incomplète ou patch plus ancien | redemande le JSON complet à Claude et recolle toute la réponse |
| Mot de passe oublié | — | Responsable du jeu ou Administrateur général → *Nouveau mot de passe* |
