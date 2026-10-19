// Stratbook, suite : formulaire d'une strat (map, camp, type selon le camp, étapes, rôle de chaque joueur, utilitaires,
// vidéo, astuces de la bibliothèque) et fiche de lecture. Types, camps et vocabulaire viennent du jeu affiché.

import { h, modale, confirmer, champ, saisie, zone, liste, bouton, toast, lienExterne, caseACocher, messageErreur, idUnique } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puceStatutStrat, puce, nomMap, nomPersonnage, signature } from '../composants/jetons.js';
import { STATUTS_STRAT, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { optionsAvec, optionsCartes, optionsCamps, etiquetteCamp, guillemets, accord } from './maps-outils.js';

const MAX_ASTUCES = 12;

function editeurEtapes(etapes) {
  const conteneur = h('div', { class: 'liste-editable' });
  const valeurs = [...etapes];
  const dessiner = () => {
    conteneur.replaceChildren(...valeurs.map((v, i) => {
      const input = saisie({ valeur: v, maxlength: 300, 'aria-label': `Étape ${i + 1}`, oninput: (e) => { valeurs[i] = e.target.value; } });
      return h('div', { class: 'liste-editable__ligne' },
        h('span', { class: 'liste-editable__num' }, String(i + 1)),
        input,
        h('div', { class: 'rangee' },
          h('button', { type: 'button', class: 'btn btn--discret btn--icone', 'aria-label': `Monter l’étape ${i + 1}`, disabled: i === 0, onclick: () => { [valeurs[i - 1], valeurs[i]] = [valeurs[i], valeurs[i - 1]]; dessiner(); } }, icone('haut')),
          h('button', { type: 'button', class: 'btn btn--discret btn--icone', 'aria-label': `Retirer l’étape ${i + 1}`, onclick: () => { valeurs.splice(i, 1); dessiner(); } }, icone('fermer'))));
    }), bouton('Ajouter une étape', {
      icone: 'ajouter',
      classe: 'btn--petit',
      disabled: valeurs.length >= 20,
      onclick: () => { valeurs.push(''); dessiner(); conteneur.querySelectorAll('input').item(valeurs.length - 1)?.focus(); },
    }));
  };
  dessiner();
  return { element: conteneur, lire: () => valeurs.map((v) => v.trim()).filter(Boolean) };
}

// Astuces (lineups…) de la bibliothèque à relier : celles de la map choisie et celles déjà reliées.
function editeurAstuces(choisis, selectMap) {
  const selection = new Set(choisis);
  const conteneur = h('div', { class: 'pile-s' });
  const astuces = J.v('astuces');
  const dessiner = () => {
    const carte = selectMap?.value || '';
    const dispo = E.liste('bibliotheque')
      .filter((b) => b.type === 'astuce' && (selection.has(b._id) || !carte || !b.map || b.map === carte))
      .sort((a, b) => nomPersonnage(a.personnage).localeCompare(nomPersonnage(b.personnage), 'fr') || a.titre.localeCompare(b.titre, 'fr'));
    const details = (b) => [b.personnage ? nomPersonnage(b.personnage) : '', b.site].filter(Boolean).join(', ');
    conteneur.replaceChildren(dispo.length
      ? h('div', { class: 'cases cases--colonne' }, dispo.map((b) => caseACocher(`${b.titre}${details(b) ? ` (${details(b)})` : ''}`, {
        coche: selection.has(b._id),
        onchange: (e) => { if (e.target.checked) selection.add(b._id); else selection.delete(b._id); },
      }).element))
      : h('p', { class: 'texte-3 petit' }, `Rien à relier ${carte ? `sur ${nomMap(carte)} ` : ''}pour l’instant : ajoute des ${astuces} dans la Bibliothèque, puis relie-les ici.`));
  };
  selectMap?.addEventListener('change', dessiner);
  dessiner();
  return { element: conteneur, lire: () => [...selection].filter((id) => E.doc('bibliotheque', id)) };
}

// Types proposés pour un camp : ceux du camp (et ceux sans camp) ; sans camp choisi, seulement ceux qui n'en exigent pas.
function typesPour(camp) {
  if (!J.camps().length) return J.typesStrat();
  return camp ? J.typesStrat(camp) : J.typesStrat().filter((t) => !t.camps.length);
}

export function editeur(strat = null, { map: mapDefaut = '' } = {}) {
  const nouvelle = !strat;
  const camps = J.camps();
  const sansCamp = J.typesStrat().some((t) => !t.camps.length);
  const campDefaut = camps.length && !sansCamp ? camps[0].id : '';
  const s = strat || {
    map: J.aPool() ? mapDefaut || E.meta()?.mapPool?.[0] || '' : '', camp: campDefaut, type: '', nom: '', resume: '',
    etapes: ['', '', ''], roles: {}, utilitaires: '', statut: 'apprendre', video: '', lineups: [],
  };
  const carte = J.v('carte');
  const nom = saisie({ valeur: s.nom, maxlength: 60, required: true });
  const map = J.aCartes()
    ? liste(optionsAvec(optionsCartes(), s.map, nomMap(s.map)), { valeur: s.map, vide: J.aPool() ? null : accord(carte, 'Aucun', 'Aucune'), required: J.aPool() })
    : null;
  const optCamps = [...optionsCamps(), ...(sansCamp ? [{ valeur: '', libelle: 'Les deux' }] : [])];
  const camp = camps.length ? liste(optionsAvec(optCamps, s.camp, J.nomCamp(s.camp)), { valeur: s.camp || '' }) : null;
  const type = h('select', { class: 'saisie', required: true, id: idUnique('type-strat') });
  const aideType = h('span', { class: 'champ__aide' });
  const majAide = () => { aideType.textContent = J.def().typesStrat.find((t) => t.id === type.value)?.resume || ''; };
  const majTypes = () => {
    const actuel = type.value || s.type;
    const choix = typesPour(camp?.value || '');
    const ancien = J.def().typesStrat.find((t) => t.id === s.type);
    if (ancien && !choix.includes(ancien) && (!ancien.camps.length || ancien.camps.includes(camp?.value))) choix.push(ancien);
    type.replaceChildren(...choix.map((t) => h('option', { value: t.id }, t.nom)));
    type.value = choix.some((t) => t.id === actuel) ? actuel : choix[0]?.id || '';
    majAide();
  };
  camp?.addEventListener('change', majTypes);
  type.addEventListener('change', majAide);
  majTypes();
  const statut = liste(STATUTS_STRAT.map((x) => ({ valeur: x.id, libelle: x.nom })), { valeur: s.statut || 'apprendre' });
  const resume = zone({ valeur: s.resume, lignes: 2, maxlength: 300 });
  const etapes = editeurEtapes(s.etapes?.length ? s.etapes : ['']);
  // Rôle de chaque joueur de l'effectif (titulaires, puis remplaçants et essais nommés) ; ceux d'anciens membres restent.
  const effectif = E.joueurs().filter((j) => j.statut === 'titulaire' || j.pseudo || s.roles?.[j._id]);
  const roles = effectif.map((j) => ({ j, input: saisie({ valeur: s.roles?.[j._id] || '', maxlength: 200, placeholder: 'Sa mission dans cette strat' }) }));
  const autresRoles = Object.fromEntries(Object.entries(s.roles || {}).filter(([id]) => !effectif.some((j) => j._id === id)));
  const utilitaires = zone({ valeur: s.utilitaires, lignes: 3, maxlength: 1000 });
  const video = saisie({ type: 'url', valeur: s.video, placeholder: 'https://…', maxlength: 500 });
  const astuces = editeurAstuces(s.lineups || [], map);

  const actions = [];
  if (!nouvelle) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer(`Supprimer définitivement ${guillemets(s.nom)} ?`, { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('strats', s._id);
        toast('Strat supprimée.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouvelle ? 'Créer la strat' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const valeur = {
        nom: nom.value.trim(), map: map?.value || '', camp: camp?.value || '', type: type.value, statut: statut.value,
        resume: resume.value.trim(), etapes: etapes.lire(), utilitaires: utilitaires.value.trim(), video: video.value.trim(),
        roles: { ...autresRoles, ...Object.fromEntries(roles.filter((r) => r.input.value.trim()).map((r) => [r.j._id, r.input.value.trim()])) },
        lineups: astuces.lire(),
      };
      if (!valeur.nom) throw new Error('Donne un nom à la strat.');
      if (J.aPool() && !valeur.map) throw new Error(`${J.v('carte', true)} obligatoire.`);
      if (!valeur.type) throw new Error('Choisis un type de strat.');
      if (valeur.lineups.length > MAX_ASTUCES) throw new Error(`${MAX_ASTUCES} ${J.v('astuces')} au maximum par strat.`);
      await E.enregistrer('strats', s._id || nouvelId('s'), valeur, { revBase: nouvelle ? 0 : s.rev });
      toast(nouvelle ? 'Strat créée.' : 'Strat enregistrée.');
    },
  });

  modale({
    titre: nouvelle ? 'Nouvelle strat' : s.nom,
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--3 grille-champs--haut' },
        champ('Nom', nom),
        map ? champ(J.v('carte', true), map) : null,
        champ('Statut', statut),
        camp ? champ('Camp', camp) : null,
        h('div', { class: 'champ' }, h('label', { class: 'champ__label', for: type.id }, 'Type'), type, aideType),
        champ('Vidéo ou schéma', video, { aide: 'Lien https (YouTube, Medal, image…).' })),
      champ('En une phrase', resume),
      h('div', { class: 'champ' }, h('span', { class: 'champ__label' }, 'Étapes, dans l’ordre'), etapes.element),
      effectif.length ? h('fieldset', { class: 'compo-editeur' }, h('legend', {}, 'Rôle de chaque joueur'),
        h('div', { class: 'grille-champs grille-champs--haut' }, roles.map((r) => champ(`${r.j.pseudo || 'Poste à pourvoir'}${r.j.statut === 'titulaire' ? '' : r.j.statut === 'essai' ? ' (à l’essai)' : ' (remplaçant)'}`, r.input)))) : null,
      champ('Timings et utilitaires', utilitaires, { aide: 'Ce qu’il faut lancer, garder ou annoncer, et à quel moment.' }),
      h('fieldset', { class: 'compo-editeur' }, h('legend', {}, `${J.v('astuces', true)} de la bibliothèque`), astuces.element),
    ],
    actions,
  });
}

export function detail(s) {
  const editable = E.peut('strats.modifier');
  const astuces = (s.lineups || []).map((id) => E.doc('bibliotheque', id)).filter(Boolean);
  modale({
    titre: s.nom,
    large: true,
    contenu: [
      h('div', { class: 'rangee' },
        s.map ? puce(nomMap(s.map), 'plein') : null,
        J.camps(true).length && (s.camp || J.camps().length) ? etiquetteCamp(s.camp, { classe: 'puce' }) : null,
        puce(J.nomTypeStrat(s.type), 'accent'), puceStatutStrat(s.statut)),
      s.resume ? h('p', { class: 'texte-2' }, s.resume) : null,
      s.etapes?.length ? h('ol', { class: 'etapes' }, s.etapes.map((e) => h('li', {}, e))) : null,
      Object.keys(s.roles || {}).length ? h('div', { class: 'pile-s' }, h('h3', {}, 'Rôles'),
        h('dl', { class: 'details' }, Object.entries(s.roles).map(([id, r]) => {
          const m = E.doc('membres', id);
          return [h('dt', {}, m ? E.nomMembre(m) : 'Ancien membre'), h('dd', {}, r)];
        }))) : null,
      s.utilitaires ? h('div', { class: 'pile-s' }, h('h3', {}, 'Timings et utilitaires'), h('p', { class: 'texte-multi' }, s.utilitaires)) : null,
      s.video ? lienExterne(s.video, 'Voir la vidéo ou le schéma') : null,
      astuces.length ? h('div', { class: 'pile-s' }, h('h3', {}, J.v('astuces', true)),
        h('ul', { class: 'liste-puces' }, astuces.map((l) => {
          const details = [l.personnage ? nomPersonnage(l.personnage) : '', l.site].filter(Boolean).join(', ');
          return h('li', {}, l.lien ? lienExterne(l.lien, l.titre) : l.titre, details ? ` : ${details}` : '');
        }))) : null,
      signature(s),
    ],
    actions: editable
      ? [{ libelle: 'Fermer' }, { libelle: 'Modifier', classe: 'btn--principal', action: () => { setTimeout(() => editeur(E.doc('strats', s._id) || s), 0); } }]
      : [{ libelle: 'Fermer', classe: 'btn--principal' }],
  });
}

export async function changerStatut(s, statut) {
  try {
    await E.enregistrer('strats', s._id, { ...E.sansMeta(s), statut }, { revBase: s.rev });
    toast(`${guillemets(s.nom)} : ${libelle(STATUTS_STRAT, statut).toLowerCase()}.`);
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}
