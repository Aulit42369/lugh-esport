# Lugh — parcours écran par écran

Rédigé le 28/10/2026 d'après `public/js/vues/` et `ARCHITECTURE.md`. Adresses : `#/<jeu>/<page>`, `#/admin/<onglet>`, `#/compte`, `#/jeux`.

## 1. Arrivée

1. **Ouverture…** : écran d'attente pendant le réveil de Render (copie locale de la coquille par le service worker).
2. **Connexion** : écusson, lettrage LUGH, devise « Le soleil se lève avec nous. », identifiant + mot de passe, « Pas encore de compte ? Demande-le au Responsable de ton jeu », liens **Données et confidentialité · Conditions d'utilisation · Mentions légales** (fenêtres lisibles sans compte ; chacune ouvre les deux autres).
3. **Code de double authentification** (si activée) : code de l'application ou code de secours.
4. **Nouveau mot de passe** : imposé à la première connexion (mot de passe temporaire).
5. **Activer la double authentification** : imposé si l'Administrateur général l'exige pour ce compte.

## 2. Mes jeux (`#/jeux`)

Cartes des jeux auxquels on a accès (couleur du jeu, métiers), dernier jeu ouvert mis en avant, aide « Un jeu manque ? », liens légaux en pied de page. L'Administrateur général a « Gérer les jeux ».

## 3. Dans un jeu (`#/<jeu>`)

Navigation en quatre groupes, pages visibles selon le métier :
- **La semaine** : Accueil (quoi de neuf, « Premiers pas » masquable, annonces), Planning (+ comptes rendus, conflits), Présences (charge), Dispos, Jour de match.
- **Le jeu** : Maps et compos, Stratbook, Bibliothèque, Adversaires (veto ou draft), Tournois, Méta (suggestions à traiter).
- **La performance** : Scrims, Partenaires, VOD, Progression, Programme, Bilan, Stats Valorant (si les clés Riot sont posées).
- **L'équipe** : Roster (autorisations des mineurs), Recrutement, Gestion du jeu (comptes, Discord, sauvegarde et restauration), Réglages du jeu.

Une fiche modifiée ailleurs entre-temps : sauvegarde refusée et fiche rechargée. Les autres appareils se mettent à jour toutes les 20 s.

## 4. Mon compte (`#/compte`)

Nom affiché, mot de passe, double authentification (QR code, codes de secours), thème sombre ou clair, agenda `.ics`, liaison Discord (code `/lier` puis confirmation du pseudo), installation de l'appli, liens légaux, **Supprimer mon compte** (mot de passe exigé, pas pour l'Administrateur général), déconnexion.

## 5. Administration générale (`#/admin`, Administrateur général)

Vue d'ensemble de tous les jeux → onglets **Jeux** (ajouter, désactiver, supprimer), **Comptes** (métiers par jeu, Trésorier, 2FA exigée), **Annonces**, **Discord** (état du bot, jeux sur Discord), **Service** (santé, Atlas, adresse retenue, coûts), **Administratif** (Obligations et veille, Comptes, Documents, Mineurs, Identité et sauvegarde), journal.

## 6. Trésorier sans jeu

Après connexion : seulement **Comptes de la structure** (livre, réglages, rapprochement, bilan, export).

## 7. Retour Riot

`/api/riot/retour` après l'accord sur le site de Riot → retour sur la page Stats Valorant du jeu.
