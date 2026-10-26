// Fenêtres « Données et confidentialité » et « Mentions légales » : ouvertes depuis l'écran de connexion (sans compte),
// Mes jeux et Mon compte. Textes dans shared/administratif/ ; seuls le nom et le contact de la structure sont lus.

import { h, modale } from '../ui.js';
import { api } from '../api.js';
import { texteConfidentialite } from '/shared/administratif/confidentialite.js';
import { texteMentionsLegales } from '/shared/administratif/mentions-legales.js';

async function fenetre(titre, sections, autre) {
  let identite = {};
  try {
    identite = await api('GET', '/api/public/structure');
  } catch { /* texte générique si le serveur ne répond pas */ }
  modale({
    titre,
    large: true,
    contenu: h('div', { class: 'pile confidentialite' }, sections(identite).map((s) => h('section', { class: 'pile-s' },
      h('h3', {}, s.titre),
      s.texte ? h('p', {}, s.texte) : null,
      s.liste ? h('ul', { class: 'liste-puces' }, s.liste.map((x) => h('li', {}, x))) : null))),
    actions: [{ libelle: autre.libelle, action: autre.ouvrir }, { libelle: 'Fermer', classe: 'btn--principal' }],
  });
}

export function ouvrirConfidentialite() {
  return fenetre('Données et confidentialité', texteConfidentialite, { libelle: 'Mentions légales', ouvrir: () => { ouvrirMentionsLegales(); } });
}

export function ouvrirMentionsLegales() {
  return fenetre('Mentions légales', texteMentionsLegales, { libelle: 'Données et confidentialité', ouvrir: () => { ouvrirConfidentialite(); } });
}

export function lienMentionsLegales(classe = 'lien-discret') {
  return h('button', { type: 'button', class: ['btn-lien', classe], onclick: () => ouvrirMentionsLegales() }, 'Mentions légales');
}

export function lienConfidentialite(classe = 'lien-discret') {
  return h('button', { type: 'button', class: ['btn-lien', classe], onclick: () => ouvrirConfidentialite() }, 'Données et confidentialité');
}
