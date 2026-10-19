# Pièges connus

- **Disque Render effacé** à chaque redéploiement, redémarrage ou mise en veille : aucune donnée sur disque, tout est dans MongoDB Atlas.
- **Atlas refuse Render** : le plan gratuit de Render n'a pas d'adresse IP fixe, l'accès réseau `0.0.0.0/0` est obligatoire (protégé par un mot de passe fort).
- **Utilisateur Atlas** : il doit avoir le rôle *Read and write to any database* ; Lugh crée une base par jeu (`lugh_valorant`, `lugh_lol`…). Limité à une seule base, l'activation d'un jeu échoue.
- **Limite d'Atlas gratuit** : 500 collections ; chaque jeu en utilise 27 et la base générale 7, d'où 15 jeux au plus (412 collections). Désactiver un jeu ne libère rien (ses données restent).
- **Identifiant d'un « Autre jeu »** : définitif (c'est le nom de sa base). Seuls son nom et son abrégé se changent ensuite.
- **Render endormi** : les automatismes d'un jeu (semaine du lundi, méta du lundi et du jeudi) tournent à la première visite de ce jeu, pas à l'heure pile.
- **Blueprint Render** : les valeurs `sync: false` ne sont demandées qu'à la création ; ensuite elles se changent dans *Environment*.
- **`LUGH_ADMIN_ID` / `LUGH_ADMIN_MDP`** ne créent l'Administrateur général que si la collection `comptes` est vide : changer ces variables ensuite ne change rien.
- **Mot de passe contenant l'identifiant** : refusé exprès (y compris pour `LUGH_ADMIN_MDP`, le serveur ne démarre pas).
- **Compteurs anti-force brute en mémoire** : remis à zéro à chaque redémarrage. Le blocage par identifiant (5 échecs → 15 min) reste le garde-fou principal.
- **Adresse IP derrière Render** : lue dans le premier élément de `X-Forwarded-For`, falsifiable ; le blocage par identifiant ne dépend pas de l'IP.
- **Responsable et comptes partagés** : un Responsable ne peut ni réinitialiser le mot de passe, ni renommer, ni désactiver un compte qui a aussi accès à un jeu qu'il ne gère pas : c'est voulu (sinon il pourrait entrer dans l'autre jeu). L'Administrateur général le peut.
- **Réglages du jeu** : un élément venu du modèle ne se supprime pas, il se masque (les fiches qui l'utilisent restent valides). Le type de score ne change plus une fois des scrims enregistrés.
- **Deux coachs sur la même fiche** : la seconde sauvegarde est refusée (409) et la fiche est rechargée ; rien n'est écrasé en silence.
- **Méta** : une réponse invalide (patch plus ancien, liste de personnages ou de maps raccourcie, JSON illisible) est rejetée et l'ancienne méta conservée.
- **Webhook Discord supprimé côté Discord** : les envois échouent (noté au journal) ; il faut coller l'adresse d'un nouveau webhook dans la Gestion du jeu.
- **Restauration** : elle remplace les données de l'équipe de CE jeu par celles du fichier, y compris ce qui a été créé après l'export ; une sauvegarde d'un autre jeu est refusée. Toujours exporter avant de restaurer.
- **Service worker** : une ancienne copie du style peut s'afficher pendant le réveil du serveur ; le code de l'appli vient toujours du réseau quand le serveur répond.
- **Fichier agenda (.ics)** : c'est une copie de la semaine au moment du téléchargement ; si le planning change, il faut le télécharger à nouveau.
- **Visuels des éditeurs** : aucun visuel officiel (personnages, maps, logos) ; identité et icônes maison uniquement.
- **`.env` sous Windows** : l'Explorateur peut l'enregistrer en `.env.txt`.
- **Glisser-déposer GitHub** : 100 fichiers au plus par envoi : `public` (99), puis `src` + `shared` (90), puis le reste. Déposer le *contenu* du dossier `Lugh-2.0.0`, pas le dossier lui-même (`package.json` et `render.yaml` doivent être à la racine).
- **Double authentification** : l'heure du téléphone doit être automatique (un code se calcule sur l'heure ; 30 secondes de décalage sont tolérées). Un code ne sert qu'une fois ; un code de secours aussi. Sans téléphone ni codes de secours : l'Administrateur général réinitialise le compte ; pour lui-même, variable `LUGH_REINITIALISER_2FA` (à retirer juste après).
- **Exiger la double authentification** : impossible tant que l'Administrateur général ne l'a pas activée sur son propre compte (sinon il se bloquerait).
- **Point de restauration** : un seul par jeu, l'état juste avant la dernière restauration. Il est gardé dans la base générale et compte dans les 512 Mo d'Atlas.
- **Agenda `.ics` de « Mon compte »** : c'est un téléchargement, pas un abonnement (un abonnement demanderait un jeton secret dans l'adresse). Le retélécharger après un changement de planning.
- **Conflits d'agenda entre jeux** : seules les personnes reliées à une fiche de membre dans chaque jeu sont comparées. L'autre séance n'est montrée que par son jeu et son horaire, jamais son contenu.
- **Charge d'entraînement** : calculée sur le planning (heures planifiées et jours sans séance), pas sur le temps réellement joué. Les seuils se règlent dans les Réglages du jeu.
- **Fiches de compte réécrites en entier** (visites, dernière connexion, double authentification) : deux modifications du même compte à la même seconde, la dernière gagne. Sans conséquence avec une petite structure ; à revoir si Lugh s'ouvre à beaucoup d'utilisateurs.
- **Base générale non sauvegardée par l'appli** : l'export se fait jeu par jeu (avec la liste des comptes du jeu). Les comptes, annonces et paramètres de la structure ne sont pas exportés (ils contiennent des secrets). En cas de perte d'Atlas : recréer les comptes, puis restaurer chaque jeu.
- **Nom de domaine personnel** : il faut alors renseigner `LUGH_ORIGINE` (ex. `https://lugh.mondomaine.fr`) dans Render, sinon toutes les écritures sont refusées (protection CSRF). Inutile avec l'adresse `onrender.com`.
- **Blocage d'un identifiant par un tiers** : quelqu'un qui connaît un identifiant peut le bloquer 15 minutes en se trompant 5 fois. C'est le prix de l'anti-force brute ; l'identifiant de l'Administrateur général n'a pas à être public.
- **Espace Atlas** : la taille utilisée s'affiche dans Administration générale → Service (alerte à 400 Mo sur 512). Les points de restauration y comptent.
- **Restauration interrompue** (redéploiement en plein milieu) : la Gestion du jeu le signale ; relancer la restauration ou l'annuler.
- **Une seule restauration à la fois par jeu** : une seconde demande pendant la première est refusée.

## Bot Discord (19/10)

| Piège | Pourquoi | Ce qu'il faut faire |
|---|---|---|
| Synchroniser le bot souvent (chaque minute) | l'appli Render gratuite ne dort plus : 744 h par mois, le quota de 750 h est partagé avec les autres services | 3 h par défaut (`SYNCHRO_HEURES` côté bot) |
| `/api/bot/` passé par le contrôle `X-Lugh` | le bot n'a pas de cookie ni de navigateur | exempté dans `app.js`, comme `/api/cron/` ; la clé `Authorization` est la seule protection : jamais dans une URL |
| Rappel calculé en heure du serveur | Render est en UTC, le planning est en heure de Paris | `instantCivil` (domaine/bot.js) convertit, heure d'été comprise (testé le 25/10) |
| Compte supprimé ou délié : rôles Discord restants | le bot ne voit plus ce compte dans la liste | `noterDelie` garde l'identifiant Discord 14 jours dans `parametres/discord-bot.delies` ; le bot retire les rôles Lugh |
| Plus de 100 fichiers dans `public` | GitHub web refuse l'envoi | zip rangé en `envoi-1` (public sans vues + shared), `envoi-2` (src, test, racine), `envoi-3` (public/js/vues) |
