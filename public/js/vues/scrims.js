// Scrims et matchs : résultats saisis selon le type de score du jeu (manches, score simple ou classement)
// et statistiques automatiques (victoires ou places, maps, camps, pistols, forme récente).

import { h, modale, bouton, etatVide, onglets, liste, pourcentage, lienExterne } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { nomMap, nomPersonnage, jetonPersonnage, forme, puce, signature } from '../composants/jetons.js';
import { copierTexte, telecharger } from '../composants/sorties.js';
import { nombre } from '../composants/courbe.js';
import { editeur, creerVod, titreScrim, partenaireDe } from './scrims-saisie.js';
import { texteScrim, texteDerniersScrims } from '/shared/discord.js';
import { csv } from '/shared/exports.js';
import { statsScrims, resultat, trierParDate, manchesParCamp, scoreLisible, estClassement, pointsClassement } from '/shared/stats.js';
import { TYPES_SCRIM, RESULTATS_MANCHE, libelle } from '/shared/referentiel.js';
import { formatDate, joursDepuis } from '/shared/temps.js';

const filtres = { periode: '60', type: '' };
const MOTS = { V: 'Victoire', D: 'Défaite', N: 'Nul' };
const MOTS_CLASSEMENT = { V: 'top 1', D: 'bas de tableau', N: 'milieu de tableau' };
const pts = (n) => nombre(n, n % 1 ? 1 : 0);
const signe = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;
const place = (n) => (n === 1 ? '1re' : `${n}e`);

// ——— Statistiques (reprises par le bilan du mois) ———

function tuile(valeur, legende) {
  return h('div', { class: 'tuile' }, h('span', { class: 'chiffre chiffre--xl' }, valeur), h('span', { class: 'texte-3 petit' }, legende));
}

function texteSerie(serie) {
  if (!serie) return 'Aucun résultat.';
  if (J.typeScore() === 'classement') return `Série en cours : ${serie.longueur} × ${MOTS_CLASSEMENT[serie.type]}`;
  const mot = MOTS[serie.type].toLowerCase();
  return `Série en cours : ${serie.longueur} ${mot}${serie.longueur > 1 ? 's' : ''}`;
}

export function tuilesResultats(stats, { formeRecente = true } = {}) {
  const manche = J.v('manche');
  const manches = J.v('manches');
  const tuiles = [];
  if (J.typeScore() === 'classement') {
    const c = stats.classement;
    tuiles.push(
      tuile(String(c.top1), `top 1 sur ${c.parties} ${c.parties > 1 ? manches : manche}`),
      tuile(c.placeMoyenne === null ? '—' : nombre(c.placeMoyenne, 1), 'place moyenne'),
      tuile(c.eliminationsMoyennes === null ? '—' : nombre(c.eliminationsMoyennes, 1), `éliminations par ${manche}`));
    if (c.pointsMoyens !== null) tuiles.push(tuile(pts(c.pointsTotal), `points, ${nombre(c.pointsMoyens, 1)} par ${manche}`));
  } else {
    tuiles.push(
      tuile(pourcentage(stats.winrate), `de victoires sur ${stats.total} match${stats.total > 1 ? 's' : ''}`),
      tuile(`${stats.victoires}–${stats.defaites}${stats.nuls ? `–${stats.nuls}` : ''}`, `${stats.nuls ? 'V–D–N' : 'V–D'}, ${manches} ${stats.roundsPour}–${stats.roundsContre}`));
    if (J.typeScore() === 'manches') {
      const camps = J.camps();
      for (const camp of camps.length === 2 ? camps : []) {
        const c = stats.cotes[camp.id];
        if (c) tuiles.push(tuile(pourcentage(c.taux), `${camp.nom} · ${c.gagnes} ${manches} sur ${c.gagnes + c.perdus}`));
      }
      if (J.def().score.pistols) tuiles.push(tuile(pourcentage(stats.pistols.taux), `pistols gagnés sur ${stats.pistols.joues}`));
    }
  }
  if (formeRecente) tuiles.push(h('div', { class: 'tuile' }, forme(stats.tendance), h('span', { class: 'texte-3 petit' }, texteSerie(stats.serie))));
  return h('div', { class: 'tableau-bord' }, tuiles);
}

export function tableauParMap(stats, { liens = true } = {}) {
  const lignes = Object.values(stats.parMap).filter((m) => m.map).sort((a, b) => b.joues - a.joues || nomMap(a.map).localeCompare(nomMap(b.map), 'fr'));
  if (!lignes.length) return null;
  const classement = J.typeScore() === 'classement';
  const nom = (id) => (liens && J.aCartes() ? h('a', { href: J.lien(`/maps/${id}`) }, nomMap(id)) : nomMap(id));
  const th = (t) => h('th', { class: 'num' }, t);
  const td = (t) => h('td', { class: 'num' }, t);
  return h('div', { class: 'defile' }, h('table', { class: 'tableau' },
    h('thead', {}, h('tr', {}, h('th', {}, J.v('carte', true) || 'Map'), th(classement ? J.v('manches', true) : 'Matchs'),
      classement ? [th('Top 1'), th('Place moyenne')] : [th('Bilan'), th('Victoires'), th(`Écart de ${J.v('manches')}`)])),
    h('tbody', {}, lignes.map((m) => h('tr', {},
      h('td', {}, nom(m.map)),
      td(String(m.joues)),
      classement
        ? [td(String(m.victoires)), td(m.placeMoyenne === null ? '—' : nombre(m.placeMoyenne, 1))]
        : [td(`${m.victoires}–${m.defaites}`), td(pourcentage(m.winrate)), td(signe(m.roundsPour - m.roundsContre))])))));
}

// ——— Un résultat ———

function badge(s) {
  const r = resultat(s);
  if (estClassement(s)) {
    return h('span', { class: `resultat resultat--place resultat--${r}`, role: 'img', 'aria-label': `${place(s.place)} place sur ${s.equipes || J.def().score.equipes || 20}` }, String(s.place));
  }
  return h('span', { class: `resultat resultat--${r}`, role: 'img', 'aria-label': MOTS[r] }, r);
}

function pucesPistols(s) {
  return Object.entries(s.pistols || {}).map(([camp, v]) => puce(`Pistol ${J.nomCamp(camp)} : ${libelle(RESULTATS_MANCHE, v).toLowerCase()}`, v === 'gagne' ? 'positif' : ''));
}

function ficheAdversaire(s) {
  const nom = s.adversaire.trim().toLowerCase();
  const adv = E.liste('adversaires').find((a) => a.nom.trim().toLowerCase() === nom);
  return adv ? h('a', { href: J.lien(`/adversaires/${adv._id}`), class: 'petit' }, `Fiche adversaire : ${adv.nom}`) : null;
}

function details(s) {
  const def = J.def();
  if (estClassement(s)) {
    const p = pointsClassement(s, def.score);
    return h('dl', { class: 'details' },
      h('dt', {}, 'Place'), h('dd', {}, `${place(s.place)} sur ${s.equipes || def.score.equipes || 20} équipes`),
      h('dt', {}, 'Éliminations'), h('dd', {}, typeof s.eliminations === 'number' ? String(s.eliminations) : 'non notées'),
      h('dt', {}, 'Points'), h('dd', {}, p === null ? 'non comptés' : `${pts(p)}${typeof s.points === 'number' ? '' : ' (barème officiel)'}`));
  }
  const mc = manchesParCamp(s, def.camps.map((c) => c.id));
  const lignes = [];
  if (mc) {
    for (const c of def.camps) {
      const { gagnes, perdus } = mc[c.id];
      lignes.push(h('dt', {}, c.nom), h('dd', {}, `${gagnes}–${perdus} ${J.v('manches')}${gagnes + perdus ? ` (${Math.round((gagnes / (gagnes + perdus)) * 100)} %)` : ''}`));
    }
  }
  for (const [camp, v] of Object.entries(s.pistols || {})) lignes.push(h('dt', {}, `Pistol ${J.nomCamp(camp)}`), h('dd', {}, libelle(RESULTATS_MANCHE, v)));
  return lignes.length ? h('dl', { class: 'details' }, lignes) : null;
}

function detail(s) {
  const editable = E.peut('scrims.modifier');
  const vodExistante = E.liste('vods').find((v) => v.scrimId === s._id);
  const depart = !estClassement(s) && s.campDepart && J.camps().length === 2 ? puce(`Départ : ${J.nomCamp(s.campDepart)}`) : null;
  modale({
    titre: titreScrim(s),
    large: true,
    contenu: [
      h('div', { class: 'rangee' }, s.map ? puce(nomMap(s.map), 'plein') : null, puce(libelle(TYPES_SCRIM, s.type)),
        puce(`${formatDate(s.date)}${s.heure ? `, ${s.heure}` : ''}`), depart, lienPartenaire(s)),
      details(s),
      s.compo?.length ? h('div', { class: 'pile-s' }, h('h3', {}, 'Compo jouée'), h('div', { class: 'compo-pro__agents' }, s.compo.map(jetonPersonnage))) : null,
      s.bien ? h('div', { class: 'pile-s' }, h('h3', {}, 'Ce qui a marché'), h('p', { class: 'texte-multi' }, s.bien)) : null,
      s.corriger ? h('div', { class: 'pile-s' }, h('h3', {}, 'À corriger'), h('p', { class: 'texte-multi' }, s.corriger)) : null,
      s.vod ? lienExterne(s.vod, 'Ouvrir la VOD') : null,
      ficheAdversaire(s),
      signature(s),
    ],
    actions: [
      { libelle: 'Copier pour Discord', action: () => copierTexte(texteScrim(J.def(), s, nomMap)) },
      vodExistante ? { libelle: 'Voir la review', action: () => { window.location.hash = J.lien(`/vod/${vodExistante._id}`); } }
        : E.peut('vod.modifier') ? { libelle: 'Créer la VOD à revoir', action: () => creerVod(s) } : null,
      editable ? { libelle: 'Modifier', classe: 'btn--principal', action: () => { setTimeout(() => editeur(E.doc('scrims', s._id) || s), 0); } }
        : { libelle: 'Fermer', classe: 'btn--principal' },
    ].filter(Boolean),
  });
}

// Lien vers la fiche du partenaire de scrim (carnet), si le résultat y est rattaché.
function lienPartenaire(s) {
  const p = partenaireDe(s);
  return p ? h('a', { href: J.lien(`/partenaires/${p._id}`), class: 'puce lien-partenaire', title: `${p.nom} : fiabilité, créneaux, contact` }, icone('partenaires'), `Partenaire : ${p.tag || p.nom}`) : null;
}

// Une ligne = un bouton qui ouvre le détail, et à côté les puces (le lien du partenaire ne peut pas être dans le bouton).
function ligne(s) {
  const r = resultat(s);
  const classement = estClassement(s);
  const p = classement ? pointsClassement(s, J.def().score) : null;
  const type = libelle(TYPES_SCRIM, s.type).toLowerCase();
  const sous = [classement ? s.adversaire : null, s.map ? nomMap(s.map) : null, type, formatDate(s.date)].filter(Boolean).join(', ');
  return h('div', { class: ['ligne ligne-resultat', `ligne-resultat--${r}`] },
    h('button', { type: 'button', class: 'ligne-resultat__ouvrir', onclick: () => detail(s) },
      badge(s),
      h('span', { class: 'ligne__principal' },
        h('span', { class: 'ligne__titre' }, classement ? h('span', { class: 'ligne-resultat__score' }, scoreLisible(s)) : [h('span', { class: 'ligne-resultat__score' }, scoreLisible(s)), ` contre ${s.adversaire}`]),
        h('span', { class: 'ligne__sous' }, sous))),
    h('div', { class: 'rangee' },
      lienPartenaire(s),
      p !== null ? puce(`${pts(p)} pts`, r === 'V' ? 'accent' : '') : null,
      pucesPistols(s)));
}

// ——— Export CSV : colonnes selon le type de score, libellés en clair ———

function exporter(scrims) {
  const def = J.def();
  const type = J.typeScore();
  const manches = J.v('manches');
  const camps = J.camps();
  const avecMap = J.aCartes() || scrims.some((s) => s.map);
  const avecCompo = J.aPersonnages() || scrims.some((s) => s.compo?.length);
  const avecPartenaire = scrims.some((s) => partenaireDe(s));
  const entetes = ['Date', 'Heure', 'Type', type === 'classement' ? 'Lobby ou tournoi' : 'Adversaire'];
  if (avecPartenaire) entetes.push('Partenaire');
  if (avecMap) entetes.push(J.v('carte', true) || 'Map');
  if (type === 'manches') {
    entetes.push('Camp de départ', 'Mi-temps nous', 'Mi-temps eux', 'Nous', 'Eux', 'Résultat');
    for (const c of camps) entetes.push(`${c.nom} : ${manches} pour`, `${c.nom} : ${manches} contre`);
    if (def.score.pistols) for (const c of camps) entetes.push(`Pistol ${c.nom}`);
  } else if (type === 'classement') {
    entetes.push('Place', 'Équipes', 'Éliminations', 'Points');
  } else {
    entetes.push(`Nous (${manches})`, `Eux (${manches})`, 'Résultat');
  }
  if (avecCompo) entetes.push(`Compo (${J.v('personnages') || 'personnages'})`);
  entetes.push('Ce qui a marché', 'À corriger', 'VOD');

  const lignes = trierParDate(scrims).map((s) => {
    const l = [s.date, s.heure, libelle(TYPES_SCRIM, s.type), s.adversaire];
    if (avecPartenaire) l.push(partenaireDe(s)?.nom || '');
    if (avecMap) l.push(s.map ? nomMap(s.map) : '');
    const classement = estClassement(s);
    if (type === 'manches') {
      const mc = classement ? null : manchesParCamp(s, def.camps.map((c) => c.id));
      l.push(J.nomCamp(s.campDepart), s.mtNous, s.mtEux, s.scoreNous, s.scoreEux, classement ? '' : MOTS[resultat(s)]);
      for (const c of camps) l.push(mc?.[c.id]?.gagnes ?? '', mc?.[c.id]?.perdus ?? '');
      if (def.score.pistols) for (const c of camps) l.push(libelle(RESULTATS_MANCHE, s.pistols?.[c.id], ''));
    } else if (type === 'classement') {
      l.push(s.place, s.equipes, s.eliminations, classement ? pointsClassement(s, def.score) : null);
    } else {
      l.push(s.scoreNous, s.scoreEux, classement ? '' : MOTS[resultat(s)]);
    }
    if (avecCompo) l.push((s.compo || []).map(nomPersonnage).join(', '));
    l.push(s.bien, s.corriger, s.vod);
    return l;
  });
  telecharger(`scrims-${E.jeu()?.id || 'jeu'}.csv`, csv(entetes, lignes), 'text/csv;charset=utf-8');
}

function intro() {
  const type = J.typeScore();
  const parts = [];
  if (type === 'classement') parts.push('top 1', 'place moyenne', 'éliminations', 'points');
  else parts.push('victoires', `${J.v('manches')} pour et contre`);
  if (J.aCartes()) parts.push(`bilan par ${J.v('carte')}`);
  if (type === 'manches' && J.camps().length === 2) parts.push(`${J.v('manches')} par camp`);
  if (type === 'manches' && J.def().score.pistols) parts.push('pistols');
  return `Chaque ${type === 'classement' ? `${J.v('manche')} saisie` : 'résultat saisi'} alimente les statistiques : ${parts.join(', ')} et forme récente.`;
}

export function rendre(page, params, ctx) {
  const editable = E.peut('scrims.modifier');
  const tous = E.liste('scrims');
  const visibles = tous.filter((s) => (!filtres.type || s.type === filtres.type)
    && (filtres.periode === 'tout' || joursDepuis(`${s.date}T12:00:00`) <= Number(filtres.periode)));
  const stats = statsScrims(visibles, J.def());
  const ajouter = (classe) => bouton('Ajouter un résultat', { icone: 'ajouter', classe, onclick: () => editeur() });

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Scrims et matchs'),
      h('p', { class: 'entete-page__intro' }, intro())),
    h('div', { class: 'entete-page__actions' },
      editable ? ajouter('btn--principal') : null,
      tous.length ? bouton('Copier pour Discord', { icone: 'discord', onclick: () => copierTexte(texteDerniersScrims(visibles.length ? visibles : tous, nomMap)) }) : null,
      tous.length ? bouton('Exporter (CSV)', { icone: 'telecharger', onclick: () => exporter(tous) }) : null)));

  page.append(h('div', { class: 'barre-outils' },
    onglets([{ valeur: '30', libelle: '30 jours' }, { valeur: '60', libelle: '60 jours' }, { valeur: 'tout', libelle: 'Tout' }], filtres.periode, (v) => { filtres.periode = v; ctx.rafraichir(); }, { libelle: 'Période' }),
    liste(TYPES_SCRIM.map((t) => ({ valeur: t.id, libelle: t.nom })), { valeur: filtres.type, vide: 'Tous les types', 'aria-label': 'Type de match', class: 'saisie saisie--compacte', onchange: (e) => { filtres.type = e.target.value; ctx.rafraichir(); } })));

  if (!visibles.length) {
    page.append(etatVide(tous.length ? 'Aucun résultat sur cette période.' : 'Aucun résultat saisi. Ajoute votre prochain scrim ou match pour démarrer les statistiques.',
      editable ? ajouter('btn--principal') : null));
    return;
  }

  page.append(tuilesResultats(stats));

  const parMap = J.aCartes() ? tableauParMap(stats) : null;
  if (parMap) {
    page.append(h('section', { class: 'section' },
      h('div', { class: 'section__entete' }, h('h2', {}, `Par ${J.v('carte')}`)),
      parMap));
  }

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Résultats'), h('span', { class: 'section__aide' }, `${visibles.length} sur la période`)),
    h('div', { class: 'liste-lignes' }, trierParDate(visibles, -1).map(ligne))));
}
