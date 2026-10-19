// Adversaires, suite : formulaire d'une fiche adverse. Selon le veto du jeu, leurs points forts, points faibles et bans
// habituels sont des maps (veto de maps), des personnages (draft) ou absents ; format et « qui commence » aussi.

import { h, modale, confirmer, champ, saisie, zone, liste, caseACocher, toast } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { nomMap, jetonPersonnage, nomPersonnage, optionsPersonnages } from '../composants/jetons.js';
import { nouvelId } from '/shared/validation.js';
import { accord, cartesSuivies, guillemets } from './maps-outils.js';

const MAX_LISTE = 10;

// Ce que contiennent fortes / faibles / bans pour ce jeu, avec leurs libellés.
export function listesAdverses() {
  const cartes = J.v('cartes');
  const surCartes = {
    genre: 'cartes',
    libelles: {
      fortes: `Leurs ${cartes} ${accord(cartes, 'forts', 'fortes')}`,
      faibles: `Leurs ${cartes} faibles`,
      bans: 'Leurs bans habituels',
    },
  };
  if (J.typeVeto() === 'cartes') return { ...surCartes, cles: ['fortes', 'faibles', 'bans'] };
  if (J.typeVeto() === 'draft' && J.aPersonnages()) {
    return { genre: 'personnages', cles: ['fortes', 'faibles', 'bans'], libelles: { fortes: 'Picks forts', faibles: 'Faibles contre…', bans: 'Bans habituels' } };
  }
  if (J.aPool()) return { ...surCartes, cles: ['fortes', 'faibles'] };
  return { genre: '', cles: [], libelles: {} };
}

export const libelleDebuts = () => (J.def().score?.pistols ? 'Pistols' : 'Débuts de partie');
export const libellePlan = () => (J.typeVeto() === 'draft' ? 'Plan de draft' : 'Plan de veto');

export function formatParDefaut() {
  const ids = J.formats().map((f) => f.id);
  return ids.includes('bo3') ? 'bo3' : ids[0] || '';
}

function choixCartes(titre, actuelles) {
  const suivies = cartesSuivies();
  const ids = [...new Set([...suivies, ...actuelles])];
  const cases = ids.map((id) => ({
    id,
    ...caseACocher(`${nomMap(id)}${J.aPool() && !suivies.includes(id) ? ' (hors pool)' : ''}`, { coche: actuelles.includes(id) }),
  }));
  return {
    element: h('fieldset', { class: 'compo-editeur' }, h('legend', {}, titre), h('div', { class: 'cases' }, cases.map((c) => c.element))),
    lire: () => cases.filter((c) => c.input.checked).map((c) => c.id),
  };
}

// Choix de personnages parmi une longue liste (170 champions en LoL) : un menu pour ajouter, des jetons pour retirer.
function choixPersonnages(titre, actuels) {
  const selection = [...actuels];
  const jetons = h('div', { class: 'jetons-choisis' });
  const opt = (o) => h('option', { value: o.valeur }, o.libelle);
  const menu = h('select', { class: 'saisie' });
  const dessiner = () => {
    jetons.replaceChildren(...(selection.length
      ? selection.map((id) => h('span', { class: 'jeton-choisi' }, jetonPersonnage(id),
        h('button', {
          type: 'button',
          class: 'jeton-choisi__retirer',
          'aria-label': `Retirer ${nomPersonnage(id)}`,
          onclick: () => { selection.splice(selection.indexOf(id), 1); dessiner(); },
        }, icone('fermer'))))
      : [h('span', { class: 'texte-3 petit' }, 'Liste vide.')]));
    const plein = selection.length >= MAX_LISTE;
    menu.replaceChildren(h('option', { value: '' }, plein ? `Liste complète (${MAX_LISTE})` : 'Choisir pour ajouter'),
      ...optionsPersonnages().map((o) => (o.groupe ? h('optgroup', { label: o.groupe }, o.options.map(opt)) : opt(o))));
    menu.value = '';
    menu.disabled = plein;
  };
  menu.addEventListener('change', () => {
    const v = menu.value;
    if (v && !selection.includes(v) && selection.length < MAX_LISTE) selection.push(v);
    dessiner();
    menu.focus();
  });
  dessiner();
  return {
    element: h('fieldset', { class: 'compo-editeur' }, h('legend', {}, titre), jetons, champ(`Ajouter (${J.v('personnage')})`, menu)),
    lire: () => [...selection],
  };
}

export function editeur(adv = null) {
  const nouveau = !adv;
  const d = adv || {
    nom: '', tag: '', circuit: '', prochainMatch: { date: '', heure: '', format: formatParDefaut(), nousCommencons: true },
    fortes: [], faibles: [], bans: [], debuts: '', setups: '', tendances: '', joueursCles: '', vods: [], planVeto: '', checklist: {},
  };
  const pm = d.prochainMatch || {};
  const nom = saisie({ valeur: d.nom, maxlength: 40, required: true });
  const tag = saisie({ valeur: d.tag, maxlength: 6 });
  const circuit = saisie({ valeur: d.circuit, maxlength: 80, placeholder: 'Ligue, tournoi, circuit…' });
  const date = saisie({ type: 'date', valeur: pm.date });
  const heure = saisie({ type: 'time', valeur: pm.heure, step: 300 });
  const format = J.typeScore() === 'classement' ? null
    : liste(J.formats().map((f) => ({ valeur: f.id, libelle: f.nom })), { valeur: J.format(pm.format || formatParDefaut())?.id });
  const libelleCommence = { cartes: 'Qui commence le veto', draft: 'Qui a le premier choix' }[J.typeVeto()];
  const commence = libelleCommence
    ? liste([{ valeur: 'oui', libelle: 'Nous' }, { valeur: 'non', libelle: 'Eux' }], { valeur: pm.nousCommencons === false ? 'non' : 'oui' })
    : null;
  const listes = listesAdverses();
  const choix = Object.fromEntries(listes.cles.map((cle) => [cle,
    listes.genre === 'cartes' ? choixCartes(listes.libelles[cle], d[cle] || []) : choixPersonnages(listes.libelles[cle], d[cle] || [])]));
  const debuts = zone({ valeur: d.debuts, lignes: 3, maxlength: 1000 });
  const setups = zone({ valeur: d.setups, lignes: 3, maxlength: 1000 });
  const tendances = zone({ valeur: d.tendances, lignes: 3, maxlength: 1000 });
  const joueurs = zone({ valeur: d.joueursCles, lignes: 2, maxlength: 500 });
  const vods = zone({ valeur: (d.vods || []).join('\n'), lignes: 3, placeholder: 'Un lien https par ligne' });

  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer(`Supprimer la fiche de ${d.nom} ?`, { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('adversaires', adv._id);
        window.location.hash = J.lien('/adversaires');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Créer la fiche' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const id = adv?._id || nouvelId('d');
      const lus = Object.fromEntries(Object.entries(choix).map(([cle, c]) => [cle, c.lire()]));
      for (const [cle, valeurs] of Object.entries(lus)) {
        if (valeurs.length > MAX_LISTE) throw new Error(`${guillemets(listes.libelles[cle])} : ${MAX_LISTE} au maximum.`);
      }
      const liens = vods.value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (liens.length > 10) throw new Error('VOD à étudier : 10 liens au maximum.');
      if (!nom.value.trim()) throw new Error('Donne le nom de l’équipe adverse.');
      await E.enregistrer('adversaires', id, {
        nom: nom.value.trim(), tag: tag.value.trim(), circuit: circuit.value.trim(),
        prochainMatch: {
          date: date.value,
          heure: heure.value,
          format: format ? format.value : pm.format || formatParDefaut(),
          nousCommencons: commence ? commence.value === 'oui' : pm.nousCommencons !== false,
        },
        fortes: lus.fortes ?? d.fortes ?? [], faibles: lus.faibles ?? d.faibles ?? [], bans: lus.bans ?? d.bans ?? [],
        debuts: debuts.value.trim(), setups: setups.value.trim(), tendances: tendances.value.trim(), joueursCles: joueurs.value.trim(),
        vods: liens, planVeto: d.planVeto || '', checklist: d.checklist || {},
      }, { revBase: nouveau ? 0 : adv.rev });
      toast(nouveau ? 'Fiche créée.' : 'Fiche enregistrée.');
      if (nouveau) window.location.hash = J.lien(`/adversaires/${id}`);
    },
  });

  modale({
    titre: nouveau ? 'Nouvel adversaire' : d.nom,
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--3 grille-champs--haut' }, champ('Nom', nom), champ('Tag', tag), champ('Circuit', circuit)),
      h('fieldset', { class: 'compo-editeur' }, h('legend', {}, 'Prochain match'),
        h('div', { class: 'grille-champs grille-champs--haut' }, champ('Date', date), champ('Heure', heure),
          format ? champ('Format', format) : null, commence ? champ(libelleCommence, commence) : null)),
      listes.cles.length ? h('div', { class: 'grille-listes' }, listes.cles.map((cle) => choix[cle].element)) : null,
      h('div', { class: 'grille-champs grille-champs--haut' },
        champ(libelleDebuts(), debuts), champ('Setups', setups, { aide: 'Placements et organisation habituels.' }),
        champ('Tendances', tendances, { aide: 'Rythme, réactions après un temps fort, habitudes de fin de partie…' }), champ('Joueurs clés', joueurs),
        champ('VOD à étudier', vods, { large: true })),
    ],
    actions,
  });
}
