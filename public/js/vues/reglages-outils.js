// Réglages du jeu, outils communs aux sections : brouillon des réglages, sections repliables (« postes » numérotés),
// champs reliés au brouillon (chaque contrôle porte le chemin de validation du serveur, pour pointer une erreur),
// identifiants des nouveaux éléments.

import { h, champ, saisie, zone, bouton } from '../ui.js';
import { puce } from '../composants/jetons.js';
import { idDepuisNom } from './admin-commun.js';

export const cloner = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Identifiant d'un nouvel élément : tiré de son nom (minuscules sans accent, chiffres), 2 à 20 caractères, unique.
export function nouvelId(nom, pris, { prefixe = 'el', reserves = [] } = {}) {
  const interdits = new Set([...pris, ...reserves]);
  let base = idDepuisNom(nom, 20);
  if (base.length < 2) base = `${prefixe}${base}`.slice(0, 20);
  if (!interdits.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const id = `${base.slice(0, 20 - String(n).length)}${n}`;
    if (!interdits.has(id)) return id;
  }
  return `${prefixe}${Date.now().toString(36)}`.slice(0, 20);
}

// Contrôle relié au brouillon. chemin : chemin de validation (« listes.roles[2].nom ») ; contexte : libellé lisible
// d'une erreur (« Rôles · Duelliste · nom »).
function relier(ctrl, { chemin, contexte, ecrire, lire = () => ctrl.value }) {
  if (chemin) ctrl.dataset.chemin = chemin;
  if (contexte) ctrl.dataset.libelle = contexte;
  ctrl.addEventListener('input', () => {
    ctrl.removeAttribute('aria-invalid');
    ecrire(lire());
  });
  return ctrl;
}

export function texteReglage({ libelle, valeur = '', max = 80, chemin, contexte, ecrire, placeholder = '', aide = '', large = false, multi = false, lignes = 2, attrs = {} }) {
  const ctrl = multi
    ? zone({ valeur, lignes, maxlength: max, placeholder, ...attrs })
    : saisie({ valeur, maxlength: max, placeholder, autocomplete: 'off', ...attrs });
  relier(ctrl, { chemin, contexte: contexte || libelle, ecrire });
  return champ(libelle, ctrl, { aide, large });
}

// Nombre : entier ou décimal (virgule acceptée). Une saisie invalide est signalée tout de suite et bloque
// l'enregistrement (S.erreursLocales) au lieu d'être remplacée en silence par une valeur par défaut.
export function nombreReglage(S, { libelle, valeur, min, max, decimales = 0, chemin, contexte, ecrire, aide = '', unite = '' }) {
  const ctrl = saisie({
    valeur: valeur ?? '', inputmode: decimales ? 'decimal' : 'numeric', autocomplete: 'off', class: 'saisie rgl-nombre', maxlength: 12,
  });
  const message = `${decimales ? 'nombre' : 'nombre entier'} entre ${min} et ${max}`;
  relier(ctrl, {
    chemin,
    contexte: contexte || libelle,
    lire: () => ctrl.value,
    ecrire: (brut) => {
      const t = String(brut).trim().replace(',', '.');
      const n = Number(t);
      const ok = t !== '' && /^-?\d+(\.\d+)?$/.test(t) && n >= min && n <= max && (decimales || Number.isInteger(n));
      if (ok) {
        S.erreursLocales.delete(chemin);
        ecrire(decimales ? Math.round(n * 10 ** decimales) / 10 ** decimales : n);
      } else {
        S.erreursLocales.set(chemin, { chemin, message, libelle: contexte || libelle, ctrl });
        ctrl.setAttribute('aria-invalid', 'true');
        S.modifie();
      }
    },
  });
  return champ(unite ? `${libelle} (${unite})` : libelle, ctrl, { aide });
}

export function caseReglage({ libelle, coche, chemin, contexte, ecrire }) {
  const input = h('input', { type: 'checkbox', checked: !!coche });
  relier(input, { chemin, contexte: contexte || libelle, ecrire, lire: () => input.checked });
  return { element: h('label', { class: 'case' }, input, libelle), input };
}

// Section repliable : un « poste » numéroté du parcours des réglages. Son corps est reconstruit à la demande
// (retour au modèle, ajout ou retrait d'un élément) ; une simple saisie ne le reconstruit jamais.
export function section(S, { cle, numero, titre, intro = '', resume, personnalise, revenir = null, revenirBloque = '', corps }) {
  const etat = h('span', { class: 'rgl-poste__etat' });
  const sous = h('span', { class: 'rgl-poste__resume' });
  const contenu = h('div', { class: 'rgl-poste__contenu' });
  const pied = h('div', { class: 'rgl-poste__pied' });
  const details = h('details', { class: 'rgl-poste', dataset: { section: cle } },
    h('summary', { class: 'rgl-poste__titre' },
      h('span', { class: 'rgl-poste__numero', 'aria-hidden': 'true' }, String(numero)),
      h('span', { class: 'rgl-poste__textes' }, h('span', { class: 'rgl-poste__nom' }, titre), sous),
      etat),
    h('div', { class: 'rgl-poste__corps' }, intro ? h('p', { class: 'texte-2 petit rgl-poste__intro' }, intro) : null, contenu, pied));
  const majEntete = () => {
    const perso = personnalise();
    details.classList.toggle('rgl-poste--perso', perso);
    etat.replaceChildren(perso ? puce('Personnalisé', 'accent') : puce('Modèle'));
    sous.textContent = resume();
    const b = pied.querySelector('button');
    if (b) b.disabled = !perso || !!revenirBloque;
  };
  const redessiner = () => {
    contenu.replaceChildren(...[corps()].flat().filter(Boolean));
    majEntete();
  };
  if (revenir) {
    if (revenirBloque) pied.append(h('p', { class: 'texte-3 tres-petit' }, revenirBloque));
    pied.append(bouton('Revenir au modèle', {
      classe: 'btn--petit btn--discret', icone: 'actualiser',
      onclick: () => {
        revenir();
        redessiner();
        S.modifie();
      },
    }));
  }
  redessiner();
  return { cle, element: details, redessiner, majEntete };
}

// Retrouve le contrôle d'un chemin d'erreur (ou, à défaut, du plus proche parent : « meta.sources[3] » → meta.sources).
export function trouverChamp(racine, chemin) {
  let c = chemin;
  while (c) {
    const el = racine.querySelector(`[data-chemin="${CSS.escape(c)}"]`);
    if (el) return { el, reste: chemin.slice(c.length) };
    const coupe = Math.max(c.lastIndexOf('.'), c.lastIndexOf('['));
    if (coupe <= 0) break;
    c = c.slice(0, coupe);
  }
  return null;
}

export function ouvrirJusqua(el) {
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) {
    if (!d.open) d.open = true;
  }
}
