// Administration générale (Administrateur général seulement) : vue d'ensemble de la structure, jeux activables, comptes,
// annonces, bot Discord et état du service. Onglets : #/admin/structure (par défaut), jeux, comptes, annonces, discord, service.
// La gestion d'un seul jeu (ses comptes, Discord, sauvegarde) est dans « Gestion du jeu » (gestion.js).

import { h, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { rendreStructure } from './admin-structure.js';
import { rendreJeux } from './admin-jeux.js';
import { rendreComptes } from './admin-comptes.js';
import { rendreAnnonces } from './admin-annonces.js';
import { rendreService } from './admin-service.js';
import { rendreDiscord } from './admin-discord.js';

const ONGLETS = [
  { id: 'structure', titre: 'Vue d’ensemble', icone: 'structure', intro: 'Tous les jeux d’un coup d’œil : effectif, prochaines échéances, santé, présence et résultats.', rendre: rendreStructure },
  { id: 'jeux', titre: 'Jeux', icone: 'jeux', intro: 'Active les jeux de la structure : chaque jeu activé a son propre espace, ses comptes et ses données.', rendre: rendreJeux },
  { id: 'comptes', titre: 'Comptes', icone: 'roster', intro: 'Un compte par personne, avec ses métiers dans chaque jeu. Les Responsables gèrent aussi les comptes de leur jeu.', rendre: rendreComptes },
  { id: 'annonces', titre: 'Annonces', icone: 'annonce', intro: 'Un message en tête de l’accueil de tous les jeux, ou de certains, et qui l’a lu.', rendre: rendreAnnonces },
  { id: 'discord', titre: 'Discord', icone: 'discord', intro: 'Le bot Discord de la structure : rôles synchronisés avec Lugh, rappels avant les séances et les matchs, comptes liés.', rendre: rendreDiscord },
  { id: 'service', titre: 'Service', icone: 'meta', intro: 'État du serveur, de la méta et de Discord pour chaque jeu, et tout ce qui s’est passé dans la structure.', rendre: rendreService },
];

export function rendre(page, params, ctx) {
  page.classList.add('adm-page');
  if (!E.estAdmin()) {
    page.append(h('h1', {}, 'Administration générale'), etatVide('Cette page est réservée à l’Administrateur général.'));
    return null;
  }
  const onglet = ONGLETS.find((o) => o.id === params[0]) || ONGLETS[0];
  const zone = h('div', { class: 'adm-zone' });
  page.append(
    h('header', { class: 'entete-page adm-entete' },
      h('div', { class: 'entete-page__texte' },
        h('p', { class: 'adm-surtitre' }, icone('cadenas'), 'Administrateur général'),
        h('h1', {}, 'Administration générale'),
        h('p', { class: 'entete-page__intro' }, onglet.intro))),
    h('nav', { class: 'onglets adm-onglets', 'aria-label': 'Rubriques de l’administration générale' },
      ONGLETS.map((o) => h('a', { href: `#/admin/${o.id}`, 'aria-current': o.id === onglet.id ? 'page' : null }, icone(o.icone), o.titre))),
    zone);
  return onglet.rendre(zone, ctx) || null;
}
