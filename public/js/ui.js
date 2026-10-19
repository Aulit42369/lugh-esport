// Outils d'interface : création d'éléments (texte uniquement, jamais de HTML injecté), champs de formulaire,
// modales, confirmations et notifications.

import { icone } from './icones.js';

const PROPRIETES = new Set(['value', 'checked', 'selected', 'indeterminate']);

function ajouter(parent, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false || e === true) continue;
    parent.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

function appliquer(el, attrs) {
  const differes = [];
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (PROPRIETES.has(k)) differes.push([k, v]);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return differes;
}

export function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  const differes = appliquer(el, attrs);
  ajouter(el, enfants);
  for (const [k, v] of differes) el[k] = v;
  return el;
}

export function svg(tag, attrs = {}, ...enfants) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, String(v));
  }
  ajouter(el, enfants);
  return el;
}

export function vider(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

let compteurId = 0;
export function idUnique(prefixe = 'c') {
  compteurId += 1;
  return `${prefixe}-${compteurId}`;
}

// ——— Champs de formulaire ———

export function champ(libelle, controle, { aide = '', large = false } = {}) {
  const id = controle.id || idUnique('champ');
  controle.id = id;
  return h('div', { class: ['champ', large && 'champ--large'] },
    h('label', { class: 'champ__label', for: id }, libelle),
    controle,
    aide ? h('span', { class: 'champ__aide' }, aide) : null);
}

export function saisie({ type = 'text', valeur = '', ...attrs } = {}) {
  return h('input', { class: 'saisie', type, value: valeur ?? '', ...attrs });
}

export function zone({ valeur = '', lignes = 4, ...attrs } = {}) {
  return h('textarea', { class: 'saisie', rows: lignes, value: valeur ?? '', ...attrs });
}

// options : [{ valeur, libelle }] ou [{ groupe, options: [...] }]
export function liste(options, { valeur = '', vide = null, ...attrs } = {}) {
  const opt = (o) => h('option', { value: o.valeur }, o.libelle);
  const el = h('select', { class: 'saisie', ...attrs },
    vide !== null ? h('option', { value: '' }, vide) : null,
    options.map((o) => (o.groupe ? h('optgroup', { label: o.groupe }, o.options.map(opt)) : opt(o))));
  el.value = valeur ?? '';
  return el;
}

export function caseACocher(libelle, { coche = false, ...attrs } = {}) {
  const input = h('input', { type: 'checkbox', checked: !!coche, ...attrs });
  return { element: h('label', { class: 'case' }, input, libelle), input };
}

export function onglets(choix, actuel, surChoix, { libelle = '' } = {}) {
  return h('div', { class: 'onglets', role: 'group', 'aria-label': libelle },
    choix.map((c) => h('button', {
      type: 'button',
      'aria-pressed': String(c.valeur === actuel),
      onclick: () => surChoix(c.valeur),
    }, c.libelle)));
}

export function bouton(libelle, { icone: nomIcone = null, classe = '', ...attrs } = {}) {
  return h('button', { type: 'button', class: ['btn', classe], ...attrs }, nomIcone ? icone(nomIcone) : null, libelle);
}

export function lienExterne(url, libelle, { classe = '' } = {}) {
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: classe }, libelle, ' ', icone('externe', { classe: 'icone-texte' }));
}

// ——— Notifications ———

function conteneurToasts() {
  let c = document.querySelector('.toasts');
  if (!c) {
    c = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(c);
  }
  return c;
}

export function toast(message, { type = 'ok', duree = 4500 } = {}) {
  const t = h('div', { class: ['toast', type === 'erreur' && 'toast--erreur'] }, icone(type === 'erreur' ? 'alerte' : 'ok'), message);
  conteneurToasts().append(t);
  setTimeout(() => t.remove(), duree);
}

export function messageErreur(err) {
  if (!err) return 'Erreur inconnue.';
  if (err.details?.length) {
    return `${err.message} ${err.details.slice(0, 3).map((d) => `${d.chemin} : ${d.message}`).join(' ; ')}`;
  }
  return err.message || String(err);
}

// ——— Modales ———

// actions : [{ libelle, classe, action: async () => false pour garder la modale ouverte }]
export function modale({ titre, contenu, actions = [], large = false, surFermeture = null }) {
  const zoneErreur = h('div', { class: 'champ__erreur', role: 'alert' });
  const corps = h('div', { class: 'modale__corps' }, zoneErreur, contenu);
  const pied = h('div', { class: 'modale__pied' });
  const dialogue = h('dialog', { class: ['modale', large && 'modale--large'], 'aria-labelledby': idUnique('titre-modale') },
    h('div', { class: 'modale__entete' },
      h('h2', { id: '' }, titre),
      h('button', { type: 'button', class: 'btn btn--discret btn--icone', 'aria-label': 'Fermer', onclick: () => fermer() }, icone('fermer'))),
    corps,
    actions.length ? pied : null);
  dialogue.querySelector('h2').id = dialogue.getAttribute('aria-labelledby');

  function fermer() {
    if (dialogue.open) dialogue.close();
  }

  for (const a of actions) {
    const b = bouton(a.libelle, { classe: a.classe || '', icone: a.icone || null });
    b.addEventListener('click', async () => {
      if (!a.action) return fermer();
      zoneErreur.textContent = '';
      b.setAttribute('aria-busy', 'true');
      b.disabled = true;
      try {
        const resultat = await a.action();
        if (resultat !== false) fermer();
      } catch (err) {
        zoneErreur.textContent = messageErreur(err);
        corps.scrollTop = 0;
      } finally {
        b.removeAttribute('aria-busy');
        b.disabled = false;
      }
    });
    pied.append(b);
  }

  dialogue.addEventListener('close', () => {
    dialogue.remove();
    surFermeture?.();
    document.dispatchEvent(new CustomEvent('lugh:modale-fermee'));
  });
  document.body.append(dialogue);
  dialogue.showModal();
  const premier = corps.querySelector('input, select, textarea');
  if (premier && !matchMedia('(max-width: 899px)').matches) premier.focus();
  return { fermer, dialogue, signalerErreur: (m) => { zoneErreur.textContent = m; } };
}

export function confirmer(message, { titre = 'Confirmer', libelle = 'Confirmer', danger = false } = {}) {
  return new Promise((resoudre) => {
    let reponse = false;
    modale({
      titre,
      contenu: h('p', {}, message),
      actions: [
        { libelle: 'Annuler' },
        { libelle, classe: danger ? 'btn--danger' : 'btn--principal', action: () => { reponse = true; } },
      ],
      surFermeture: () => resoudre(reponse),
    });
  });
}

export function etatVide(texte, action = null) {
  return h('div', { class: 'vide' }, h('p', {}, texte), action);
}

export function pourcentage(n) {
  return n === null || n === undefined ? '—' : `${n} %`;
}
