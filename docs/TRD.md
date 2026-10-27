# Lugh — TRD (exigences techniques)

Rédigé le 28/10/2026 à partir du code réel. Détail complet : `ARCHITECTURE.md` (modules, persistance, sécurité) et `PIEGES.md`.

## 1. Pile technique

| Couche | Choix |
|---|---|
| Serveur | Node.js **22** minimum, modules ES, HTTP natif, routeur maison (`src/http/`) |
| Dépendance | une seule : `mongodb` |
| Code commun | `shared/` (serveur + navigateur) : modèles de jeu, schémas, rôles, textes administratifs |
| Navigateur | modules ES sans framework ni dépendance (`public/js/`), CSS par jetons (`public/css/tokens.css`) |
| Appli | PWA : `manifest.webmanifest` (id `/lugh`), service worker `sw.js` (cache `lugh-v1`, jamais `/api/`) |
| Tests | `node --test` (240 tests au 28/10), serveur de simulation et faux pilote MongoDB ; GitHub Actions à chaque envoi |

## 2. Hébergement

- **Render** : Blueprint `render.yaml`, service `lugh-esport`, plan gratuit, Francfort, santé `/api/sante` (ping Atlas, 503 si muette). S'endort après 15 min ; réveil ≈ 1 min.
- **MongoDB Atlas** M0 (Europe) : base globale `lugh` + une base `lugh_<jeu>` par jeu ; 512 Mo et 500 collections → 15 jeux au plus.
- **Raspberry Pi** : bot Discord Lugh, sauvegarde hebdomadaire de chaque jeu et de la structure (8 semaines).
- Facultatif : API Claude (méta, veille légale), API Riot + RSO (Stats Valorant).

## 3. Contraintes

- **Un seul serveur** : révisions, verrous, limiteurs et file des mots de passe en mémoire.
- Disque Render effacé à chaque redéploiement : tout est dans Atlas.
- Fichiers d'environ 400 lignes au plus ; un fichier = une responsabilité.
- Identifiants figés pour toujours : id `/lugh`, caches `lugh-`, bases `lugh_<jeu>`, identifiant d'un « Autre jeu ».
- Coût de l'API plafonné (10 vérifications manuelles de méta par jeu et par mois, 5 de veille).

## 4. Sécurité

- Secrets uniquement en variables Render (`MONGODB_URI`, `LUGH_ADMIN_MDP`, `LUGH_CLE_2FA`, `LUGH_CLE_BOT`, `ANTHROPIC_API_KEY`, `LUGH_CLE_RIOT`, `RIOT_*`…), lus par `src/config.js` seul.
- Mots de passe scrypt ; session : cookie `lugh_session` `HttpOnly`, `Secure`, `SameSite=Lax`, 30 jours, empreinte SHA-256 en base.
- Double authentification TOTP + 10 codes de secours ; clés chiffrées AES-256-GCM ; exigeable pour l'Administrateur général, les Responsables et le Trésorier.
- Anti-force brute (5 échecs par identifiant → 15 min ; 20 par adresse), essais traités un par un.
- CSRF : en-tête `X-Lugh` et même origine pour toute écriture ; bot et cron par clé en en-tête, comparée en temps constant.
- Séparation des jeux : accès vérifié à chaque requête `/api/e/<jeu>/…` ; recrutement visible des seuls métiers qui votent.
- CSP stricte `'self'`, aucun HTML interprété depuis une saisie, liens `https://` seulement.
- Données minimales : pseudo, pas de nom réel, d'âge ni d'e-mail ; mineurs signalés sans âge.

## 5. Données personnelles et conformité

Textes dans `shared/administratif/` : `confidentialite.js` (dont « Ce que ton navigateur garde » : cookie `lugh_session`, `localStorage` `lugh-theme`, `lugh-dernier-jeu`, `lugh-premiers-pas-masques-<jeu>`, cache `lugh-v1`), `conditions.js`, `mentions-legales.js`. Journal 90 jours, candidatures refusées effacées après 6 mois, parties Riot 90 jours, suppression de son compte par soi-même.

## 6. Exploitation

- Déploiement : Claude publie sur GitHub, Render redéploie (réglage conseillé : « After CI Checks Pass »).
- Sauvegardes : export par jeu, sauvegarde de la structure, point de restauration automatique, reprise après sinistre.
