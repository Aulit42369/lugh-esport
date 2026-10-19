// Tournois : de l'inscription au résultat. À venir et en cours (parcours daté, compte à rebours de la date limite),
// terminés (place et résultat), abandonnés (repliés). Les rappels de l'accueil (J-7, J-2, début imminent, roster vide,
// résultat à saisir) renvoient ici : ils sont repris en tête de page et marqués sur la carte du tournoi concerné.

import { h, bouton, etatVide, lienExterne } from '../ui.js';
import { icone, symboleRole } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puce, signature } from '../composants/jetons.js';
import { rappelsTournois } from '/shared/organisation.js';
import { STATUTS_TOURNOI, libelle } from '/shared/referentiel.js';
import { civileDepuisIso, formatDate, formatDateCourte } from '/shared/temps.js';
import { editeur, saisirResultat, changerStatut, abandonner } from './tournois-editeur.js';
import { pluriel } from './maps-outils.js';

const ACTIFS = ['envisage', 'inscrit', 'encours'];
const TONS = { envisage: '', inscrit: 'info', encours: 'accent', termine: 'positif', abandonne: 'negatif' };

const aujourdhui = () => E.serveur()?.aujourdhui || new Date().toISOString().slice(0, 10);

function joursJusqua(iso, auj) {
  const a = civileDepuisIso(auj);
  const b = civileDepuisIso(iso);
  return Math.round((Date.UTC(b.a, b.m - 1, b.j) - Date.UTC(a.a, a.m - 1, a.j)) / 86_400_000);
}

const dans = (n) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);
const placeLisible = (n) => `${n}${n === 1 ? 're' : 'e'} place`;
const cleDate = (t) => t.debut || t.dateLimite || '9999-12-31';
const pucesStatut = (s) => puce(libelle(STATUTS_TOURNOI, s, 'Envisagé'), TONS[s] || '');

function periode(t) {
  if (!t.debut) return t.fin ? `Jusqu’au ${formatDate(t.fin)}` : 'Dates à venir';
  if (!t.fin || t.fin === t.debut) return `Le ${formatDate(t.debut)}`;
  return `Du ${formatDateCourte(t.debut)} au ${formatDate(t.fin)}`;
}

// Compte à rebours de la date limite d'un tournoi envisagé : urgent à J-2, avec texte et icône (jamais la couleur seule).
function echeance(t, auj) {
  if (t.statut !== 'envisage' || !t.dateLimite) return null;
  const n = joursJusqua(t.dateLimite, auj);
  const quand = formatDateCourte(t.dateLimite);
  if (n < 0) return { ton: 'passee', icone: 'alerte', texte: `Date limite passée (${quand}) : l’équipe est-elle inscrite ?` };
  if (n === 0) return { ton: 'urgent', icone: 'alerte', texte: `Urgent : dernier jour pour s’inscrire (${quand})` };
  if (n <= 2) return { ton: 'urgent', icone: 'alerte', texte: `Urgent : inscription à boucler ${dans(n)} (${quand})` };
  if (n <= 7) return { ton: 'bientot', icone: 'planning', texte: `Date limite d’inscription ${dans(n)} (${quand})` };
  return { ton: '', icone: 'planning', texte: `Date limite d’inscription le ${quand}, ${dans(n)}` };
}

function ligneEcheance({ ton, icone: nom, texte }) {
  return h('p', { class: ['echeance', ton && `echeance--${ton}`] }, icone(nom), h('span', {}, texte));
}

function roster(t) {
  const ids = t.roster || [];
  if (!ids.length) {
    return h('p', { class: 'texte-3 petit' }, t.statut === 'envisage' ? 'Roster à choisir.' : 'Aucun joueur dans le roster inscrit.');
  }
  const avecRoles = J.roles(true).length > 1;
  return h('div', { class: 'pile-s' },
    h('span', { class: 'texte-3 tres-petit' }, `${t.statut === 'envisage' ? 'Roster prévu' : 'Roster inscrit'} (${ids.length})`),
    h('ul', { class: 'roster-tournoi' }, ids.map((id) => {
      const m = E.doc('membres', id);
      const role = avecRoles && m?.roleJeu ? J.role(m.roleJeu) : null;
      return h('li', { class: ['membre-tournoi', role && J.classeRole(m.roleJeu)] },
        role ? symboleRole(J.indexRole(m.roleJeu)) : null,
        h('span', {}, m ? E.nomMembre(m) : 'Ancien membre'),
        role ? h('abbr', { title: role.nom }, role.court || role.nom) : null);
    })));
}

function actions(t, { editable, auj }) {
  if (!editable) return null;
  // Le résultat se saisit une fois le tournoi commencé (ou sans date connue).
  const commence = t.statut === 'encours' || (t.statut === 'inscrit' && (!t.debut || t.debut <= auj));
  return h('div', { class: 'rangee carte-tournoi__actions' },
    t.statut === 'envisage' ? bouton('Nous sommes inscrits', { icone: 'ok', classe: 'btn--petit btn--principal', onclick: () => changerStatut(t, 'inscrit') }) : null,
    commence ? bouton('Saisir le résultat', { icone: 'tournois', classe: 'btn--petit btn--principal', onclick: () => saisirResultat(t) }) : null,
    ACTIFS.includes(t.statut) ? bouton('Abandonner', { classe: 'btn--petit btn--discret', onclick: () => abandonner(t) }) : null,
    t.statut === 'abandonne' ? bouton('Reprendre', { classe: 'btn--petit btn--discret', onclick: () => changerStatut(t, 'envisage') }) : null,
    bouton('Modifier', { icone: 'modifier', classe: 'btn--petit btn--discret', onclick: () => editeur(t) }));
}

function carteTournoi(t, { auj, editable }) {
  const delai = echeance(t, auj);
  // Rappels de l'accueil propres à ce tournoi ; celui de la date limite est déjà le compte à rebours.
  const rappels = rappelsTournois([t], auj);
  const autres = t.statut === 'envisage' ? [] : rappels;
  const urgent = rappels.some((r) => r.niveau === 'attention');
  const details = [['Dates', periode(t)], ['Format', t.format]].filter(([, v]) => v);
  return h('article', {
    class: ['fiche', 'carte-tournoi', urgent && 'carte-tournoi--urgent', !urgent && rappels.length && 'carte-tournoi--a-traiter'],
    id: `tournoi-${t._id}`,
    tabindex: '-1',
  },
  h('div', { class: 'carte-tournoi__tete' },
    h('div', { class: 'carte-tournoi__titre' }, h('h3', {}, t.nom), t.organisateur ? h('span', { class: 'texte-3 petit' }, t.organisateur) : null),
    pucesStatut(t.statut)),
  delai ? ligneEcheance(delai) : null,
  autres.map((r) => ligneEcheance({ ton: r.niveau === 'attention' ? 'urgent' : 'info', icone: r.niveau === 'attention' ? 'alerte' : 'info', texte: r.texte })),
  t.statut === 'termine' ? h('div', { class: 'resultat-tournoi' },
    t.place ? h('span', { class: 'resultat-tournoi__place' }, placeLisible(t.place)) : null,
    h('span', { class: t.resultat ? 'petit' : 'texte-3 petit' }, t.resultat || (t.place ? '' : 'Résultat à préciser'))) : null,
  details.length ? h('dl', { class: 'details' }, details.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])) : null,
  roster(t),
  t.notes ? h('p', { class: 'texte-multi petit texte-2' }, t.notes) : null,
  t.lien ? lienExterne(t.lien, 'Page du tournoi', { classe: 'petit' }) : null,
  actions(t, { editable, auj }),
  signature(t));
}

// Parcours des tournois à venir : la date de début dans un poste (cercle), un trait les relie dans l'ordre.
function parcours(liste_, options) {
  return h('ol', { class: 'parcours-tournois' }, liste_.map((t) => {
    const rappels = rappelsTournois([t], options.auj);
    const urgent = rappels.some((r) => r.niveau === 'attention');
    const [jour, ...mois] = t.debut ? formatDateCourte(t.debut).split(' ') : [];
    return h('li', { class: ['etape-tournoi', urgent && 'etape-tournoi--urgent', t.statut === 'encours' && 'etape-tournoi--encours'] },
      h('div', { class: 'etape-tournoi__poste', 'aria-hidden': 'true' },
        t.debut ? [h('span', { class: 'etape-tournoi__jour' }, jour), h('span', { class: 'etape-tournoi__mois' }, mois.join(' '))]
          : h('span', { class: 'etape-tournoi__mois' }, 'date ?')),
      carteTournoi(t, options));
  }));
}

// Rappels en tête de page : chacun mène à la carte du tournoi concerné.
function blocRappels(tournois, auj) {
  const rappels = tournois.flatMap((t) => rappelsTournois([t], auj).map((r) => ({ ...r, t })))
    .sort((a, b) => (a.niveau === 'attention' ? 0 : 1) - (b.niveau === 'attention' ? 0 : 1));
  if (!rappels.length) return null;
  const montrer = (t) => {
    const carte = document.getElementById(`tournoi-${t._id}`);
    if (!carte) return;
    carte.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    carte.focus({ preventScroll: true });
    carte.classList.remove('carte-tournoi--reperee');
    requestAnimationFrame(() => carte.classList.add('carte-tournoi--reperee'));
    setTimeout(() => carte.classList.remove('carte-tournoi--reperee'), 2000);
  };
  return h('section', { class: 'rappels-tournois' },
    h('h2', { class: 'rappels-tournois__titre' }, 'À traiter'),
    rappels.map((r) => h('button', { type: 'button', class: `alerte alerte--${r.niveau}`, onclick: () => montrer(r.t) },
      icone(r.niveau === 'attention' ? 'alerte' : 'info'), h('span', {}, r.texte), icone('bas'))));
}

export function rendre(page) {
  const auj = aujourdhui();
  const editable = E.peut('tournois.modifier');
  const tous = E.liste('tournois');
  const recents = (a, b) => (b.debut || b.fin || '').localeCompare(a.debut || a.fin || '') || a.nom.localeCompare(b.nom, 'fr');
  const actifs = tous.filter((t) => ACTIFS.includes(t.statut)).sort((a, b) => cleDate(a).localeCompare(cleDate(b)) || a.nom.localeCompare(b.nom, 'fr'));
  const termines = tous.filter((t) => t.statut === 'termine').sort(recents);
  const abandonnes = tous.filter((t) => t.statut === 'abandonne').sort(recents);
  const options = { auj, editable };
  const nouveau = editable ? bouton('Nouveau tournoi', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeur() }) : null;

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Tournois'),
      h('p', { class: 'entete-page__intro' },
        'Les tournois de l’équipe, de l’inscription au résultat. La date limite d’inscription déclenche des rappels à J-7 puis J-2 sur l’accueil.')),
    nouveau ? h('div', { class: 'entete-page__actions' }, nouveau) : null));

  if (!tous.length) {
    page.append(etatVide(editable
      ? 'Aucun tournoi pour l’instant. Ajoute ceux que l’équipe envisage avec leur date limite d’inscription : l’accueil te préviendra à temps.'
      : 'Aucun tournoi pour l’instant. Le staff les ajoute ici dès qu’une inscription se prépare.',
    editable ? bouton('Nouveau tournoi', { classe: 'btn--principal', onclick: () => editeur() }) : null));
    return;
  }

  const rappels = blocRappels(tous, auj);
  if (rappels) page.append(rappels);

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'À venir et en cours'), h('span', { class: 'section__aide' }, pluriel(actifs.length, 'tournoi'))),
    actifs.length ? parcours(actifs, options)
      : h('p', { class: 'texte-3' }, 'Aucun tournoi prévu. Ajoute le prochain dès que ses inscriptions ouvrent.')));

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Terminés'), h('span', { class: 'section__aide' }, pluriel(termines.length, 'tournoi'))),
    termines.length ? h('div', { class: 'grille-tournois' }, termines.map((t) => carteTournoi(t, options)))
      : h('p', { class: 'texte-3' }, 'Aucun tournoi terminé pour l’instant.')));

  if (abandonnes.length) {
    page.append(h('details', { class: 'section tournois-abandonnes' },
      h('summary', {}, h('strong', {}, `Abandonnés (${abandonnes.length})`)),
      h('div', { class: 'grille-tournois' }, abandonnes.map((t) => carteTournoi(t, options)))));
  }
}
