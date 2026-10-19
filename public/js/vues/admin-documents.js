// Administratif → Documents : modèles prêts à imprimer ou à enregistrer en PDF, pré-remplis avec l'identité de la
// structure (nom, référent, contact). Ce qui concerne une personne reste en pointillés, à remplir à la main.

import { h, bouton } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import { DOCUMENTS, documentType } from '/shared/administratif/documents.js';
import { chargement, erreurChargement } from './admin-commun.js';

export function rendreDocuments(corps, idDoc) {
  corps.replaceChildren(chargement());
  api('GET', '/api/admin/administratif')
    .then((d) => {
      const doc = idDoc ? documentType(idDoc, d.identite) : null;
      corps.replaceChildren(doc ? vue(doc) : liste(d.identite));
    })
    .catch((err) => corps.replaceChildren(erreurChargement(err, () => rendreDocuments(corps, idDoc))));
}

function liste(identite) {
  return h('div', { class: 'pile' },
    identite.nom ? null : h('div', { class: 'alerte alerte--info' }, icone('info'),
      h('span', {}, 'Renseigne d’abord le nom de l’association (rubrique Identité) : il s’inscrit dans chaque document.')),
    h('div', { class: 'admv-docs' }, DOCUMENTS.map((d) => h('a', { href: `#/admin/administratif/documents/${d.id}`, class: 'admv-doc' },
      icone('document'),
      h('span', {}, h('strong', {}, d.titre), h('span', { class: 'texte-3 petit' }, d.pour)),
      icone('droite')))),
    h('p', { class: 'texte-3 tres-petit' }, 'Ce sont des modèles, pas des actes rédigés par un juriste : relis-les et adapte-les à ta structure.'));
}

function imprimer() {
  document.body.classList.add('impression-document');
  const fin = () => {
    document.body.classList.remove('impression-document');
    window.removeEventListener('afterprint', fin);
  };
  window.addEventListener('afterprint', fin);
  window.print();
}

function bloc(b) {
  switch (b.t) {
    case 'titre': return h('h1', { class: 'admv-papier__titre' }, b.texte);
    case 'sous': return h('h2', { class: 'admv-papier__sous' }, b.texte);
    case 'liste': return h('ul', {}, b.items.map((x) => h('li', {}, x)));
    case 'cases': return h('ul', { class: 'admv-papier__cases' }, b.items.map((x) => h('li', {}, h('span', { class: 'admv-papier__case', 'aria-hidden': 'true' }), x)));
    case 'champ': return h('p', { class: 'admv-papier__champ' }, `${b.libelle} : `, h('span', { class: 'admv-papier__ligne' }));
    case 'note': return h('p', { class: 'admv-papier__note' }, b.texte);
    case 'signatures': return h('div', { class: 'admv-papier__signatures' },
      b.lieuDate ? h('p', {}, 'Fait à …………………………, le ……………………') : null,
      h('div', { class: 'admv-papier__cadres' }, b.qui.map((q) => h('div', { class: 'admv-papier__cadre' }, h('span', {}, q), h('span', { class: 'texte-3 tres-petit' }, 'Signature')))));
    default: return h('p', {}, b.texte);
  }
}

function vue(doc) {
  return h('div', { class: 'pile' },
    h('div', { class: 'barre-outils sans-impression' },
      h('a', { href: '#/admin/administratif/documents', class: 'retour' }, icone('gauche'), 'Tous les documents'),
      bouton('Imprimer ou PDF', { icone: 'imprimer', classe: 'btn--principal', onclick: imprimer })),
    h('article', { class: 'admv-papier' }, doc.blocs.map(bloc)));
}
