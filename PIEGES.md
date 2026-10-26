# Pièges connus

- **Disque Render effacé** à chaque redéploiement, redémarrage ou mise en veille : aucune donnée sur disque, tout est dans MongoDB Atlas.
- **Atlas refuse Render** : le plan gratuit de Render n'a pas d'adresse IP fixe, l'accès réseau `0.0.0.0/0` est obligatoire (protégé par un mot de passe fort).
- **Utilisateur Atlas** : il doit avoir le rôle *Read and write to any database* ; Lugh crée une base par jeu (`lugh_valorant`, `lugh_lol`…). Limité à une seule base, l'activation d'un jeu échoue.
- **Limite d'Atlas gratuit** : 500 collections ; chaque jeu en utilise 27 et la base générale 10 (dont `ecrituresHistorique`, `riot`, `riotParties`), d'où 15 jeux au plus (415 collections). Désactiver un jeu ne libère rien (ses données restent).
- **Identifiant d'un « Autre jeu »** : définitif (c'est le nom de sa base). Seuls son nom et son abrégé se changent ensuite.
- **Render endormi** : les automatismes d'un jeu (semaine du lundi, méta du lundi et du jeudi) tournent à la première visite de ce jeu, pas à l'heure pile.
- **Blueprint Render** : les valeurs `sync: false` ne sont demandées qu'à la création ; ensuite elles se changent dans *Environment*.
- **`LUGH_ADMIN_ID` / `LUGH_ADMIN_MDP`** ne créent l'Administrateur général que si la collection `comptes` est vide : changer ces variables ensuite ne change rien.
- **Mot de passe contenant l'identifiant** : refusé exprès (y compris pour `LUGH_ADMIN_MDP`, le serveur ne démarre pas).
- **Pas d'index TTL sur une collection synchronisée** (`candidats`…) : Atlas effacerait la fiche sans trace dans `suppressions`, les navigateurs la garderaient. Les candidatures refusées passent donc par `depot.supprimer` dans les automatismes (à la première visite du jeu, comme la semaine type).
- **Compteurs anti-force brute en mémoire** : remis à zéro à chaque redémarrage. Le blocage par identifiant (5 échecs → 15 min) reste le garde-fou principal.
- **Adresse IP derrière Render** : Lugh prend le dernier élément de `X-Forwarded-For` (celui qu'ajoute le proxy de Render ; `LUGH_PROXY_SAUTS`, 1 par défaut, = nombre de proxys de confiance en partant de la droite). Le début de la liste est falsifiable par le client. À vérifier dans Administration générale → Service : « Adresse retenue » doit être « publique » (sinon appliquer la « Valeur conseillée » de `LUGH_PROXY_SAUTS`, calculée comme la position de la première adresse publique en partant de la droite) ; si elle est interne, tous les visiteurs partagent le même compteur (20 échecs bloquent tout le monde 15 min, limite de débit commune). Le blocage par identifiant ne dépend pas de l'IP. Depuis le 23/10, Service affiche un avertissement si l'en-tête manque, est plus court que `LUGH_PROXY_SAUTS` ou si l'adresse retenue est interne (10.x, 172.16-31.x, 192.168.x, 100.64-127.x) : c'est un indice, pas une preuve. Depuis le 24/10, Service n'affiche plus aucune adresse IP (seulement « publique » ou « interne »), à la demande d'Olivier.
- **Responsable et comptes partagés** : un Responsable ne peut ni réinitialiser le mot de passe, ni renommer, ni désactiver un compte qui a aussi accès à un jeu qu'il ne gère pas : c'est voulu (sinon il pourrait entrer dans l'autre jeu). L'Administrateur général le peut. De même, « Compte existant » est refusé (403) à un Responsable pour un compte qui n'a accès à aucun jeu (ancien membre, compte désactivé) : sinon il en deviendrait le seul gestionnaire. L'Administrateur général lui redonne l'accès.
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
- **Écritures simultanées sur un compte** : depuis le 23/10, toutes les routes qui modifient un compte (admin, Responsable, « Mon compte » : mot de passe, double authentification, liaison Discord) écrivent seulement les champs changés (`modifierCompte`) et lisent le corps de la requête avant la fiche : une requête lente n'annule plus une désactivation, un nouveau mot de passe ou une suppression. Deux modifications du MÊME champ à la même seconde : la dernière gagne. Un champ effacé vaut maintenant `null` (et non plus absent) : tester `if (!compte.discord)`, jamais `=== undefined`. Nouvelle route sur un compte : `modifierCompte`, jamais `lire` + `ecrire`, et `await r.corps()` avant de lire la fiche.
- **Nouvelle écriture serveur sur une fiche partagée** (compte, annonce) : utiliser `global.modifier(coll, id, { 'champ.sous': valeur })`, jamais `lire` + `ecrire` de toute la fiche. Les clés de chemin ne contiennent ni « . » ni « $ ». Un vrai MongoDB refuse un `$set` sous un champ qui vaut `null` (fiche écrite à la main) : corriger la fiche.
- **Base générale : reprise qui ne remplit que le vide** : la sauvegarde de la structure (`_structure.json`) contient jeux, comptes sans secret, annonces, livres (et leur historique, gardé dans le fichier mais pas réimporté), autorisations et documents de la structure, mais ni mots de passe, ni double authentification, ni liaisons Discord, ni webhooks, ni réglages du bot. Après une perte d'Atlas : Administration → Administratif → Identité → « Reprise après sinistre », transmettre les mots de passe temporaires (montrés une seule fois), puis restaurer chaque jeu avec sa sauvegarde, réactiver la double authentification, relier Discord et refaire les réglages du bot. Un livre des comptes déjà commencé n'est jamais complété : vider la collection avant, ou ressaisir.
- **`LUGH_CLE_2FA` changée ou retirée** : les clés de double authentification déjà chiffrées deviennent illisibles et ces comptes ne peuvent plus se connecter (message clair, avertissement dans Service). Remettre la valeur d'origine ; sinon l'Administrateur général réinitialise la 2FA de chaque compte (pour lui-même : `LUGH_REINITIALISER_2FA`). Garder la valeur dans un gestionnaire de mots de passe.
- **Retour arrière avant la 2.7.0** : une fois `LUGH_CLE_2FA` posée et les clés chiffrées, ne JAMAIS revenir à une version 2.6.x (Rollback Render) : l'ancien code lit `v1:…` comme une clé TOTP, tous les codes sont refusés et les comptes se bloquent. Pendant le redéploiement qui suit la pose de la clé, l'ancienne instance répond 503 quelques instants aux connexions 2FA déjà converties : attendre « Live ».
- **Historique du livre après une reprise** : `ecrituresHistorique` est dans `_structure.json` mais n'est pas réimporté par la reprise ; garder le fichier du Pi comme trace. Une écriture refusée par la validation (catégorie changée depuis) est écartée : comparer le nombre d'écritures de l'aperçu avec le livre attendu avant de confirmer.
- **`LUGH_REINITIALISER_2FA`** : une fois par pose. Tant qu'elle reste posée, les redémarrages ne refont rien ; retirée, la note est effacée au démarrage suivant, et une nouvelle pose resert. (Avant le 23/10, `parametres.ecrire` effaçait cette note en réécrivant tout le document `structure` : il fusionne maintenant.)
- **Restaurer par appel direct** : le serveur exige `confirmation: "RESTAURER"` (et `"ANNULER"` pour annuler). Un outil ou un script doit l'envoyer.
- **Rôles Discord après un retrait** : ils restent jusqu'à la synchro suivante du bot (3 h). Taper /synchro tout de suite ; Lugh le rappelle.
- **Plafond des vérifications à la main** : 10 par mois et par jeu pour la méta, 5 pour la veille (`PLAFONDS_MANUELS` dans `config.js`) ; les échecs comptent ; au-delà, réponse 429, l'import manuel reste possible.
- **Un seul serveur** : révisions, verrous, limiteurs et file des mots de passe sont en mémoire ; ne jamais passer le service Render à deux instances.
- **Nom de domaine personnel** : il faut alors renseigner `LUGH_ORIGINE` (ex. `https://lugh.mondomaine.fr`) dans Render, sinon toutes les écritures sont refusées (protection CSRF). Inutile avec l'adresse `onrender.com`.
- **Blocage d'un identifiant par un tiers** : quelqu'un qui connaît un identifiant peut le bloquer 15 minutes en se trompant 5 fois. C'est le prix de l'anti-force brute ; l'identifiant de l'Administrateur général n'a pas à être public.
- **Espace Atlas** : la taille utilisée s'affiche dans Administration générale → Service (alerte à 400 Mo sur 512). Les points de restauration y comptent.
- **Restauration interrompue** (redéploiement en plein milieu) : la Gestion du jeu le signale ; relancer la restauration ou l'annuler.
- **Une seule restauration à la fois par jeu** : une seconde demande pendant la première est refusée.
- **Nouvelle collection restaurable** : lui donner un plafond dans `QUOTAS` (`collections.js`), sinon toute restauration est refusée (400). Un identifiant en double dans un fichier : seule la dernière fiche compte.
- **« avis ou notes de VOD au nom d'autres comptes » au journal après une restauration** : le fichier contenait des avis de recrutement ou des notes de VOD d'autres personnes, absents ou différents de l'état actuel. Normal après une perte de données ; sinon, le fichier a été modifié à la main : annuler la restauration (Gestion du jeu → Sauvegarde).
- **Connexions simultanées sur un même identifiant** : elles passent une par une (une fraction de seconde chacune). Une rafale de mauvais mots de passe bloque l'identifiant dès le 5e échec ; les suivantes reçoivent 429.
- **Méta sur Discord** : les caractères `* _ ~ | > [ ] ( ) # <` et la barre oblique inverse du patch, de la saison et des noms sont échappés ; Discord les affiche tels quels, sans mise en forme.

## Bot Discord (19/10)

- **Nom de jeu = nom d'un rôle de fonction** (Administrateur, Responsable…) : refusé par Lugh depuis la 2.7.1 (`estNomJeuReserve`, shared/referentiel.js). La liste doit suivre les rôles de `lugh-bot/src/structure.js` si l'un d'eux change.
- **Deux jeux au même nom ou au même nom court** : refusé par Lugh depuis le 23/10 (`nomJeuDejaPris`, shared/referentiel.js ; casse, accents et espaces ignorés, jeux désactivés compris), à la création, au renommage et dans les Réglages du jeu. Le bot nomme le rôle d'après le nom et la catégorie d'après le nom court : un doublon y serait seulement bloqué et signalé. Un « Autre jeu » dont les 4 lettres du nom court sont prises reçoit un nom court plus long (jusqu'à 12).


| Piège | Pourquoi | Ce qu'il faut faire |
|---|---|---|
| Synchroniser le bot souvent (chaque minute) | l'appli Render gratuite ne dort plus : 744 h par mois, le quota de 750 h est partagé avec les autres services | 3 h par défaut (`SYNCHRO_HEURES` côté bot) |
| `/api/bot/` passé par le contrôle `X-Lugh` | le bot n'a pas de cookie ni de navigateur | exempté dans `app.js`, comme `/api/cron/` ; la clé `Authorization` est la seule protection : jamais dans une URL |
| Rappel calculé en heure du serveur | Render est en UTC, le planning est en heure de Paris | `instantCivil` (shared/temps.js, source unique, aussi utilisée pour les créneaux de la méta avec `config.fuseau`) convertit, heure d'été comprise (testé le 25/10) |
| Compte supprimé ou délié : rôles Discord restants | le bot ne voit plus ce compte dans la liste | `noterDelie` garde l'identifiant Discord 14 jours dans `parametres/discord-bot.delies` ; le bot retire les rôles Lugh |
| Plus de 100 fichiers dans un envoi | GitHub web refuse l'envoi | Claude publie directement par git ; pour un zip, ranger en `envoi-1`, `envoi-2`… à recompter (`src` + `shared` dépasse 100 depuis le 23/10) |
| Jeu désactivé jamais sauvegardé | la synchro ne renvoyait que les jeux actifs | `sauvegardes` dans la synchro (tous les jeux) ; un fichier en échec est refait à la synchro suivante ; alerte au-delà de 8 jours |
| Le bot rebranche un webhook retiré exprès | « manquant » ne distinguait pas « jamais posé » de « retiré » | `retire: true` posé par Retirer, effacé quand on colle une adresse ; la synchro n'annonce comme manquants que les webhooks jamais posés |
| Jeu renommé dans Lugh après son installation sur Discord | le bot nomme rôle et catégorie d'après le nom du jeu | il en crée de nouveaux au nouveau nom ; renommer à la main l'ancien rôle et l'ancienne catégorie sur Discord, ou ne pas renommer le jeu |
| Suppression d'un jeu : `dropDatabase` refusé par Atlas | l'utilisateur « lecture et écriture » n'a pas ce droit | `supprimerBase` supprime chaque collection ; la base vide disparaît seule |
| Annonce qui ne visait qu'un jeu supprimé | une liste de jeux vide veut dire « tous les jeux » | l'annonce est supprimée avec le jeu |
| Jeu désactivé ouvert par l'Administrateur général (export, suppression) | chaque visite d'un jeu déclenche ses automatismes | `exigerEspace` ne les lance que pour un jeu actif : pas de méta payante pour un jeu désactivé |


## Administratif (19/10)

| Piège | Pourquoi | Ce qu'il faut faire |
|---|---|---|
| Une vue renvoie une promesse | le routeur appelle la valeur renvoyée comme fonction de nettoyage : l'affichage suivant plante | les vues renvoient `null` ; le chargement se fait dans `.then` sans `return` |
| `replaceChildren(null)` | le navigateur affiche le texte « null » | filtrer les enfants (`.filter(Boolean)`) ou passer un tableau vide |
| Montants en euros à virgule | erreurs d'arrondi (0,1 + 0,2) | tout en centimes entiers ; `lireMontant` à la saisie, `euros` à l'affichage |
| Export tableur avec un libellé « =… » | Excel exécute une formule | `csvEcritures` préfixe d'une apostrophe les cellules qui commencent par = + - @ |
| Veille légale qui « invente » | une IA peut citer une source non officielle ou une règle imaginaire | sources https d'une liste fermée, propositions à accepter une par une, la source à lire avant |
| Nouveau rôle sensible (Trésorier) | les contrôles « gérable par un Responsable » ne regardaient que les jeux du compte : un Responsable pouvait réinitialiser le mot de passe du trésorier | tout rôle de structure (admin, trésorier) est exclu de `gerable()`, du parcours « compte existant » et inclus dans `soumisA2fa` |
| Formulaire qui remplace tout un document | « Enregistrer » l'identité (ou un ancien onglet) écrasait la forme juridique | le serveur fusionne l'envoi avec l'identité enregistrée ; un champ absent ne change pas |
| Seuil chiffré dans un texte et dans le code | la veille peut mettre à jour le texte de « gestion.impots », pas la constante de l'indicateur | si la veille fait accepter un nouveau seuil de franchise, changer aussi `SEUILS` dans `obligations.js` |
| Un an avant le 29 février | `setUTCFullYear` donne le 1er mars | revenir au dernier jour du mois quand le mois a changé |
| Livre choisi dans la requête | modifier une écriture avec `?livre=association` aurait pu la déplacer d'un livre à l'autre | le livre se lit sur l'écriture enregistrée |
| Données hors jeux | les sauvegardes du Pi ne prenaient que les jeux : livre des comptes et autorisations n'avaient aucune copie | `_structure` dans la sauvegarde du bot, et téléchargement dans Administratif → Identité |
| Écriture modifiée ou supprimée sans trace | `PUT`/`DELETE` remplaçaient l'écriture | ancienne version gardée dans `ecrituresHistorique` avant chaque changement, jamais effacée par Lugh (6 ans au moins, 10 ans pour la société) |
| `e.currentTarget` après un `await` | il vaut `null` : le bouton ne se réactive pas | le garder dans une variable avant le premier `await` |
| Identité publique | le contact s'affiche sans connexion | une adresse de l'association, jamais une adresse personnelle ; pas d'adresse postale ni de nom de dirigeant dans Lugh |
| `/api/sante` qui ne regarde pas la base | Atlas coupé, la santé répondait quand même « ok » | ping de la base, 2 s au plus, 503 sinon. C'est aussi le `healthCheckPath` de Render : Atlas coupé, Render voit le service malade (redéploiement non promu, redémarrage possible) ; c'est voulu, sans base le service ne sert à rien |


## Stats Valorant / API Riot (25/10)

| Piège | Pourquoi | Ce qu'il faut faire |
|---|---|---|
| Utiliser une clé de développement Riot en ligne | elle expire toutes les 24 h et Riot l'interdit pour un produit | seulement la clé de **production** (`docs/DEMANDE-RIOT.md`) ; sans elle, la page reste masquée |
| Une des 5 variables Riot oubliée ou mal recopiée | la fonction reste inactive (exprès, rien ne plante) | *Logs* Render : « Stats Valorant (Riot) inactives » ou « RIOT_RSO_REDIRECT_URI invalide » |
| Adresse de retour différente de celle déclarée chez Riot | RSO refuse la connexion | exactement `https://lugh-esport.onrender.com/api/riot/retour` des deux côtés ; un nom de domaine à toi oblige à changer les deux |
| `LUGH_CLE_RIOT` changée | les jetons chiffrés deviennent illisibles | chaque joueur clique *Délier* puis relie son compte ; rien d'autre n'est touché |
| Retour RSO sans session | le cookie `SameSite=Lax` n'est envoyé que sur une navigation normale | le retour passe par une redirection classique (jamais une iframe ni une fenêtre surgissante) ; sans session, retour à l'accueil |
| Ajouter une donnée « pour le scouting » (adversaires, rang, MMR, temps réel) | interdit par Riot : la clé serait retirée | ne jamais stocker les autres joueurs d'une partie (`resumerPartie` ne garde que le joueur relié) ; les tests le vérifient |
| Limites de débit | `LIMITES_DEFAUT` = celles d'une clé de développement (20/s, 100/2 min) | les relever avec celles de la clé de production ; un 429 met tout en pause pendant Retry-After (au-delà de 10 s, la page affiche les parties déjà gardées et un avertissement) |
| Adresse de révocation RSO | non publique avant l'accord de Riot ; `/token/revoke` supposée | à confirmer avec la documentation RSO ; un échec de révocation n'empêche jamais la suppression chez nous |
| Synchro « figée » | une synchro par joueur toutes les 10 minutes au plus (« Actualiser » force) | normal ; « Actualiser » ramène l’écart à 1 minute ; Riot met aussi quelques minutes à publier une partie |
| Démo en production | `LUGH_RIOT_DEMO` n'est lu qu'en mode simulation | ne pas chercher à l'activer sur Render |
