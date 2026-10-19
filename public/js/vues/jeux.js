// Mes jeux : les espaces de jeu ouverts à cette personne et ses métiers dans chacun.
// Page générale (aucun jeu chargé) : tout vient de la session (E.jeux(), E.compte()).
// Chaque jeu est une « feuille de carte » : son propre relief (tiré de son identifiant) et un poste à pointer.

import { h } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { topo } from '../composants/topo.js';
import { puce } from '../composants/jetons.js';
import { puceJeu } from '../navigation.js';
import { nomsMetiers } from '/shared/roles.js';

// Nombre stable tiré d'un texte : place le poste au même endroit du relief à chaque visite.
function graine(texte) {
  let n = 2166136261;
  for (const c of String(texte)) {
    n ^= c.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

// Pastille du jeu (sa couleur, son nom court), agrandie pour la carte.
function codeJeu(j) {
  const p = puceJeu(j);
  p.classList.add('carte-jeu__code');
  return p;
}

function carteJeu(j, dernier) {
  const g = graine(j.id);
  const metiers = nomsMetiers(j.metiers || []);
  return h('a', { href: `#/${encodeURIComponent(j.id)}`, class: ['carte-jeu', !j.actif && 'carte-jeu--inactif'] },
    h('div', { class: 'carte-jeu__terrain' },
      topo({ largeur: 480, hauteur: 180, graine: `jeu-${j.id}`, colonnes: 40, niveaux: 9, bosses: 6, classe: 'topo carte-jeu__fond' }),
      h('span', {
        class: 'carte-jeu__poste',
        'aria-hidden': 'true',
        style: { left: `${56 + (g % 27)}%`, top: `${25 + ((g >>> 8) % 26)}%` },
      }),
      codeJeu(j)),
    h('div', { class: 'carte-jeu__corps' },
      h('h2', { class: 'carte-jeu__nom' }, j.nom),
      h('span', { class: 'carte-jeu__metiers' }, metiers.length ? metiers.join(', ') : 'Aucun métier'),
      !j.actif || j.id === dernier ? h('div', { class: 'rangee' },
        j.actif ? null : puce('désactivé', 'attention'),
        j.id === dernier ? puce('Dernier ouvert') : null) : null));
}

function vide(admin) {
  return h('section', { class: 'jeux-vide' },
    topo({ largeur: 1200, hauteur: 360, graine: 'carte-vierge', colonnes: 60, niveaux: 10, bosses: 7, classe: 'topo jeux-vide__fond' }),
    h('div', { class: 'jeux-vide__texte' },
      admin
        ? [h('h2', {}, 'Aucun jeu activé'),
          h('p', { class: 'texte-2' }, 'Active un premier jeu : son espace est créé avec un roster à compléter, sa méta et une semaine type. Tu pourras ensuite y ouvrir l’accès aux autres comptes.'),
          h('a', { href: '#/admin/jeux', class: 'btn btn--principal' }, icone('ajouter'), 'Activer un premier jeu')]
        : [h('h2', {}, 'Aucun jeu pour l’instant'),
          h('p', { class: 'texte-2' }, 'Aucun jeu ne t’est encore ouvert : demande à ton Responsable ou à l’Administrateur général.')]));
}

export function rendre(page) {
  const jeux = E.jeux();
  const admin = E.estAdmin();
  const dernier = jeux.length > 1 ? E.dernierJeu() : '';

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Mes jeux'),
      h('p', { class: 'entete-page__intro' }, jeux.length
        ? 'Chaque jeu a son propre espace : roster, planning, stratbook et résultats ne se mélangent pas. Tes métiers peuvent changer d’un jeu à l’autre.'
        : 'Un espace par jeu, avec ses propres données et tes métiers dans ce jeu.')),
    admin && jeux.length ? h('div', { class: 'entete-page__actions' },
      h('a', { href: '#/admin/jeux', class: 'btn' }, icone('cadenas'), 'Gérer les jeux')) : null));

  if (!jeux.length) {
    page.append(vide(admin));
    return;
  }
  page.append(h('div', { class: 'grille-jeux' }, jeux.map((j) => carteJeu(j, dernier))));
  if (!admin) {
    page.append(h('p', { class: 'texte-3 petit section jeux-aide' }, icone('info', { classe: 'icone-texte' }),
      ' Un jeu manque ? Demande l’accès à son Responsable ou à l’Administrateur général.'));
  }
}
