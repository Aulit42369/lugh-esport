// Gestion du jeu (Responsable du jeu, ou Administrateur général) : comptes qui ont accès à ce jeu et leurs métiers,
// état du jeu, notifications Discord, sauvegarde et restauration, journal du jeu.
// Ce qui change le jeu lui-même (rôles, vocabulaire, score…) est dans « Réglages du jeu » (reglages-jeu.js).

import { h, bouton, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { sectionComptes, creerCompte } from './gestion-comptes.js';
import { sectionsService } from './gestion-service.js';
import { tableauDroits } from './admin-commun.js';

export function rendre(page, params, ctx) {
  page.classList.add('adm-page');
  if (!E.peut('comptes.gerer')) {
    page.append(h('h1', {}, 'Gestion du jeu'), etatVide('Cette page est réservée au Responsable du jeu.'));
    return null;
  }
  const jeu = E.jeu();
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Gestion du jeu'),
      h('p', { class: 'entete-page__intro' }, `Qui a accès à ${jeu.nom} et avec quels métiers, les notifications Discord et la sauvegarde. Pour adapter le jeu lui-même (rôles, vocabulaire, score…), passe par ses Réglages du jeu.`)),
    h('div', { class: 'entete-page__actions' },
      E.peut('jeu.regler') ? h('a', { href: J.lien('/reglages'), class: 'btn' }, icone('reglages'), 'Réglages du jeu') : null,
      E.estAdmin() ? h('a', { href: '#/admin/comptes', class: 'btn btn--discret' }, icone('cadenas'), 'Tous les comptes') : null,
      bouton('Ajouter une personne', { icone: 'ajouter', classe: 'btn--principal', onclick: () => creerCompte(ctx) }))));

  const comptes = h('section', { class: 'section adm-section-comptes' });
  page.append(comptes);
  sectionComptes(comptes, ctx);
  page.append(tableauDroits());

  const service = h('div', { class: 'grille-2 section grille-service' });
  page.append(service);
  sectionsService(service, ctx);
  return null;
}
