// Maps et compos : statut et préparation de chaque map du pool, compo de l'équipe comparée aux compos pro, plans de jeu
// par camp, résultats et stratbook de la map. Jeu à personnages sans map pool (LoL) : une seule fiche « general »
// (compos). Jeu à maps sans personnages (CS2) : statut, préparation et plans, sans compo. Tout vient du jeu affiché.

import { h, bouton, lienExterne, etatVide, pourcentage } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { titreVue } from '../navigation.js';
import { topo } from '../composants/topo.js';
import { jauge, puceStatutMap, jetonPersonnage, nomMap, signature, puce } from '../composants/jetons.js';
import { statsScrims } from '/shared/stats.js';
import { STATUTS_MAP, STATUTS_STRAT, libelle } from '/shared/referentiel.js';
import { ficheMap, editeur, compos, emplacements, nbRemplis, titulaires, depuisCompoPro, nomMembreOuAncien } from './maps-editeur.js';
import {
  accord, pluriel, nombre, majuscule, libellePatch, cartesSuivies, infoMap, nomMode, clesNotes, nomCleNotes, repereCamp, resumeResultats,
} from './maps-outils.js';

const ORDRE = { pick: 0, confort: 1, travail: 2, ban: 3 };
const SEUIL_PRETE = 70;

const stratsActives = (garder) => E.liste('strats').filter((s) => s.statut !== 'archivee' && garder(s));

// ——— Liste des maps ———

function resumeCompo(m) {
  const t = titulaires();
  if (J.parCamp()) {
    return h('ul', { class: 'carte-map__camps' }, compos(m).map((c) => {
      const n = nbRemplis(c.valeur);
      return h('li', {}, repereCamp(c.camp), h('span', {}, c.titre),
        h('span', { class: n >= t ? 'texte-positif' : 'texte-3' }, n >= t ? 'compo complète' : `${n} sur ${t}`));
    }));
  }
  const remplis = (m.compo || []).filter((e) => e.personnage);
  return h('div', { class: 'carte-map__agents' },
    remplis.length ? remplis.map((e) => jetonPersonnage(e.personnage)) : h('span', { class: 'texte-3 petit' }, 'Compo à construire'),
    remplis.length && remplis.length < t ? puce(`${remplis.length} sur ${t}`, 'attention') : null);
}

function carteMap(m, st, strats) {
  const info = infoMap(m._id);
  const n = strats.filter((s) => s.map === m._id).length;
  return h('a', { href: J.lien(`/maps/${m._id}`), class: 'fiche carte-map' },
    topo({ largeur: 320, hauteur: 200, graine: `map-${m._id}`, colonnes: 32, niveaux: 7, bosses: 5, classe: 'topo carte-map__fond' }),
    h('div', { class: 'carte-map__tete' },
      h('div', { class: 'carte-map__nom' }, h('h2', {}, nomMap(m._id)), info?.mode ? h('span', { class: 'carte-map__mode' }, nomMode(info.mode)) : null),
      puceStatutMap(m.statut)),
    jauge(m.preparation, { legende: 'Préparation' }),
    J.aPersonnages() ? resumeCompo(m) : null,
    h('p', { class: 'texte-3 tres-petit' }, `${resumeResultats(st.parMap[m._id])} · ${pluriel(n, 'strat')}`));
}

function vueListe(page) {
  const meta = E.meta();
  const ids = cartesSuivies();
  const cartes = J.v('cartes');
  const st = statsScrims(E.liste('scrims'), J.def());
  const strats = stratsActives(() => true);
  const fiches = ids.map(ficheMap).sort((a, b) => (ORDRE[a.statut] ?? 2) - (ORDRE[b.statut] ?? 2) || (b.preparation || 0) - (a.preparation || 0));
  const noms = (statut) => fiches.filter((m) => m.statut === statut).map((m) => nomMap(m._id)).join(', ');
  const veto = J.typeVeto() === 'cartes';
  const contexte = [meta?.saison, libellePatch(meta?.patch)].filter(Boolean).join(', ');

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, titreVue('maps')),
      h('p', { class: 'entete-page__intro' },
        `${J.aPool() ? 'Pool en cours' : `${majuscule(cartes)} du jeu`}${contexte ? ` : ${contexte}` : ''}. `,
        `Statut, préparation${J.aPersonnages() ? ' et compo' : ''} de l’équipe pour chaque ${J.v('carte')}.`))));

  if (!fiches.length) {
    page.append(etatVide(J.aPool() ? 'Le pool n’est pas encore connu : vérifie la méta du jeu.' : 'La méta du jeu n’en liste pas encore.',
      h('a', { href: J.lien('/meta'), class: 'btn' }, icone('meta'), 'Ouvrir la méta')));
    return;
  }

  page.append(h('div', { class: 'veto' },
    h('div', {}, h('span', { class: 'texte-3 petit' }, veto ? 'Nos picks au veto' : 'Nos points forts'), h('strong', {}, noms('pick') || 'Aucun pour l’instant')),
    h('div', {}, h('span', { class: 'texte-3 petit' }, veto ? 'Bans prioritaires' : 'À éviter'), h('strong', {}, noms('ban') || 'Aucun pour l’instant')),
    h('div', {},
      h('span', { class: 'texte-3 petit' }, `${majuscule(cartes)} ${accord(cartes, 'prêts', 'prêtes')} (${SEUIL_PRETE} % et plus)`),
      h('strong', {}, `${fiches.filter((m) => (m.preparation || 0) >= SEUIL_PRETE).length} sur ${fiches.length}`))));

  page.append(h('div', { class: 'grille-maps' }, fiches.map((m) => carteMap(m, st, strats))));

  const hors = J.aPool() ? (meta?.maps || []).filter((x) => !ids.includes(x.id)) : [];
  if (hors.length) {
    page.append(h('section', { class: 'section' },
      h('div', { class: 'section__entete' }, h('h2', {}, 'Hors pool'), h('span', { class: 'section__aide' }, 'Pour mémoire : le pool change d’une saison à l’autre.')),
      h('div', { class: 'rangee' }, hors.map((x) => h('a', { href: J.lien(`/maps/${x.id}`), class: 'puce' }, x.nom, E.doc('mapsEquipe', x.id) ? icone('ok') : null)))));
  }
}

// ——— Fiche d'une map (ou fiche « general ») ———

// Places remplies, puis une seule ligne pour les places encore libres (10 places en Rainbow Six : liste courte).
function compoAffichee(compo) {
  const remplies = emplacements(compo).filter((e) => e.personnage || e.membre);
  if (!remplies.length) return h('p', { class: 'texte-3 petit' }, 'Compo à construire.');
  const libres = titulaires() - remplies.length;
  return h('ul', { class: 'compo' },
    remplies.map((e) => h('li', {},
      jetonPersonnage(e.personnage),
      h('span', { class: 'texte-3 petit' }, e.membre ? nomMembreOuAncien(e.membre) : 'Joueur à choisir'))),
    libres > 0 ? h('li', { class: 'compo__libres' }, h('span', { class: 'agent agent--vide' }, `${pluriel(libres, 'place libre', 'places libres')}`)) : null);
}

function ficheCompo(m, doc) {
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Notre compo'), signature(doc)),
    jauge(m.preparation, { legende: 'Préparation' }),
    compos(m).map((c, i) => {
      if (!J.parCamp() && i === 1 && !c.valeur.length) return null;
      return [
        J.parCamp() || i === 1 ? h('h3', { class: 'sous-titre legende-camp' }, J.parCamp() ? repereCamp(c.camp) : null, c.titre) : null,
        compoAffichee(c.valeur),
      ];
    }),
    m.priorites ? [h('h3', { class: 'sous-titre' }, 'Priorités'), h('p', { class: 'texte-multi petit' }, m.priorites)] : null);
}

function ficheComposPro(id, m, editable) {
  const meta = E.meta();
  const comps = meta?.compsPro?.[id] || [];
  const notres = new Set([...(m.compo || []), ...(J.parCamp() ? m.compoAlt || [] : [])].map((e) => e.personnage).filter(Boolean));
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Compos pro'),
      h('a', { href: J.lien('/meta'), class: 'petit' }, majuscule(libellePatch(meta?.patch)) || 'Méta')),
    comps.length ? h('div', { class: 'pile' }, comps.map((c) => {
      const communs = c.personnages.filter((p) => notres.has(p)).length;
      return h('div', { class: 'compo-pro' },
        h('div', { class: 'compo-pro__agents' }, c.personnages.map((p) => jetonPersonnage(p))),
        c.usage ? h('p', { class: 'petit texte-2' }, c.usage) : null,
        h('div', { class: 'rangee rangee--espace' },
          h('span', { class: 'texte-3 tres-petit' }, notres.size ? `${communs} en commun avec notre compo` : c.evenement || ''),
          h('div', { class: 'rangee' },
            c.source ? lienExterne(c.source, 'Source', { classe: 'petit' }) : null,
            editable ? bouton('Partir de cette compo', { classe: 'btn--petit', onclick: () => editeur(id, depuisCompoPro(c.personnages, id)) }) : null)));
    })) : h('p', { class: 'texte-3' }, 'Aucune compo pro relevée ici pour l’instant.'));
}

function fichePreparation(m, doc) {
  const statut = STATUTS_MAP.find((s) => s.id === m.statut);
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Préparation'), signature(doc)),
    jauge(m.preparation, { legende: accord(J.v('carte'), 'Prêt à', 'Prête à') }),
    statut ? h('p', { class: 'petit texte-2 marge-haut' }, `${statut.nom} : ${statut.resume}`) : null,
    h('h3', { class: 'sous-titre' }, 'Priorités'),
    h('p', { class: m.priorites ? 'texte-multi petit' : 'texte-3 petit' }, m.priorites || 'Pas encore de priorités de travail.'));
}

function ficheNotes(m) {
  const cles = clesNotes(m.notes);
  const seul = cles.length === 1 && cles[0] === 'general';
  return h('section', { class: 'fiche' },
    h('h2', {}, J.camps().length ? 'Plans de jeu' : 'Plan de jeu'),
    h('div', { class: 'plans' }, cles.map((cle) => h('div', { class: 'plan-cote' },
      seul ? null : h('h3', { class: 'legende-camp' }, repereCamp(cle === 'general' ? '' : cle), nomCleNotes(cle)),
      h('p', { class: m.notes?.[cle] ? 'texte-multi petit' : 'texte-3 petit' }, m.notes?.[cle] || 'Pas encore de notes.')))));
}

function ficheResultats(id, st, strats) {
  const general = id === 'general';
  const manches = J.v('manches');
  const cases = [[String(strats.length), strats.length > 1 ? 'strats actives' : 'strat active']];
  if (J.typeScore() === 'classement') {
    cases.push([String(st.classement.parties), 'parties jouées'], [nombre(st.classement.placeMoyenne), 'place moyenne'], [String(st.classement.top1), 'top 1']);
  } else {
    cases.push([st.total ? `${st.victoires}–${st.defaites}` : '—', 'bilan en scrim et match']);
    if (J.typeScore() === 'manches' && J.camps().length) {
      for (const c of J.camps()) cases.push([pourcentage(st.cotes[c.id]?.taux ?? null), `${c.nom} : ${manches} ${accord(manches, 'gagnés', 'gagnées')}`]);
    } else {
      cases.push([pourcentage(st.winrate), 'de victoires']);
    }
  }
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre fiche__titre--souple' }, h('h2', {}, 'Stratbook et résultats'),
      h('a', { href: J.lien(general ? '/strats' : `/strats/${id}`), class: 'petit' }, 'Ouvrir le stratbook')),
    h('div', { class: 'chiffres chiffres--fiche' }, cases.map(([valeur, legende]) => h('div', {},
      h('span', { class: 'chiffre chiffre--l' }, valeur), h('span', { class: 'texte-3 petit' }, legende)))),
    h('div', { class: 'rangee marge-haut' }, STATUTS_STRAT.filter((s) => s.id !== 'archivee').map((s) => {
      const n = strats.filter((x) => x.statut === s.id).length;
      return n ? puce(`${n} ${libelle(STATUTS_STRAT, s.id).toLowerCase()}`) : null;
    })));
}

function vueDetail(page, id) {
  // Fiche « general » : seulement pour un jeu à personnages sans map pool (ailleurs, l'adresse est introuvable).
  const general = id === 'general' && !J.aPool();
  const meta = E.meta();
  const info = general ? null : infoMap(id);
  const retour = general ? null : h('a', { href: J.lien('/maps'), class: 'retour' }, icone('gauche'), `Retour aux ${J.v('cartes')}`);
  if (!general && !info) {
    page.append(retour, etatVide('Introuvable dans la méta du jeu : le lien est peut-être ancien.'));
    return;
  }
  const m = ficheMap(id);
  const doc = E.doc('mapsEquipe', id);
  const editable = E.peut('maps.modifier');
  const enPool = (meta?.mapPool || []).includes(id);
  const st = statsScrims(general ? E.liste('scrims') : E.liste('scrims').filter((s) => s.map === id), J.def());
  const strats = stratsActives((s) => general || s.map === id);

  if (retour) page.append(retour);
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, general ? titreVue('maps') : nomMap(id)),
      general
        ? h('p', { class: 'entete-page__intro' }, `Compo de l’équipe et plan de jeu, comparés aux compos pro${meta?.patch ? ` (${libellePatch(meta.patch)})` : ''}.`)
        : h('div', { class: 'rangee' }, puceStatutMap(m.statut),
          J.aPool() ? (enPool ? puce('Dans le pool', 'positif') : puce('Hors pool')) : null,
          info.mode ? puce(nomMode(info.mode), 'info') : null,
          info.entreePatch ? puce(`Entrée en ${info.entreePatch}`, 'info') : null,
          info.sortiePatch ? puce(`Sortie en ${info.sortiePatch}`, 'negatif') : null),
      info?.noteMeta ? h('p', { class: 'entete-page__intro' }, info.noteMeta) : null),
    editable ? h('div', { class: 'entete-page__actions' },
      bouton(general ? 'Modifier les compos' : 'Modifier la fiche', { icone: 'modifier', classe: 'btn--principal', onclick: () => editeur(id) })) : null));

  if (J.aPersonnages()) {
    page.append(
      h('div', { class: 'grille-2' }, ficheCompo(m, doc), ficheComposPro(id, m, editable)),
      h('div', { class: 'grille-2 section' }, ficheNotes(m), ficheResultats(id, st, strats)));
  } else {
    page.append(
      h('div', { class: 'grille-2' }, fichePreparation(m, doc), ficheResultats(id, st, strats)),
      h('div', { class: 'section' }, ficheNotes(m)));
  }
}

export function rendre(page, params) {
  if (J.aPersonnages() && !J.aPool()) vueDetail(page, 'general');
  else if (params[0]) vueDetail(page, params[0]);
  else vueListe(page);
}
