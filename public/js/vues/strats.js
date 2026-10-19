// Stratbook : strats regroupées par map (jeu à map pool) ou par type (jeu sans pool), colonnes par camp quand le jeu
// en a, étapes et rôle de chaque titulaire. Types, camps et vocabulaire viennent de la définition du jeu affiché.

import { h, champ, saisie, liste, onglets, bouton, etatVide } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puceStatutStrat, puce, nomMap } from '../composants/jetons.js';
import { STATUTS_STRAT } from '/shared/referentiel.js';
import { editeur, detail, changerStatut } from './strats-editeur.js';
import { filtresDuJeu, optionsCamps, etiquetteCamp, repereCamp, nomCampOuDeux, accord, pluriel, guillemets } from './maps-outils.js';

const DEFAUTS = { camp: '', type: '', statut: 'actives', texte: '' };
const filtres = { jeu: '', ...DEFAUTS };
const MAX_ONGLETS = 8;

// Ordre des types : celui du jeu (types masqués compris), puis les inconnus.
const rangType = (id) => {
  const i = J.def().typesStrat.findIndex((t) => t.id === id);
  return i < 0 ? 99 : i;
};
const rangCamp = (id) => {
  const i = J.camps(true).findIndex((c) => c.id === id);
  return id ? (i < 0 ? 50 : i) : 90;
};
const parTypeEtNom = (a, b) => rangType(a.type) - rangType(b.type) || a.nom.localeCompare(b.nom, 'fr');

function carteStrat(s, { editable, pool, avecCamp = false, avecCarte = false, avecType = true }) {
  const peutArchiver = editable && J.aPool() && s.map && !pool.includes(s.map) && s.statut !== 'archivee';
  const suivant = s.statut === 'apprendre' ? 'rodage' : 'maitrisee';
  return h('article', { class: 'strat' },
    h('button', { type: 'button', class: 'strat__ouvrir', onclick: () => detail(s) },
      avecType ? h('span', { class: 'strat__type' }, J.nomTypeStrat(s.type)) : null,
      h('span', { class: 'strat__nom' }, s.nom),
      s.resume ? h('span', { class: 'texte-3 petit' }, s.resume) : null),
    h('div', { class: 'rangee' },
      puceStatutStrat(s.statut),
      avecCamp && (s.camp || J.camps().length) ? etiquetteCamp(s.camp, { classe: 'puce' }) : null,
      avecCarte && s.map ? puce(nomMap(s.map)) : null,
      h('span', { class: 'texte-3 tres-petit' }, pluriel(s.etapes?.length || 0, 'étape')),
      editable && s.statut !== 'maitrisee' && s.statut !== 'archivee'
        ? bouton(s.statut === 'apprendre' ? 'Passer en rodage' : 'Maîtrisée', { classe: 'btn--discret btn--petit', onclick: () => changerStatut(s, suivant) }) : null,
      peutArchiver ? bouton('Archiver', { classe: 'btn--discret btn--petit', onclick: () => changerStatut(s, 'archivee') }) : null));
}

// Colonnes par camp : camps actifs, camps masqués encore utilisés, puis « Les deux » (strats sans camp).
function colonnes(strats, options) {
  const ids = [...new Set([...J.camps().map((c) => c.id), ...strats.map((s) => s.camp || '')])]
    .filter((id) => id || strats.some((s) => !s.camp))
    .sort((a, b) => rangCamp(a) - rangCamp(b));
  if (!J.camps(true).length || !ids.length || (ids.length === 1 && !ids[0])) {
    return h('div', { class: 'grille-strats' }, [...strats].sort(parTypeEtNom).map((s) => carteStrat(s, options)));
  }
  return h('div', { class: 'colonnes-strats', style: { '--n': String(ids.length) } }, ids.map((id) => {
    const duCamp = strats.filter((s) => (s.camp || '') === id).sort(parTypeEtNom);
    return h('div', { class: 'pile-s' },
      h('h3', { class: 'sous-titre legende-camp' }, repereCamp(id), nomCampOuDeux(id)),
      duCamp.length ? duCamp.map((s) => carteStrat(s, options)) : h('p', { class: 'texte-3 petit' }, 'Aucune strat.'));
  }));
}

function sectionsParCarte(page, visibles, options) {
  const { pool } = options;
  const rang = (id) => (pool.indexOf(id) + 1 || 99);
  const groupes = [...new Set(visibles.map((s) => s.map || ''))].sort((a, b) => rang(a) - rang(b) || nomMap(a).localeCompare(nomMap(b), 'fr'));
  for (const mapId of groupes) {
    const strats = visibles.filter((s) => (s.map || '') === mapId);
    page.append(h('section', { class: 'section' },
      h('div', { class: 'section__entete' },
        h('div', { class: 'rangee' }, h('h2', {}, mapId ? nomMap(mapId) : `Sans ${J.v('carte')}`), mapId && !pool.includes(mapId) ? puce('Hors pool', 'attention') : null),
        mapId ? h('a', { href: J.lien(`/maps/${mapId}`), class: 'petit' }, 'Fiche et compo') : null),
      colonnes(strats, options)));
  }
}

function sectionsParType(page, visibles, options) {
  const types = [...new Set(visibles.map((s) => s.type))].sort((a, b) => rangType(a) - rangType(b));
  for (const id of types) {
    const t = J.def().typesStrat.find((x) => x.id === id);
    const strats = visibles.filter((s) => s.type === id).sort((a, b) => rangCamp(a.camp) - rangCamp(b.camp) || a.nom.localeCompare(b.nom, 'fr'));
    page.append(h('section', { class: 'section' },
      h('div', { class: 'section__entete' }, h('h2', {}, J.nomTypeStrat(id)), t?.resume ? h('span', { class: 'section__aide' }, t.resume) : null),
      h('div', { class: 'grille-strats' }, strats.map((s) => carteStrat(s, { ...options, avecCamp: true, avecCarte: J.aCartes(), avecType: false })))));
  }
}

// Choix de la map : onglets pour un petit pool, liste déroulante au-delà.
function choixCarte(ids, actuel, ctx) {
  const aller = (v) => ctx.aller(J.lien(v ? `/strats/${v}` : '/strats'));
  const tous = `${accord(J.v('cartes'), 'Tous', 'Toutes')}`;
  if (ids.length + 1 <= MAX_ONGLETS) {
    return onglets([{ valeur: '', libelle: tous }, ...ids.map((id) => ({ valeur: id, libelle: nomMap(id) }))], actuel, aller, { libelle: J.v('carte', true) });
  }
  const select = liste(ids.map((id) => ({ valeur: id, libelle: nomMap(id) })), { valeur: actuel, vide: tous, class: 'saisie saisie--compacte' });
  select.addEventListener('change', () => aller(select.value));
  return champ(J.v('carte', true), select);
}

export function rendre(page, params, ctx) {
  filtresDuJeu(filtres, DEFAUTS);
  const parCarte = J.aPool();
  const pool = parCarte ? E.meta()?.mapPool || [] : [];
  const toutes = E.liste('strats');
  // Une ancienne adresse (ex. « strats/fiche-roles », page retirée) ne filtre rien : seule une map connue filtre.
  const connues = new Set([...(E.meta()?.maps || []).map((m) => m.id), ...toutes.map((s) => s.map).filter(Boolean)]);
  const mapFiltre = parCarte && connues.has(params[0]) ? params[0] : '';
  const editable = E.peut('strats.modifier');
  const camps = J.camps();
  const texteFiltre = filtres.texte.toLowerCase();
  const correspond = (s) => (!mapFiltre || s.map === mapFiltre)
    && (!filtres.camp || !s.camp || s.camp === filtres.camp)
    && (!filtres.type || s.type === filtres.type)
    && (filtres.statut === 'toutes' || (filtres.statut === 'actives' ? s.statut !== 'archivee' : s.statut === filtres.statut))
    && (!texteFiltre || `${s.nom} ${s.resume}`.toLowerCase().includes(texteFiltre));
  const visibles = toutes.filter(correspond);
  const nouvelle = () => editeur(null, { map: mapFiltre });

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Stratbook'),
      h('p', { class: 'entete-page__intro' },
        `Strats rangées par ${parCarte ? J.v('carte') : 'type'}, chacune avec ses étapes et le rôle de chaque titulaire. `,
        `Une strat passe de ${guillemets('à apprendre')} à ${guillemets('maîtrisée')} au fil des entraînements.`)),
    editable ? h('div', { class: 'entete-page__actions' }, bouton('Nouvelle strat', { icone: 'ajouter', classe: 'btn--principal', onclick: nouvelle })) : null));

  if (parCarte) {
    const ids = [...new Set([...pool, ...toutes.map((s) => s.map).filter(Boolean)])];
    page.append(h('div', { class: 'barre-outils' }, choixCarte(ids, mapFiltre, ctx)));
  }

  const rafraichir = () => ctx.rafraichir();
  const types = J.typesStrat(filtres.camp);
  const texte = saisie({ type: 'search', valeur: filtres.texte, placeholder: 'Nom ou résumé' });
  texte.addEventListener('change', () => { filtres.texte = texte.value; rafraichir(); });
  page.append(h('div', { class: 'filtres' },
    camps.length ? champ('Camp', liste(optionsCamps(), {
      valeur: filtres.camp,
      vide: 'Tous',
      onchange: (e) => {
        filtres.camp = e.target.value;
        if (filtres.type && !J.typesStrat(filtres.camp).some((t) => t.id === filtres.type)) filtres.type = '';
        rafraichir();
      },
    })) : null,
    champ('Type', liste(types.map((t) => ({ valeur: t.id, libelle: t.nom })), { valeur: filtres.type, vide: 'Tous', onchange: (e) => { filtres.type = e.target.value; rafraichir(); } })),
    champ('Statut', liste([{ valeur: 'actives', libelle: 'Actives' }, ...STATUTS_STRAT.map((x) => ({ valeur: x.id, libelle: x.nom })), { valeur: 'toutes', libelle: 'Toutes' }],
      { valeur: filtres.statut, onchange: (e) => { filtres.statut = e.target.value; rafraichir(); } })),
    champ('Rechercher', texte)));

  if (!visibles.length) {
    const premier = J.typesStrat()[0]?.nom;
    page.append(etatVide(toutes.length
      ? 'Aucune strat ne correspond à ces filtres.'
      : `Le stratbook est vide. Commence par une strat simple${premier ? ` (${premier.toLowerCase()})` : ''}${parCarte ? ` sur votre ${accord(J.v('carte'), 'meilleur', 'meilleure')} ${J.v('carte')}` : ''}.`,
    editable ? bouton('Nouvelle strat', { classe: 'btn--principal', onclick: nouvelle }) : null));
    return;
  }
  const options = { editable, pool };
  if (parCarte) sectionsParCarte(page, visibles, options);
  else sectionsParType(page, visibles, options);
}
