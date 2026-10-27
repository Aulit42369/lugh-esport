// Écrans hors application : connexion (et son code de double authentification), choix du mot de passe à la
// première connexion, activation obligatoire de la double authentification, erreur de démarrage.
// Même seuil pour tous les jeux : la marque (MARQUE) sur le soleil levant de Lug.

import { h, vider, champ, saisie, messageErreur } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import { topo } from '../composants/topo.js';
import { champCode, activation2fa, blocCodesSecours } from './deuxfacteurs.js';
import { MARQUE } from '/shared/marque.js';
import { liensLegaux } from '../composants/confidentialite.js';

// Marque du produit : l'écusson complet en grand, le lettrage dessous (styles : identite.css).
function marque() {
  return h('div', { class: 'marque marque--grande marque--pile', role: 'img', 'aria-label': MARQUE.nom },
    h('img', { class: 'marque__symbole', src: MARQUE.symbole, alt: '', width: '128', height: '128' }),
    h('span', { class: 'marque__mot', style: { '--marque-mot': `url("${MARQUE.mot}")` } }));
}

function cadre(racine, contenu, titre, { large = false, ecran = '' } = {}) {
  document.title = `${titre} | ${MARQUE.nom}`;
  vider(racine);
  racine.append(h('main', { class: 'accueil', dataset: ecran ? { ecran } : null },
    topo({ largeur: 1600, hauteur: 1000, graine: 'accueil-lugh', colonnes: 80, niveaux: 14, bosses: 9, classe: 'topo accueil__fond' }),
    h('div', { class: ['accueil__panneau', large && 'accueil__panneau--large'] },
      h('div', { class: 'accueil__marque' },
        marque(),
        h('p', { class: 'accueil__devise' }, MARQUE.slogan),
        h('p', { class: 'accueil__sous' }, 'L’espace privé de la structure, ', h('br'), 'un espace par jeu')),
      contenu)));
}

function attenteServeur(bouton, zone) {
  const minuterie = setTimeout(() => {
    zone.textContent = 'Le serveur se réveille, cela peut prendre jusqu’à une minute.';
  }, 4000);
  bouton.setAttribute('aria-busy', 'true');
  bouton.disabled = true;
  return () => {
    clearTimeout(minuterie);
    bouton.removeAttribute('aria-busy');
    bouton.disabled = false;
  };
}

export function ecranConnexion(racine, { message = '', surConnecte }) {
  const identifiant = saisie({ name: 'identifiant', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
  const mdp = saisie({ type: 'password', name: 'mdp', autocomplete: 'current-password', required: true });
  const info = h('p', { class: 'champ__aide', role: 'status' }, message);
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const bouton = h('button', { type: 'submit', class: 'btn btn--principal' }, 'Se connecter');

  const formulaire = h('form', {
    class: 'formulaire',
    onsubmit: async (e) => {
      e.preventDefault();
      erreur.textContent = '';
      const id = identifiant.value.trim().toLowerCase();
      const fin = attenteServeur(bouton, info);
      try {
        const r = await api('POST', '/api/auth/connexion', { identifiant: id, mdp: mdp.value });
        fin();
        // Double authentification active : le mot de passe est bon, il manque le code (réponse 200, sans session).
        if (r.code2fa) return etapeCode(racine, { identifiant: id, mdp: mdp.value, surConnecte });
        surConnecte(r.compte, mdp.value);
      } catch (err) {
        fin();
        info.textContent = '';
        // Double authentification active : le mot de passe est bon, il manque le code.
        if (err.code === 'code_2fa') return etapeCode(racine, { identifiant: id, mdp: mdp.value, surConnecte });
        erreur.textContent = messageErreur(err);
        mdp.value = '';
        mdp.focus();
      }
    },
  },
  h('h1', {}, 'Connexion'),
  champ('Identifiant', identifiant),
  champ('Mot de passe', mdp),
  erreur,
  bouton,
  info,
  h('p', { class: 'champ__aide' }, 'Pas encore de compte ? ', h('span', { class: 'sans-coupure' }, 'Demande-le'), ' au Responsable de ton jeu.'),
  h('p', { class: 'champ__aide connexion__confidentialite' }, ...liensLegaux()));
  cadre(racine, formulaire, 'Connexion');
  identifiant.focus();
}

// 2e étape : le code de l'application ou un code de secours. Le mot de passe n'est gardé qu'en mémoire, le temps de
// cette étape, pour renvoyer identifiant, mot de passe et code ensemble.
function etapeCode(racine, { identifiant, mdp: mdpSaisi, surConnecte }) {
  let mdp = mdpSaisi;
  let enCours = false;
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const info = h('p', { class: 'champ__aide', role: 'status' });
  const bouton = h('button', { type: 'submit', class: 'btn btn--principal' }, 'Valider');
  const code = champCode({ surComplet: () => formulaire.requestSubmit() });
  const revenir = (message = '') => {
    mdp = '';
    ecranConnexion(racine, { message, surConnecte });
  };

  const formulaire = h('form', {
    class: 'formulaire',
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (enCours) return;
      erreur.textContent = '';
      let valeur;
      try {
        valeur = code.lire();
      } catch (err) {
        erreur.textContent = err.message;
        code.input.focus();
        return;
      }
      enCours = true;
      const fin = attenteServeur(bouton, info);
      try {
        const r = await api('POST', '/api/auth/connexion', { identifiant, mdp, code: valeur });
        fin();
        const mdpConnu = mdp;
        mdp = '';
        surConnecte(r.compte, mdpConnu);
      } catch (err) {
        fin();
        info.textContent = '';
        if (err.code === 'identifiants') return revenir('Identifiant ou mot de passe refusé : recommence la connexion.');
        erreur.textContent = err.code === 'code_2fa'
          ? (code.estSecours() ? 'Code de secours incorrect ou déjà utilisé.' : 'Code incorrect ou déjà utilisé : attends le code suivant (il change toutes les 30 secondes).')
          : messageErreur(err);
        code.vider();
        code.input.focus();
      } finally {
        enCours = false;
      }
    },
  },
  h('h1', {}, 'Double authentification'),
  h('p', { class: 'texte-2' }, `Ouvre ton application d’authentification et saisis le code affiché pour ${MARQUE.nom} (${identifiant}).`),
  code.element,
  erreur,
  bouton,
  info,
  h('p', { class: 'champ__aide' }, h('button', { type: 'button', class: 'lien-bouton', onclick: () => revenir() }, 'Revenir à l’identifiant')));
  cadre(racine, formulaire, 'Double authentification');
  code.input.focus();
}

// Activation obligatoire : la structure exige la double authentification pour ce compte (Administrateur général,
// Responsable d'un jeu). Rien d'autre n'est accessible avant ; surActive() relance l'application.
export function ecranActivation2fa(racine, { surActive }) {
  // Déjà affiché (autre refus du serveur pendant l'activation) : la clé scannée et les codes en cours restent.
  if (racine.querySelector('[data-ecran="activation-2fa"]')) return;
  const deconnexion = h('button', {
    type: 'button',
    class: 'lien-bouton',
    onclick: async () => {
      try {
        await api('POST', '/api/auth/deconnexion');
      } finally {
        window.location.hash = '';
        window.location.reload();
      }
    },
  }, 'Se déconnecter');
  const contenu = h('div', { class: 'formulaire' },
    h('h1', {}, 'Active la double authentification'),
    h('p', { class: 'texte-2' }, 'La structure l’exige pour les comptes qui gèrent un jeu : en plus du mot de passe, un code à 6 chiffres donné par une application sur ton téléphone. Quelqu’un qui découvre ton mot de passe ne pourra pas entrer. Il te faut deux minutes.'),
    activation2fa({ surActive: (r) => codes(r) }),
    h('p', { class: 'champ__aide' }, 'Pas ton téléphone sous la main ? ', deconnexion));

  function codes(r) {
    vider(contenu).append(
      h('h1', {}, 'Tes codes de secours'),
      h('p', { class: 'bandeau-2fa' }, icone('ok'), 'Double authentification activée. Tes autres appareils ont été déconnectés.'),
      blocCodesSecours(r.codesSecours, { identifiant: r.compte?.identifiant, libelleFin: 'Continuer', surFin: () => surActive() }));
    contenu.querySelector('.codes-2fa button')?.focus();
  }
  cadre(racine, contenu, 'Double authentification', { large: true, ecran: 'activation-2fa' });
}

export function ecranChangementMdp(racine, { identifiant = '', mdpActuel = '', surChange }) {
  const ancien = saisie({ type: 'password', autocomplete: 'current-password', value: mdpActuel, required: true });
  const nouveau = saisie({ type: 'password', autocomplete: 'new-password', required: true, minlength: 10 });
  const confirmation = saisie({ type: 'password', autocomplete: 'new-password', required: true });
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const bouton = h('button', { type: 'submit', class: 'btn btn--principal' }, 'Enregistrer mon mot de passe');
  const info = h('p', { class: 'champ__aide', role: 'status' });

  const formulaire = h('form', {
    class: 'formulaire',
    onsubmit: async (e) => {
      e.preventDefault();
      erreur.textContent = '';
      if (nouveau.value !== confirmation.value) {
        erreur.textContent = 'Les deux nouveaux mots de passe ne sont pas identiques.';
        return;
      }
      const fin = attenteServeur(bouton, info);
      try {
        const r = await api('POST', '/api/auth/mdp', { ancien: ancien.value, nouveau: nouveau.value });
        fin();
        surChange(r.compte);
      } catch (err) {
        fin();
        erreur.textContent = messageErreur(err);
      }
    },
  },
  h('h1', {}, 'Choisis ton mot de passe'),
  h('p', { class: 'texte-2' }, identifiant
    ? `Bienvenue ${identifiant}. Remplace le mot de passe temporaire par un mot de passe personnel : il vaut pour tous tes jeux.`
    : 'Remplace le mot de passe temporaire par un mot de passe personnel : il vaut pour tous tes jeux.'),
  champ('Mot de passe temporaire', ancien),
  champ('Nouveau mot de passe', nouveau, { aide: '10 caractères minimum, sans ton identifiant.' }),
  champ('Confirme le nouveau mot de passe', confirmation),
  erreur,
  bouton,
  info);
  cadre(racine, formulaire, 'Mot de passe');
  (mdpActuel ? nouveau : ancien).focus();
}

export function ecranErreur(racine, err, surReessayer) {
  // Une page refusée faute de double authentification n'est pas une panne : l'activation s'affiche (ou reste).
  if (err?.code === 'activer_2fa') return ecranActivation2fa(racine, { surActive: surReessayer });
  cadre(racine, h('div', { class: 'formulaire' },
    h('h1', {}, `${MARQUE.nom} indisponible`),
    h('p', {}, messageErreur(err)),
    h('button', { type: 'button', class: 'btn btn--principal', onclick: surReessayer }, 'Réessayer')), 'Indisponible');
}
