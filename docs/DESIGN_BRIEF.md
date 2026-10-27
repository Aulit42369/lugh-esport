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

Thème **sombre par défaut** (« nuit de Lug »), thème clair en option (« parchemin »), impression toujours sur fond blanc.

| Rôle (jeton) | Sombre | Clair |
|---|---|---|
| Fond `--papier` | `#0f0c09` | `#f7f1e6` |
| Surface `--surface` / creux `--creux` | `#17120c` / `#211a12` | `#fffaf1` / `#eee5d4` |
| Texte `--encre` / `--encre-2` / `--encre-3` | `#f6ecd9` / `#d2c4a8` / `#a8987c` | `#1d150c` / `#4b3f30` / `#6b5d4b` |
| Accent or `--surimpression` | `#ffc23d` | `#8c4f00` |
| Tracés décoratifs ambre `--courbe` | `#d3801a` | `#a35f0d` |
| États : réussi `--foret`, info `--eau`, attention `--champ`, alerte `--brique` | `#86c96f`, `#7db8ec`, `#e6d27a`, `#f08367` | `#336b29`, `#2a6aa6`, `#d9b23c`, `#b03f26` |

Contrastes vérifiés : texte 4,5:1 au moins sur les deux thèmes, bordures fortes 3:1.

**Couleur de chaque jeu** : palette fermée de 14 teintes (`shared/couleurs.js`), inspirées des jeux sans les reproduire, contrastées à 4,5:1 sur les deux thèmes.

## 4. Typographie

- Titres : **Grenze** (700, 800, 900), repli Georgia.
- Texte : **Instrument Sans** (variable, 400 à 700), repli system-ui.
- Polices hébergées dans `public/fonts/`, licences OFL dans `licences/`.

## 5. Motifs

Rayons gravés et lance à la place d'une carte d'orientation, reliefs « topo » sur Mes jeux, courbes ambre décoratives.

## 6. Ton

- Tutoiement, phrases courtes, lisibles par un ado (des membres peuvent être mineurs).
- Vocabulaire du club : « Responsable du jeu », « Premiers pas », « Jour de match ».
- Tout en français, noms de menus en français.

## 7. Accessibilité

Contraste AA, navigation au clavier, modales `<dialog>` titrées, focus visible ; pensé pour le téléphone (Jour de match).
