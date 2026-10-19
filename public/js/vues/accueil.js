// Accueil d'un jeu : annonces de la structure, parcours de la semaine, prochaine séance, points à traiter (méta,
// préparation, santé et charge de l'équipe, tournois), préparation selon le jeu (map pool, compo principale ou
// stratbook), prochain match et tournoi, forme récente, méta et focus personnel.

import { h, bouton, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { parcours, postesDeLaSemaine, etatPoste } from '../composants/parcours.js';
import { topo } from '../composants/topo.js';
import { jauge, puceStatutMap, nomMap, forme, puce, puceObjectif, pucePalier, jetonPersonnage } from '../composants/jetons.js';
import { libelleSemaine, publicDuBloc, titreBloc } from '../composants/grille.js';
import { alertesEquipe, trierAlertes } from '/shared/alertes.js';
import { alertesSante } from '/shared/sante.js';
import { rappelsTournois } from '/shared/organisation.js';
import { statsScrims, resultat, scoreLisible, estClassement, pointsClassement, trierParDate } from '/shared/stats.js';
import { objectifParId } from '/shared/jeux/contenus.js';
import { JOURS, TYPES_SCRIM, libelle } from '/shared/referentiel.js';
import { dateCivile, semaineIso, jourSemaine, decalerSemaine, joursDe, formatDate, ilYA, aujourdhui } from '/shared/temps.js';
import { bandeauAnnonces, premiersPas, quoiDeNeufSection, prochainMatch, absencesSeance, metaAVerifier, metaAutomatique, alerteMeta, lienJeu } from './accueil-sections.js';

const ICONES_ALERTE = { urgent: 'alerte', attention: 'alerte', info: 'info' };
const NIVEAUX_ALERTE = { urgent: 'Urgent : ', attention: 'À surveiller : ', info: 'Pour info : ' };
const MOTS_RESULTAT = { V: 'victoire', D: 'défaite', N: 'match nul' };
const decimal = (x) => String(x).replace('.', ',');
const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;
// Place (moyenne ou non) : « 1re », « 6,8e ».
const place = (x) => (x === 1 ? '1re' : `${decimal(x)}e`);
// « Patch 13.08 », mais « Saison 30 · mi-saison » ou « Mise à jour 1.0.4 » tels quels.
const libellePatch = (p) => (!p ? 'Patch inconnu' : /^v?\d/i.test(p) ? `Patch ${p}` : p);

function maintenantSemaine(semaine) {
  const t = new Date();
  const civ = dateCivile(t);
  return semaineIso(civ) === semaine ? { jour: jourSemaine(civ), min: t.getHours() * 60 + t.getMinutes() } : null;
}

function hero(eq, semaine, planning, depuisModele) {
  const jeu = E.jeu();
  const blocs = planning?.blocs || [];
  const maintenant = maintenantSemaine(semaine);
  const postes = postesDeLaSemaine(blocs);
  let prochain = postes.find((b) => etatPoste(b, maintenant) !== 'passe') || null;
  let semaineSuivante = false;
  if (!prochain) {
    const suivante = E.doc('planning', decalerSemaine(semaine, 1));
    prochain = postesDeLaSemaine((suivante?.blocs?.length ? suivante : E.doc('planning', 'modele'))?.blocs || [])[0] || null;
    semaineSuivante = !!prochain;
  }

  const absents = prochain ? absencesSeance(joursDe(semaineSuivante ? decalerSemaine(semaine, 1) : semaine)[prochain.jour - 1].iso, prochain) : [];
  const blocProchain = prochain
    ? h('div', { class: 'hero__prochain' },
      h('span', { class: 'hero__etiquette' }, !semaineSuivante && etatPoste(prochain, maintenant) === 'en-cours' ? 'En cours' : 'Prochaine séance'),
      h('strong', { class: 'hero__quand' }, `${JOURS[prochain.jour - 1].nom}${semaineSuivante ? ' prochain' : ''} ${prochain.debut}`),
      h('span', {}, `${titreBloc(prochain)}, ${publicDuBloc(prochain).toLowerCase()}`),
      prochain.details ? h('span', { class: 'texte-3 petit' }, prochain.details) : null,
      absents.length ? h('a', { href: J.lien('/presences'), class: 'petit' }, `${pluriel(absents.length, 'absence prévue', 'absences prévues')} : ${absents.map((a) => E.nomMembre(E.doc('membres', a.membreId))).join(', ')}`) : null)
    : h('div', { class: 'hero__prochain' },
      h('span', { class: 'hero__etiquette' }, 'Prochaine séance'),
      h('span', {}, postes.length ? 'Toutes les séances de la semaine sont passées.' : 'Aucune séance collective prévue.'),
      h('a', { href: J.lien('/planning') }, 'Ouvrir le planning'));

  const devise = eq.devise
    ? h('p', { class: 'texte-2' }, eq.devise)
    : (eq.nom ? null : h('p', { class: 'texte-2' }, 'Choisis le nom et le tag de l’équipe dans ', h('a', { href: J.lien('/roster') }, 'Roster'), '.'));
  return h('section', { class: 'hero', 'aria-labelledby': 'titre-hero' },
    topo({ largeur: 1400, hauteur: 420, graine: `${jeu.id}-${eq.tag || eq.nom || 'equipe'}`, classe: 'topo hero__fond' }),
    h('div', { class: 'hero__tete' },
      h('div', { class: 'hero__identite' },
        h('span', { class: 'hero__tag', 'aria-hidden': 'true' }, eq.tag || jeu.court),
        h('div', { class: 'hero__nom' },
          h('h1', { id: 'titre-hero' },
            h('span', { class: 'hero__jeu' }, jeu.nom, h('span', { class: 'visuellement-cache' }, ' : ')),
            h('span', { class: 'hero__equipe' }, eq.nom || 'Équipe sans nom')),
          devise)),
      blocProchain),
    h('div', { class: 'hero__parcours' },
      h('div', { class: 'rangee rangee--espace' },
        h('h2', {}, 'Parcours de la semaine'),
        h('span', { class: 'texte-3 petit' }, depuisModele ? `${libelleSemaine(semaine)}, d’après la semaine type` : libelleSemaine(semaine))),
      parcours(blocs, { maintenant, prochainId: semaineSuivante ? null : prochain?.id })));
}

async function traiter(s, statut) {
  try {
    await E.appeler('POST', `/suggestions/${encodeURIComponent(s._id)}/traiter`, { statut }, 'suggestions');
    toast(statut === 'appliquee' ? 'Suggestion marquée comme appliquée.' : 'Suggestion ignorée.');
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

function aTraiter(alertes, suggestions) {
  const peutTraiter = E.peut('suggestions.traiter');
  const meta = alerteMeta();
  const elements = [
    ...(meta ? [meta] : []),
    ...suggestions.map((s) => h('div', { class: 'suggestion' },
      h('div', { class: 'suggestion__texte' },
        h('div', { class: 'rangee' }, puce('Suggestion', 'accent'), h('strong', {}, s.titre)),
        h('p', { class: 'petit texte-2' }, s.texte)),
      h('div', { class: 'rangee' },
        s.lien ? h('a', { href: lienJeu(s.lien), class: 'btn btn--petit' }, 'Ouvrir') : null,
        peutTraiter ? bouton('Appliquée', { classe: 'btn--petit', onclick: () => traiter(s, 'appliquee') }) : null,
        peutTraiter ? bouton('Ignorer', { classe: 'btn--petit btn--discret', onclick: () => traiter(s, 'ignoree') }) : null))),
    ...alertes.map((a) => h('a', { href: lienJeu(a.lien), class: `alerte alerte--${a.niveau}` },
      icone(ICONES_ALERTE[a.niveau] || 'info'),
      h('span', {}, h('span', { class: 'visuellement-cache' }, NIVEAUX_ALERTE[a.niveau] || ''), a.texte),
      icone('droite'))),
  ];
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'À traiter'), h('span', { class: 'section__aide' }, pluriel(elements.length, 'point'))),
    elements.length ? h('div', { class: 'pile-s' }, elements) : h('p', { class: 'texte-3' }, 'Rien à signaler : tout est à jour.'));
}

// ——— Préparation : map pool (jeux à maps), compo principale (jeux à personnages sans maps), stratbook ———

function mapPool(meta, stats) {
  const maps = meta?.mapPool || [];
  const classement = J.typeScore() === 'classement';
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, J.v('carte') === 'map' ? 'Map pool' : `${J.v('cartes', true)} du pool`), h('a', { href: J.lien('/maps'), class: 'petit' }, 'Tout voir')),
    maps.length ? h('div', { class: 'pile-s' }, maps.map((id) => {
      const m = E.doc('mapsEquipe', id) || {};
      const s = stats.parMap[id];
      let bilan = 'Aucun résultat';
      let detail = null;
      if (s && classement) {
        bilan = s.placeMoyenne === null ? pluriel(s.joues, 'partie') : `moy. ${place(s.placeMoyenne)}`;
        detail = `${pluriel(s.joues, 'partie')}${s.placeMoyenne === null ? '' : `, place moyenne : ${place(s.placeMoyenne)}`}`;
      } else if (s) {
        bilan = `${s.victoires}V ${s.defaites}D`;
      }
      return h('a', { href: J.lien(`/maps/${id}`), class: 'pool-ligne' },
        h('span', { class: 'pool-ligne__nom' }, nomMap(id)),
        puceStatutMap(m.statut),
        jauge(m.preparation || 0),
        h('span', { class: 'texte-3 tres-petit pool-ligne__wr', title: detail }, bilan));
    })) : h('p', { class: 'texte-3 petit' }, `Pool de ${J.v('cartes')} pas encore connu : il arrive avec la méta.`));
}

function compoPrincipale() {
  const me = E.doc('mapsEquipe', 'general');
  const n = J.def().equipe.titulaires;
  const places = Array.from({ length: n }, (_, i) => me?.compo?.[i] || {});
  const choisis = places.filter((p) => p.personnage).length;
  let etat = null;
  if (!choisis) etat = h('p', { class: 'texte-3 petit' }, 'Compo de référence pas encore choisie : elle se construit dans ', h('a', { href: J.lien('/maps') }, 'Compos'), '.');
  else if (choisis < n) etat = h('p', { class: 'texte-3 petit' }, `${choisis} sur ${n} places remplies.`);
  return h('section', { class: 'fiche accueil-compo' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Compo principale'), h('a', { href: J.lien('/maps'), class: 'petit' }, 'Compos')),
    jauge(me?.preparation || 0, { legende: 'Préparation' }),
    choisis ? h('ul', { class: 'accueil-compo__liste' }, places.map((p) => h('li', {},
      jetonPersonnage(p.personnage),
      h('span', { class: 'texte-2 petit' }, p.membre ? E.nomMembre(E.doc('membres', p.membre)) : 'Joueur à placer')))) : null,
    etat);
}

// Couverture du stratbook : chaque type de strat du jeu, avec la part de strats maîtrisées (jeux sans map pool).
function stratbook() {
  const strats = E.liste('strats').filter((s) => s.statut !== 'archivee');
  const parType = new Map();
  for (const s of strats) parType.set(s.type, [...(parType.get(s.type) || []), s]);
  const types = [...J.typesStrat().map((t) => t.id), ...[...parType.keys()].filter((t) => !J.typesStrat().some((x) => x.id === t))];
  const compte = (statut) => strats.filter((s) => s.statut === statut).length;
  return h('section', { class: 'fiche accueil-strats' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Stratbook'), h('a', { href: J.lien('/strats'), class: 'petit' }, 'Tout voir')),
    h('p', { class: 'texte-2 petit' }, strats.length
      ? `${pluriel(strats.length, 'strat')} : ${pluriel(compte('maitrisee'), 'maîtrisée', 'maîtrisées')}, ${compte('rodage')} en rodage, ${compte('apprendre')} à apprendre.`
      : 'Aucune strat pour l’instant : chaque type ci-dessous est à construire.'),
    h('div', { class: 'pile-s' }, types.map((type) => {
      const liste = parType.get(type) || [];
      const maitrisees = liste.filter((s) => s.statut === 'maitrisee').length;
      return h('a', { href: J.lien('/strats'), class: ['accueil-strats__ligne', !liste.length && 'accueil-strats__ligne--vide'] },
        h('span', { class: 'accueil-strats__nom' }, J.nomTypeStrat(type)),
        jauge(liste.length ? Math.round((maitrisees / liste.length) * 100) : 0),
        h('span', { class: 'texte-3 tres-petit accueil-strats__compte' }, liste.length ? `${maitrisees} sur ${liste.length} maîtrisée${maitrisees > 1 ? 's' : ''}` : 'à construire'));
    })));
}

function preparation(meta, stats) {
  if (J.aPool()) return mapPool(meta, stats);
  return h('div', { class: 'pile' }, J.aPersonnages() ? compoPrincipale() : null, stratbook());
}

// ——— Forme récente : victoires et défaites, ou places en classement (battle royale) ———

function chiffresForme(stats, classement) {
  if (classement) {
    const c = stats.classement;
    return [
      [c.placeMoyenne === null ? '—' : place(c.placeMoyenne), 'place moyenne'],
      [String(c.top1), c.top1 > 1 ? 'tops 1' : 'top 1'],
      c.pointsMoyens === null ? null : [decimal(c.pointsMoyens), 'points par partie'],
    ].filter(Boolean);
  }
  return [
    [stats.winrate === null ? '—' : `${stats.winrate}%`, 'victoires'],
    stats.nuls ? [`${stats.victoires}–${stats.nuls}–${stats.defaites}`, 'victoires, nuls, défaites'] : [`${stats.victoires}–${stats.defaites}`, 'bilan'],
  ];
}

function ligneResultat(s, classement) {
  const r = resultat(s);
  const points = classement ? pointsClassement(s, J.def().score) : null;
  const etiquette = estClassement(s) ? `${s.place}${s.place === 1 ? 're' : 'e'} place` : MOTS_RESULTAT[r];
  return h('div', { class: 'ligne' },
    h('span', { class: `resultat resultat--${r}`, role: 'img', 'aria-label': etiquette, title: etiquette }, estClassement(s) ? String(s.place) : r),
    h('div', { class: 'ligne__principal' },
      h('div', { class: 'ligne__titre' }, estClassement(s) ? `${scoreLisible(s)} · ${s.adversaire}` : `${scoreLisible(s)} contre ${s.adversaire}`),
      h('div', { class: 'ligne__sous' }, [
        s.map && J.aCartes() ? nomMap(s.map) : null,
        libelle(TYPES_SCRIM, s.type).toLowerCase(),
        typeof points === 'number' ? `${decimal(points)} pts` : null,
        formatDate(s.date),
      ].filter(Boolean).join(', '))));
}

function formeRecente(stats, scrims) {
  const classement = J.typeScore() === 'classement';
  const derniers = trierParDate(scrims, -1).slice(0, 3);
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Forme'), h('a', { href: J.lien('/scrims'), class: 'petit' }, 'Scrims et matchs')),
    stats.total
      ? h('div', { class: 'pile' },
        h('div', { class: 'chiffres' },
          chiffresForme(stats, classement).map(([valeur, legende]) => h('div', {}, h('span', { class: 'chiffre chiffre--l' }, valeur), h('span', { class: 'texte-3 petit' }, legende))),
          h('div', {}, forme(stats.tendance), h('span', { class: 'texte-3 petit' }, classement ? '10 dernières parties' : '10 derniers'))),
        h('div', { class: 'liste-lignes' }, derniers.map((s) => ligneResultat(s, classement))))
      : h('p', { class: 'texte-3' }, 'Aucun résultat saisi pour l’instant.'));
}

function etatMeta(meta) {
  if (!meta) return null;
  const echec = meta.statut === 'echec';
  const aVerifier = metaAVerifier(meta);
  let etat = puce('À jour', 'positif');
  if (echec) etat = puce('Échec de la vérification', 'negatif');
  else if (aVerifier) etat = puce('À vérifier', 'attention');
  const e = meta.dernierEcart;
  const personnages = J.v('personnages') || 'personnages';
  const changements = e && !e.vide ? [
    e.entrees?.length ? `Entrée dans le pool : ${e.entrees.join(', ')}.` : '',
    e.sorties?.length ? `Sortie du pool : ${e.sorties.join(', ')}.` : '',
    e.personnagesModifies?.length ? `${personnages[0].toUpperCase()}${personnages.slice(1)} modifiés : ${e.personnagesModifies.join(', ')}.` : '',
    e.nouveauxPersonnages?.length ? `Nouveaux ${personnages} : ${e.nouveauxPersonnages.join(', ')}.` : '',
  ].filter(Boolean).join(' ') : '';
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Méta'), h('a', { href: J.lien('/meta'), class: 'petit' }, 'Détails')),
    h('div', { class: 'rangee' }, h('span', { class: 'chiffre chiffre--l' }, libellePatch(meta.patch)), etat),
    h('p', { class: 'texte-2 petit' }, `${meta.saison ? `${meta.saison}. ` : ''}Vérifiée ${ilYA(meta.derniereVerif)}. ${metaAutomatique()
      ? 'Prochaine vérification automatique à la première visite après le lundi ou le jeudi 7 h 45.'
      : 'Mise à jour manuelle par le Responsable du jeu, le lundi et le jeudi.'}`),
    changements ? h('p', { class: 'petit' }, changements) : null);
}

function monFocus() {
  const membre = E.monMembre();
  if (!membre || membre.type !== 'joueur') return null;
  const obj = E.doc('objectifs', membre._id);
  const focus = (obj?.focus || []).map((id) => objectifParId(J.def(), id) || (obj.perso || []).find((p) => p.id === id)).filter(Boolean);
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Mon focus'), h('a', { href: J.lien('/programme'), class: 'petit' }, 'Mon programme')),
    h('div', { class: 'rangee' }, pucePalier(obj?.palier)),
    focus.length
      ? h('ul', { class: 'liste-focus' }, focus.map((o) => h('li', {}, icone('etoile'), h('span', {}, o.texte), puceObjectif(obj.suivis?.[o.id]?.statut || o.statut))))
      : h('p', { class: 'texte-3 petit' }, 'Ton coach n’a pas encore choisi d’objectifs prioritaires.'));
}

export function rendre(page, params, ctx) {
  const def = J.def();
  const eq = E.equipe();
  const meta = E.meta();
  const semaine = semaineIso(dateCivile(new Date()));
  const planningSemaine = E.doc('planning', semaine);
  const planning = planningSemaine?.blocs?.length ? planningSemaine : E.doc('planning', 'modele');
  const scrims = E.liste('scrims');
  const membres = E.liste('membres');
  const stats = statsScrims(scrims, def);
  const auj = aujourdhui();
  const alertes = trierAlertes([
    ...alertesEquipe({ def, meta, mapsEquipe: E.liste('mapsEquipe'), strats: E.liste('strats'), membres, planningSemaine }),
    ...alertesSante({
      def, membres, presences: E.liste('presences'), mesures: E.liste('mesures'), scrims, meta, planning: E.liste('planning'), semaineCourante: semaine, aujourdhui: auj,
    }),
    ...rappelsTournois(E.liste('tournois'), auj),
  ]);
  const suggestions = E.liste('suggestions').filter((s) => s.statut === 'nouvelle').sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));

  page.append(
    bandeauAnnonces(),
    hero(eq, semaine, planning, planning !== planningSemaine),
    premiersPas(ctx) || '',
    quoiDeNeufSection() || '',
    aTraiter(alertes, suggestions),
    h('div', { class: 'section grille-accueil' },
      preparation(meta, stats),
      h('div', { class: 'pile' }, prochainMatch(), formeRecente(stats, scrims), etatMeta(meta), monFocus())));
}
