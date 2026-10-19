// Chiffres hebdomadaires d'un joueur : saisie du rang et des chiffres suivis par le jeu, courbes (rang et un graphique
// par chiffre, avec l'objectif du palier et le repère du chiffre), tableau de toutes les semaines et export CSV.

import { h, champ, saisie, liste, bouton, toast, messageErreur, confirmer } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { courbe, nombre } from '../composants/courbe.js';
import { telecharger } from '../composants/sorties.js';
import { lienProfil } from '../composants/profil.js';
import { csv } from '/shared/exports.js';
import { seriesMesures } from '/shared/suivi.js';
import { seuilPourChiffre } from '/shared/jeux/contenus.js';
import { decalerSemaine, numeroSemaine, semaineCourante } from '/shared/temps.js';

const NB_SEMAINES = 12;

// ——— Formats (repris par la progression et le bilan) ———

export function avecUnite(texte, unite) {
  if (!unite) return texte;
  return unite.startsWith('/') ? `${texte}${unite}` : `${texte} ${unite}`;
}

export const decimalesDe = (c) => c?.decimales ?? 2;
export const formatChiffre = (c, v) => (typeof v === 'number' ? avecUnite(nombre(v, decimalesDe(c)), c?.unite) : '—');
// Seuil ou repère : « 23 % » plutôt que « 23,0 % » quand la valeur est ronde.
export const formatSeuil = (c, v) => avecUnite(nombre(v, Number.isInteger(v) ? 0 : decimalesDe(c)), c?.unite);
export const libelleChiffre = (c) => `${c.nom}${c.unite ? ` (${c.unite})` : ''}`;

// Écart signé arrondi selon le chiffre : « +1,2 », « −0,40 », « ±0 ».
export function ecartChiffre(c, actuel, avant) {
  if (typeof actuel !== 'number' || typeof avant !== 'number') return '';
  const d = decimalesDe(c);
  const e = Number((actuel - avant).toFixed(d));
  if (!e) return '±0';
  return `${e > 0 ? '+' : '−'}${nombre(Math.abs(e), d)}`;
}

// Abréviation d'un rang pour l'axe : « Diamant 2 » → « Dia 2 », « Grand Champion III » → « GC III ».
function rangCourt(n) {
  const r = J.rangDeN(n);
  if (!r) return '';
  const mots = r.nom.split(/\s+/);
  const fin = mots.length > 1 && /^([IVX]+|\d+)$/.test(mots.at(-1)) ? mots.pop() : '';
  const base = mots.length > 1 ? mots.map((m) => m[0].toUpperCase()).join('') : mots[0].slice(0, 3);
  return fin ? `${base} ${fin}` : base;
}

function ecartRang(a, b) {
  const e = Math.round(a - b);
  if (!e) return 'stable';
  return `${e > 0 ? '+' : '−'}${Math.abs(e)} rang${Math.abs(e) > 1 ? 's' : ''}`;
}

// Dernière semaine saisie (ou la dernière qui contient ce chiffre).
export function derniereMesure(membreId, chiffreId = null) {
  const serie = seriesMesures(E.liste('mesures'), membreId);
  if (!chiffreId) return serie.at(-1) || null;
  return serie.findLast((m) => typeof m.valeurs?.[chiffreId] === 'number') || null;
}

// Chiffres à montrer dans un tableau : ceux suivis par le jeu, plus ceux masqués depuis qui ont encore des valeurs.
export function chiffresAffiches(mesures) {
  return J.chiffres(true).filter((c) => !c.archive || mesures.some((m) => typeof m.valeurs?.[c.id] === 'number'));
}

// Liste lisible : « rang, headshots, ACS moyen et K/D ».
function enumeration(noms) {
  const mots = noms.map((n) => (/^\p{Lu}\p{Ll}/u.test(n) ? n[0].toLowerCase() + n.slice(1) : n));
  return mots.length > 1 ? `${mots.slice(0, -1).join(', ')} et ${mots.at(-1)}` : mots[0] || '';
}

function lireNombre(texte) {
  const t = texte.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// ——— Saisie de la semaine ———

function formulaire(membre, semaines) {
  const avecRangs = J.rangs(true).length > 0;
  const rang = avecRangs ? liste(J.rangs().map((r) => ({ valeur: r.id, libelle: r.nom })), { vide: '—' }) : null;
  const chiffres = J.chiffres().map((c) => ({
    c,
    el: saisie({ inputmode: decimalesDe(c) ? 'decimal' : 'numeric', maxlength: 12, placeholder: `${nombre(c.min, 0)} à ${nombre(c.max, 0)}` }),
  }));
  const parties = saisie({ type: 'number', min: 0, max: 300, step: 1, placeholder: 'Ex. : 12' });
  const note = saisie({ maxlength: 200, placeholder: 'Facultatif : contexte de la semaine' });
  const semaine = liste(semaines.map((s, i) => ({ valeur: s, libelle: `Semaine ${numeroSemaine(s)}${i === 0 ? ' (en cours)' : i === 1 ? ' (dernière)' : ''}` })), { valeur: semaines[0], dataset: { pasBrouillon: '1' } });
  const supprimer = bouton('Effacer cette semaine', { classe: 'btn--discret btn--petit' });
  const actuelle = () => E.doc('mesures', `${membre._id}_${semaine.value}`);
  const remplir = () => {
    const m = actuelle();
    if (rang) {
      // Un rang masqué depuis reste affiché pour ne pas être effacé à l'enregistrement.
      for (const o of rang.querySelectorAll('option[data-ancien]')) o.remove();
      if (m?.rang && !J.rangs().some((r) => r.id === m.rang)) rang.append(h('option', { value: m.rang, dataset: { ancien: '1' } }, J.nomRang(m.rang)));
      rang.value = m?.rang || '';
    }
    for (const { c, el } of chiffres) {
      const v = m?.valeurs?.[c.id];
      el.value = typeof v === 'number' ? nombre(v, decimalesDe(c)).replace(/\s/g, '') : '';
      el.removeAttribute('aria-invalid');
    }
    parties.value = m?.parties ?? '';
    note.value = m?.note || '';
    supprimer.hidden = !m;
  };
  semaine.addEventListener('change', remplir);
  remplir();
  const chemin = () => `/mesures/${encodeURIComponent(membre._id)}/${encodeURIComponent(semaine.value)}`;
  const enregistrer = bouton('Enregistrer', { classe: 'btn--principal' });
  enregistrer.addEventListener('click', async () => {
    const valeurs = { ...(actuelle()?.valeurs || {}) };
    let erreur = '';
    for (const { c, el } of chiffres) {
      const n = lireNombre(el.value);
      const invalide = Number.isNaN(n) || (n !== null && (n < c.min || n > c.max));
      if (invalide) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
      if (invalide && !erreur) {
        erreur = Number.isNaN(n) ? `${c.nom} : un nombre, par exemple ${nombre(c.max / 2, decimalesDe(c) ? 1 : 0)}.` : `${c.nom} : entre ${nombre(c.min, 0)} et ${nombre(c.max, 0)}.`;
        el.focus();
      }
      valeurs[c.id] = n;
    }
    const nbParties = parties.value.trim() === '' ? null : Number(parties.value);
    if (!erreur && nbParties !== null && (!Number.isInteger(nbParties) || nbParties < 0 || nbParties > 300)) erreur = 'Parties jouées : un nombre entier entre 0 et 300.';
    if (!erreur && !rang?.value && nbParties === null && chiffres.every(({ c }) => valeurs[c.id] === null)) erreur = 'Renseigne au moins un chiffre.';
    if (erreur) {
      toast(erreur, { type: 'erreur' });
      return;
    }
    enregistrer.disabled = true;
    try {
      await E.appeler('PUT', chemin(), { valeur: { rang: rang ? rang.value : (actuelle()?.rang || ''), valeurs, parties: nbParties, note: note.value.trim() } }, 'mesures');
      toast(`Chiffres de la semaine ${numeroSemaine(semaine.value)} enregistrés.`);
      E.definirBrouillon(false, 'chiffres');
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    } finally {
      enregistrer.disabled = false;
    }
  });
  supprimer.addEventListener('click', async () => {
    if (!(await confirmer(`Effacer les chiffres de la semaine ${numeroSemaine(semaine.value)} ?`, { libelle: 'Effacer', danger: true }))) return;
    try {
      await E.appeler('DELETE', chemin());
      E.supprimerLocal('mesures', `${membre._id}_${semaine.value}`);
      toast('Semaine effacée.');
      E.definirBrouillon(false, 'chiffres');
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    }
  });
  const site = J.def()?.profil?.site;
  const profil = membre.idJeu ? lienProfil(membre.idJeu) : null;
  return h('div', { class: 'fiche fiche--serree pile-s saisie-chiffres', dataset: { brouillon: 'chiffres' } },
    h('div', { class: 'grille-champs grille-champs--3' },
      champ('Semaine', semaine),
      rang ? champ('Rang', rang) : null,
      chiffres.map(({ c, el }) => champ(libelleChiffre(c), el, { aide: c.aide || '' })),
      champ('Parties jouées', parties)),
    champ('Note', note),
    h('div', { class: 'rangee rangee--espace' },
      profil ? h('span', { class: 'petit texte-3' }, 'Chiffres sur ', profil)
        : h('span', { class: 'petit texte-3' }, `Chiffres de fin de partie${site ? ` ou de ${site}` : ''}.`),
      h('div', { class: 'rangee' }, supprimer, enregistrer)));
}

// ——— Tableau et export ———

function tableau(serie, affiches, avecRangs) {
  return h('div', { class: 'defile' }, h('table', { class: 'tableau tableau--chiffres' },
    h('thead', {}, h('tr', {},
      h('th', {}, 'Semaine'), avecRangs ? h('th', {}, 'Rang') : null,
      affiches.map((c) => h('th', { class: 'num' }, c.nom)), h('th', { class: 'num' }, 'Parties'), h('th', {}, 'Note'))),
    h('tbody', {}, [...serie].reverse().map((m) => h('tr', {},
      h('td', { class: 'tableau__semaine' }, `S${numeroSemaine(m.semaine)} ${m.semaine.slice(0, 4)}`),
      avecRangs ? h('td', {}, m.rang ? J.nomRang(m.rang) : '—') : null,
      affiches.map((c) => h('td', { class: 'num' }, formatChiffre(c, m.valeurs?.[c.id]))),
      h('td', { class: 'num' }, m.parties ?? '—'),
      h('td', { class: 'petit' }, m.note || ''))))));
}

function exporter(membre, serie, affiches, avecRangs) {
  const entetes = ['Semaine', ...(avecRangs ? ['Rang'] : []), ...affiches.map(libelleChiffre), 'Parties', 'Note'];
  const lignes = serie.map((m) => [m.semaine, ...(avecRangs ? [m.rang ? J.nomRang(m.rang) : ''] : []), ...affiches.map((c) => m.valeurs?.[c.id] ?? null), m.parties ?? null, m.note]);
  const nom = (membre.pseudo || 'joueur').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'joueur';
  telecharger(`chiffres-${nom}-${E.jeu()?.id || 'jeu'}.csv`, csv(entetes, lignes), 'text/csv;charset=utf-8');
}

// ——— Section complète ———

export function sectionChiffres(membre) {
  const moi = E.monMembreId() === membre._id;
  const peutSaisir = (moi && E.peut('mesures.soi')) || E.peut('objectifs.fixer');
  const courante = E.serveur()?.semaine || semaineCourante();
  const fenetre = Array.from({ length: NB_SEMAINES }, (_, i) => decalerSemaine(courante, i - NB_SEMAINES + 1));
  const serie = seriesMesures(E.liste('mesures'), membre._id);
  const parSemaine = new Map(serie.map((m) => [m.semaine, m]));
  const etiquette = (s) => `S${numeroSemaine(s)}`;
  const palierN = J.palier(E.palierDe(membre._id))?.n || 1;
  const avecRangs = J.rangs(true).length > 0;
  const suivis = J.chiffres();

  const courbes = [];
  if (avecRangs) {
    courbes.push(courbe({
      titre: 'Rang',
      points: fenetre.map((s) => ({ etiquette: etiquette(s), valeur: J.rangN(parSemaine.get(s)?.rang) })),
      format: (v) => J.rangDeN(v)?.nom || '—', etiquettesAxe: rangCourt, pasMin: 1, plancher: 1, ecart: ecartRang,
    }));
  }
  for (const c of suivis) {
    const objectif = seuilPourChiffre(J.def(), c.id, palierN);
    const lignes = [];
    if (objectif) lignes.push({ valeur: objectif.seuil, libelle: `objectif ${objectif.sens === '<=' ? '≤' : '≥'} ${formatSeuil(c, objectif.seuil)}`, ton: 'objectif' });
    if (typeof c.repere?.valeur === 'number') lignes.push({ valeur: c.repere.valeur, libelle: c.repere.libelle || 'repère', ton: 'repere' });
    courbes.push(courbe({
      titre: c.nom,
      points: fenetre.map((s) => ({ etiquette: etiquette(s), valeur: parSemaine.get(s)?.valeurs?.[c.id] ?? null })),
      format: (v) => formatChiffre(c, v), lignes, plancher: c.min, plafond: c.max, pasMin: decimalesDe(c) ? 0 : 1,
      suffixeAxe: c.unite === '%' ? ' %' : '', ecart: (a, b) => ecartChiffre(c, a, b),
    }));
  }
  // Petits multiples de même taille : 3 colonnes pour 3, 5, 6 ou 9 courbes, 4 pour 4, 7 ou 8, 2 au minimum.
  const n = courbes.length;
  const colonnes = n <= 2 ? 2 : [3, 5, 6, 9].includes(n) ? 3 : 4;

  const affiches = chiffresAffiches(serie);
  const noms = [...(avecRangs ? ['rang'] : []), ...suivis.map((c) => c.nom)];
  return h('section', { class: 'section section-chiffres' },
    h('div', { class: 'section__entete' },
      h('h2', {}, moi ? 'Mes chiffres' : 'Chiffres de la semaine'),
      h('span', { class: 'section__aide' }, noms.length
        ? `${enumeration(noms).replace(/^./, (x) => x.toUpperCase())}, une fois par semaine. Courbes sur les ${NB_SEMAINES} dernières semaines.`
        : 'Aucun chiffre suivi : le Responsable peut en ajouter dans les Réglages du jeu.')),
    peutSaisir ? formulaire(membre, fenetre.slice(-8).reverse()) : null,
    n ? h('div', { class: 'grille-courbes grille-courbes--perf', style: { '--colonnes': String(colonnes) } }, courbes) : null,
    serie.length ? h('details', { class: 'referentiel' },
      h('summary', {}, h('strong', {}, 'Toutes les semaines'), h('span', { class: 'texte-3 petit' }, ` ${serie.length} saisie${serie.length > 1 ? 's' : ''}`)),
      tableau(serie, affiches, avecRangs),
      bouton('Exporter (CSV)', { icone: 'telecharger', classe: 'btn--petit', onclick: () => exporter(membre, serie, affiches, avecRangs) })) : null);
}
