// Navigation : pages d'un jeu et pages générales, rail (ordinateur), en-tête et barre du bas (téléphone),
// sélecteur de jeu. Chaque personne ne voit que les jeux auxquels elle a accès.

import { h, vider, modale } from './ui.js';
import { icone } from './icones.js';
import * as E from './etat.js';
import * as J from './jeu.js';
import { nomsMetiers } from '/shared/roles.js';
import { aujourdhui } from '/shared/temps.js';
import { couleurJeu, ENCRE_PASTILLE } from '/shared/couleurs.js';
import { MARQUE } from '/shared/marque.js';

// Pages d'un jeu. titre/court peuvent dépendre du vocabulaire du jeu ; visible() masque une page sans objet.
export const VUES = {
  accueil: { titre: 'Accueil', icone: 'accueil', charger: () => import('./vues/accueil.js') },
  planning: { titre: 'Planning', icone: 'planning', charger: () => import('./vues/planning.js') },
  presences: { titre: 'Présences', icone: 'presences', charger: () => import('./vues/presences.js') },
  dispos: { titre: 'Disponibilités', court: 'Dispos', icone: 'dispos', charger: () => import('./vues/dispos.js') },
  match: { titre: 'Jour de match', court: 'Match', icone: 'match', charger: () => import('./vues/match.js') },
  maps: {
    titre: () => {
      if (!J.aCartes()) return 'Compos';
      return J.aPersonnages() ? `${J.v('cartes', true)} et compos` : J.v('cartes', true);
    },
    court: () => (J.aCartes() ? J.v('cartes', true) : 'Compos'),
    icone: 'maps',
    visible: () => J.aCartes() || J.aPersonnages(),
    charger: () => import('./vues/maps.js'),
  },
  strats: { titre: 'Stratbook', icone: 'strats', charger: () => import('./vues/strats.js') },
  bibliotheque: { titre: 'Bibliothèque', icone: 'bibliotheque', charger: () => import('./vues/bibliotheque.js') },
  adversaires: { titre: 'Adversaires', icone: 'adversaires', charger: () => import('./vues/adversaires.js') },
  tournois: { titre: 'Tournois', icone: 'tournois', charger: () => import('./vues/tournois.js') },
  meta: { titre: 'Méta', icone: 'meta', charger: () => import('./vues/meta.js') },
  scrims: { titre: 'Scrims et matchs', court: 'Scrims', icone: 'scrims', charger: () => import('./vues/scrims.js') },
  partenaires: { titre: 'Partenaires de scrim', court: 'Partenaires', icone: 'partenaires', charger: () => import('./vues/partenaires.js') },
  vod: { titre: 'VOD review', court: 'VOD', icone: 'vod', charger: () => import('./vues/vod.js') },
  progression: { titre: 'Progression', icone: 'progression', charger: () => import('./vues/progression.js') },
  programme: { titre: 'Programme individuel', court: 'Programme', icone: 'programme', charger: () => import('./vues/programme.js') },
  // Stats Valorant (API Riot) : jeux Valorant seulement, et seulement quand le serveur a les clés Riot.
  riot: { titre: 'Stats Valorant', court: 'Stats', icone: 'etoile', visible: () => E.jeu()?.modele === 'valorant' && !!E.serveur()?.riot, charger: () => import('./vues/riot.js') },
  bilan: { titre: 'Bilan du mois', court: 'Bilan', icone: 'bilan', charger: () => import('./vues/bilan.js') },
  roster: { titre: 'Roster', icone: 'roster', charger: () => import('./vues/roster.js') },
  recrutement: { titre: 'Recrutement', icone: 'recrutement', perm: 'recrutement.voter', charger: () => import('./vues/recrutement.js') },
  gestion: { titre: 'Gestion du jeu', court: 'Gestion', icone: 'admin', perm: 'comptes.gerer', charger: () => import('./vues/gestion.js') },
  reglages: { titre: 'Réglages du jeu', court: 'Réglages', icone: 'reglages', perm: 'jeu.regler', charger: () => import('./vues/reglages-jeu.js') },
};

// Pages générales (hors jeu).
export const PAGES = {
  jeux: { titre: 'Mes jeux', icone: 'jeux', charger: () => import('./vues/jeux.js') },
  admin: { titre: 'Administration générale', court: 'Administration', icone: 'cadenas', admin: true, charger: () => import('./vues/admin.js') },
  tresorerie: { titre: 'Comptes de la structure', court: 'Comptes', icone: 'euro', tresorier: true, charger: () => import('./vues/tresorerie.js') },
  compte: { titre: 'Mon compte', icone: 'compte', charger: () => import('./vues/compte.js') },
};

export const GROUPES = [
  { titre: 'Semaine', vues: ['accueil', 'planning', 'presences', 'dispos', 'match'] },
  { titre: 'Jeu', vues: ['maps', 'strats', 'bibliotheque', 'adversaires', 'tournois', 'meta'] },
  { titre: 'Performance', vues: ['scrims', 'partenaires', 'vod', 'progression', 'programme', 'riot', 'bilan'] },
  { titre: 'Équipe', vues: ['roster', 'recrutement', 'gestion', 'reglages'] },
];

const valeur = (x) => (typeof x === 'function' ? x() : x);

export function visible(id) {
  const v = VUES[id];
  return !!v && (!v.perm || E.peut(v.perm)) && (!v.visible || v.visible());
}

export function pageVisible(id) {
  const p = PAGES[id];
  return !!p && (!p.admin || E.estAdmin()) && (!p.tresorier || E.estAdmin() || E.estTresorier());
}

export const titreVue = (id) => valeur(VUES[id]?.titre) || '';
export const courtVue = (id) => valeur(VUES[id]?.court) || titreVue(id);

function badge(id) {
  if (id !== 'meta') return null;
  const n = E.liste('suggestions').filter((s) => s.statut === 'nouvelle').length;
  return n ? h('span', { class: 'rail__badge', 'aria-label': `${n} suggestion${n > 1 ? 's' : ''} à traiter` }, String(n)) : null;
}

function lienVue(id, actif, { rail = true } = {}) {
  return h('a', { href: J.lien(id === 'accueil' ? '' : id), class: rail ? 'rail__lien' : '', 'aria-current': id === actif ? 'page' : null },
    icone(VUES[id].icone), rail ? titreVue(id) : courtVue(id), rail ? badge(id) : null);
}

function lienPage(id, actif, { rail = true } = {}) {
  const p = PAGES[id];
  return h('a', { href: `#/${id}`, class: rail ? 'rail__lien' : '', 'aria-current': id === actif ? 'page' : null },
    icone(p.icone), rail ? p.titre : (p.court || p.titre));
}

// Marque Lugh : écusson simplifié (lisible en 36 px) + lettrage, coloré par le thème (masque, voir identite.css).
const SYMBOLE_PETIT = MARQUE.symbole.replace(/\.svg$/, '-petit.svg');
export function marque() {
  return h('a', { href: '#/jeux', class: 'rail__marque marque', 'aria-label': `${MARQUE.nom}, mes jeux` },
    h('img', { class: 'marque__symbole', src: SYMBOLE_PETIT, alt: '', width: '36', height: '36' }),
    h('span', { class: 'marque__mot', 'aria-hidden': 'true', style: { '--marque-mot': `url("${MARQUE.mot}")` } }));
}

// Pastille d'un jeu : son nom court (5 caractères au plus, sinon ses initiales), sur sa couleur de jeu.
function texteCourt(court = '?') {
  if (court.length <= 5) return court;
  const mots = court.split(/\s+/).filter(Boolean);
  return (mots.length > 1 ? mots.map((m) => m[0]).join('') : court).slice(0, 4).toUpperCase();
}

export function styleCouleurJeu(id) {
  const c = couleurJeu(id);
  return c ? { '--jeu-sombre': c.sombre, '--jeu-clair': c.clair } : null;
}

export function puceJeu(j) {
  return h('span', { class: 'puce-jeu', 'aria-hidden': 'true', style: styleCouleurJeu(j?.couleur) }, texteCourt(j?.court || '?'));
}

// La couleur du jeu affiché teinte le rail, l'en-tête mobile et le sélecteur ; hors jeu, elle s'efface.
function appliquerCouleurJeu(j) {
  const racine = document.documentElement;
  const c = j ? couleurJeu(j.couleur) : null;
  if (c) {
    racine.style.setProperty('--jeu-sombre', c.sombre);
    racine.style.setProperty('--jeu-clair', c.clair);
    racine.style.setProperty('--jeu-encre-sombre', ENCRE_PASTILLE.sombre);
    racine.style.setProperty('--jeu-encre-clair', ENCRE_PASTILLE.clair);
    racine.dataset.jeu = j.id;
  } else {
    for (const v of ['--jeu-sombre', '--jeu-clair', '--jeu-encre-sombre', '--jeu-encre-clair']) racine.style.removeProperty(v);
    delete racine.dataset.jeu;
  }
}

// Bouton du jeu affiché : ouvre le choix du jeu (seulement utile avec plusieurs jeux ou pour l'administration).
function selecteur(compact = false) {
  const j = E.jeu();
  const eq = E.equipe();
  const plusieurs = E.jeux().length > 1 || E.estAdmin();
  const contenu = [
    puceJeu(j),
    h('span', { class: 'selecteur-jeu__texte' },
      h('strong', {}, j?.nom || 'Choisir un jeu'),
      compact ? null : h('small', {}, eq.nom || (eq.tag ? eq.tag : 'Équipe sans nom'))),
    plusieurs ? icone('bas', { classe: 'selecteur-jeu__fleche' }) : null,
  ];
  if (!plusieurs) return h('div', { class: ['selecteur-jeu', compact && 'selecteur-jeu--compact'] }, contenu);
  return h('button', { type: 'button', class: ['selecteur-jeu', compact && 'selecteur-jeu--compact'], 'aria-haspopup': 'dialog', onclick: ouvrirChoixJeu, title: 'Changer de jeu' }, contenu);
}

export function ouvrirChoixJeu() {
  const actuel = E.jeu()?.id;
  const m = modale({
    titre: 'Changer de jeu',
    contenu: h('div', { class: 'choix-jeux' },
      E.jeux().map((j) => h('a', { href: `#/${j.id}`, class: 'choix-jeu', 'aria-current': j.id === actuel ? 'page' : null },
        puceJeu(j),
        h('span', { class: 'choix-jeu__texte' },
          h('strong', {}, j.nom, j.actif ? null : h('span', { class: 'puce puce--attention' }, 'désactivé')),
          h('small', {}, nomsMetiers(j.metiers).join(', '))))),
      E.jeux().length ? null : h('p', { class: 'texte-2' }, 'Aucun jeu pour l’instant.'),
      E.estAdmin() ? h('a', { href: '#/admin', class: 'btn btn--discret' }, icone('cadenas'), 'Administration générale') : null),
  });
  m.dialogue.addEventListener('click', (e) => {
    if (e.target.closest('a')) m.fermer();
  });
}

function piedRail(actif) {
  const c = E.compte();
  return h('div', { class: 'rail__pied' },
    E.estAdmin() ? h('a', { href: '#/admin', class: 'rail__lien', 'aria-current': actif === 'admin' ? 'page' : null }, icone('cadenas'), 'Administration générale') : null,
    E.estTresorier() && !E.estAdmin() ? lienPage('tresorerie', actif) : null,
    h('a', { href: '#/compte', class: 'rail__compte', 'aria-current': actif === 'compte' ? 'page' : null },
      icone('compte'),
      h('span', {}, c?.nomAffiche || '', h('small', {}, c?.identifiant || ''))));
}

// Rail, en-tête mobile et barre du bas. actif = identifiant de la page affichée ; dansJeu = page d'un jeu.
export function construireNavigation({ rail, entete, barre, actif, dansJeu }) {
  appliquerCouleurJeu(dansJeu ? E.jeu() : null);
  if (dansJeu) {
    vider(rail).append(
      marque(),
      selecteur(),
      ...GROUPES.map((g) => {
        const ids = g.vues.filter(visible);
        return ids.length ? h('nav', { class: 'rail__groupe', 'aria-label': g.titre },
          h('span', { class: 'rail__titre-groupe' }, g.titre),
          ids.map((id) => lienVue(id, actif))) : null;
      }).filter(Boolean),
      piedRail(actif));
  } else {
    vider(rail).append(
      marque(),
      E.jeux().length ? h('nav', { class: 'rail__groupe', 'aria-label': 'Mes jeux' },
        h('span', { class: 'rail__titre-groupe' }, 'Mes jeux'),
        E.jeux().map((j) => h('a', { href: `#/${j.id}`, class: 'rail__lien' }, puceJeu(j), j.nom))) : h('span'),
      piedRail(actif));
  }

  const titre = dansJeu ? titreVue(actif) : (PAGES[actif]?.titre || MARQUE.nom);
  vider(entete).append(
    dansJeu ? selecteur(true) : marque(),
    h('span', { class: 'entete-mobile__titre' }, titre),
    h('a', { href: '#/compte', class: 'btn btn--discret btn--icone', 'aria-label': 'Mon compte' }, icone('compte')));

  if (dansJeu) {
    const principales = ['accueil', 'planning', visible('maps') ? 'maps' : 'strats', 'scrims'];
    vider(barre).append(
      ...principales.map((id) => lienVue(id, actif, { rail: false })),
      h('button', { type: 'button', 'aria-current': principales.includes(actif) ? null : 'page', onclick: () => ouvrirMenu(actif) }, icone('plus'), 'Plus'));
    barre.hidden = false;
  } else {
    vider(barre);
    barre.hidden = true;
  }
}

export function ouvrirMenu(actif) {
  const m = modale({
    titre: 'Toutes les rubriques',
    contenu: h('div', { class: 'menu-mobile' },
      h('div', { class: 'rail__groupe' }, selecteur()),
      GROUPES.map((g) => {
        const ids = g.vues.filter(visible);
        return ids.length ? h('div', { class: 'rail__groupe' }, h('span', { class: 'rail__titre-groupe' }, g.titre), ids.map((id) => lienVue(id, actif))) : null;
      }),
      h('div', { class: 'rail__groupe' },
        E.estAdmin() ? lienPage('admin', actif) : null,
        E.estTresorier() && !E.estAdmin() ? lienPage('tresorerie', actif) : null,
        lienPage('compte', actif))),
  });
  m.dialogue.addEventListener('click', (e) => {
    if (e.target.closest('a')) m.fermer();
  });
}

// Petite aide pour les vues : date du jour (navigateur) pour les comparaisons simples.
export const jour = () => E.serveur()?.aujourdhui || aujourdhui();
