// Icônes maison (trait 1,75 px, grille 24) et symboles des rôles en jeu. Aucune image externe.
// Les rôles changent d'un jeu à l'autre : leur symbole dépend de leur place dans la liste du jeu (1 à 8).

const NS = 'http://www.w3.org/2000/svg';

const TRACES = {
  accueil: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8l2.5 4-2.5 4-2.5-4z',
  planning: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6',
  dispos: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',
  maps: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14',
  strats: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  meta: 'M3 12h4l2-6 4 12 2-6h6',
  scrims: 'M5 5l6 6M5 11l6-6M14 13h6M17 10v6M4 19h7',
  vod: 'M4 5h16v12H4zM10 9v4l3.5-2zM8 21h8',
  progression: 'M3 19h4v-4h4v-4h4V7h4V3M3 19h18',
  programme: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2',
  roster: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.8 3 5.5',
  admin: 'M8 15a4 4 0 1 0 0-8a4 4 0 1 0 0 8M11 11h10M18 11v3M21 11v2',
  compte: 'M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  plus: 'M5 12h.01M12 12h.01M19 12h.01',
  ajouter: 'M12 5v14M5 12h14',
  modifier: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  supprimer: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  fermer: 'M6 6l12 12M18 6L6 18',
  gauche: 'M15 5l-7 7 7 7',
  droite: 'M9 5l7 7-7 7',
  haut: 'M5 15l7-7 7 7',
  bas: 'M5 9l7 7 7-7',
  externe: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  copier: 'M8 8h12v12H8zM4 16V4h12',
  alerte: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5h.01',
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  deconnexion: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  actualiser: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  telecharger: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  etoile: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z',
  cadenas: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  presences: 'M4 5h16v15H4zM8 3v4M16 3v4M8 12l2 2 4-4M8 17h8',
  bibliotheque: 'M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.8-1 3 15-3.8 1z',
  adversaires: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8v8M8 12h8',
  bilan: 'M6 3h9l4 4v14H6zM14 3v5h5M9 17v-3M12 17v-5M15 17v-2',
  recrutement: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M3 20c0-3.3 2.7-6 6-6 1.5 0 2.8.5 3.9 1.4M18 13v6M15 16h6',
  jeux: 'M4 8h16v10H4zM8 11v4M6 13h4M15 12h.01M17 14h.01M9 5h6',
  reglages: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  discord: 'M5 5h14v11H9l-4 4zM9 10h.01M15 10h.01',
  agenda: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5L12 18l2.5-2.5',
  imprimer: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  installer: 'M7 2h10v20H7zM12 7v7M9 11l3 3 3-3M10 19h4',
  vote: 'M4 12l5 5L20 6',
  match: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
  tournois: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4',
  partenaires: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  annonce: 'M3 10v4h3l7 5V5l-7 5M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  securite: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
  structure: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  compteRendu: 'M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5',
  charge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6',
};

export function icone(nom, { titre = '', classe = '' } = {}) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.75');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  if (classe) el.setAttribute('class', classe);
  if (titre) {
    el.setAttribute('role', 'img');
    const t = document.createElementNS(NS, 'title');
    t.textContent = titre;
    el.append(t);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', TRACES[nom] || TRACES.info);
  el.append(p);
  return el;
}

// Symboles des rôles : la forme porte le sens, la couleur le confirme (jamais la couleur seule).
const SYMBOLES = [
  (el) => forme(el, 'path', { d: 'M5 4l15 8-15 8z' }),
  (el) => {
    forme(el, 'circle', { cx: 12, cy: 12, r: 8, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 });
    forme(el, 'circle', { cx: 12, cy: 12, r: 3 });
  },
  (el) => forme(el, 'circle', { cx: 12, cy: 12, r: 9 }),
  (el) => forme(el, 'rect', { x: 4, y: 4, width: 16, height: 16, rx: 1 }),
  (el) => forme(el, 'path', { d: 'M12 2l10 10-10 10L2 12z' }),
  (el) => forme(el, 'path', { d: 'M7 3h10l5 9-5 9H7l-5-9z' }),
  (el) => forme(el, 'path', { d: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z' }),
  (el) => forme(el, 'path', { d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' }),
];

function forme(parent, tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.append(el);
}

// index : place du rôle dans la liste du jeu (0 à 7) ; -1 ou inconnu → losange neutre.
export function symboleRole(index) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'currentColor');
  el.setAttribute('aria-hidden', 'true');
  (SYMBOLES[index >= 0 ? index % SYMBOLES.length : 4])(el);
  return el;
}
