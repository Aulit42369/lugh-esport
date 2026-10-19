// Outils communs à l'administration générale (#/admin) et à la gestion d'un jeu (#/<jeu>/gestion) :
// mot de passe temporaire à transmettre, choix des métiers, état d'un compte, journal, interrupteur, tableau des droits.

import { h, modale, bouton, toast, caseACocher, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import { puce } from '../composants/jetons.js';
import { METIERS, ORDRE_METIERS, PERMISSIONS } from '/shared/roles.js';
import { formatHorodatage, ilYA } from '/shared/temps.js';
import { puceJeu } from '../navigation.js';

// Identifiant tiré d'un nom (comme le serveur pour un « Autre jeu ») : « Marvel Rivals » → « marvelrivals ».
export function idDepuisNom(nom, max = 20) {
  return String(nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '').slice(0, max);
}

// Pastille d'un jeu : la même que dans la navigation (nom court sur la couleur du jeu).
export const pastilleJeu = (j) => puceJeu(j);

export function chargement(texte = 'Chargement…') {
  return h('p', { class: 'texte-3 adm-chargement', role: 'status' }, texte);
}

export function erreurChargement(err, reessayer) {
  return h('div', { class: 'vide' },
    h('p', {}, `Chargement impossible : ${messageErreur(err)}`),
    reessayer ? bouton('Réessayer', { icone: 'actualiser', onclick: reessayer }) : null);
}

export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    toast('Copié.');
  } catch {
    toast('Copie impossible : sélectionne le texte à la main.', { type: 'erreur' });
  }
}

// Mot de passe temporaire : affiché une seule fois, à transmettre en message privé.
export function afficherMdp(compte, mdp, titre) {
  const texte = `Adresse : ${window.location.origin}\nIdentifiant : ${compte.identifiant}\nMot de passe temporaire : ${mdp}`;
  modale({
    titre,
    contenu: [
      h('p', {}, `Transmets ces informations à ${compte.nomAffiche} par message privé. Le mot de passe ne sera plus jamais affiché : il en choisira un nouveau à sa première connexion.`),
      h('dl', { class: 'details' },
        h('dt', {}, 'Adresse'), h('dd', {}, window.location.origin),
        h('dt', {}, 'Identifiant'), h('dd', {}, h('strong', {}, compte.identifiant))),
      h('div', { class: 'secret adm-secret' },
        h('strong', {}, mdp),
        bouton('Copier', { icone: 'copier', onclick: () => copier(texte) })),
    ],
    actions: [{ libelle: 'C’est transmis', classe: 'btn--principal' }],
  });
}

// Cases des métiers d'un jeu. verrouilles : cochés d'office et non modifiables (Responsable d'un Administrateur général,
// son propre rôle de Responsable). compact : noms seuls (le résumé passe en infobulle).
export function choixMetiers(actuels = [], { legende = 'Métiers (plusieurs possibles)', compact = false, verrouilles = [], aide = '' } = {}) {
  const cases = ORDRE_METIERS.map((id) => {
    const m = METIERS[id];
    const verrou = verrouilles.includes(id);
    const libelle = compact ? m.nom : h('span', { class: 'adm-metier' }, h('strong', {}, m.nom), h('span', { class: 'texte-3' }, m.resume));
    return { id, ...caseACocher(libelle, { coche: verrou || actuels.includes(id), disabled: verrou, title: compact ? m.resume : null }) };
  });
  return {
    element: h('fieldset', { class: ['adm-metiers', compact && 'adm-metiers--compact'] },
      h('legend', {}, legende),
      aide ? h('p', { class: 'texte-3 tres-petit' }, aide) : null,
      h('div', { class: 'adm-metiers__cases' }, cases.map((c) => c.element))),
    lire: () => cases.filter((c) => c.input.checked).map((c) => c.id),
    verrouiller(ids) {
      for (const c of cases) {
        const verrou = ids.includes(c.id);
        if (verrou) c.input.checked = true;
        c.input.disabled = verrou;
      }
    },
    cases,
  };
}

// Actions rares et sensibles d'une fenêtre de compte (mot de passe, retrait d'accès, suppression), à l'écart
// des boutons Annuler et Enregistrer. fenetre() rend la modale ouverte ({ fermer, signalerErreur }).
// Chaque action : { titre, aide, libelle, danger, executer: async () => true pour refermer la fenêtre }.
export function actionsSensibles(actions, fenetre) {
  const utiles = actions.filter(Boolean);
  if (!utiles.length) return null;
  return h('section', { class: 'adm-sensible' },
    h('h3', { class: 'sous-titre' }, 'Autres actions'),
    utiles.map((a) => h('div', { class: 'adm-sensible__ligne' },
      h('div', { class: 'adm-sensible__texte' }, h('strong', {}, a.titre), h('span', { class: 'texte-3 tres-petit' }, a.aide)),
      bouton(a.libelle, {
        classe: a.danger ? 'btn--petit btn--danger' : 'btn--petit',
        onclick: async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          b.setAttribute('aria-busy', 'true');
          try {
            if (await a.executer()) fenetre()?.fermer();
          } catch (err) {
            fenetre()?.signalerErreur(messageErreur(err));
            fenetre()?.dialogue.querySelector('.modale__corps')?.scrollTo(0, 0);
          } finally {
            b.disabled = false;
            b.removeAttribute('aria-busy');
          }
        },
      }))));
}

// État d'un compte : désactivé, mot de passe à choisir, ou dernière connexion.
export function etatCompte(c) {
  if (!c.actif) return puce('Désactivé', 'negatif');
  if (c.doitChangerMdp) return puce('Mot de passe à choisir', 'attention');
  return h('span', { class: 'petit texte-2' }, c.derniereConnexion ? `Connecté ${ilYA(c.derniereConnexion)}` : 'Jamais connecté');
}

// Interrupteur (case à cocher au rôle « switch ») : la position, la couleur et le texte d'état disent la même chose.
export function interrupteur({ coche, nom, desactive = false, surChange, textes = ['Activé', 'Désactivé'] }) {
  const input = h('input', { type: 'checkbox', role: 'switch', class: 'adm-interrupteur__case', checked: !!coche, disabled: desactive, 'aria-label': `${nom} : ${textes[0].toLowerCase()}` });
  const etat = h('span', { class: 'adm-interrupteur__etat' }, coche ? textes[0] : textes[1]);
  input.addEventListener('change', () => {
    etat.textContent = input.checked ? textes[0] : textes[1];
    surChange(input, (valeur) => {
      input.checked = valeur;
      etat.textContent = valeur ? textes[0] : textes[1];
    });
  });
  return h('label', { class: 'adm-interrupteur' }, input, h('span', { class: 'adm-interrupteur__piste', 'aria-hidden': 'true' }), etat);
}

// Journal : date, (jeu), qui, quoi.
export function listeJournal(entrees, { nomPar, colonneJeu = null, max = 150 } = {}) {
  if (!entrees.length) return h('p', { class: 'texte-3 petit' }, 'Rien pour l’instant.');
  return h('ol', { class: ['adm-journal', colonneJeu && 'adm-journal--jeux'] }, entrees.slice(0, max).map((e) => h('li', { class: 'adm-journal__ligne' },
    h('time', { class: 'adm-journal__quand', datetime: e.date }, formatHorodatage(e.date)),
    colonneJeu ? h('span', { class: 'adm-journal__jeu' }, colonneJeu(e)) : null,
    h('span', { class: 'adm-journal__quoi' },
      h('strong', {}, nomPar(e.par)), ` ${e.action}`,
      e.cible ? h('span', { class: 'adm-journal__cible' }, ` : ${/^\d{4}-\d{2}-\d{2}T/.test(e.cible) ? formatHorodatage(e.cible) : e.cible}`) : null,
      e.details ? h('span', { class: 'texte-3' }, ` (${e.details})`) : null))));
}

// Coût estimé de la méta (par mois) : « 0,42 $ ».
export function dollars(n) {
  return `${(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

export function tableauCouts(couts = {}) {
  const mois = Object.entries(couts).sort(([a], [b]) => b.localeCompare(a));
  if (!mois.length) return h('p', { class: 'texte-3 petit' }, 'Aucun passage payant pour l’instant.');
  return h('div', { class: 'defile' }, h('table', { class: 'tableau' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Mois'), h('th', { class: 'num' }, 'Passages'), h('th', { class: 'num' }, 'Recherches'), h('th', { class: 'num' }, 'Coût estimé'))),
    h('tbody', {}, mois.map(([k, v]) => h('tr', {},
      h('td', {}, k), h('td', { class: 'num' }, String(v.passages ?? 0)), h('td', { class: 'num' }, String(v.recherches ?? 0)), h('td', { class: 'num' }, dollars(v.usd)))))));
}

// Ce que chaque métier peut modifier (tout le monde consulte tout l’espace de son jeu).
export function tableauDroits() {
  return h('details', { class: 'section referentiel adm-droits' },
    h('summary', {}, h('strong', {}, 'Ce que chaque métier peut faire')),
    h('div', { class: 'defile' }, h('table', { class: 'tableau tableau--droits' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Action'), ORDRE_METIERS.map((id) => h('th', { class: 'num' }, METIERS[id].nom)))),
      h('tbody', {}, Object.entries(PERMISSIONS).map(([perm, texte]) => h('tr', {},
        h('td', {}, texte),
        ORDRE_METIERS.map((id) => h('td', { class: 'num' }, METIERS[id].perms.includes(perm)
          ? icone('ok', { titre: 'Oui' })
          : h('span', { class: 'texte-3', 'aria-label': 'Non' }, '·')))))))),
    h('p', { class: 'texte-3 petit' }, 'Tout le monde consulte tout l’espace de son jeu ; ce tableau ne concerne que les modifications.'));
}
