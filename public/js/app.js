// Point d'entrée de l'application : session, choix du jeu, coquille (rail, barre mobile) et rendu des pages.

import { h, vider } from './ui.js';
import { api } from './api.js';
import * as E from './etat.js';
import { routeCourante, surChangementRoute, remplacerAdresse } from './routeur.js';
import { VUES, PAGES, visible, pageVisible, titreVue, construireNavigation } from './navigation.js';
import { ecranConnexion, ecranChangementMdp, ecranErreur } from './vues/connexion.js';
import * as ecrans from './vues/connexion.js';
import { MARQUE } from '/shared/marque.js';
import { appliquerTheme } from './theme.js';
import './installation.js';

const racine = document.getElementById('app');
const PAGES_JEU = new Set(Object.keys(VUES));
let principal = null;
let rail = null;
let barre = null;
let entete = null;
let nettoyage = null;
let jeton = 0;
let enAttente = false;
let routeAffichee = '';

function modaleOuverte() {
  return !!document.querySelector('dialog[open]');
}

function route() {
  return routeCourante({ pagesJeu: PAGES_JEU, jeux: E.jeux().map((j) => j.id) });
}

// Jeu à ouvrir quand l'adresse n'en donne pas : le dernier ouvert, sinon le premier ; aucun → choix ou administration.
function jeuParDefaut() {
  const ids = E.jeux().filter((j) => j.actif).map((j) => j.id);
  const dernier = E.dernierJeu();
  return ids.includes(dernier) ? dernier : ids[0] || '';
}

async function afficher({ conserver = false } = {}) {
  let r = route();
  if (r.relatif) {
    // Lien enregistré sans jeu (« #/maps/bind ») : il vise le jeu affiché.
    const jeu = E.jeu()?.id || jeuParDefaut();
    if (!jeu) return remplacerEtAfficher('#/jeux');
    return remplacerEtAfficher(`#/${jeu}/${[r.route, ...r.params].join('/')}`);
  }
  if (!r.jeu && !r.route) {
    const jeu = jeuParDefaut();
    return remplacerEtAfficher(jeu ? `#/${jeu}` : (E.estAdmin() && !E.jeux().length ? '#/admin/jeux' : '#/jeux'));
  }

  const moi = ++jeton;
  const dansJeu = !!r.jeu;
  if (dansJeu) {
    if (!E.jeux().some((j) => j.id === r.jeu)) return remplacerEtAfficher('#/jeux');
    if (E.jeu()?.id !== r.jeu) {
      E.quitterJeu();
      try {
        await E.charger(r.jeu);
      } catch (err) {
        if (err.statut === 404) return remplacerEtAfficher('#/jeux');
        return ecranErreur(racine, err, () => location.reload());
      }
      if (moi !== jeton) return;
      E.demarrerSync();
    }
    if (!visible(r.route)) r = { ...r, route: 'accueil', params: [] };
  } else {
    if (!pageVisible(r.route)) r = { ...r, route: 'jeux', params: [] };
    if (E.jeu()) E.quitterJeu();
  }

  const id = r.route;
  const cle = `${r.jeu || ''}/${id}/${r.params.join('/')}`;
  const changement = cle !== routeAffichee;
  if (changement) E.effacerBrouillons();
  construireNavigation({ rail, entete, barre, actif: id, dansJeu });
  const def = dansJeu ? VUES[id] : PAGES[id];
  let module;
  try {
    module = await def.charger();
  } catch {
    module = { rendre: (p) => p.append(h('p', {}, 'Cette page n’a pas pu être chargée. Recharge la page.')) };
  }
  if (moi !== jeton) return;
  const defilement = conserver && !changement ? window.scrollY : 0;
  nettoyage?.();
  nettoyage = null;
  const page = h('div', { class: 'page' });
  // Une saisie dans une zone marquée data-brouillon protège ce formulaire jusqu'à son enregistrement.
  page.addEventListener('input', (e) => {
    const zone = e.target.closest?.('[data-brouillon]');
    if (zone && !e.target.closest('[data-pas-brouillon]')) E.definirBrouillon(true, zone.dataset.brouillon);
  });
  vider(principal).append(page);
  try {
    nettoyage = module.rendre(page, r.params, {
      aller: (chemin) => { window.location.hash = chemin; },
      rafraichir: () => afficher({ conserver: true }),
      recharger: () => recharger(),
    }) || null;
  } catch (err) {
    console.error(err);
    page.append(h('p', { class: 'champ__erreur' }, 'Erreur d’affichage de cette page.'));
  }
  routeAffichee = cle;
  const titre = dansJeu ? `${titreVue(id)} · ${E.jeu().court}` : PAGES[id].titre;
  document.title = `${titre} | ${MARQUE.nom}`;
  window.scrollTo(0, defilement);
  if (changement) principal.focus({ preventScroll: true });
}

function remplacerEtAfficher(hash) {
  remplacerAdresse(hash);
  return afficher();
}

// Après l'activation d'un jeu ou un changement d'accès : la liste des jeux et les droits sont relus.
async function recharger() {
  await E.chargerSession();
  if (E.jeu()) {
    const id = E.jeu().id;
    E.quitterJeu();
    routeAffichee = '';
    if (E.jeux().some((j) => j.id === id)) {
      await E.charger(id);
      E.demarrerSync();
    }
  }
  await afficher({ conserver: true });
}

function surChangementEtat(source) {
  if (source === 'charge' || !principal) return;
  if (modaleOuverte() || E.brouillon()) {
    enAttente = true;
    return;
  }
  afficher({ conserver: true });
}

function enregistrerAppli() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function lancerApp() {
  vider(racine);
  rail = h('aside', { class: 'rail' });
  entete = h('header', { class: 'entete-mobile' });
  principal = h('main', { class: 'principal', id: 'contenu', tabindex: '-1' });
  barre = h('nav', { class: 'barre-mobile', 'aria-label': 'Navigation principale' });
  racine.append(
    h('a', { href: '#contenu', class: 'lien-evitement' }, 'Aller au contenu'),
    h('div', { class: 'coquille' }, rail, h('div', {}, entete, principal)),
    barre);
  enregistrerAppli();
  afficher();
}

async function demarrer() {
  appliquerTheme();
  try {
    const session = await api('GET', '/api/auth/session');
    if (!session.connecte) return connexion();
    if (session.doitChangerMdp) return changementMdp(session.identifiant);
    if (session.doitActiver2fa) return activation2fa();
    await E.chargerSession();
    lancerApp();
  } catch (err) {
    if (err.statut === 401) return connexion();
    if (err.code === 'mdp_a_changer') return changementMdp();
    return ecranErreur(racine, err, demarrer);
  }
}

function connexion(message = '') {
  E.reinitialiser();
  principal = null;
  routeAffichee = '';
  ecranConnexion(racine, {
    message,
    surConnecte: async (compte, mdp) => {
      if (compte.doitChangerMdp) return changementMdp(compte.identifiant, mdp);
      await demarrer();
    },
  });
}

// La structure exige la double authentification pour ce compte : rien d'autre tant qu'elle n'est pas activée.
function activation2fa() {
  E.reinitialiser(); // plus de synchronisation tant que la double authentification n'est pas activée
  principal = null;
  routeAffichee = '';
  if (typeof ecrans.ecranActivation2fa === 'function') return ecrans.ecranActivation2fa(racine, { surActive: () => demarrer() });
  return ecranErreur(racine, new Error('Active la double authentification pour continuer.'), () => location.reload());
}

async function changementMdp(identifiant = '', mdpActuel = '') {
  principal = null;
  routeAffichee = '';
  let nom = identifiant;
  if (!nom) {
    try {
      nom = (await api('GET', '/api/auth/moi')).compte.identifiant;
    } catch {
      return connexion();
    }
  }
  ecranChangementMdp(racine, { identifiant: nom, mdpActuel, surChange: () => demarrer() });
}

E.abonner(surChangementEtat);
document.addEventListener('lugh:modale-fermee', () => {
  if (enAttente && !modaleOuverte() && !E.brouillon()) {
    enAttente = false;
    afficher({ conserver: true });
  }
});
document.addEventListener('lugh:recharger', () => { recharger(); });
window.addEventListener('lugh:deconnecte', () => connexion('Ta session a expiré : reconnecte-toi.'));
window.addEventListener('lugh:mdp-a-changer', () => changementMdp());
window.addEventListener('lugh:activer-2fa', () => activation2fa());
window.addEventListener('beforeunload', (e) => {
  if (E.brouillon()) e.preventDefault();
});
surChangementRoute(() => {
  // Un lien suivi depuis une fenêtre (fiche d'un membre, menu mobile) referme la fenêtre.
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  if (principal) afficher();
});

demarrer();
