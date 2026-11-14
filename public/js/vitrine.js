// Vitrine publique : lit /api/public/vitrine (liste blanche, voir src/domaine/vitrine.js) et remplit la page.
// Aucun stockage dans le navigateur, aucun cookie, aucun contenu tiers.

import { h } from './ui.js';
import { liensLegaux } from './composants/confidentialite.js';
import { couleurJeu } from '/shared/couleurs.js';

const $ = (champ) => document.querySelector(`[data-champ="${champ}"]`);
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const styleJeu = (j) => {
  const c = couleurJeu(j.couleur);
  return c ? { '--jeu': c.sombre } : {};
};

function lienPostuler(url, libelle = 'Postuler', classe = 'v-btn-or') {
  if (!url) return null;
  const href = /^https:\/\//.test(url) ? url : `mailto:${url}`;
  return h('a', { class: ['btn', classe], href, ...(href.startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, libelle);
}

function carteMembre(m) {
  const initiale = [...m.pseudo][0]?.toUpperCase() || '?';
  return h('li', { class: ['v-carte', m.type === 'staff' && 'v-carte--staff'] },
    h('div', { class: 'v-carte__photo' },
      m.photo
        ? h('img', { src: m.photo, alt: `Photo de ${m.pseudo}`, width: 320, height: 320, loading: 'lazy', decoding: 'async' })
        : h('span', { class: 'v-carte__initiale', 'aria-hidden': 'true' }, initiale)),
    h('div', { class: 'v-carte__corps' },
      h('h4', { class: 'v-carte__pseudo' }, m.pseudo),
      h('p', { class: 'v-carte__role' }, m.role || (m.type === 'staff' ? 'Staff' : 'Joueur')),
      m.statut && m.type === 'joueur' ? h('p', { class: 'v-carte__statut' }, m.statut) : null));
}

function blocJeu(j) {
  const joueurs = j.membres.filter((m) => m.type === 'joueur');
  const staff = j.membres.filter((m) => m.type === 'staff');
  const nomEquipe = j.equipe.nom || j.nom;
  return h('article', { class: 'v-jeu', style: styleJeu(j), 'aria-labelledby': `jeu-${j.id}` },
    h('header', { class: 'v-jeu__tete' },
      h('p', { class: 'v-jeu__jeu' }, j.nom),
      h('h3', { id: `jeu-${j.id}`, class: 'v-jeu__equipe' }, nomEquipe, j.equipe.tag ? h('span', { class: 'v-jeu__tag' }, j.equipe.tag) : null),
      j.equipe.devise ? h('p', { class: 'v-jeu__devise' }, j.equipe.devise) : null,
      j.equipe.circuit ? h('p', { class: 'v-jeu__circuit' }, j.equipe.circuit) : null,
      j.places > 0 ? h('a', { class: 'v-jeu__recrute', href: '#recrutement' }, `Recrute · ${pluriel(j.places, 'place')}`) : null),
    joueurs.length
      ? h('ul', { class: 'v-cartes', 'aria-label': `Joueurs ${j.nom}` }, joueurs.map(carteMembre))
      : h('p', { class: 'v-vide' }, 'Les joueurs de cette équipe n’ont pas encore choisi d’apparaître ici.'),
    staff.length ? h('div', { class: 'v-staff' },
      h('p', { class: 'v-kick' }, 'Staff'),
      h('ul', { class: 'v-cartes v-cartes--staff', 'aria-label': `Staff ${j.nom}` }, staff.map(carteMembre))) : null);
}

function recrutement(v) {
  const ouverts = v.jeux.filter((j) => j.places > 0);
  if (!ouverts.length) {
    return h('div', { class: 'v-recrut-vide' },
      h('p', {}, 'Aucune place ouverte pour le moment. Repasse bientôt : les places s’affichent ici dès qu’une équipe recrute.'),
      lienPostuler(v.structure.postuler, 'Nous contacter', 'v-btn-ligne'));
  }
  return h('ul', { class: 'v-recrut' }, ouverts.map((j) => h('li', { class: 'v-recrut__carte', style: styleJeu(j) },
    h('p', { class: 'v-recrut__nombre' }, h('strong', {}, String(j.places)), h('span', {}, j.places > 1 ? 'places ouvertes' : 'place ouverte')),
    h('h3', { class: 'v-recrut__jeu' }, j.nom),
    h('p', { class: 'v-recrut__equipe' }, j.equipe.nom || 'Équipe en construction'),
    j.recherche ? h('p', { class: 'v-recrut__roles' }, h('span', {}, 'Recherche'), j.recherche) : null,
    lienPostuler(v.structure.postuler, `Postuler · ${j.nom}`) || h('p', { class: 'v-vide' }, 'Contact bientôt disponible.'))));
}

function resultats(v) {
  const lignes = v.jeux.flatMap((j) => j.resultats.map((r) => ({ ...r, jeu: j }))).sort((a, b) => b.date.localeCompare(a.date));
  if (!lignes.length) return h('p', { class: 'v-vide' }, 'Les premiers résultats de tournois arrivent bientôt.');
  const date = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '');
  return h('ol', { class: 'v-resultats' }, lignes.map((r) => h('li', { class: 'v-resultat', style: styleJeu(r.jeu) },
    h('span', { class: 'v-resultat__place' }, r.place ? `#${r.place}` : '—'),
    h('span', { class: 'v-resultat__corps' },
      h('strong', {}, r.nom),
      h('span', { class: 'v-resultat__meta' }, [r.jeu.nom, date(r.date), r.resultat].filter(Boolean).join(' · '))))));
}

function remplir(v) {
  const nom = v.structure.nom || 'Lugh';
  $('nom').textContent = nom;
  if (v.structure.presentation) $('presentation').textContent = v.structure.presentation;
  const postuler = lienPostuler(v.structure.postuler);
  if (postuler) $('actions').replaceChildren(postuler, h('a', { class: 'btn v-btn-ligne', href: '#equipes' }, 'Voir les joueurs'));

  const membres = v.jeux.reduce((n, j) => n + j.membres.length, 0);
  const places = v.jeux.reduce((n, j) => n + j.places, 0);
  $('compteurs').replaceChildren(...[[v.jeux.length, v.jeux.length > 1 ? 'jeux actifs' : 'jeu actif'], [membres, membres > 1 ? 'membres' : 'membre'], [places, places > 1 ? 'places ouvertes' : 'place ouverte']]
    .map(([n, l]) => h('div', { class: 'v-compteur' }, h('dt', {}, l), h('dd', {}, String(n)))));

  const ouverts = v.jeux.filter((j) => j.places > 0);
  if (ouverts.length) {
    $('bandeau').hidden = false;
    $('bandeau').querySelector('p').textContent = ouverts.map((j) => `${j.nom} recrute : ${pluriel(j.places, 'place')}${j.recherche ? ` (${j.recherche})` : ''}`).join('  ·  ');
  }
  $('jeux').replaceChildren(...(v.jeux.length ? v.jeux.map(blocJeu) : [h('p', { class: 'v-vide' }, 'Les équipes se présentent bientôt.')]));
  $('recrutement').replaceChildren(recrutement(v));
  $('resultats').replaceChildren(resultats(v));
}

$('legal').replaceChildren(...liensLegaux('v-lien-legal'));
fetch('/api/public/vitrine', { credentials: 'omit' })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then(remplir)
  .catch(() => { $('jeux').replaceChildren(h('p', { class: 'v-vide' }, 'Les équipes ne se chargent pas pour l’instant. Réessaie dans un instant.')); });
