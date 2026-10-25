// Stats Valorant, onglet « Équipe » (staff) : cartes jouées et taux de victoire, agents et forme de chaque joueur.
// Uniquement les joueurs qui ont relié eux-mêmes leur compte Riot. Aucun adversaire, aucun rang, rien en direct.

import { h, etatVide, messageErreur } from '../ui.js';
import { api } from '../api.js';
import * as E from '../etat.js';
import { puce, forme } from '../composants/jetons.js';
import { nombre } from '../composants/courbe.js';

export const FILES = {
  competitive: 'Compétitif', unrated: 'Non classé', premier: 'Premier', swiftplay: 'Vélocité', spikerush: 'Spike Rush',
  deathmatch: 'Combat à mort', custom: 'Personnalisée',
};
export const nomFile = (id) => FILES[id] || id;
export const chiffre = (n) => nombre(n, 2);
export function tuile(valeur, legende) {
  return h('div', { class: 'tuile' }, h('span', { class: 'chiffre chiffre--xl' }, valeur), h('span', { class: 'texte-3 petit' }, legende));
}
const pct = (n) => (n === null ? '—' : `${n} %`);

export function rendreEquipe(corps) {
  api('GET', `/api/e/${E.jeu().id}/riot/equipe`).then((r) => {
    if (!r.joueurs.length) {
      corps.replaceChildren(etatVide('Aucun joueur n’a encore relié son compte Riot. Chacun le fait lui-même, depuis l’onglet « Mes parties » de cette page.'));
      return;
    }
    corps.replaceChildren(...[
      h('p', { class: 'texte-3 petit' }, `${r.joueurs.length} joueur${r.joueurs.length > 1 ? 's ont relié leur' : ' a relié son'} compte Riot. Les autres n’apparaissent pas. Une partie jouée ensemble ne compte qu’une fois par carte.`),
      r.avertissement ? h('p', { class: 'conseil' }, r.avertissement) : null,
      h('section', { class: 'section pile-s' }, h('h2', {}, 'Cartes'),
        h('div', { class: 'defile' }, h('table', { class: 'tableau' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Carte'), h('th', { class: 'num' }, 'Parties'), h('th', { class: 'num' }, 'Victoires'))),
          h('tbody', {}, r.cartes.map((c) => h('tr', {},
            h('td', {}, c.carte), h('td', { class: 'num' }, String(c.parties)), h('td', { class: 'num' }, pct(c.victoires)))))))),
      h('section', { class: 'section pile-s' }, h('h2', {}, 'Joueurs'),
        h('div', { class: 'defile' }, h('table', { class: 'tableau' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Joueur'), ['Parties', 'KDA', 'ACS', 'Victoires'].map((t) => h('th', { class: 'num' }, t)),
            h('th', {}, 'Agents'), h('th', {}, 'Forme'))),
          h('tbody', {}, r.joueurs.map((j) => h('tr', {},
            h('td', {}, h('strong', {}, j.nom), h('div', { class: 'texte-3 petit' }, j.nomRiot)),
            h('td', { class: 'num' }, String(j.parties)), h('td', { class: 'num' }, chiffre(j.kda)),
            h('td', { class: 'num' }, j.acs === null ? '—' : String(j.acs)), h('td', { class: 'num' }, pct(j.victoires)),
            h('td', {}, h('div', { class: 'rangee' }, j.agents.slice(0, 3).map((a) => puce(`${a.nom} · ${a.parties}`)))),
            h('td', {}, forme(j.forme))))))))].filter(Boolean));
  }).catch((err) => corps.replaceChildren(h('p', { class: 'champ__erreur', role: 'alert' }, messageErreur(err))));
}
