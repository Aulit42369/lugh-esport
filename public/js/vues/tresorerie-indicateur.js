// Livre de l'association : « Prêt pour la société ? ». Recettes commerciales des 12 derniers mois (sponsors, ventes,
// billetterie) face à la franchise des impôts commerciaux et au seuil de passage choisi dans Identité.

import { h } from '../ui.js';
import { icone } from '../icones.js';
import { jauge } from '../composants/jetons.js';
import { euros } from '/shared/administratif/comptes.js';

const PROCHE = 0.8; // à 80 % d'un seuil, on prévient

const part = (valeur, seuil) => (seuil > 0 ? Math.round((valeur / seuil) * 100) : 0);

export function indicateurSociete(ind) {
  const { commerciales, franchise, seuilPassage } = ind;
  const alertes = [];
  if (seuilPassage !== null && commerciales >= seuilPassage) {
    alertes.push(['urgent', 'Seuil de passage atteint : c’est le moment de préparer la société (Administratif → Obligations → Passer en société) et de voir le comptable.']);
  } else if (seuilPassage !== null && commerciales >= seuilPassage * PROCHE) {
    alertes.push(['attention', 'Tu approches du seuil de passage que tu t’es fixé : prépare la société avec le comptable.']);
  }
  if (commerciales >= franchise * PROCHE) {
    alertes.push(['urgent', `Recettes commerciales proches de ${euros(franchise)} par an : au-delà, l’association paie les impôts commerciaux. Demande conseil maintenant.`]);
  }
  return h('section', { class: 'fiche pile-s section sans-impression tres-indicateur' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, seuilPassage !== null ? 'Prêt pour la société ?' : 'Recettes commerciales')),
    h('p', { class: 'texte-3 petit' }, `Sponsors, ventes et billetterie des 12 derniers mois : ${euros(commerciales)}.`),
    seuilPassage !== null ? jauge(part(commerciales, seuilPassage), { legende: 'Seuil de passage en société', droite: `${euros(commerciales)} sur ${euros(seuilPassage)}` }) : null,
    jauge(part(commerciales, franchise), { legende: 'Franchise des impôts commerciaux', droite: `${part(commerciales, franchise)} % de ${euros(franchise)}` }),
    ...alertes.map(([ton, texte]) => h('div', { class: ['alerte', `alerte--${ton}`] }, icone('alerte'), h('span', {}, texte))));
}
