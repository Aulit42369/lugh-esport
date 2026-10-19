// Méta : saison, patch, état de la dernière vérification, ce qui a changé, suggestions pour l'équipe, map pool,
// personnages et leurs derniers changements, compos pro, tendances, circuit et sources. Tout est propre au jeu affiché ;
// rien ici ne modifie le travail de l'équipe (les changements deviennent des suggestions).

import { h, bouton, toast, onglets, lienExterne, messageErreur, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puce } from '../composants/jetons.js';
import { TYPES_SUGGESTION, libelle } from '/shared/referentiel.js';
import { formatDate, formatHorodatage, ilYA } from '/shared/temps.js';
import { sectionImport, sectionPool, sectionPersonnages, sectionComposPro } from './meta-sections.js';
import { filtresDuJeu, libellePatch } from './maps-outils.js';

const DEFAUTS = { role: '', modifies: false, suggestions: 'nouvelle' };
const filtres = { jeu: '', ...DEFAUTS };
const DECLENCHEURS = {
  initial: 'méta livrée avec le jeu', manuel: 'vérification demandée', automatique: 'vérification automatique', cron: 'vérification programmée', import: 'import manuel',
};

// Créneaux de vérification : lundi et jeudi à 7 h 45 (heure de l'appareil, celle de Paris en pratique).
function creneau(sens, maintenant = new Date()) {
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(maintenant);
    d.setDate(d.getDate() + sens * i);
    d.setHours(7, 45, 0, 0);
    if ([1, 4].includes(d.getDay()) && (sens > 0 ? d > maintenant : d <= maintenant)) return d;
  }
  return null;
}

// Vérification automatique : clé API sur le serveur et option laissée active dans les Réglages du jeu.
const verificationAuto = () => !!E.serveur()?.metaAuto && J.def().meta?.auto !== false;

// Sans vérification automatique : un créneau du lundi ou du jeudi est passé depuis la dernière vérification.
function aVerifier(m) {
  if (verificationAuto()) return false;
  const dernier = creneau(-1);
  return !!dernier && (!m.derniereVerif || new Date(m.derniereVerif) < dernier);
}

async function actualiser() {
  try {
    await E.appeler('POST', '/meta/actualiser');
    toast('Vérification lancée : résultat dans 1 à 3 minutes, la page se mettra à jour seule.', { duree: 7000 });
    for (const delai of [45_000, 90_000, 150_000]) setTimeout(() => E.synchroniser(), delai);
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

async function traiter(s, statut) {
  try {
    await E.appeler('POST', `/suggestions/${encodeURIComponent(s._id)}/traiter`, { statut }, 'suggestions');
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

function bandePatch(m) {
  const echec = m.statut === 'echec';
  const prochain = verificationAuto() ? creneau(1) : null;
  const origine = !echec && DECLENCHEURS[m.declencheur] ? `, ${DECLENCHEURS[m.declencheur]}` : '';
  // Numéro court (« 13.08 ») en très grand ; libellé long (« Correctif du 13 octobre 2026 ») plus petit.
  const longueur = String(m.patch || '').length;
  const taille = longueur > 14 ? 'bande-patch__numero--tres-long' : longueur > 7 ? 'bande-patch__numero--long' : '';
  return h('section', { class: 'bande-patch' },
    h('div', { class: ['bande-patch__numero', taille] },
      h('span', { class: 'texte-3 petit' }, 'Patch'), h('span', { class: 'chiffre' }, m.patch || '—')),
    h('div', { class: 'pile-s bande-patch__texte' },
      h('strong', {}, m.saison || 'Saison inconnue'),
      m.patchDate ? h('span', { class: 'petit texte-2' }, `Sorti le ${formatDate(m.patchDate)}.`) : null,
      h('span', { class: 'petit texte-2' },
        `Dernière vérification ${ilYA(m.derniereVerif)}${m.derniereVerif ? ` (${formatHorodatage(m.derniereVerif)}${origine})` : ''}.`),
      prochain ? h('span', { class: 'petit texte-3' }, `Prochaine à la première visite après le ${formatHorodatage(prochain)}.`) : null),
    h('div', { class: 'pile-s bande-patch__etat' },
      echec ? puce('Dernière vérification en échec', 'negatif') : aVerifier(m) ? puce('À vérifier : nouveau créneau', 'attention') : puce('À jour', 'positif'),
      echec ? h('span', { class: 'petit texte-2' },
        `${m.erreur || 'Raison inconnue.'} Tentative ${ilYA(m.derniereTentative)} ; les données ci-dessous restent celles du ${formatHorodatage(m.derniereVerif)}.`) : null));
}

function sectionEcart(ecart) {
  if (!ecart || ecart.vide) return null;
  const items = [
    ecart.patch ? `Nouveau patch : ${ecart.patch.apres}${ecart.patch.avant ? ` (avant : ${ecart.patch.avant})` : ''}.` : null,
    J.aCartes() && ecart.entrees?.length ? `Entrent dans le pool : ${ecart.entrees.join(', ')}.` : null,
    J.aCartes() && ecart.sorties?.length ? `Sortent du pool : ${ecart.sorties.join(', ')}.` : null,
    J.aPersonnages() && ecart.personnagesModifies?.length ? `Équilibrage modifié : ${ecart.personnagesModifies.join(', ')}.` : null,
    J.aPersonnages() && ecart.nouveauxPersonnages?.length ? `Arrivent dans le jeu : ${ecart.nouveauxPersonnages.join(', ')}.` : null,
  ].filter(Boolean);
  if (!items.length) return null;
  return h('section', { class: 'section fiche' },
    h('h2', {}, 'Ce qui a changé à la dernière vérification'),
    h('ul', { class: 'liste-puces' }, items.map((t) => h('li', {}, t))));
}

function sectionSuggestions(ctx) {
  const toutes = E.liste('suggestions').sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));
  const visibles = toutes.filter((s) => filtres.suggestions === 'toutes' || s.statut === filtres.suggestions);
  const peutTraiter = E.peut('suggestions.traiter');
  const aTraiter = toutes.filter((s) => s.statut === 'nouvelle').length;
  const choix = [
    { valeur: 'nouvelle', libelle: `À traiter (${aTraiter})` }, { valeur: 'appliquee', libelle: 'Appliquées' },
    { valeur: 'ignoree', libelle: 'Ignorées' }, { valeur: 'toutes', libelle: 'Toutes' },
  ];
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, 'Suggestions pour l’équipe'),
      onglets(choix, filtres.suggestions, (v) => { filtres.suggestions = v; ctx.rafraichir(); }, { libelle: 'Suggestions' })),
    visibles.length ? h('div', { class: 'pile-s' }, visibles.map((s) => h('div', { class: 'suggestion' },
      h('div', { class: 'suggestion__texte' },
        h('div', { class: 'rangee' }, puce(libelle(TYPES_SUGGESTION, s.type)), h('strong', {}, s.titre),
          s.patch ? h('span', { class: 'texte-3 tres-petit' }, libellePatch(s.patch)) : null),
        h('p', { class: 'petit texte-2' }, s.texte),
        s.statut !== 'nouvelle'
          ? h('span', { class: 'signature' }, `${s.statut === 'appliquee' ? 'Appliquée' : 'Ignorée'} par ${E.nomCompte(s.traitePar)}, ${ilYA(s.traiteLe)}`) : null),
      h('div', { class: 'rangee' },
        /^#\//.test(s.lien || '') ? h('a', { href: J.lien(s.lien), class: 'btn btn--petit' }, 'Ouvrir') : null,
        peutTraiter && s.statut === 'nouvelle' ? bouton('Appliquée', { classe: 'btn--petit', onclick: () => traiter(s, 'appliquee') }) : null,
        peutTraiter && s.statut === 'nouvelle' ? bouton('Ignorer', { classe: 'btn--petit btn--discret', onclick: () => traiter(s, 'ignoree') }) : null,
        peutTraiter && s.statut !== 'nouvelle' ? bouton('Remettre à traiter', { classe: 'btn--petit btn--discret', onclick: () => traiter(s, 'nouvelle') }) : null))))
      : h('p', { class: 'texte-3' }, 'Aucune suggestion dans cette catégorie.'));
}

function sectionTendances(m) {
  const c = m.circuit;
  return h('div', { class: 'grille-2 section' },
    h('section', { class: 'fiche' }, h('h2', {}, 'Tendances'),
      (m.tendances || []).length ? h('ul', { class: 'liste-puces' }, m.tendances.map((t) => h('li', {}, t))) : h('p', { class: 'texte-3 petit' }, 'Aucune tendance relevée.')),
    h('section', { class: 'fiche' },
      h('h2', {}, 'Points à confirmer'),
      (m.incertitudes || []).length ? h('ul', { class: 'liste-puces petit' }, m.incertitudes.map((t) => h('li', {}, t))) : h('p', { class: 'texte-3 petit' }, 'Rien en suspens.'),
      c && (c.etape || c.dates || c.format || c.notes) ? h('div', { class: 'circuit' },
        h('h3', {}, 'Circuit'),
        h('dl', { class: 'details' },
          [['Étape', c.etape], ['Dates', c.dates], ['Format', c.format], ['Notes', c.notes]].filter(([, v]) => v).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))) : null));
}

export function rendre(page, params, ctx) {
  filtresDuJeu(filtres, DEFAUTS);
  const m = E.meta();
  const auto = verificationAuto();
  const peutVerifier = E.peut('meta.actualiser');
  const intro = auto
    ? 'Vérifiée à la première visite après le lundi et le jeudi 7 h 45, sources officielles d’abord.'
    : E.serveur()?.metaAuto
      ? 'Vérification automatique coupée dans les Réglages du jeu : vérifie à la demande ou mets-la à jour à la main.'
      : 'Mise à jour à la main par le staff, sources officielles d’abord.';

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Méta'),
      h('p', { class: 'entete-page__intro' }, `${intro} Rien ici ne modifie votre travail : les changements deviennent des suggestions, appliquées ou non par le staff.`)),
    peutVerifier && E.serveur()?.metaAuto ? h('div', { class: 'entete-page__actions' }, bouton('Vérifier maintenant', { icone: 'actualiser', onclick: actualiser })) : null));

  if (!m) {
    page.append(etatVide('Aucune méta pour ce jeu pour l’instant.'));
    if (peutVerifier) page.append(sectionImport(auto));
    return;
  }

  page.append(bandePatch(m));
  if (peutVerifier) page.append(sectionImport(auto));
  const ecart = sectionEcart(m.dernierEcart);
  if (ecart) page.append(ecart);
  page.append(sectionSuggestions(ctx));
  if (J.aCartes()) page.append(sectionPool(m));
  if (J.aPersonnages()) page.append(sectionPersonnages(m, filtres, () => ctx.rafraichir()), sectionComposPro(m));
  page.append(sectionTendances(m));

  if ((m.sources || []).length) {
    page.append(h('details', { class: 'section referentiel' },
      h('summary', {}, h('strong', {}, `Sources (${m.sources.length})`)),
      h('ul', { class: 'liste-puces petit' }, m.sources.map((s) => h('li', {}, lienExterne(s, s.replace(/^https:\/\//, '').slice(0, 90)))))));
  }
  if (m.avertissements?.length) {
    page.append(h('p', { class: 'texte-3 tres-petit avertissements-meta' }, icone('info', { classe: 'icone-texte' }), ` ${m.avertissements.join(' ')}`));
  }
}
