// Tournois, suite : formulaire d'un tournoi (fenêtre), saisie rapide du résultat et changements de statut.
// Dates contrôlées comme sur le serveur (fin après le début, date limite avant le début) : ses messages s'affichent.

import { h, modale, confirmer, champ, saisie, zone, liste, caseACocher, toast, messageErreur } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { STATUTS_TOURNOI } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { guillemets } from './maps-outils.js';

export const MAX_ROSTER = 16;

const CHAMPS = {
  nom: 'Nom', organisateur: 'Organisateur', lien: 'Lien', format: 'Format', dateLimite: 'Date limite d’inscription', debut: 'Début',
  fin: 'Fin', statut: 'Statut', roster: 'Roster', place: 'Place', resultat: 'Résultat', notes: 'Notes',
};

// Erreurs de validation du serveur en phrases lisibles (« Lien : lien invalide. », « La fin doit être après le début. »).
export function erreurLisible(err) {
  if (!err?.details?.length) return err;
  const phrases = err.details.slice(0, 3).map((d) => {
    const champ_ = CHAMPS[String(d.chemin || '').split(/[.[]/)[0]];
    const message = String(d.message || '');
    return champ_ ? `${champ_} : ${message}.` : `${message.charAt(0).toUpperCase()}${message.slice(1)}.`;
  });
  return new Error(phrases.join(' '));
}

// Contrôle d'abord avec le schéma partagé (mêmes règles et mêmes messages que le serveur, sans aller-retour),
// puis enregistre ; une erreur du serveur (conflit de modification…) s'affiche de la même façon.
async function enregistrer(t, valeur) {
  const verif = J.schemas().validerDocument('tournois', valeur);
  if (!verif.ok) throw erreurLisible({ details: verif.erreurs });
  try {
    return await E.enregistrer('tournois', t?._id || nouvelId('t'), valeur, { revBase: t ? t.rev : 0 });
  } catch (err) {
    throw erreurLisible(err);
  }
}

const suffixe = (m) => (m.statut === 'titulaire' ? '' : m.statut === 'essai' ? ' (à l’essai)' : ' (remplaçant)');

// Roster : une case par joueur actif ; un ancien joueur déjà inscrit reste proposé (coché) pour ne pas disparaître en silence.
function choixRoster(actuel) {
  const joueurs = E.joueurs();
  const autres = actuel.filter((id) => !joueurs.some((j) => j._id === id));
  const cases = [
    ...joueurs.map((j) => ({ id: j._id, libelle: `${E.nomMembre(j)}${suffixe(j)}` })),
    ...autres.map((id) => ({ id, libelle: `${E.doc('membres', id) ? E.nomMembre(E.doc('membres', id)) : 'Ancien membre'} (ancien)` })),
  ].map((c) => ({ ...c, ...caseACocher(c.libelle, { coche: actuel.includes(c.id) }) }));
  const compteur = h('span', { class: 'fiche__meta' });
  const majCompteur = () => {
    const n = cases.filter((c) => c.input.checked).length;
    compteur.textContent = `${n} sur ${MAX_ROSTER} au plus`;
  };
  for (const c of cases) c.input.addEventListener('change', majCompteur);
  majCompteur();
  return {
    element: h('fieldset', { class: 'compo-editeur' },
      h('legend', {}, 'Roster inscrit'),
      cases.length ? [compteur, h('div', { class: 'cases' }, cases.map((c) => c.element))]
        : h('p', { class: 'texte-3 petit' }, 'Aucun joueur actif dans le roster de l’équipe.')),
    lire: () => cases.filter((c) => c.input.checked).map((c) => c.id),
  };
}

const placeValeur = (input) => (input.value.trim() === '' ? null : Number(input.value));

export function editeur(t = null) {
  const nouveau = !t;
  const d = t || {
    nom: '', organisateur: '', lien: '', format: '', dateLimite: '', debut: '', fin: '', statut: 'envisage', roster: [], place: null, resultat: '', notes: '',
  };
  const nom = saisie({ valeur: d.nom, maxlength: 60, required: true });
  const organisateur = saisie({ valeur: d.organisateur, maxlength: 60, placeholder: 'Ligue, association, plateforme…' });
  const lien = saisie({ type: 'url', valeur: d.lien, maxlength: 500, placeholder: 'https://… (page d’inscription ou règlement)' });
  const format = saisie({ valeur: d.format, maxlength: 80, placeholder: 'Ex. : poules en BO1, finale en BO3' });
  const dateLimite = saisie({ type: 'date', valeur: d.dateLimite });
  const debut = saisie({ type: 'date', valeur: d.debut });
  const fin = saisie({ type: 'date', valeur: d.fin });
  const statut = liste(STATUTS_TOURNOI.map((s) => ({ valeur: s.id, libelle: s.nom })), { valeur: d.statut || 'envisage' });
  const roster = choixRoster(d.roster || []);
  const place = saisie({ type: 'number', valeur: d.place ?? '', min: 1, max: 999, step: 1, inputmode: 'numeric' });
  const resultat = saisie({ valeur: d.resultat, maxlength: 80, placeholder: 'Ex. : demi-finale, 2e de poule' });
  const notes = zone({ valeur: d.notes, lignes: 3, maxlength: 1000 });

  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer(`Supprimer définitivement ${guillemets(d.nom)} ?`, { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('tournois', t._id);
        toast('Tournoi supprimé.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Ajouter le tournoi' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const inscrits = roster.lire();
      if (inscrits.length > MAX_ROSTER) throw new Error(`${MAX_ROSTER} joueurs au plus dans le roster.`);
      await enregistrer(t, {
        nom: nom.value.trim(), organisateur: organisateur.value.trim(), lien: lien.value.trim(), format: format.value.trim(),
        dateLimite: dateLimite.value, debut: debut.value, fin: fin.value, statut: statut.value, roster: inscrits,
        place: placeValeur(place), resultat: resultat.value.trim(), notes: notes.value.trim(),
      });
      toast(nouveau ? 'Tournoi ajouté.' : 'Tournoi enregistré.');
    },
  });

  modale({
    titre: nouveau ? 'Nouveau tournoi' : d.nom,
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--3 grille-champs--haut' },
        champ('Nom', nom), champ('Organisateur', organisateur), champ('Format', format)),
      champ('Lien', lien),
      h('fieldset', { class: 'compo-editeur' }, h('legend', {}, 'Dates'),
        h('div', { class: 'grille-champs grille-champs--3 grille-champs--haut' },
          champ('Date limite d’inscription', dateLimite, { aide: 'Rappels à J-7 puis J-2 sur l’accueil.' }),
          champ('Début', debut), champ('Fin', fin))),
      champ('Statut', statut),
      roster.element,
      h('fieldset', { class: 'compo-editeur' }, h('legend', {}, 'Résultat'),
        h('div', { class: 'grille-champs grille-champs--haut' }, champ('Place', place), champ('Résultat', resultat))),
      champ('Notes', notes, { aide: 'Horaires, code du lobby, contact de l’organisateur…' }),
    ],
    actions,
  });
}

// Résultat d'un tournoi joué : place et résultat, le tournoi passe en « Terminé ».
export function saisirResultat(t) {
  const place = saisie({ type: 'number', valeur: t.place ?? '', min: 1, max: 999, step: 1, inputmode: 'numeric' });
  const resultat = saisie({ valeur: t.resultat, maxlength: 80, placeholder: 'Ex. : demi-finale, 2e de poule' });
  modale({
    titre: `Résultat : ${t.nom}`,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--haut' }, champ('Place', place), champ('Résultat', resultat)),
      h('p', { class: 'texte-3 petit' }, 'Le tournoi passe dans les tournois terminés.'),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer le résultat',
      classe: 'btn--principal',
      action: async () => {
        if (place.value.trim() === '' && !resultat.value.trim()) throw new Error('Indique au moins la place ou le résultat.');
        await enregistrer(t, { ...E.sansMeta(t), place: placeValeur(place), resultat: resultat.value.trim(), statut: 'termine' });
        toast(`${t.nom} : résultat enregistré.`);
      },
    }],
  });
}

const MESSAGES = { inscrit: 'Inscription notée', abandonne: 'Tournoi abandonné', envisage: 'Tournoi repris' };

export async function changerStatut(t, statut) {
  try {
    await enregistrer(t, { ...E.sansMeta(t), statut });
    toast(`${MESSAGES[statut] || 'Statut modifié'} : ${t.nom}.`);
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

export async function abandonner(t) {
  const ok = await confirmer(`Abandonner ${guillemets(t.nom)} ? Il reste visible dans les tournois abandonnés.`, { libelle: 'Abandonner', danger: true });
  if (ok) await changerStatut(t, 'abandonne');
}
