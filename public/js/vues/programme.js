// Programme individuel : routine d'échauffement, volume hebdomadaire et exercices de rôle selon le palier,
// plus les objectifs prioritaires et les blocs individuels de la semaine. Tout vient de la définition du jeu.

import { h, liste, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jetonRole, jetonPersonnage, pucePalier, puceObjectif } from '../composants/jetons.js';
import { trierBlocs, titreBloc } from '../composants/grille.js';
import { programmePour, objectifParId } from '/shared/jeux/contenus.js';
import { JOURS } from '/shared/referentiel.js';
import { dateCivile, semaineIso } from '/shared/temps.js';

export function rendre(page, params, ctx) {
  const def = J.def();
  const moi = E.monMembre();
  const joueurs = E.joueurs();
  const demande = params[0] ? E.doc('membres', params[0]) : null;
  const membre = (demande?.type === 'joueur' ? demande : null) || (moi?.type === 'joueur' ? moi : joueurs[0]);

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Programme individuel'),
      h('p', { class: 'entete-page__intro' }, `Ce que chaque joueur fait seul sur ${def.nom} : échauffement avant chaque session, travail de la semaine et exercices propres à son rôle. Il s’adapte au palier fixé dans Progression.`))));

  if (!membre) {
    page.append(etatVide('Aucun joueur dans le roster.', h('a', { href: J.lien('/roster'), class: 'btn' }, 'Ouvrir le roster')));
    return;
  }
  const options = joueurs.map((j) => ({ valeur: j._id, libelle: j.pseudo || 'Poste à pourvoir' }));
  if (!joueurs.some((j) => j._id === membre._id)) options.push({ valeur: membre._id, libelle: membre.pseudo || 'Ancien joueur' });
  page.append(h('div', { class: 'barre-outils' },
    liste(options, {
      valeur: membre._id, class: 'saisie saisie--compacte', 'aria-label': 'Joueur', onchange: (e) => ctx.aller(J.lien(`/programme/${e.target.value}`)),
    }),
    h('a', { href: J.lien(`/progression/${membre._id}`), class: 'btn btn--discret btn--petit' }, icone('progression'), 'Objectifs de progression')));

  const obj = E.doc('objectifs', membre._id);
  const n = J.palier(obj?.palier)?.n || 1;
  const prog = programmePour(def, n, membre.roleJeu);
  const nomRole = membre.roleJeu ? J.nomRole(membre.roleJeu) : '';

  page.append(h('section', { class: 'fiche entete-joueur' },
    h('div', { class: 'pile-s' },
      h('h2', {}, membre.pseudo || 'Poste à pourvoir'),
      h('div', { class: 'rangee' },
        J.roles(true).length ? jetonRole(membre.roleJeu) : null,
        pucePalier(obj?.palier),
        ...(J.aPersonnages() ? (membre.personnages?.principaux || []).map(jetonPersonnage) : []))),
    obj?.palier ? null : h('p', { class: 'texte-3 petit' }, 'Palier non défini : programme du palier 1 affiché par défaut.')));

  page.append(h('div', { class: 'grille-2 section' },
    h('section', { class: 'fiche' },
      h('div', { class: 'fiche__titre' }, h('h2', {}, 'Échauffement'), h('span', { class: 'fiche__meta' }, `${prog.dureeEchauffement} minutes, avant chaque session`)),
      prog.echauffement.length
        ? h('ol', { class: 'routine' }, prog.echauffement.map((e) => h('li', {}, h('span', { class: 'routine__duree' }, `${e.duree} min`), h('span', {}, e.texte))))
        : h('p', { class: 'texte-3 petit' }, 'Aucune routine d’échauffement prévue pour ce palier.')),
    h('section', { class: 'fiche' },
      h('h2', {}, 'Chaque semaine'),
      prog.hebdo.length ? h('ul', { class: 'liste-puces' }, prog.hebdo.map((t) => h('li', {}, t))) : h('p', { class: 'texte-3 petit' }, 'Aucun volume hebdomadaire prévu pour ce palier.'),
      prog.conseil ? h('p', { class: 'conseil' }, prog.conseil) : null)));

  let exercices;
  if (!membre.roleJeu) exercices = h('p', { class: 'texte-3 petit' }, J.roles(true).length ? 'Rôle en jeu à définir dans le roster.' : `Pas de rôle en jeu sur ${def.nom} : le programme du palier suffit.`);
  else if (!prog.role.length) exercices = h('p', { class: 'texte-3 petit' }, `Aucun exercice prévu pour le rôle ${nomRole} : le Responsable du jeu peut en ajouter dans les Réglages du jeu.`);
  else exercices = h('ul', { class: 'liste-puces' }, prog.role.map((t) => h('li', {}, t)));

  page.append(h('div', { class: 'grille-2 section' },
    h('section', { class: 'fiche' },
      h('div', { class: 'fiche__titre' }, h('h2', {}, 'Exercices de rôle'), membre.roleJeu ? jetonRole(membre.roleJeu) : null),
      exercices),
    h('section', { class: 'fiche' },
      h('div', { class: 'fiche__titre' }, h('h2', {}, 'Objectifs prioritaires'), h('a', { href: J.lien(`/progression/${membre._id}`), class: 'petit' }, 'Tout voir')),
      (obj?.focus || []).length
        ? h('ul', { class: 'liste-focus' }, obj.focus.map((id) => {
          const o = objectifParId(def, id) || (obj.perso || []).find((p) => p.id === id);
          return o ? h('li', {}, icone('etoile'), h('span', {}, h('strong', {}, o.texte), o.critere ? h('span', { class: 'texte-3 petit' }, ` ${o.critere}`) : null), puceObjectif(obj.suivis?.[id]?.statut || o.statut)) : null;
        }))
        : h('p', { class: 'texte-3 petit' }, 'Aucun objectif prioritaire choisi par le coach.'))));

  const semaine = semaineIso(dateCivile(new Date()));
  const planning = E.doc('planning', semaine)?.blocs?.length ? E.doc('planning', semaine) : E.doc('planning', 'modele');
  const blocs = trierBlocs((planning?.blocs || []).filter((b) => b.pour === 'individuel' || (b.pour === 'choix' && b.membres?.includes(membre._id))));
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Créneaux individuels de la semaine'), h('a', { href: J.lien('/planning'), class: 'petit' }, 'Planning')),
    blocs.length ? h('div', { class: 'liste-lignes' }, blocs.map((b) => h('div', { class: 'ligne' },
      h('span', { class: 'chiffre programme__quand' }, `${JOURS[b.jour - 1].court} ${b.debut}`),
      h('div', { class: 'ligne__principal' },
        h('div', { class: 'ligne__titre' }, titreBloc(b), b.titre && b.titre !== J.nomTypeBloc(b.type) ? h('span', { class: 'texte-3 petit' }, ` · ${J.nomTypeBloc(b.type)}`) : null),
        b.details ? h('div', { class: 'ligne__sous' }, b.details) : null))))
      : h('p', { class: 'texte-3 petit' }, 'Aucun créneau individuel prévu cette semaine.')));
}
