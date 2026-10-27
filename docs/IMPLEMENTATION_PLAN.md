# Lugh — plan de mise en œuvre

Rédigé le 28/10/2026 d'après `A_FAIRE.md` (qui reste la référence à jour).

## 1. État actuel

- **Version 2.8.1 en ligne** sur Render (`lugh-esport.onrender.com`), MongoDB Atlas, bot Discord sur le Raspberry Pi, déployés le 19/10 et mis à jour depuis.
- Multi-jeux complet (10 modèles + « Autre jeu »), administration générale, administratif de l'association, double authentification chiffrée, sauvegardes et reprise après sinistre.
- **Stats Valorant** : prototype prêt, masqué tant que la clé de production Riot manque.
- **Conformité** : mentions légales, confidentialité (dont la liste exacte de ce que garde le navigateur, 28/10), conditions d'utilisation (28/10), suppression de son compte.
- **Tests** : 240, GitHub Actions à chaque envoi.

## 2. Prochaines étapes (ordre conseillé)

1. **Riot** : suivre `docs/DEMANDE-RIOT.md` (captures en simulation, Register Product, puis les 5 variables dans Render). Après validation : relever `LIMITES_DEFAUT` (`src/riot/client.js`), confirmer l'adresse de révocation RSO (`src/riot/rso.js`), tester une vraie liaison.
2. **Association** : la créer (Administratif → Obligations → Créer l'association), puis renseigner son RNA dans Identité.
3. **Mise en route des équipes** : créer les comptes et les Responsables, régler chaque jeu, suivre « Premiers pas ».
4. **Vérifications** : adresse retenue dans Service (`LUGH_PROXY_SAUTS`) ; rappels d'une vraie semaine et synchronisation des rôles par le bot ; points incertains des modèles (pool R6, profils publics, barèmes battle royale) à la première méta de chaque jeu.
5. **Routine** : export de chaque jeu une fois par mois ; veille légale de temps en temps (avant l'AG).
6. **Plus tard** : avant de livrer Lugh à une autre structure, suivre `OUVRIR-A-UNE-STRUCTURE.md` (conditions d'usage du nom Lugh à écrire).

## 3. Risques suivis

Voir `ARCHITECTURE.md` § 8 et `PIEGES.md` : un seul serveur, `LUGH_CLE_2FA` à ne jamais changer, limites d'Atlas gratuit (15 jeux, 512 Mo), bot avec la permission Administrateur sur Discord (risque accepté le 19/10).

## 4. Règle de livraison

`npm test` vert avant chaque envoi ; `A_FAIRE.md`, `ARCHITECTURE.md` et ces documents mis à jour avec le code.
