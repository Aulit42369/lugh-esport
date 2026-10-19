// Bilan du mois : résultats (selon le type de score du jeu), présences, objectifs atteints, chiffres du jeu,
// comptes rendus de séance, tournois et état du map pool, prêt à imprimer en PDF.

import { h, bouton, pourcentage } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jour } from '../navigation.js';
import { nomMap, puce, puceStatutMap, jauge } from '../composants/jetons.js';
import { copierTexte } from '../composants/sorties.js';
import { nombre } from '../composants/courbe.js';
import { tuilesResultats, tableauParMap } from './scrims.js';
import { formatChiffre, ecartChiffre } from './progression-chiffres.js';
import { bilanMois, moisDeSemaine } from '/shared/suivi.js';
import { objectifParId } from '/shared/jeux/contenus.js';
import { libelleStatutTournoi } from '/shared/organisation.js';
import { couper } from '/shared/discord.js';
import { joursDe, formatJour, formatDateCourte } from '/shared/temps.js';

// Au-delà de ce nombre de comptes rendus dans le mois, chacun est raccourci pour garder le bilan lisible.
const SEANCES_EN_ENTIER = 6;
const COURT = 150;

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function decaler(mois, n) {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nomMois(mois) {
  const [a, m] = mois.split('-').map(Number);
  return `${NOMS_MOIS[m - 1]} ${a}`;
}

// Texte d'un objectif atteint : objectif du jeu (individuel ou collectif) ou objectif personnalisé.
function texteObjectif(id, membreId) {
  return objectifParId(J.def(), id)?.texte || (E.doc('objectifs', membreId)?.perso || []).find((x) => x.id === id)?.texte || '';
}

function resumeResultats(s) {
  if (!s.total) return 'Aucun match ce mois-ci.';
  if (J.typeScore() === 'classement') {
    const c = s.classement;
    return [`Résultats : ${c.parties} ${c.parties > 1 ? J.v('manches') : J.v('manche')}, ${c.top1} top 1`,
      c.placeMoyenne !== null ? `place moyenne ${nombre(c.placeMoyenne, 1)}` : null,
      c.pointsMoyens !== null ? `${nombre(c.pointsTotal, c.pointsTotal % 1 ? 1 : 0)} pts` : null].filter(Boolean).join(', ');
  }
  const parts = [`Résultats : ${s.victoires}V ${s.defaites}D${s.nuls ? ` ${s.nuls}N` : ''} (${pourcentage(s.winrate)} de victoires)`];
  if (J.typeScore() === 'manches' && J.camps().length === 2) parts.push(...J.camps().map((c) => `${c.nom} ${pourcentage(s.cotes[c.id]?.taux)}`));
  else parts.push(`${J.v('manches')} ${s.roundsPour}–${s.roundsContre}`);
  return parts.join(', ');
}

const place = (n) => (n === 1 ? '1re' : `${n}e`);
const resultatTournoi = (t) => [typeof t.place === 'number' ? `${place(t.place)} place` : null, t.resultat || null].filter(Boolean).join(', ')
  || libelleStatutTournoi(t.statut);

function texteDiscord(b, eq, presence) {
  const nb = Object.values(b.atteints).reduce((n, l) => n + l.length, 0);
  return couper([`📊 **Bilan de ${nomMois(b.mois)}${eq.nom ? ` : ${eq.nom}` : ''}** (${J.def().nom})`,
    resumeResultats(b.scrims),
    ...b.tournois.map((t) => `🏆 ${t.nom} : ${resultatTournoi(t)}`),
    presence !== null ? `Présence moyenne : ${presence} %` : null,
    `Objectifs atteints : ${nb}`,
    b.seances.length ? `Comptes rendus de séance : ${b.seances.length}` : null].filter(Boolean).join('\n'));
}

// Rang de la dernière semaine du mois qui en indique un.
function rangDuMois(membreId, mois) {
  const m = E.liste('mesures')
    .filter((x) => x.membreId === membreId && x.rang && /^\d{4}-W\d{2}$/.test(x.semaine || '') && moisDeSemaine(x.semaine) === mois)
    .sort((a, b) => b.semaine.localeCompare(a.semaine))[0];
  return m ? J.nomRang(m.rang) : '—';
}

function celluleChiffre(c, actuel, avant) {
  if (typeof actuel !== 'number') return h('td', { class: 'num' }, '—');
  const e = ecartChiffre(c, actuel, avant);
  return h('td', { class: 'num' }, formatChiffre(c, actuel),
    e ? h('span', { class: 'bilan__ecart' }, e, h('span', { class: 'visuellement-cache' }, ' par rapport au mois précédent')) : null);
}

function sectionResultats(page, s) {
  page.append(h('section', { class: 'section bilan-resultats' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Résultats'), s.total ? h('span', { class: 'section__aide' }, `${s.total} ${s.total > 1 ? 'résultats saisis' : 'résultat saisi'} ce mois-ci`) : null),
    s.total ? tuilesResultats(s, { formeRecente: false }) : h('p', { class: 'texte-3' }, 'Aucun scrim ni match saisi ce mois-ci.'),
    s.total && J.aCartes() ? tableauParMap(s, { liens: false }) : null));
}

function sectionJoueurs(page, b, joueurs) {
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Joueurs'),
      h('span', { class: 'section__aide' }, 'Présence : présent ou en retard ; les absences excusées ne comptent pas.')),
    h('div', { class: 'defile' }, h('table', { class: 'tableau' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Joueur'), h('th', { class: 'num' }, 'Présence'), h('th', { class: 'num' }, 'Absences'),
        h('th', { class: 'num' }, 'Retards'), h('th', { class: 'num' }, 'Objectifs atteints'))),
      h('tbody', {}, joueurs.map((j) => {
        const p = b.presences[j._id];
        return h('tr', {},
          h('td', {}, E.nomMembre(j)),
          h('td', { class: 'num' }, p ? pourcentage(p.taux) : '—'),
          h('td', { class: 'num' }, p ? String(p.absent) : '—'),
          h('td', { class: 'num' }, p ? String(p.retard) : '—'),
          h('td', { class: 'num' }, String((b.atteints[j._id] || []).length)));
      }))))));
}

function sectionChiffres(page, b, joueurs, mois) {
  const chiffres = J.chiffres();
  const avecRangs = J.rangs(true).length > 0;
  const saisis = joueurs.filter((j) => b.chiffres[j._id]?.mois);
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Chiffres du mois'),
      h('span', { class: 'section__aide' }, 'Moyenne des semaines du mois ; en dessous, l’écart avec le mois précédent.')),
    saisis.length ? h('div', { class: 'defile' }, h('table', { class: 'tableau tableau--chiffres' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Joueur'), avecRangs ? h('th', {}, 'Rang') : null,
        chiffres.map((c) => h('th', { class: 'num' }, c.nom)), h('th', { class: 'num' }, 'Parties'))),
      h('tbody', {}, saisis.map((j) => {
        const c = b.chiffres[j._id];
        return h('tr', {},
          h('td', {}, E.nomMembre(j)),
          avecRangs ? h('td', {}, rangDuMois(j._id, mois)) : null,
          chiffres.map((x) => celluleChiffre(x, c.mois.valeurs[x.id], c.precedent.valeurs[x.id])),
          h('td', { class: 'num' }, c.mois.parties ? String(c.mois.parties) : '—'));
      }))))
      : h('p', { class: 'texte-3' }, 'Aucun chiffre saisi ce mois-ci.')));
}

function sectionObjectifs(page, b, joueurs) {
  const parJoueur = joueurs.map((j) => ({ j, textes: (b.atteints[j._id] || []).map((id) => texteObjectif(id, j._id)).filter(Boolean) })).filter((x) => x.textes.length);
  const collectifs = (b.atteints.equipe || []).map((id) => texteObjectif(id, 'equipe')).filter(Boolean);
  if (!parJoueur.length && !collectifs.length) return;
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Objectifs atteints')),
    h('div', { class: 'grille-2 bilan-objectifs' },
      collectifs.length ? h('div', { class: 'fiche fiche--serree pile-s' }, h('h3', {}, 'Équipe'), h('ul', { class: 'liste-puces petit' }, collectifs.map((t) => h('li', {}, t)))) : null,
      parJoueur.map(({ j, textes }) => h('div', { class: 'fiche fiche--serree pile-s' }, h('h3', {}, E.nomMembre(j)),
        h('ul', { class: 'liste-puces petit' }, textes.map((t) => h('li', {}, t))))))));
}

// ——— Comptes rendus de séance : date, titre, travaillé, positif, à revoir (version courte si le mois en compte beaucoup) ———

function compteRendu(c, court) {
  const jourSeance = joursDe(c.semaine)[(c.jour || 1) - 1];
  const raccourcir = (t) => (court && t.length > COURT ? `${t.slice(0, COURT - 1).trimEnd()}…` : t);
  const ligne = (titre, texte, classe) => (texte ? [h('dt', { class: classe }, titre), h('dd', { class: 'texte-multi' }, raccourcir(texte))] : null);
  return h('article', { class: 'fiche fiche--serree compte-rendu' },
    h('header', { class: 'compte-rendu__tete' },
      h('span', { class: 'compte-rendu__quand' }, `${jourSeance ? formatJour(jourSeance.civ) : ''}, ${c.debut}`),
      h('h3', {}, c.titre || J.nomTypeBloc(c.type) || 'Séance'),
      h('a', { href: J.lien(`/planning/${c.semaine}`), class: 'petit sans-impression' }, 'Voir la semaine')),
    h('dl', { class: 'compte-rendu__details' },
      ligne('Travaillé', c.travaille, ''),
      ligne('Positif', c.positif, 'compte-rendu__positif'),
      ligne('À revoir', c.aRevoir, 'compte-rendu__revoir')));
}

function sectionSeances(page, seances) {
  const court = seances.length > SEANCES_EN_ENTIER;
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Comptes rendus de séance'),
      seances.length ? h('span', { class: 'section__aide' }, `${seances.length} séance${seances.length > 1 ? 's' : ''}${court ? ' : version courte, le détail est dans le planning' : ''}.`) : null),
    seances.length ? h('div', { class: 'grille-2 bilan-seances' }, seances.map((c) => compteRendu(c, court)))
      : h('p', { class: 'texte-3' }, 'Aucun compte rendu de séance ce mois-ci : il se remplit depuis le planning, après chaque séance.')));
}

// ——— Tournois joués ou terminés dans le mois : place, résultat, roster ———

function sectionTournois(page, tournois) {
  const dates = (t) => [t.debut, t.fin && t.fin !== t.debut ? t.fin : null].filter(Boolean).map(formatDateCourte).join(' → ') || '—';
  const roster = (t) => (t.roster || []).map((id) => E.nomMembre(E.doc('membres', id))).join(', ') || '—';
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Tournois du mois'),
      h('a', { href: J.lien('/tournois'), class: 'petit sans-impression' }, 'Tous les tournois')),
    tournois.length ? h('div', { class: 'defile' }, h('table', { class: 'tableau tableau--tournois' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Tournoi'), h('th', {}, 'Dates'), h('th', { class: 'num' }, 'Place'), h('th', {}, 'Résultat'), h('th', {}, 'Roster'))),
      h('tbody', {}, tournois.map((t) => h('tr', {},
        h('td', {}, h('strong', {}, t.nom), t.organisateur ? h('span', { class: 'bilan__ecart' }, t.organisateur) : null),
        h('td', {}, dates(t)),
        h('td', { class: 'num' }, typeof t.place === 'number' ? place(t.place) : '—'),
        h('td', {}, t.resultat || puce(libelleStatutTournoi(t.statut), t.statut === 'encours' ? 'info' : '')),
        h('td', { class: 'petit' }, roster(t)))))))
      : h('p', { class: 'texte-3' }, 'Aucun tournoi joué ce mois-ci.')));
}

function sectionPool(page) {
  const meta = E.meta();
  const pool = meta?.mapPool || [];
  if (!J.aPool() || !pool.length) return;
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, `${J.v('cartes', true)} : le pool aujourd’hui`), h('span', { class: 'section__aide' }, meta?.patch ? `Patch ${meta.patch}` : '')),
    h('div', { class: 'grille-3' }, pool.map((id) => {
      const m = E.doc('mapsEquipe', id) || {};
      return h('div', { class: 'fiche fiche--serree pile-s' }, h('div', { class: 'rangee rangee--espace' }, h('strong', {}, nomMap(id)), puceStatutMap(m.statut)),
        jauge(m.preparation || 0, { legende: 'Préparation' }));
    }))));
}

export function rendre(page, params, ctx) {
  const courant = jour().slice(0, 7);
  const mois = /^\d{4}-(0[1-9]|1[0-2])$/.test(params[0] || '') ? params[0] : courant;
  const eq = E.equipe();
  const b = bilanMois({
    mois, scrims: E.liste('scrims'), presences: E.liste('presences'), objectifs: E.liste('objectifs'), mesures: E.liste('mesures'),
    seances: E.liste('seances'), tournois: E.liste('tournois'), def: J.def(),
  });
  const joueurs = E.joueurs().filter((j) => j.pseudo);
  const taux = joueurs.map((j) => b.presences[j._id]?.taux).filter((t) => typeof t === 'number');
  const presence = taux.length ? Math.round(taux.reduce((a, t) => a + t, 0) / taux.length) : null;

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('p', { class: 'bilan__surtitre' }, [J.def().nom, eq.nom].filter(Boolean).join(' · ')),
      h('h1', {}, `Bilan de ${nomMois(mois)}`),
      h('p', { class: 'entete-page__intro' }, `${eq.nom || 'L’équipe'} : résultats, tournois, présences, objectifs atteints, chiffres et comptes rendus du mois. Imprime-le en PDF pour le garder ou le partager.`)),
    h('div', { class: 'entete-page__actions sans-impression' },
      bouton('Copier pour Discord', { icone: 'discord', onclick: () => copierTexte(texteDiscord(b, eq, presence)) }),
      bouton('Imprimer ou PDF', { icone: 'imprimer', classe: 'btn--principal', onclick: () => window.print() }))));

  page.append(h('div', { class: 'barre-outils sans-impression' },
    h('div', { class: 'nav-semaine' },
      h('button', { type: 'button', class: 'btn btn--icone', 'aria-label': 'Mois précédent', onclick: () => ctx.aller(J.lien(`/bilan/${decaler(mois, -1)}`)) }, icone('gauche')),
      h('div', { class: 'nav-semaine__texte' }, h('strong', {}, nomMois(mois))),
      h('button', { type: 'button', class: 'btn btn--icone', 'aria-label': 'Mois suivant', disabled: mois >= courant, onclick: () => ctx.aller(J.lien(`/bilan/${decaler(mois, 1)}`)) }, icone('droite')))));

  sectionResultats(page, b.scrims);
  sectionTournois(page, b.tournois);
  sectionJoueurs(page, b, joueurs);
  sectionChiffres(page, b, joueurs, mois);
  sectionObjectifs(page, b, joueurs);
  sectionSeances(page, b.seances);
  sectionPool(page);
}
