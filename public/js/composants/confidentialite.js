// Fenêtres « Données et confidentialité », « Conditions d'utilisation » et « Mentions légales » : ouvertes depuis l'écran
// de connexion (sans compte), Mes jeux et Mon compte. Textes dans shared/administratif/ ; seuls le nom et le contact de
// la structure sont lus.

import { h, modale } from '../ui.js';
import { api } from '../api.js';

// Chaque fenêtre propose d'ouvrir les deux autres. Les textes ne sont chargés qu'à l'ouverture (JS initial plus léger).
const FENETRES = {
  confidentialite: { titre: 'Données et confidentialité', page: '/confidentialite', texte: async () => (await import('/shared/administratif/confidentialite.js')).texteConfidentialite },
  conditions: { titre: 'Conditions d’utilisation', page: '/conditions', texte: async () => (await import('/shared/administratif/conditions.js')).texteConditions },
  mentions: { titre: 'Mentions légales', page: '/mentions-legales', texte: async () => (await import('/shared/administratif/mentions-legales.js')).texteMentionsLegales },
};

async function fenetre(cle) {
  let identite = {};
  try {
    identite = await api('GET', '/api/public/structure');
  } catch { /* texte générique si le serveur ne répond pas */ }
  const { titre, page } = FENETRES[cle];
  let texte;
  try {
    texte = await FENETRES[cle].texte();
  } catch {
    window.location.href = page; // texte injoignable : la page servie par le serveur, lisible sans JavaScript
    return;
  }
  modale({
    titre,
    large: true,
    contenu: h('div', { class: 'pile confidentialite' }, texte(identite).map((s) => h('section', { class: 'pile-s' },
      h('h3', {}, s.titre),
      s.texte ? h('p', {}, s.texte) : null,
      s.liste ? h('ul', { class: 'liste-puces' }, s.liste.map((x) => h('li', {}, x))) : null))),
    actions: [
      ...Object.keys(FENETRES).filter((k) => k !== cle).map((k) => ({ libelle: FENETRES[k].titre, action: () => { fenetre(k); } })),
      { libelle: 'Fermer', classe: 'btn--principal' },
    ],
  });
}

export const ouvrirConfidentialite = () => fenetre('confidentialite');
export const ouvrirConditions = () => fenetre('conditions');
export const ouvrirMentionsLegales = () => fenetre('mentions');

// Vrais liens vers les pages servies par le serveur (lisibles sans JavaScript, partageables) ; dans l'appli, un clic
// simple ouvre la fenêtre (on reste où on est), un clic molette ou Ctrl+clic ouvre la page.
const lien = (libelle, href, ouvrir) => (classe = 'lien-discret') => h('a', {
  href,
  class: ['lien-legal', classe],
  onclick: (e) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    ouvrir();
  },
}, libelle);
export const lienConfidentialite = lien('Données et confidentialité', '/confidentialite', ouvrirConfidentialite);
export const lienConditions = lien('Conditions d’utilisation', '/conditions', ouvrirConditions);
export const lienMentionsLegales = lien('Mentions légales', '/mentions-legales', ouvrirMentionsLegales);

// Les trois liens côte à côte (connexion, Mes jeux, Mon compte). La vitrine les a en HTML (vitrine.html).
export const liensLegaux = (classe) => [lienConfidentialite(classe), ' · ', lienConditions(classe), ' · ', lienMentionsLegales(classe)];
