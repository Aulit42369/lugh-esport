// Jour de match : tout sur un seul écran, pensé d'abord pour le téléphone. Adversaire, horaire et format, plan de veto
// ou de draft, checklist d'avant-match, compo (par map pour un jeu à map pool), notes par map, points forts et faibles
// de l'adversaire, et la saisie du résultat. Par défaut le prochain match ; #/<jeu>/match/<adversaire> en choisit un autre.

import { h, etatVide, liste, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { themeActuel, definirTheme } from '../theme.js';
import { puce, puceStatutMap, nomMap, nomPersonnage, jetonPersonnage, jetonRole } from '../composants/jetons.js';
import { matchsAVenir } from './accueil-sections.js';
import { aujourdhui, formatDateCourte, formatJour, civileDepuisIso } from '/shared/temps.js';

// Formulaire de résultat de la page Scrims, chargé dès l'affichage : sans nouveauScrim, le bouton reste un lien.
let saisieScrims = null;
function chargerSaisie() {
  import('./scrims-saisie.js').then((m) => { saisieScrims = m; }).catch(() => { saisieScrims = {}; });
}

const ORDRE_STATUT = { pick: 0, confort: 1, travail: 2, ban: 3 };
const libellePlan = () => (J.typeVeto() === 'draft' ? 'Plan de draft' : 'Plan de veto');
const libelleDebuts = () => (J.def().score?.pistols ? 'Pistols' : 'Débuts de partie');
// Points forts et faibles de l'adversaire : des personnages en draft, des maps si le jeu en a, sinon rien.
function genreListes() {
  if (J.typeVeto() === 'draft' && J.aPersonnages()) return 'personnages';
  return J.aCartes() ? 'cartes' : null;
}

function joursAvant(iso) {
  const a = civileDepuisIso(aujourdhui());
  const b = civileDepuisIso(iso);
  return Math.round((Date.UTC(b.a, b.m - 1, b.j) - Date.UTC(a.a, a.m - 1, a.j)) / 86_400_000);
}

function quand(m) {
  if (!m?.date) return 'Date à fixer';
  const n = joursAvant(m.date);
  const heure = m.heure ? ` à ${m.heure}` : '';
  if (n === 0) return `Aujourd’hui${heure}`;
  if (n === 1) return `Demain${heure}`;
  const jour = formatJour(civileDepuisIso(m.date));
  const Jour = `${jour[0].toUpperCase()}${jour.slice(1)}`;
  return n < 0 ? `${Jour}${heure}, match passé` : `${Jour}${heure}, dans ${n} jours`;
}

// ——— En-tête : adversaire, quand, format, choix du match, affichage plein jour ———

function entete(a, choix, ctx) {
  const m = a.prochainMatch || {};
  const serie = J.typeScore() !== 'classement' && m.format ? J.nomFormat(m.format) : '';
  const veto = J.typeVeto();
  const premier = veto !== 'aucun' ? `${m.nousCommencons === false ? 'Ils commencent' : 'Nous commençons'} le ${veto === 'draft' ? 'draft' : 'veto'}` : '';
  const clair = themeActuel() === 'clair';
  return h('header', { class: 'match-entete' },
    h('div', { class: 'match-entete__haut' },
      h('span', { class: 'match-entete__etiquette' }, icone('match'), 'Jour de match'),
      h('button', {
        type: 'button', class: 'btn btn--petit match__theme', 'aria-pressed': String(clair),
        title: 'Thème clair, plus lisible au soleil (vaut pour cet appareil)',
        onclick: () => { definirTheme(clair ? 'sombre' : 'clair'); ctx.rafraichir(); },
      }, clair ? icone('ok') : null, 'Plein jour')),
    h('h1', { class: 'match-entete__nom' }, a.nom, a.tag ? h('span', { class: 'match-entete__tag' }, ` ${a.tag}`) : null),
    h('p', { class: 'match-entete__quand' }, quand(m)),
    h('div', { class: 'rangee' },
      serie ? puce(serie, 'plein') : null,
      premier ? puce(premier, 'accent') : null,
      a.circuit ? h('span', { class: 'texte-2 petit' }, a.circuit) : null),
    choix.length > 1
      ? liste(choix.map((x) => ({ valeur: x._id, libelle: `${x.nom}${x.prochainMatch?.date ? ` · ${formatDateCourte(x.prochainMatch.date)}${x.prochainMatch.heure ? ` ${x.prochainMatch.heure}` : ''}` : ''}` })), {
        valeur: a._id, class: 'saisie match__choix', 'aria-label': 'Choisir un autre match', onchange: (e) => ctx.aller(J.lien(`/match/${e.target.value}`)),
      })
      : null);
}

function actions(a) {
  const m = a.prochainMatch || {};
  let resultat = null;
  if (E.peut('scrims.modifier')) {
    chargerSaisie();
    resultat = h('a', {
      href: J.lien('/scrims'),
      class: 'btn btn--principal match__action',
      onclick: (e) => {
        if (typeof saisieScrims?.nouveauScrim !== 'function') return; // la page Scrims prend le relais
        e.preventDefault();
        saisieScrims.nouveauScrim({ adversaire: a.nom, date: m.date || aujourdhui(), heure: m.heure || '', type: 'officiel' });
      },
    }, icone('scrims'), 'Saisir le résultat');
  }
  return h('div', { class: 'match-actions' },
    resultat,
    h('a', { href: J.lien(`/adversaires/${a._id}`), class: 'btn match__action' }, icone('adversaires'), 'Fiche de l’adversaire'));
}

// ——— Checklist d'avant-match : enregistrée dans la fiche de l'adversaire ———

function checklist(a) {
  const editable = E.peut('adversaires.modifier');
  const connus = new Set(J.checklist(true).map((c) => c.id));
  const elements = J.checklist(true).filter((c) => !c.archive || a.checklist?.[c.id]);
  const faits = J.checklist().filter((c) => a.checklist?.[c.id]).length;
  const ligne = (c) => {
    const coche = !!a.checklist?.[c.id];
    if (!editable) {
      return h('li', { class: ['match-coche', coche && 'match-coche--fait'] },
        coche ? icone('ok', { classe: 'match-coche__etat' }) : h('span', { class: 'match-coche__vide' }), h('span', {}, c.nom),
        h('span', { class: 'visuellement-cache' }, coche ? ' : fait' : ' : à faire'));
    }
    const input = h('input', { type: 'checkbox', checked: coche });
    input.addEventListener('change', async () => {
      const valeur = Object.fromEntries(Object.entries({ ...a.checklist, [c.id]: input.checked }).filter(([k]) => connus.has(k)));
      try {
        await E.enregistrer('adversaires', a._id, { ...E.sansMeta(a), checklist: valeur }, { revBase: a.rev });
      } catch (err) {
        input.checked = !input.checked;
        toast(messageErreur(err), { type: 'erreur' });
      }
    });
    return h('li', {}, h('label', { class: ['match-coche', coche && 'match-coche--fait'] }, input, h('span', {}, c.nom)));
  };
  return h('section', { class: 'fiche match-carte match-checklist' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Checklist d’avant-match'), elements.length ? h('span', { class: 'match-compte' }, `${faits} sur ${J.checklist().length}`) : null),
    elements.length
      ? h('ul', { class: 'match-coches' }, elements.map(ligne))
      : h('p', { class: 'texte-3 petit' }, 'Aucun élément : la checklist se règle dans les Réglages du jeu.'),
    editable ? null : h('p', { class: 'texte-3 tres-petit' }, 'Lecture seule : le staff et le capitaine cochent les éléments.'));
}

// ——— Plan de veto ou de draft ———

function plan(a) {
  if (J.typeVeto() === 'aucun') return null;
  const regles = J.def().veto?.notes;
  return h('section', { class: 'fiche match-carte match-plan' },
    h('h2', {}, libellePlan()),
    a.planVeto ? h('p', { class: 'texte-multi match-plan__texte' }, a.planVeto) : h('p', { class: 'texte-3' }, 'Pas encore de plan : il se prépare dans la fiche de l’adversaire.'),
    regles ? h('details', { class: 'match-regles' }, h('summary', {}, `Règles de ${J.def().nom}`), h('p', { class: 'texte-multi petit texte-2' }, regles)) : null);
}

// ——— Compo : par map (jeu à map pool), compo principale (personnages sans maps), sinon les titulaires ———

function emplacements(compo = []) {
  const places = compo.filter((e) => e.personnage || e.membre);
  if (!places.length) return h('p', { class: 'texte-3 petit' }, 'Compo pas encore fixée.');
  return h('ul', { class: 'match-compo' }, places.map((e) => h('li', {},
    J.aPersonnages() ? jetonPersonnage(e.personnage) : null,
    h('span', { class: 'match-compo__joueur' }, e.membre ? E.nomMembre(E.doc('membres', e.membre)) : 'Joueur à placer'))));
}

function notesFiche(me) {
  const notes = Object.entries(me?.notes || {}).filter(([, t]) => t);
  if (!notes.length) return null;
  return h('dl', { class: 'match-notes' }, notes.map(([camp, texte]) => [
    h('dt', {}, camp === 'general' ? 'Notes' : J.nomCamp(camp, camp)),
    h('dd', { class: 'texte-multi' }, texte),
  ]));
}

function compoParMap(a) {
  const pool = E.meta()?.mapPool || [];
  const adverses = genreListes() === 'cartes';
  const marques = (id) => [
    adverses && (a.fortes || []).includes(id) ? puce('Leur point fort', 'negatif') : null,
    adverses && (a.faibles || []).includes(id) ? puce('Leur point faible', 'positif') : null,
    adverses && (a.bans || []).includes(id) ? puce('Leur ban habituel', 'attention') : null,
  ];
  const maps = pool.map((id) => ({ id, me: E.doc('mapsEquipe', id) }))
    .sort((x, y) => (ORDRE_STATUT[x.me?.statut] ?? 2) - (ORDRE_STATUT[y.me?.statut] ?? 2) || nomMap(x.id).localeCompare(nomMap(y.id), 'fr'));
  if (!maps.length) return h('p', { class: 'texte-3' }, `Pool de ${J.v('cartes')} pas encore connu.`);
  return h('div', { class: 'match-maps' }, maps.map(({ id, me }) => {
    const ouverte = ['pick', 'confort'].includes(me?.statut) || (adverses && (a.fortes || []).includes(id));
    return h('details', { class: 'match-map', open: ouverte },
      h('summary', { class: 'match-map__entete' },
        h('span', { class: 'match-map__nom' }, nomMap(id)), puceStatutMap(me?.statut), ...marques(id)),
      h('div', { class: 'match-map__corps' },
        J.aPersonnages() ? emplacements(me?.compo) : null,
        notesFiche(me) || h('p', { class: 'texte-3 petit' }, 'Aucune note sur cette map.')));
  }));
}

function compo(a) {
  let contenu;
  let titre = 'Compo';
  if (J.aPool()) {
    titre = `${J.v('cartes', true)} et compos`;
    contenu = compoParMap(a);
  } else if (J.aPersonnages()) {
    const me = E.doc('mapsEquipe', 'general');
    contenu = h('div', { class: 'pile-s' },
      emplacements(me?.compo),
      me?.compoAlt?.some((e) => e.personnage) ? [h('h3', { class: 'sous-titre' }, 'Compo de secours'), emplacements(me.compoAlt)] : null,
      notesFiche(me));
  } else {
    titre = 'Titulaires';
    const titulaires = E.joueurs().filter((j) => j.statut === 'titulaire' && j.pseudo);
    contenu = titulaires.length
      ? h('ul', { class: 'match-compo' }, titulaires.map((j) => h('li', {}, h('span', { class: 'match-compo__joueur' }, j.pseudo), J.roles(true).length ? jetonRole(j.roleJeu) : null)))
      : h('p', { class: 'texte-3 petit' }, 'Aucun titulaire nommé dans le roster.');
  }
  return h('section', { class: 'fiche match-carte match-compo-carte' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, titre), J.aCartes() || J.aPersonnages() ? h('a', { href: J.lien('/maps'), class: 'petit' }, 'Compos') : null),
    contenu);
}

// ——— L'adversaire : points forts et faibles, débuts de partie, tendances, joueurs clés ———

function adversaire(a) {
  const genre = genreListes();
  const nommer = genre === 'personnages' ? nomPersonnage : nomMap;
  const mot = genre === 'personnages' ? J.v('personnages') : J.v('cartes');
  const listes = genre ? [
    [`Points forts (${mot})`, a.fortes, 'negatif'],
    [`Points faibles (${mot})`, a.faibles, 'positif'],
    ['Bans habituels', a.bans, 'attention'],
  ].filter(([, ids]) => ids?.length) : [];
  const textes = [[libelleDebuts(), a.debuts], ['Setups', a.setups], ['Tendances', a.tendances], ['Joueurs clés', a.joueursCles]].filter(([, t]) => t);
  return h('section', { class: 'fiche match-carte match-adversaire' },
    h('h2', {}, `Face à ${a.nom}`),
    listes.length ? h('div', { class: 'pile-s' }, listes.map(([titre, ids, ton]) => h('div', { class: 'match-liste' },
      h('span', { class: 'match-liste__titre' }, titre),
      h('div', { class: 'rangee' }, ids.map((id) => (genre === 'personnages' ? jetonPersonnage(id) : puce(nommer(id), ton))))))) : null,
    textes.length ? h('dl', { class: 'match-notes' }, textes.map(([t, v]) => [h('dt', {}, t), h('dd', { class: 'texte-multi' }, v)])) : null,
    !listes.length && !textes.length ? h('p', { class: 'texte-3' }, 'Fiche encore vide : ses habitudes se notent dans la fiche de l’adversaire.') : null);
}

export function rendre(page, params, ctx) {
  const avenir = matchsAVenir();
  const demande = params[0] ? E.doc('adversaires', params[0]) : null;
  const a = demande || avenir[0] || null;

  if (!a) {
    page.append(h('header', { class: 'entete-page' },
      h('div', { class: 'entete-page__texte' }, h('h1', {}, 'Jour de match'),
        h('p', { class: 'entete-page__intro' }, 'Le jour J sur un seul écran : plan, compo, checklist et adversaire.'))),
    etatVide(params[0] ? 'Ce match n’existe plus.' : 'Aucun match à venir : la date du prochain match se fixe dans la fiche de l’adversaire.',
      h('a', { href: J.lien('/adversaires'), class: 'btn btn--principal match__action' }, icone('adversaires'), 'Ouvrir Adversaires')));
    return;
  }
  const choix = avenir.some((x) => x._id === a._id) ? avenir : [a, ...avenir];
  if (params[0] && !demande) page.append(h('p', { class: 'bandeau match__bandeau' }, 'Ce match n’existe plus : voici le prochain.'));
  page.append(
    entete(a, choix, ctx),
    actions(a),
    h('div', { class: 'match-grille' },
      h('div', { class: 'match-col' }, plan(a), compo(a)),
      h('div', { class: 'match-col' }, checklist(a), adversaire(a))));
}
