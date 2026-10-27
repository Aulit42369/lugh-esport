// Fenêtres « Données et confidentialité », « Conditions d'utilisation » et « Mentions légales » : ouvertes depuis l'écran
// de connexion (sans compte), Mes jeux et Mon compte. Textes dans shared/administratif/ ; seuls le nom et le contact de
// la structure sont lus.

import { h, modale } from '../ui.js';
import { api } from '../api.js';
import { texteConfidentialite } from '/shared/administratif/confidentialite.js';
import { texteConditions } from '/shared/administratif/conditions.js';
import { texteMentionsLegales } from '/shared/administratif/mentions-legales.js';

// Chaque fenêtre propose d'ouvrir les deux autres.
const FENETRES = {
  confidentialite: { titre: 'Données et confidentialité', texte: texteConfidentialite },
  conditions: { titre: 'Conditions d’utilisation', texte: texteConditions },
  mentions: { titre: 'Mentions légales', texte: texteMentionsLegales },
};

async function fenetre(cle) {
  let identite = {};
  try {
    identite = await api('GET', '/api/public/structure');
  } catch { /* texte générique si le serveur ne répond pas */ }
  const { titre, texte } = FENETRES[cle];
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

const lien = (libelle, ouvrir) => (classe = 'lien-discret') => h('button', { type: 'button', class: ['btn-lien', classe], onclick: () => ouvrir() }, libelle);
export const lienConfidentialite = lien('Données et confidentialité', ouvrirConfidentialite);
export const lienConditions = lien('Conditions d’utilisation', ouvrirConditions);
export const lienMentionsLegales = lien('Mentions légales', ouvrirMentionsLegales);

// Les trois liens côte à côte (connexion, Mes jeux, Mon compte).
export const liensLegaux = (classe) => [lienConfidentialite(classe), ' · ', lienConditions(classe), ' · ', lienMentionsLegales(classe)];
