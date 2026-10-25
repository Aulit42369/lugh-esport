# Demande de clé Riot — « Lugh · Valorant team stats »

Ce document sert à obtenir une **clé de production** Riot pour la page **Stats Valorant** de Lugh.
Partie 1 : la marche à suivre pour Olivier (en français). Partie 2 : le texte à coller dans le formulaire Riot (en anglais).

Rappel des règles Riot vérifiées le 25/10/2026 :
- VALORANT n'accepte **pas** de clé personnelle : il faut une clé de **production**, obtenue en enregistrant un produit avec un prototype qui marche. Une clé = un produit.
- Chaque joueur doit **donner son accord** via **Riot Sign On (RSO)** ; Lugh l'identifie ensuite par `/riot/account/v1/accounts/me`.
- Interdit : scouting d'adversaires, calculateur de MMR/ELO, overlay en temps réel qui aide pendant une partie, données d'un joueur sans son accord, analyse de joueurs cachés. Lugh ne fait **rien** de tout ça (c'est vérifié par les tests `test/riot.test.js`).
- La clé de développement (24 h) ne doit pas servir au produit en ligne.

---

## Partie 1 — Marche à suivre (Olivier)

### 1. Préparer les captures (10 minutes, sur ton PC)
1. Dans `F:\GITHUB\lugh-esport` : `npm install` (une fois), puis `npm run simulation`. Le mode démo branche un **faux serveur Riot** (données inventées, aucun appel à Riot).
2. Ouvre http://localhost:3000 et connecte-toi avec `coach` / `tactique-2026` (comptes de démo du README).
3. Fais ces captures (fenêtre d'environ 1440 px de large, puis une au format téléphone avec les outils de développement de Chrome : *F12* → icône téléphone) :
   1. **Valorant → Performance → Stats Valorant**, carte « Relier mon compte Riot » (ce qui est partagé, ce qui ne l'est jamais, la case à cocher) ;
   2. après *Se connecter avec Riot* (la démo saute la page Riot) : **Mes parties** (tuiles KDA, ACS, victoires, forme, agents, tableau des parties) ;
   3. la fenêtre **Délier** (clic sur *Délier*, puis *Annuler*) ;
   4. onglet **Équipe** : relie aussi `vesper` / `stratbook-26` et `kairo` / `entrainement-26` dans un autre navigateur (ou une fenêtre privée), puis reviens sur `coach` → onglet *Équipe* ;
   5. **Mon compte → Données et confidentialité** (paragraphes Riot).
4. Facultatif mais apprécié par Riot : une courte vidéo (30–60 s) du même parcours (*Win + G* sous Windows).
5. Le bandeau « Démonstration : faux serveur Riot » apparaît sur les captures : c'est voulu et honnête (prototype). Ne le retouche pas.

### 2. Compte développeur Riot
1. Va sur **developer.riotgames.com** → *Login* (en haut à droite) → connecte-toi avec **ton compte Riot** (celui de Valorant, ou crée-en un dédié à la structure). Active la double authentification du compte Riot si ce n'est pas fait.
2. Accepte les conditions du portail développeur (*Terms*), lis les *Policies* (General + VALORANT).

### 3. Enregistrer le produit
1. Sur le tableau de bord : **Register Product** → choisis **Production API Key** (pas *Personal*).
2. Remplis le formulaire avec les textes anglais de la partie 2 (copier-coller champ par champ).
3. Joins les captures (et la vidéo) de l'étape 1.
4. Coche les cases demandées (respect des règles, RSO), puis *Submit*.

### 4. Ce que Riot va demander (à prévoir)
- **Un prototype qui fonctionne** : les captures/vidéo, et souvent un accès pour vérifier. Lugh est privé (tu as refusé une démo en ligne le 24/10) : si Riot demande à voir, crée un **compte Invité temporaire** dans Lugh pour leur relecteur (*Gestion du jeu → Comptes*, métier Invité, sur Valorant), puis supprime-le après la validation. C'est ton choix : on peut aussi répondre avec la vidéo seule.
- **Une politique de confidentialité** accessible : la page « Données et confidentialité » est visible **sans connexion** (lien sous le formulaire de connexion). Donne l'adresse `https://lugh-esport.onrender.com` et indique ce lien. Pense à remplir *Administratif → Identité → contact public* avec une adresse de l'association : Riot veut un contact.
- **Des précisions** par message sur le portail (délai : de quelques jours à plusieurs semaines). Réponds en anglais ; les textes de la partie 2 contiennent déjà les réponses habituelles.
- **L'adresse de retour RSO** : `https://lugh-esport.onrender.com/api/riot/retour` (exactement celle-là, en https).
- Riot peut **refuser** ou demander des changements : transmets-moi leur message tel quel.

### 5. Une fois la clé accordée : brancher Lugh (5 minutes)
Riot te donne : une **clé de production** (`RGAPI-…`) et, pour RSO, un **client ID** et un **client secret**.
1. Crée la clé de chiffrement des jetons : dans Git Bash, `openssl rand -hex 32` (64 caractères). Range-la dans ton gestionnaire de mots de passe.
2. Render → service **lugh-esport** → **Environment** → *Add Environment Variable*, cinq fois :

| Clé | Valeur |
|---|---|
| `RIOT_API_KEY` | la clé de production `RGAPI-…` |
| `RIOT_RSO_CLIENT_ID` | le client ID RSO |
| `RIOT_RSO_CLIENT_SECRET` | le client secret RSO |
| `RIOT_RSO_REDIRECT_URI` | `https://lugh-esport.onrender.com/api/riot/retour` |
| `LUGH_CLE_RIOT` | les 64 caractères de l'étape 1 (différente de `LUGH_CLE_2FA`) |

3. *Save Changes* : Render redémarre (1–2 minutes).
4. Vérifie : Valorant → Performance → **Stats Valorant** apparaît. Relie ton propre compte Riot en premier. Si la page n'apparaît pas : *Logs* de Render, ligne « Stats Valorant (Riot) inactives » = une variable manque ou est mal recopiée.
5. Ne mets **jamais** ces valeurs ailleurs que dans Render (ni GitHub, ni Discord, ni capture d'écran).
6. Après la validation : demande-moi de relever les limites de débit (`LIMITES_DEFAUT` dans `src/riot/client.js`) à celles de ta clé, et de confirmer l'adresse de révocation RSO (`src/riot/rso.js`) avec la documentation reçue.

---

## Partie 2 — Texte du formulaire « Register Product » (anglais, prêt à coller)

**Product name**
> Lugh · Valorant team stats

**Product type / Game**
> VALORANT — private team management web app (non-commercial, esport association)

**Product URL**
> https://lugh-esport.onrender.com (private, login required; privacy policy link on the login page, no login needed)

**Product description**
> Lugh is the private web app of a small French esports organization (non-profit association in creation). Each game has its own space where players and coaches organize practice: schedule, attendance, strategies, scrim results, VOD review and individual progression. It is used only by members of the organization (around 10 to 30 people), each with an account created by the staff — there is no public sign-up.
>
> We want to add a "Valorant team stats" page. A player who chooses to link their Riot account signs in with Riot Sign On and explicitly agrees to share their match history. Lugh then shows:
> - to the player: their last 20 matches (date, queue, map, agent, kills/deaths/assists, combat score / ACS, round score, win or loss), their KDA, average ACS, win rate, agents played and recent form;
> - to the team's coaching staff only: an aggregated view of the linked players of their own team (maps played and win rate per map, agents per player, recent form).
>
> Endpoints used: RSO (authorize, token, refresh, revoke), account-v1 /riot/account/v1/accounts/me (to identify the player after RSO), val-content-v1 (agent and map names, fr-FR), val-match-v1 matchlists/by-puuid and matches/{matchId}. Region: eu shard, europe account routing. Possibly val-status-v1 to show a "Riot servers down" notice.

**Who will use it**
> Members of one esports organization: players, substitutes and coaches of our Valorant team. Access is private and invitation-only (accounts are created by the organization's administrator). No public audience.

**How it helps players**
> Players review their own recent matches next to their training plan and VOD notes, without copying stats by hand. Coaches see which maps the team actually plays and wins, which agents each player is comfortable on, and recent form, to plan practice (map pool, agent pool, individual programs). It replaces manual stat entry and screenshots.

**Compliance with Riot policies**
> - Opt-in only: nothing is read for a player until they sign in with Riot Sign On and tick an explicit consent box that lists what is shared, with whom, and what is never shared. Players who have not linked are never shown, not even by name.
> - Unlink at any time: one button revokes the tokens and immediately deletes the link and all cached match data. Deleting the Lugh account does the same. If Riot rejects the refresh token (consent withdrawn on Riot's side), Lugh deletes the link and data automatically.
> - No scouting: we never store or display opponents or other players of a match. From each match we keep only the linked player's own stats and the round score of both teams.
> - No MMR/ELO calculation, no rank estimation, no hidden player analysis.
> - No real-time features: data is read after matches only (at most every 10 minutes per player), never during a game, no overlay.
> - Data minimization and retention: cached match summaries are kept 90 days at most; RSO tokens are encrypted at rest (AES-256-GCM); the API key and client secret live only in server environment variables and are never sent in URLs or to browsers.
> - Rate limits: client-side sliding-window limiter, and we honor 429 responses and the Retry-After header.
> - Non-commercial: no ads, no paid features, no data sale. Our own branding; no Riot logos or game art are used.

**Screenshots to provide** (see Part 1, step 1)
> 1. Consent screen "Link my Riot account" (what is shared / never shared, consent checkbox).
> 2. "My matches" page (player view).
> 3. Unlink confirmation.
> 4. "Team" tab (staff view, linked players only).
> 5. Privacy policy section about Riot data.
> Screenshots come from our test environment with a fake Riot server (marked "Demonstration: fake Riot server").

**RSO redirect URI**
> https://lugh-esport.onrender.com/api/riot/retour

**Contact**
> (the organization's public contact e-mail from Administratif → Identité)
