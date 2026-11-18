// Administration générale (Administrateur général seulement) : vue d'ensemble de la structure, jeux activables, comptes,
// administratif de l'association, annonces, bot Discord et état du service. Onglets : #/admin/structure (par défaut), jeux,
// comptes, administratif (#/admin/administratif/<rubrique>), annonces, discord, service.
// La gestion d'un seul jeu (ses comptes, Discord, sauvegarde) est dans « Gestion du jeu » (gestion.js).

import { h, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { chargement } from './admin-commun.js';

const ONGLETS = [
  { id: 'structure', titre: 'Vue d’ensemble', icone: 'structure', intro: 'Tous les jeux d’un coup d’œil : effectif, prochaines échéances, santé, présence et résultats.', charger: () => import('./admin-structure.js'), fonction: 'rendreStructure' },
  { id: 'jeux', titre: 'Jeux', icone: 'jeux', intro: 'Active les jeux de la structure : chaque jeu activé a son propre espace, ses comptes et ses données.', charger: () => import('./admin-jeux.js'), fonction: 'rendreJeux' },
  { id: 'comptes', titre: 'Comptes', icone: 'roster', intro: 'Un compte par personne, avec ses métiers dans chaque jeu. Les Responsables gèrent aussi les comptes de leur jeu.', charger: () => import('./admin-comptes.js'), fonction: 'rendreComptes' },
  { id: 'administratif', titre: 'Administratif', icone: 'balance', intro: 'L’association : obligations légales et veille, livre des comptes, documents types, autorisations des mineurs.', charger: () => import('./admin-administratif.js'), fonction: 'rendreAdministratif' },
  { id: 'annonces', titre: 'Annonces', icone: 'annonce', intro: 'Un message en tête de l’accueil de tous les jeux, ou de certains, et qui l’a lu.', charger: () => import('./admin-annonces.js'), fonction: 'rendreAnnonces' },
  { id: 'discord', titre: 'Discord', icone: 'discord', intro: 'Le bot Discord de la structure : rôles synchronisés avec Lugh, rappels avant les séances et les matchs, comptes liés.', charger: () => import('./admin-discord.js'), fonction: 'rendreDiscord' },
  { id: 'service', titre: 'Service', icone: 'meta', intro: 'État du serveur, de la méta et de Discord pour chaque jeu, et tout ce qui s’est passé dans la structure.', charger: () => import('./admin-service.js'), fonction: 'rendreService' },
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
  // Chaque onglet est chargé à son ouverture (JS initial plus léger) ; même message d'échec que app.js.
  let quitte = false;
  let nettoyer = null;
  zone.append(chargement());
  onglet.charger()
    .then((m) => {
      if (quitte) return;
      zone.replaceChildren();
      nettoyer = m[onglet.fonction](zone, ctx, params.slice(1)) || null;
    })
    .catch((err) => {
      console.error(err);
      if (!quitte) zone.replaceChildren(h('p', {}, 'Cette page n’a pas pu être chargée. Recharge la page.'));
    });
  return () => { quitte = true; nettoyer?.(); };
}
