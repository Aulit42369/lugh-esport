// Adversaires : fiche anti-strat, prochain match, préparation selon le veto du jeu (assistant de veto de maps, plan de
// draft, ou rien), règles du jeu, checklist d'avant-match, historique contre eux et texte pour Discord.

import { h, zone, caseACocher, bouton, toast, etatVide, lienExterne, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { nomMap, puce, puceStatutMap, jetonPersonnage, signature } from '../composants/jetons.js';
import { copierTexte } from '../composants/sorties.js';
import { proposerVeto } from '/shared/veto.js';
import { statsScrims, resultat, trierParDate, scoreLisible } from '/shared/stats.js';
import { texteMatch } from '/shared/discord.js';
import { formatDate } from '/shared/temps.js';
import { editeur, listesAdverses, libelleDebuts, libellePlan, formatParDefaut } from './adversaires-editeur.js';
import { cartesSuivies, resumeResultats, motResultat } from './maps-outils.js';

const memeNom = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
export const scrimsContre = (adv) => E.liste('scrims').filter((s) => memeNom(s.adversaire, adv.nom) || (adv.tag && memeNom(s.adversaire, adv.tag)));

const aujourdhui = () => E.serveur()?.aujourdhui || new Date().toISOString().slice(0, 10);
const classement = () => J.typeScore() === 'classement';

// Éléments de la checklist : actifs, plus ceux masqués depuis mais déjà cochés sur cette fiche.
const elementsChecklist = (adv) => J.checklist(true).filter((c) => !c.archive || adv.checklist?.[c.id]);
const faitsChecklist = (adv) => J.checklist().filter((c) => adv.checklist?.[c.id]).length;

function quandMatch(m) {
  if (!m?.date) return '';
  const format = classement() ? '' : `${J.nomFormat(m.format || formatParDefaut())} `;
  return `${format}le ${formatDate(m.date)}${m.heure ? ` à ${m.heure}` : ''}`;
}

// ——— Liste ———

function vueListe(page) {
  const advs = E.liste('adversaires').sort((a, b) => (a.prochainMatch?.date || '9999').localeCompare(b.prochainMatch?.date || '9999') || a.nom.localeCompare(b.nom, 'fr'));
  const auj = aujourdhui();
  const editable = E.peut('adversaires.modifier');
  const preparation = { cartes: 'un assistant de veto', draft: 'un plan de draft' }[J.typeVeto()];
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Adversaires'),
      h('p', { class: 'entete-page__intro' }, preparation
        ? `Une fiche par équipe adverse : leurs habitudes, l’historique contre eux et ${preparation}, pour préparer le prochain match.`
        : 'Une fiche par équipe adverse : leurs habitudes et l’historique contre eux, pour préparer le prochain match.')),
    h('div', { class: 'entete-page__actions' },
      h('a', { href: J.lien('/tournois'), class: 'btn' }, icone('tournois'), 'Tournois'),
      editable ? bouton('Nouvel adversaire', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeur() }) : null)));
  if (!advs.length) {
    page.append(etatVide('Aucune fiche adverse. Crée-en une avant votre prochain match officiel.',
      editable ? bouton('Nouvel adversaire', { classe: 'btn--principal', onclick: () => editeur() }) : null));
    return;
  }
  const total = J.checklist().length;
  page.append(h('div', { class: 'grille-maps' }, advs.map((a) => {
    const st = statsScrims(scrimsContre(a), J.def());
    const aVenir = a.prochainMatch?.date && a.prochainMatch.date >= auj;
    return h('a', { href: J.lien(`/adversaires/${a._id}`), class: 'fiche carte-adversaire' },
      h('div', { class: 'rangee rangee--espace' }, h('h2', {}, a.nom), a.tag ? puce(a.tag, 'plein') : null),
      a.circuit ? h('span', { class: 'texte-3 petit' }, a.circuit) : null,
      aVenir ? puce(`Match ${quandMatch(a.prochainMatch)}`, 'accent') : h('span', { class: 'texte-3 petit' }, 'Pas de match prévu'),
      h('span', { class: 'petit' }, st.total ? `${classement() ? 'Face à eux' : 'Contre eux'} : ${resumeResultats(st)}` : 'Jamais affrontés'),
      aVenir && total ? h('span', { class: 'texte-3 tres-petit' }, `Préparation : ${faitsChecklist(a)} sur ${total}`) : null);
  })));
}

// ——— Fiche ———

function ficheRegles() {
  const notes = J.def().veto?.notes;
  if (!notes) return null;
  return h('aside', { class: 'regles-jeu', 'aria-label': 'Règles du jeu' },
    h('div', { class: 'regles-jeu__tete' }, icone('info'), h('h2', {}, 'Règles du jeu')),
    h('p', { class: 'petit texte-multi' }, notes));
}

function ficheAssistant(a) {
  const meta = E.meta();
  const m = a.prochainMatch || {};
  const pool = meta?.mapPool || [];
  const notre = Object.fromEntries(pool.map((id) => [id, E.doc('mapsEquipe', id) || { statut: 'travail', preparation: 0 }]));
  const format = m.format || formatParDefaut();
  const etapes = proposerVeto({ formats: J.formats(), format, nousCommencons: m.nousCommencons !== false, pool, notre, adv: a, nomMap });
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Assistant de veto'),
      h('span', { class: 'fiche__meta' }, `${J.nomFormat(format)}, ${m.nousCommencons === false ? 'ils commencent' : 'nous commençons'}`)),
    etapes.length ? h('ol', { class: 'veto-etapes' }, etapes.map((e) => h('li', { class: `veto-etape veto-etape--${e.qui || 'decisive'} veto-etape--${e.action}` },
      h('span', { class: 'veto-etape__qui' }, e.qui === 'nous' ? 'Nous' : e.qui === 'eux' ? 'Eux' : 'Décisive'),
      h('span', { class: 'veto-etape__action' }, e.action === 'ban' ? 'Ban' : e.action === 'pick' ? 'Pick' : J.v('carte', true)),
      h('strong', {}, e.nom),
      h('span', { class: 'texte-3 tres-petit' }, e.raison))))
      : h('p', { class: 'texte-3 petit' }, 'Pas d’ordre de veto connu pour ce format.'),
    h('p', { class: 'texte-3 tres-petit' }, `Suggestion calculée avec nos statuts de ${J.v('carte')} et leurs habitudes. Ordre habituel du format : vérifie le règlement du tournoi.`));
}

function fichePlan(a, editable) {
  const cle = `plan-${a._id}`;
  const draft = J.typeVeto() === 'draft';
  const plan = zone({
    valeur: a.planVeto,
    lignes: 5,
    maxlength: 600,
    placeholder: draft ? 'Bans prioritaires, premiers picks, réponses prévues, côté choisi.' : `Le veto retenu par le staff : ${J.v('cartes')}, ordre et côtés.`,
    disabled: !editable,
    'aria-label': libellePlan(),
    dataset: { brouillon: cle },
  });
  return [
    h('h2', {}, libellePlan()),
    plan,
    editable ? h('div', {}, bouton('Enregistrer le plan', {
      classe: 'btn--principal',
      onclick: async () => {
        try {
          await E.enregistrer('adversaires', a._id, { ...E.sansMeta(a), planVeto: plan.value.trim() }, { revBase: a.rev });
          toast(`${libellePlan()} enregistré.`);
          E.definirBrouillon(false, cle);
        } catch (err) {
          toast(messageErreur(err), { type: 'erreur' });
        }
      },
    })) : null,
  ];
}

// Checklist d'avant-match : titre de fiche quand elle est seule, sous-titre sous le plan de veto.
function blocChecklist(a, editable, { seule = false } = {}) {
  const elements = elementsChecklist(a);
  const connus = new Set(J.checklist(true).map((c) => c.id));
  const titre = 'Checklist d’avant-match';
  const compte = elements.length ? h('span', { class: 'fiche__meta' }, `${faitsChecklist(a)} sur ${J.checklist().length}`) : null;
  return [
    seule
      ? h('div', { class: 'fiche__titre' }, h('h2', {}, titre), compte)
      : h('div', { class: 'fiche__titre fiche__titre--serre' }, h('h3', { class: 'sous-titre' }, titre), compte),
    elements.length ? h('div', { class: 'pile-s checklist-match' }, elements.map((c) => {
      const cc = caseACocher(c.nom, { coche: !!a.checklist?.[c.id], disabled: !editable });
      cc.input.addEventListener('change', async () => {
        const checklist = Object.fromEntries(Object.entries({ ...a.checklist, [c.id]: cc.input.checked }).filter(([k]) => connus.has(k)));
        try {
          await E.enregistrer('adversaires', a._id, { ...E.sansMeta(a), checklist }, { revBase: a.rev });
        } catch (err) {
          toast(messageErreur(err), { type: 'erreur' });
        }
      });
      return cc.element;
    })) : h('p', { class: 'texte-3 petit' }, 'Aucun élément : la checklist se règle dans les Réglages du jeu.'),
  ];
}

function liste_(titre, ids, genre) {
  const valeurs = ids || [];
  return h('div', { class: 'pile-s' }, h('h3', { class: 'sous-titre' }, titre),
    valeurs.length
      ? h('div', { class: 'rangee' }, valeurs.map((id) => (genre === 'cartes'
        ? h('span', { class: 'rangee rangee--serree' }, puce(nomMap(id), 'plein'), puceStatutMap(E.doc('mapsEquipe', id)?.statut))
        : jetonPersonnage(id))))
      : h('span', { class: 'texte-3 petit' }, 'Non renseigné'));
}

function ficheAntiStrat(a) {
  const listes = listesAdverses();
  const texte = (titre, t) => (t ? h('div', { class: 'pile-s' }, h('h3', { class: 'sous-titre' }, titre), h('p', { class: 'texte-multi petit' }, t)) : null);
  return h('section', { class: 'fiche' },
    h('h2', {}, 'Fiche anti-strat'),
    listes.cles.map((cle) => liste_(listes.libelles[cle], a[cle], listes.genre)),
    texte(libelleDebuts(), a.debuts), texte('Setups', a.setups), texte('Tendances', a.tendances), texte('Joueurs clés', a.joueursCles),
    a.vods?.length ? h('div', { class: 'pile-s' }, h('h3', { class: 'sous-titre' }, 'VOD à étudier'),
      h('ul', { class: 'liste-puces petit' }, a.vods.map((v) => h('li', {}, lienExterne(v, v.replace(/^https:\/\//, '').slice(0, 60)))))) : null,
    !listes.cles.length && !a.debuts && !a.setups && !a.tendances && !a.joueursCles && !a.vods?.length
      ? h('p', { class: 'texte-3 petit' }, 'Rien de noté pour l’instant : complète la fiche avec ce que vous savez d’eux.') : null,
    signature(a));
}

function ficheHistorique(a) {
  const historique = trierParDate(scrimsContre(a), -1);
  return h('section', { class: 'fiche' },
    h('h2', {}, classement() ? 'Nos résultats face à eux' : 'Historique contre eux'),
    historique.length ? h('div', { class: 'liste-lignes' }, historique.map((s) => {
      const r = resultat(s);
      return h('div', { class: 'ligne' },
        h('span', { class: `resultat resultat--${r}`, title: motResultat(r), 'aria-label': motResultat(r) }, r),
        h('div', { class: 'ligne__principal' },
          h('div', { class: 'ligne__titre' }, `${scoreLisible(s)}${s.map ? ` sur ${nomMap(s.map)}` : ''}`),
          h('div', { class: 'ligne__sous' }, formatDate(s.date))));
    }))
      : h('p', { class: 'texte-3 petit' }, classement()
        ? 'Aucune partie saisie sous ce nom (le lobby ou le tournoi doit porter le même nom dans la page Scrims).'
        : 'Aucun scrim ni match saisi contre eux (le nom doit correspondre dans la page Scrims).'));
}

function vueDetail(page, id) {
  const a = E.doc('adversaires', id);
  page.append(h('a', { href: J.lien('/adversaires'), class: 'retour' }, icone('gauche'), 'Tous les adversaires'));
  if (!a) {
    page.append(etatVide('Cette fiche n’existe plus.'));
    return;
  }
  const editable = E.peut('adversaires.modifier');
  const m = a.prochainMatch || {};
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, a.nom),
      h('div', { class: 'rangee' }, a.tag ? puce(a.tag, 'plein') : null, a.circuit ? puce(a.circuit) : null,
        m.date ? puce(`Match ${quandMatch(m)}`, 'accent') : null)),
    h('div', { class: 'entete-page__actions' },
      m.date ? bouton('Copier pour Discord', { icone: 'discord', onclick: () => copierTexte(texteMatch(J.def(), a)) }) : null,
      editable ? bouton('Modifier la fiche', { icone: 'modifier', classe: 'btn--principal', onclick: () => editeur(a) }) : null)));

  const regles = ficheRegles();
  if (regles) page.append(regles);
  const veto = J.typeVeto();
  if (veto === 'cartes' && cartesSuivies().length) {
    page.append(h('div', { class: 'grille-2' }, ficheAssistant(a), h('section', { class: 'fiche pile' }, fichePlan(a, editable), blocChecklist(a, editable))));
  } else if (veto === 'draft' || veto === 'cartes') {
    page.append(h('div', { class: 'grille-2 grille--haut' },
      h('section', { class: 'fiche pile' }, fichePlan(a, editable)),
      h('section', { class: 'fiche' }, blocChecklist(a, editable, { seule: true }))));
  } else {
    // Sans veto ni draft : la fiche adverse d'abord, la checklist et l'historique à côté.
    page.append(h('div', { class: 'grille-2 grille--haut' }, ficheAntiStrat(a),
      h('div', { class: 'pile' }, h('section', { class: 'fiche' }, blocChecklist(a, editable, { seule: true })), ficheHistorique(a))));
    return;
  }
  page.append(h('div', { class: 'grille-2 section' }, ficheAntiStrat(a), ficheHistorique(a)));
}

export function rendre(page, params) {
  if (params[0]) vueDetail(page, params[0]);
  else vueListe(page);
}
