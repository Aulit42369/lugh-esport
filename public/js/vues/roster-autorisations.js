// Roster, autorisations des mineurs (Responsable du jeu et Administrateur général seulement) : « mineur », date de
// l'autorisation parentale, date du droit à l'image. Jamais d'âge. Les autres membres du jeu n'en voient rien : ces
// informations ne sont pas dans les données synchronisées du jeu, elles sont lues à part (/api/e/:jeu/autorisations).

import { h, modale, champ, saisie, caseACocher, bouton, toast } from '../ui.js';
import * as E from '../etat.js';
import { puce } from '../composants/jetons.js';
import { manques } from '/shared/administratif/identite.js';
import { formatDate, aujourdhui } from '/shared/temps.js';

let cache = { jeu: null, autorisations: null };

export const peutVoir = () => E.peut('comptes.gerer');

// Charge les autorisations du jeu affiché, puis remplit les emplacements posés sur les cartes.
export async function charger(racine) {
  if (!peutVoir()) return;
  const jeu = E.jeu()?.id;
  try {
    if (cache.jeu !== jeu || !cache.autorisations) cache = { jeu, autorisations: (await E.appeler('GET', '/autorisations')).autorisations };
  } catch {
    return;
  }
  for (const el of racine.querySelectorAll('[data-autorisation]')) el.replaceChildren(...pucesDe(cache.autorisations[el.dataset.autorisation]));
}

function pucesDe(a) {
  if (!a?.mineur) return [];
  const m = manques(a);
  return [m.length ? puce(m.includes('droit à l’image') ? 'Mineur · pas de diffusion' : 'Mineur · autorisation manquante', 'attention') : puce('Mineur · autorisations ✓', 'positif')];
}

// Emplacement sur la carte d'un membre (vide pour ceux qui ne gèrent pas le jeu).
export function emplacement(membreId) {
  return peutVoir() ? h('span', { class: 'rangee', dataset: { autorisation: membreId } }) : null;
}

// Bloc de la fiche détaillée d'un membre.
export function bloc(m, surChange) {
  if (!peutVoir()) return null;
  const a = (cache.jeu === E.jeu()?.id ? cache.autorisations?.[m._id] : null) || null;
  return h('div', { class: 'pile-s roster-autorisations' },
    h('h3', {}, 'Autorisations'),
    a?.mineur
      ? h('dl', { class: 'details' },
        h('dt', {}, 'Mineur'), h('dd', {}, 'oui'),
        h('dt', {}, 'Autorisation parentale'), h('dd', {}, a.parentale ? `reçue le ${formatDate(a.parentale)}` : puce('manquante', 'attention')),
        h('dt', {}, 'Droit à l’image'), h('dd', {}, a.image ? `reçu le ${formatDate(a.image)}` : puce('manquant : pas de webcam, de voix ni de photo diffusées', 'attention')))
      : h('p', { class: 'texte-3 petit' }, a ? 'Majeur, ou non signalé comme mineur.' : 'Pas encore renseigné.'),
    h('p', { class: 'texte-3 tres-petit' }, 'Visible seulement par le Responsable du jeu et l’Administrateur général. Aucun âge n’est enregistré.'),
    h('div', {}, bouton('Mettre à jour', { classe: 'btn--petit', onclick: () => editer(m, a, surChange) })));
}

function editer(m, a, surChange) {
  a = a || {}; // null (fiche jamais renseignée) ne déclenche pas la valeur par défaut
  const mineur = caseACocher('Mineur (moins de 18 ans)', { coche: !!a.mineur });
  const parentale = saisie({ type: 'date', valeur: a.parentale || '' });
  const image = saisie({ type: 'date', valeur: a.image || '' });
  const note = saisie({ valeur: a.note || '', maxlength: 200, placeholder: 'ex. papiers rangés par le secrétaire' });
  const zoneDates = h('div', { class: 'grille-champs' },
    champ('Autorisation parentale reçue le', parentale),
    champ('Droit à l’image reçu le', image));
  const majDates = () => { zoneDates.hidden = !mineur.input.checked; };
  mineur.input.addEventListener('change', majDates);
  majDates();
  modale({
    titre: `Autorisations de ${m.pseudo || 'ce membre'}`,
    contenu: [
      mineur.element,
      zoneDates,
      champ('Note (facultatif)', note),
      h('p', { class: 'texte-3 tres-petit' }, `Les papiers signés (modèles dans Administration générale → Administratif → Documents) restent chez le bureau. Aujourd’hui : ${formatDate(aujourdhui())}.`),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const corps = { mineur: mineur.input.checked, parentale: mineur.input.checked ? parentale.value : '', image: mineur.input.checked ? image.value : '', note: note.value.trim() };
        await E.appeler('PUT', `/autorisations/${encodeURIComponent(m._id)}`, corps);
        if (cache.autorisations) cache.autorisations[m._id] = corps;
        toast('Autorisations enregistrées.');
        surChange?.();
      },
    }],
  });
}
