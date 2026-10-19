// Journal des incidents d'un partenaire de scrim : annulations, absences, retards (et nos propres annulations).
// Ajout rapide sous la fiche (formulaire hors fenêtre, protégé par un brouillon) et retrait avec confirmation.
// Le scrim joué ne se note pas ici : il se compte tout seul depuis Scrims et matchs.

import { h, champ, saisie, liste, bouton, toast, confirmer, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { jour } from '../navigation.js';
import { puce } from '../composants/jetons.js';
import { INCIDENTS_PARTENAIRE, libelle } from '/shared/referentiel.js';
import { formatDate, formatDateCourte } from '/shared/temps.js';

const TONS = { annule: 'negatif', absent: 'negatif', retard: 'attention', annuleNous: 'info' };
const MAX = 100;
const VISIBLES = 5;

async function enregistrerIncidents(p, modifier) {
  const actuel = E.doc('partenaires', p._id) || p;
  const incidents = modifier([...(actuel.incidents || [])]);
  await E.enregistrer('partenaires', p._id, { ...E.sansMeta(actuel), incidents }, { revBase: actuel.rev });
}

async function retirer(p, x) {
  if (!(await confirmer(`Retirer l’incident du ${formatDate(x.date)} (${libelle(INCIDENTS_PARTENAIRE, x.type).toLowerCase()}) ?`, { libelle: 'Retirer', danger: true }))) return;
  try {
    await enregistrerIncidents(p, (liste_) => {
      const i = liste_.findIndex((y) => y.date === x.date && y.type === x.type && (y.note || '') === (x.note || ''));
      if (i >= 0) liste_.splice(i, 1);
      return liste_;
    });
    toast('Incident retiré du journal.');
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

function ligne(p, x, editable) {
  return h('li', { class: 'journal-incidents__ligne' },
    h('span', { class: 'journal-incidents__date' }, formatDateCourte(x.date)),
    h('span', { class: 'journal-incidents__texte' }, puce(libelle(INCIDENTS_PARTENAIRE, x.type), TONS[x.type] || ''), x.note ? h('span', { class: 'petit texte-2' }, x.note) : null),
    editable ? h('button', {
      type: 'button', class: 'btn btn--discret btn--icone', 'aria-label': `Retirer l’incident du ${formatDate(x.date)}`, onclick: () => retirer(p, x),
    }, icone('supprimer')) : null);
}

// Ajout rapide : date (aujourd'hui par défaut), type d'incident, note facultative.
function formulaire(p) {
  const cle = `incident-${p._id}`;
  const date = saisie({ type: 'date', valeur: jour(), max: jour(), required: true });
  const type = liste(INCIDENTS_PARTENAIRE.map((x) => ({ valeur: x.id, libelle: x.nom })), { valeur: 'annule' });
  const note = saisie({ maxlength: 120, placeholder: 'Facultatif : ce qui s’est passé' });
  const ajouter = bouton('Ajouter au journal', { icone: 'ajouter', classe: 'btn--petit btn--principal' });
  ajouter.addEventListener('click', async () => {
    if (!date.value) {
      toast('Indique la date de l’incident.', { type: 'erreur' });
      return;
    }
    if ((E.doc('partenaires', p._id)?.incidents || []).length >= MAX) {
      toast(`Journal plein (${MAX} incidents) : retire d’abord les plus anciens.`, { type: 'erreur' });
      return;
    }
    ajouter.disabled = true;
    try {
      await enregistrerIncidents(p, (liste_) => [...liste_, { date: date.value, type: type.value, note: note.value.trim() }]);
      toast(`${libelle(INCIDENTS_PARTENAIRE, type.value)} : noté dans le journal de ${p.nom}.`);
      E.definirBrouillon(false, cle);
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    } finally {
      ajouter.disabled = false;
    }
  });
  return h('details', { class: 'ajout-incident', dataset: { brouillon: cle } },
    h('summary', {}, icone('ajouter'), 'Noter un incident'),
    h('div', { class: 'grille-champs ajout-incident__champs' },
      champ('Date', date), champ('Incident', type), champ('Note', note, { large: true })),
    h('div', { class: 'rangee' }, ajouter));
}

export function journalIncidents(p, editable) {
  const incidents = [...(p.incidents || [])].sort((a, b) => b.date.localeCompare(a.date));
  const recents = incidents.slice(0, VISIBLES);
  const anciens = incidents.slice(VISIBLES);
  return h('section', { class: 'carte-partenaire__journal' },
    h('h3', { class: 'carte-partenaire__sous-titre' }, 'Journal des incidents', incidents.length ? h('span', { class: 'texte-3' }, ` ${incidents.length}`) : null),
    incidents.length ? h('ul', { class: 'journal-incidents' }, recents.map((x) => ligne(p, x, editable))) : h('p', { class: 'texte-3 petit' }, 'Aucun incident noté.'),
    anciens.length ? h('details', { class: 'journal-incidents__plus' },
      h('summary', {}, `${anciens.length} plus ancien${anciens.length > 1 ? 's' : ''}`),
      h('ul', { class: 'journal-incidents' }, anciens.map((x) => ligne(p, x, editable)))) : null,
    editable ? formulaire(p) : null);
}
