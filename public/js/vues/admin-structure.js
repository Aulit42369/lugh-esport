// Administration générale, onglet Vue d'ensemble (par défaut) : une carte par jeu, à sa couleur. Effectif, matchs et
// tournois à venir, moniteur de santé, présence, derniers résultats et méta. Lecture seule ; « Ouvrir » mène au jeu.

import { h, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import { api } from '../api.js';
import { puce } from '../composants/jetons.js';
import { puceJeu, styleCouleurJeu } from '../navigation.js';
import { libelleStatutTournoi } from '/shared/organisation.js';
import { formatDateCourte, ilYA, numeroSemaine } from '/shared/temps.js';
import { chargement, erreurChargement } from './admin-commun.js';

let cache = null;
const RESULTATS = { V: 'Victoire', D: 'Défaite', N: 'Nul' };

export function rendreStructure(zone) {
  let affiche = '';
  const dessiner = (d) => {
    affiche = JSON.stringify(d);
    zone.replaceChildren(resume(d), h('div', { class: 'adm-structure' }, trier(d.jeux).map(carteJeu)));
  };
  if (cache) dessiner(cache);
  else zone.replaceChildren(chargement());
  api('GET', '/api/admin/structure')
    .then((d) => {
      cache = d;
      if (JSON.stringify(d) !== affiche) dessiner(d);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => rendreStructure(zone)));
    });
}

// Jeux actifs d'abord (ordre du serveur), désactivés à la fin.
const trier = (jeux) => [...jeux.filter((j) => j.actif), ...jeux.filter((j) => !j.actif)];

// Lien d'alerte relatif au jeu (« #/presences ») → « #/valorant/presences ».
const lienDuJeu = (jeu, lien) => `#/${encodeURIComponent(jeu)}/${String(lien || '').replace(/^#?\/?/, '')}`.replace(/\/$/, '');

function resume(d) {
  const actifs = d.jeux.filter((j) => j.actif);
  const matchs = actifs.reduce((n, j) => n + j.matchs.length, 0);
  const alertes = actifs.reduce((n, j) => n + j.alertes.total, 0);
  const attention = actifs.reduce((n, j) => n + j.alertes.attention, 0);
  const chiffre = (n, sing, plur, ton = '') => h('div', {}, h('span', { class: ['chiffre chiffre--l', ton] }, String(n)), h('span', { class: 'texte-3 petit' }, n > 1 ? plur : sing));
  return h('section', { class: 'fiche adm-resume' },
    chiffre(actifs.length, 'jeu actif', 'jeux actifs'),
    chiffre(matchs, 'match à venir', 'matchs à venir'),
    chiffre(alertes, 'alerte de santé', 'alertes de santé'),
    chiffre(attention, 'à surveiller', 'à surveiller', attention ? 'adm-resume__attention' : ''),
    h('p', { class: 'texte-3 tres-petit adm-resume__date' }, `Au ${formatDateCourte(d.aujourdhui)}, semaine ${numeroSemaine(d.semaine)}`));
}

function bloc(titre, ...contenu) {
  return h('div', { class: 'adm-carte__bloc' }, h('h4', { class: 'adm-carte__titre' }, titre), ...contenu);
}

function carteJeu(j) {
  const r = j.resultats;
  const a = j.alertes;
  return h('article', { class: ['adm-carte', !j.actif && 'adm-carte--inactive'], style: styleCouleurJeu(j.couleur) },
    h('header', { class: 'adm-carte__tete' },
      puceJeu(j),
      h('h3', { class: 'adm-carte__nom' }, j.nom),
      j.actif ? null : puce('désactivé', 'attention'),
      h('a', { href: `#/${encodeURIComponent(j.id)}`, class: 'btn btn--petit adm-carte__ouvrir', 'aria-label': `Ouvrir ${j.nom}` }, 'Ouvrir', icone('droite'))),
    h('p', { class: 'adm-carte__effectif' },
      `${j.effectif.joueurs} joueur${j.effectif.joueurs > 1 ? 's' : ''} · ${j.effectif.staff} staff · ${j.effectif.comptes} compte${j.effectif.comptes > 1 ? 's' : ''}`),
    h('div', { class: 'adm-carte__chiffres' },
      h('div', {}, h('span', { class: 'chiffre' }, j.presence === null ? '—' : `${j.presence} %`), h('span', { class: 'texte-3 tres-petit' }, 'présence sur 30 jours')),
      h('div', {}, h('span', { class: 'chiffre' }, r.joues30 ? `${r.winrate30} %` : '—'), h('span', { class: 'texte-3 tres-petit' }, `victoires sur 30 jours (${r.joues30} joué${r.joues30 > 1 ? 's' : ''})`))),
    bloc('Derniers résultats', r.derniers.length
      ? h('ol', { class: 'adm-carte__resultats' }, r.derniers.map((x) => h('li', {
        class: `resultat resultat--${x.resultat}`,
        title: `${formatDateCourte(x.date)} · ${x.adversaire} · ${x.score}`,
        'aria-label': `${RESULTATS[x.resultat] || x.resultat} contre ${x.adversaire}, ${x.score}`,
      }, x.resultat)))
      : h('p', { class: 'texte-3 petit' }, 'Aucun résultat.')),
    bloc('À venir', j.matchs.length || j.tournois.length
      ? h('ul', { class: 'adm-carte__liste' },
        j.matchs.map((m) => h('li', {}, icone('match', { classe: 'icone-texte' }), h('strong', {}, formatDateCourte(m.date)), m.heure ? ` ${m.heure}` : '',
          ` · ${m.adversaire}`, m.format ? h('span', { class: 'texte-3' }, ` (${m.format})`) : null)),
        j.tournois.map((t) => h('li', {}, icone('tournois', { classe: 'icone-texte' }), h('strong', {}, t.debut ? formatDateCourte(t.debut) : 'date à fixer'),
          ` · ${t.nom} `, puce(libelleStatutTournoi(t.statut), t.statut === 'inscrit' ? 'positif' : ''))))
      : h('p', { class: 'texte-3 petit' }, 'Rien de prévu.')),
    bloc(a.total ? `Santé : ${a.total} alerte${a.total > 1 ? 's' : ''}${a.attention ? `, ${a.attention} à surveiller` : ''}` : 'Santé',
      a.premieres.length
        ? h('ul', { class: 'adm-carte__alertes' }, a.premieres.map((x) => h('li', {},
          x.niveau === 'attention' ? puce('À surveiller', 'attention') : puce('Info', 'info'),
          h('a', { href: lienDuJeu(j.id, x.lien) }, x.texte))))
        : h('p', { class: 'petit texte-positif' }, icone('ok', { classe: 'icone-texte' }), ' Aucune alerte.')),
    h('p', { class: 'adm-carte__meta texte-3 petit' }, icone('meta', { classe: 'icone-texte' }), ' ', j.meta
      ? [`Patch ${j.meta.patch || '?'}, vérifiée ${j.meta.derniereVerif ? ilYA(j.meta.derniereVerif) : 'jamais'}`,
        j.meta.statut === 'echec' ? [' ', puce('échec', 'negatif')] : null]
      : 'Méta non disponible'));
}
