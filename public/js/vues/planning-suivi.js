// Suivi de la semaine du planning : conflits d'agenda avec les autres jeux d'une même personne, et comptes rendus
// de séance (ce qui a été travaillé, en une minute). Le contenu d'une séance d'un autre jeu n'est jamais montré.

import { h, modale, champ, zone, toast, confirmer } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puceJeu } from '../navigation.js';
import { signature } from '../composants/jetons.js';
import { titreBloc, idSeance, contenuCompteRendu } from '../composants/grille.js';
import { JOURS } from '/shared/referentiel.js';
import { minutes } from '/shared/temps.js';

// ——— Conflits : une requête par semaine affichée, gardée une minute ———

const cache = new Map();
const FRAICHEUR_MS = 60_000;

export function oublierConflits(semaine) {
  cache.delete(`${E.jeu()?.id}/${semaine}`);
}

// Conflits connus de la semaine (null tant que la première réponse n'est pas arrivée). Une réponse qui change
// l'affichage redessine la page, seulement si elle est toujours affichée.
export function conflitsDe(semaine, { page, ctx }) {
  const cle = `${E.jeu()?.id}/${semaine}`;
  const connu = cache.get(cle);
  if (!connu || (!connu.enCours && Date.now() - connu.le > FRAICHEUR_MS)) {
    const entree = { le: Date.now(), conflits: connu?.conflits ?? null, enCours: true };
    cache.set(cle, entree);
    E.appeler('GET', `/conflits/${semaine}`)
      .then((r) => {
        const avant = JSON.stringify(entree.conflits);
        entree.conflits = Array.isArray(r?.conflits) ? r.conflits : [];
        if (JSON.stringify(entree.conflits) !== avant && page.isConnected) ctx.rafraichir();
      })
      .catch(() => {
        entree.conflits ??= [];
      })
      .finally(() => {
        entree.enCours = false;
        entree.le = Date.now();
      });
  }
  return connu?.conflits ?? null;
}

// Nom d'un autre jeu dans une phrase : son nom s'il est court, sinon son nom court (« LoL »).
const nomJeu = (j) => (j.nom && j.nom.length <= 12 ? j.nom : j.court || j.nom);
const nomMembre = (id) => E.nomMembre(E.doc('membres', id));

// Regroupe les conflits par séance de ce jeu, personne et autre jeu : une ligne chacun.
function regrouper(conflits, blocs) {
  const groupes = new Map();
  for (const c of conflits) {
    const cle = `${c.blocId}|${c.membreId}|${c.jeu?.id}`;
    const g = groupes.get(cle) || { ...c, horaires: [] };
    const horaire = `${c.debut}–${c.fin}`;
    if (!g.horaires.includes(horaire)) g.horaires.push(horaire);
    groupes.set(cle, g);
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, bloc: blocs.find((b) => b.id === g.blocId) }))
    .filter((g) => g.bloc)
    .sort((a, b) => a.bloc.jour - b.bloc.jour || minutes(a.bloc.debut) - minutes(b.bloc.debut));
}

// Marque d'un bloc en conflit : icône et texte, jamais la couleur seule.
export function marqueConflit(conflits) {
  const qui = [...new Set(conflits.map((c) => `${nomMembre(c.membreId)} (${nomJeu(c.jeu)})`))].join(', ');
  return h('span', { class: 'bloc__marque bloc__marque--conflit', title: `Déjà pris ailleurs : ${qui}` }, icone('alerte'), 'Conflit');
}

const VISIBLES = 4;

export function encadreConflits(conflits, blocs) {
  const groupes = regrouper(conflits || [], blocs);
  if (!groupes.length) return null;
  const personnes = [...new Set(groupes.map((g) => nomMembre(g.membreId)))];
  const ligne = (g) => h('li', { class: 'conflits__ligne' },
    puceJeu(g.jeu),
    h('span', {},
      h('strong', {}, `${nomMembre(g.membreId)} : `),
      `déjà en ${nomJeu(g.jeu)} ${JOURS[g.jour - 1].nom.toLowerCase()} ${g.horaires.join(' et ')}`,
      h('span', { class: 'texte-3' }, ` · pendant « ${titreBloc(g.bloc)} » (${g.bloc.debut}–${g.bloc.fin})`)));
  const reste = groupes.slice(VISIBLES);
  return h('section', { class: 'conflits', 'aria-labelledby': 'titre-conflits' },
    h('div', { class: 'conflits__entete' },
      icone('alerte'),
      h('h2', { id: 'titre-conflits' }, 'Conflits avec d’autres jeux'),
      h('span', { class: 'texte-2 petit' }, `${groupes.length} séance${groupes.length > 1 ? 's' : ''} · ${personnes.join(', ')}`)),
    h('ul', { class: 'conflits__liste' }, groupes.slice(0, VISIBLES).map(ligne)),
    reste.length ? h('details', { class: 'conflits__plus' },
      h('summary', {}, `${reste.length} autre${reste.length > 1 ? 's' : ''} conflit${reste.length > 1 ? 's' : ''}`),
      h('ul', { class: 'conflits__liste' }, reste.map(ligne))) : null,
    h('p', { class: 'texte-3 tres-petit' }, 'Seuls le jeu et l’horaire de l’autre séance sont connus : son contenu reste privé.'));
}

// ——— Comptes rendus ———

const quand = (b) => `${JOURS[b.jour - 1].nom} ${b.debut}–${b.fin}, ${J.nomTypeBloc(b.type).toLowerCase()}`;

export function ouvrirCompteRendu({ semaine, bloc }) {
  const id = idSeance(semaine, bloc.id);
  const actuel = E.doc('seances', id);
  const travaille = zone({ valeur: actuel?.travaille || '', lignes: 4, maxlength: 600, required: true, placeholder: 'Ex. : retakes du site B, trois scénarios à 3 contre 4.' });
  const positif = zone({ valeur: actuel?.positif || '', lignes: 3, maxlength: 400 });
  const aRevoir = zone({ valeur: actuel?.aRevoir || '', lignes: 3, maxlength: 400 });
  const suite = zone({ valeur: actuel?.suite || '', lignes: 2, maxlength: 300 });
  const actions = [];
  if (actuel && E.peut('presences.modifier')) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer('Ce compte rendu sera effacé pour toute l’équipe.', { titre: 'Supprimer le compte rendu ?', libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('seances', id);
        toast('Compte rendu supprimé.');
        return true;
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      if (!travaille.value.trim()) throw new Error('Indique ce qui a été travaillé.');
      await E.enregistrer('seances', id, {
        semaine, blocId: bloc.id, jour: bloc.jour, debut: bloc.debut, type: bloc.type, titre: titreBloc(bloc).slice(0, 60),
        travaille: travaille.value.trim(), positif: positif.value.trim(), aRevoir: aRevoir.value.trim(), suite: suite.value.trim(),
      }, { revBase: actuel?.rev ?? 0 });
      toast('Compte rendu enregistré : toute l’équipe peut le lire.');
    },
  });
  modale({
    titre: `Compte rendu : ${titreBloc(bloc)}`,
    contenu: h('div', { class: 'formulaire' },
      h('p', { class: 'texte-2 petit' }, quand(bloc)),
      champ('Travaillé (obligatoire)', travaille, { aide: 'Le contenu réel de la séance, en une ou deux phrases.' }),
      champ('Ce qui a marché', positif),
      champ('À revoir', aRevoir),
      champ('Pour la prochaine fois', suite)),
    actions,
  });
}

export function lireCompteRendu({ semaine, bloc }) {
  const cr = E.doc('seances', idSeance(semaine, bloc.id));
  if (!cr) return;
  modale({
    titre: `Compte rendu : ${titreBloc(bloc)}`,
    contenu: h('div', { class: 'pile' }, h('p', { class: 'texte-2 petit' }, quand(bloc)), contenuCompteRendu(cr), signature(cr)),
    actions: [
      ...(E.peut('presences.modifier') ? [{ libelle: 'Modifier', action: () => { setTimeout(() => ouvrirCompteRendu({ semaine, bloc }), 0); } }] : []),
      { libelle: 'Fermer', classe: 'btn--principal' },
    ],
  });
}
