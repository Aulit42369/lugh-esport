# Ouvrir Lugh à une autre structure (voie A : une installation par structure)

Choix validé le 23/10/2026 (revue L99, lot L) : chaque structure a **sa propre installation** (son GitHub, son Render,
son Atlas, son bot Discord). Aucune donnée d'une structure ne passe chez une autre ni chez toi.
L'autre voie (plusieurs structures hébergées par toi) demanderait une refonte complète : écartée.

Ce document est pour **toi** (celui qui livre). Le guide pour la structure, c'est le `README.md` : il est écrit pour
quelqu'un qui n'a jamais installé de site, et ne contient rien de personnel.

---

## 1. Avant de livrer à une structure

1. Vérifie qu'il n'y a aucun secret dans ce que tu livres : jamais `.env`, `data/`, `node_modules/`.
2. Lance les tests : `npm test` doit être entièrement vert.
3. Mets le numéro de version à jour (`package.json`) et note la livraison dans `A_FAIRE.md`.

## 2. Ce que tu donnes à la structure

| Élément | Comment |
|---|---|
| Le code de Lugh | zip complet rangé en trois dossiers `envoi-1`, `envoi-2`, `envoi-3` (100 fichiers au plus par envoi GitHub), comme pour ta propre installation |
| Le bot Discord (facultatif) | zip `lugh-bot-maj-AAAA-MM-JJ.zip` du dossier `lugh-bot` (sans `data/` ni `.env`) et son README |
| Le guide | le `README.md` de Lugh (installation en 30 minutes) et celui du bot |
| Ce qu'il faut créer de leur côté | un compte GitHub (dépôt **privé**), Render, MongoDB Atlas, et pour le bot : une application Discord à eux et une machine allumée en permanence (Raspberry Pi ou autre) |

Chaque structure crée **ses propres** secrets : `MONGODB_URI`, `LUGH_ADMIN_ID` / `LUGH_ADMIN_MDP`, `LUGH_CLE_BOT`,
`LUGH_CLE_2FA`, éventuellement `ANTHROPIC_API_KEY` (leur clé, leur facture). Ne leur donne jamais les tiens.

## 3. Mises à jour

1. Tu fais évoluer Lugh ici, comme d'habitude.
2. Pour chaque structure : envoie le dossier `Lugh-<version>-a-envoyer` (seulement les fichiers changés) avec la ligne
   du `README.md` « Mise à jour du code ». Leur Render redéploie tout seul, leurs données restent dans leur Atlas.
3. Si une version demande une nouvelle variable Render (ex. `LUGH_CLE_2FA`), dis-le en tête du message de livraison.
4. Garde une liste des structures et de la version installée chez chacune (ci-dessous).

| Structure | Contact | Version installée | Bot Discord | Date |
|---|---|---|---|---|
| (exemple) | | | | |

## 4. Points à régler avec chaque structure avant de livrer

Ce sont des faits pour décider, pas un avis juridique.

- **Données personnelles** : avec la voie A, c'est la structure qui choisit ses hébergeurs et garde ses données ; elle
  est responsable de ses traitements (page « Données et confidentialité » de Lugh à compléter avec **son** identité dans
  Administratif → Identité). Toi, tu n'as accès à rien chez elle : ne demande jamais ses mots de passe ni ses accès Render.
- **Mineurs** : Lugh garde seulement « mineur oui/non » et les dates d'autorisation parentale et de droit à l'image ;
  les autorisations signées restent chez la structure, hors de Lugh.
- **Nom et logo « Lugh »** : ils sont à toi. Décide si tu les prêtes (licence d'usage, gratuite ou non) et sous quelles
  conditions ; tant que rien n'est écrit, mets au moins ces conditions dans un message ou un court document signé.
- **Coûts** : tout est gratuit chez Render et Atlas avec les limites du README (15 jeux, 512 Mo) ; l'API Claude est
  facultative et payée par la structure.
- **Assistance** : précise ce que tu fais (mises à jour) et ce que tu ne fais pas (accès à leurs données, récupération
  de mots de passe : c'est leur Administrateur général, ou `LUGH_REINITIALISER_2FA` dans leur Render).

## 5. Message type à envoyer

> Bonjour,
>
> Voici Lugh, version X.Y.Z. Tout est dans le guide `README.md` : compte GitHub (dépôt privé), Render et MongoDB
> Atlas, gratuits, environ 30 minutes. Vos données restent chez vous : je n'y ai aucun accès.
> Le bot Discord est facultatif (il faut une machine allumée en permanence) : son guide est dans le zip du bot.
> Pour les mises à jour, je vous enverrai un dossier à déposer sur votre GitHub, Render s'occupe du reste.
>
> Avant de commencer : [conditions d'utilisation du nom et du logo Lugh].
