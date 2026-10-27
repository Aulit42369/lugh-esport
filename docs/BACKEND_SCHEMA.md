# Lugh — schéma du serveur

Rédigé le 28/10/2026 d'après `src/routes/` et `ARCHITECTURE.md` § 3. Le détail des champs est dans `shared/schemas*.js` (validés par le serveur).

## 1. Routes

Toute écriture exige l'en-tête `X-Lugh` et la même origine, sauf `/api/bot/` et `/api/cron/` (clé en en-tête `Authorization`).

**Sans compte** : `GET /api/sante`, `GET /api/public/structure` (nom et contact public), `GET /api/riot/retour` (retour OAuth Riot), fichiers statiques (`/`, `/shared/…`).

**Session et compte** (`/api/auth/…`, `/api/moi/…`)
- `POST connexion`, `POST deconnexion`, `GET session`, `GET moi`, `POST mdp`
- 2FA : `POST 2fa/preparer`, `2fa/activer`, `2fa/codes`, `2fa/desactiver`
- `GET /api/moi/agenda.ics`, Discord : `POST /api/moi/discord/code`, `POST …/confirmer`, `DELETE /api/moi/discord`
- `POST /api/moi/supprimer`

**Structure** : `GET /api/annonces`, `POST /api/annonces/:id/lu`.

**Espace d'un jeu** (`/api/e/:jeu/…`, accès au jeu vérifié)
- Données : `GET donnees`, `GET sync`, `GET etat`, `PUT|DELETE c/:coll/:id` (écritures génériques, révision exigée)
- Personnel : `absences`, `dispos/:semaine/:membreId`, `mesures/:membreId/:semaine`, `objectifs/:membreId/auto`, `votes/:cible`, `vod-notes`, `candidats/:id/essai`
- Organisation : `GET conflits/:semaine`, `GET journal`
- Réglages : `GET|PUT reglages-jeu`, `GET reglages`, `PUT reglages/discord`, `POST discord/test`
- Méta : `GET meta/consigne`, `POST meta/actualiser`, `POST meta/importer`, `POST suggestions/:id/traiter`
- Sauvegarde : `GET export`, `POST restaurer`, `GET restauration`, `POST restauration/annuler`
- Comptes du jeu : `GET|POST comptes`, `PUT|DELETE comptes/:id`, `POST comptes/:id/mdp`, `DELETE comptes/:id/acces`
- Mineurs : `GET autorisations`, `PUT autorisations/:membreId`
- Riot : `GET riot`, `POST riot/relier`, `GET riot/parties`, `GET riot/equipe`, `DELETE riot`

**Administration générale** (`/api/admin/…`) : `jeux` (+ `:id`, `:id/supprimer`), `comptes` (+ `mdp`, `2fa/reinitialiser`, `discord`), `annonces`, `parametres`, `structure`, `etat`, `journal`, `discord` (+ `reglages`, `annonces`, `annonces/test`), `administratif` (+ `identite`, `suivi/:cle`, `veille`, `veille/consigne`, `veille/import`, `veille/propositions/:id`, `sauvegarde`, `reprise`).

**Trésorerie** (Administrateur général ou Trésorier) : `GET /api/tresorerie`, `ecritures` (POST, PUT, DELETE), `reglages`, `cloture`, `rapprochement`, `export`.

**Bot et cron** : `POST /api/bot/synchro`, `planning`, `match`, `absence`, `lier`, `webhooks`, `sauvegarde` ; `POST /api/cron/meta`.

## 2. Stockage (MongoDB Atlas)

**Base globale `lugh`** : `comptes`, `sessions` (30 jours), `espaces` (jeux), `journal` (90 jours), `annonces`, `restaurations`, `parametres` (structure, identité, suivi, veille, comptes, Discord, bot), `ecritures` et `ecrituresHistorique` (livres des comptes), `riot` et `riotParties` (90 jours, index TTL), `autorisations` (mineurs, sans âge).

**Une base par jeu `lugh_<jeu>`** (27 collections) : `jeu` (réglages), `equipe`, `membres`, `mapsEquipe`, `strats`, `planning`, `objectifs`, `scrims`, `vods`, `vodNotes`, `dispos`, `absences`, `presences`, `mesures`, `adversaires`, `bibliotheque`, `candidats`, `votes`, `seances`, `tournois`, `partenaires`, `meta`, `metaHistorique`, `suggestions`, `reglages` (webhook, jamais synchronisé), `suppressions`, `compteurs`.

Chaque fiche porte `rev` et `maj` ; écritures partielles atomiques (`$set`) pour les fiches partagées ; cascades dans `src/domaine/collections.js`.

## 3. Navigateur

Cookie `lugh_session` ; `localStorage` : `lugh-theme`, `lugh-dernier-jeu`, `lugh-premiers-pas-masques-<jeu>` ; cache du service worker `lugh-v1`.

## 4. Sauvegardes

- Export d'un jeu : format `lugh`, version 2 (sans mots de passe ni webhook).
- Structure : format `lugh-structure`, version 2 (`_structure.json` sur le Pi), comptes sans secret.
- Point de restauration : un par jeu, dans `restaurations`.
