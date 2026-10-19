// Fenêtre « Données et confidentialité » : ouverte depuis l'écran de connexion (sans compte) et depuis Mon compte.
// Le texte vient de shared/administratif/confidentialite.js ; seuls le nom et le contact de la structure sont lus.

import { h, modale } from '../ui.js';
import { api } from '../api.js';
import { texteConfidentialite } from '/shared/administratif/confidentialite.js';

export async function ouvrirConfidentialite() {
  let identite = {};
  try {
    identite = await api('GET', '/api/public/structure');
  } catch { /* texte générique si le serveur ne répond pas */ }
  modale({
    titre: 'Données et confidentialité',
    large: true,
    contenu: h('div', { class: 'pile confidentialite' }, texteConfidentialite(identite).map((s) => h('section', { class: 'pile-s' },
      h('h3', {}, s.titre),
      s.texte ? h('p', {}, s.texte) : null,
      s.liste ? h('ul', { class: 'liste-puces' }, s.liste.map((x) => h('li', {}, x))) : null))),
    actions: [{ libelle: 'Fermer', classe: 'btn--principal' }],
  });
}

export function lienConfidentialite(classe = 'lien-discret') {
  return h('button', { type: 'button', class: ['btn-lien', classe], onclick: () => ouvrirConfidentialite() }, 'Données et confidentialité');
}
