# Lugh — brief de design

Rédigé le 28/10/2026 d'après `public/css/tokens.css`, `shared/marque.js`, `shared/couleurs.js` et `ARCHITECTURE.md` § 5. Design final validé par Olivier le 19/10.

## 1. Esprit

**Lugh**, le dieu celte « aux mille talents » et « le brillant » : la lumière du soleil levant sur une nuit chaude. Une identité maison, sérieuse et chaleureuse, loin des codes « gamer » génériques. Devise : **« Le soleil se lève avec nous. »**

## 2. Marque

- **Écusson** : soleil levant traversé par la lance de Lugh (version simplifiée pour les petites tailles), `public/icones/marque-symbole.svg`.
- **Lettrage maison « LUGH »** n° 2 (mélange New Rocker / Metamorphous), vectorisé : `marque-mot.svg`.
- Logos hors appli (fond sombre, fond clair) : `marque/`.
- Aucun visuel officiel d'éditeur (Riot, Valve, Ubisoft, Blizzard, Epic, EA, Psyonix) ; icônes maison.

## 3. Couleurs

**Lugh est or + violet** (re-skin « Néon × Broadcast » validé par Olivier le 06/11/2026 ; c'est ce choix qui fait foi,
y compris face au tableau « Couleur dominante par outil » du Site, corrigé le 18/11). Jetons : `public/css/tokens.css`.
Thème **sombre par défaut** (violet-noir froid), thème clair « parchemin » en option, impression toujours sur fond blanc.

| Rôle (jeton) | Sombre | Clair |
|---|---|---|
| Fond `--papier` | `#0b0813` | `#f7f1e6` |
| Surface `--surface` / creux `--creux` | `#140e26` / `#1c1438` | `#fffaf1` / `#eee5d4` |
| Texte `--encre` / `--encre-2` / `--encre-3` | `#efe9f7` / `#c9bce6` / `#9a8fb8` | `#1d150c` / `#4b3f30` / `#6b5d4b` |
| Accent or `--surimpression` (dominant) | `#ffcf5a` | `#8c4f00` |
| Second accent `--violet` (filets or→violet, marqueurs, focus de la vitrine) | `#b980ff` | `#6a34c9` |
| Tracés décoratifs `--courbe` | `#c7912f` | `#a35f0d` |
| États : réussi `--foret`, info `--eau`, attention `--champ`, alerte `--brique` | `#86c96f`, `#7db8ec`, `#e6d27a`, `#f08367` | `#336b29`, `#2a6aa6`, `#d9b23c`, `#b03f26` |

Contrastes vérifiés : texte 4,5:1 au moins sur les deux thèmes, bordures fortes 3:1. Les bandeaux « régie » (connexion,
Vue d'ensemble) ont un fond toujours nuit : leur texte est fixé à `#d2c4a8` quel que soit le thème.

**Couleur de chaque jeu** : palette fermée de 14 teintes (`shared/couleurs.js`), inspirées des jeux sans les reproduire, contrastées à 4,5:1 sur les deux thèmes.

## 4. Typographie

- Titres : **Saira Condensed** (500 à 800), capitales pour h1/h2, repli Arial Narrow.
- Texte : **IBM Plex Sans** (400 à 700), repli system-ui.
- Étiquettes, méta, en-têtes de tableau (« régie ») : **IBM Plex Mono** (400, 500).
- Le nom « LUGH » n'est jamais composé en police : c'est le lettrage maison (`marque-mot.svg`, masque teinté), sur la
  connexion comme dans le rail.
- Polices hébergées dans `public/fonts/` (WOFF2, cache d'un an), licences OFL dans `licences/`.

## 5. Motifs

Rayons gravés et lance à la place d'une carte d'orientation, reliefs « topo » sur Mes jeux, courbes ambre décoratives.

## 6. Ton

- Tutoiement, phrases courtes, lisibles par un ado (des membres peuvent être mineurs).
- Vocabulaire du club : « Responsable du jeu », « Premiers pas », « Jour de match ».
- Tout en français, noms de menus en français.

## 7. Accessibilité

Contraste AA, navigation au clavier, modales `<dialog>` titrées, focus visible ; pensé pour le téléphone (Jour de match).

## 8. Vitrine publique (14/11/2026)

Même identité « Néon × Broadcast » que l'appli (06/11 : or dominant + violet, Saira Condensed / IBM Plex Sans / IBM Plex Mono), jetons de `tokens.css` uniquement, thème sombre. Feuille dédiée `public/css/vitrine.css`.
- Héros façon plateau : étiquette mono « Structure esport » (le point rouge « direct » a été retiré le 18/11 : il évoquait un live inexistant), nom en lettrage or dégradé géant, devise en italique or, rayons du soleil levant (`motif-soleil.svg`) en fond, filet or→violet.
- Bandeau « En ce moment » biseauté (même pièce que l'accueil de l'appli) pour les jeux qui recrutent.
- Cartes joueurs = habillage de diffusion : photo carrée, dégradé vers la surface, filet or→violet, pseudo condensé en capitales, rôle en mono teinté de la couleur du jeu ; sans photo, initiale sur trame diagonale de la couleur du jeu.
- Recrutement : gros chiffre or, nom du jeu dans sa couleur, bouton biseauté « Postuler · <jeu> ».
- Accessibilité : `lang="fr"`, lien d'évitement, landmarks (header, nav, main, footer), titres h1 → h2 → h3 → h4, `alt` « Photo de <pseudo> » sur chaque photo, focus violet visible, mouvement réduit respecté, pas de défilement horizontal à 390 px. Captures : `docs/apercu-vitrine/`.
- 18/11 : aucun défilement automatique (bandeaux de la connexion et de la Vue d'ensemble figés) ; un seul bouton
  primaire par zone (« Connexion » de l'en-tête de la vitrine en bouton ligne) ; compteurs à zéro et boutons sans
  destination masqués ; cibles de 24 px au moins (44 px au doigt) ; image d'aperçu `public/og-image.jpg` (1200×630,
  `scripts/generer-og.js` depuis `scripts/og/modele.html`) ; pages légales et 404 rendues par le serveur avec la feuille
  de la vitrine.
