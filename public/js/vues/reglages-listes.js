// Réglages du jeu, section Listes : rôles, camps, types de strat, blocs propres au jeu, rangs, chiffres, checklist
// d'avant-match et domaines. Un élément du modèle ne se supprime jamais : il se masque (archive) et se rétablit,
// car des fiches peuvent l'utiliser. Un élément ajouté reçoit un identifiant tiré de son nom et peut être supprimé.

import { h, bouton, saisie, liste as menu, champ, idUnique } from '../ui.js';
import { symboleRole } from '../icones.js';
import { puce } from '../composants/jetons.js';
import { TYPES_BLOC_COMMUNS } from '/shared/jeux/commun.js';
import { section, texteReglage, nombreReglage, nouvelId } from './reglages-outils.js';
import { idDepuisNom } from './admin-commun.js';

const ORDRE = ['roles', 'camps', 'typesStrat', 'typesBloc', 'rangs', 'chiffres', 'checklistMatch', 'domaines'];
const actifs = (l) => l.filter((x) => !x.archive);

const LISTES = {
  roles: {
    titre: 'Rôles en jeu', unite: ['rôle', 'rôles'], max: 12, maxNom: 24, prefixe: 'role', ajout: () => true, masquer: true,
    aide: 'Au moins un rôle actif. Le symbole et la couleur d’un rôle suivent sa place dans la liste. Les exercices nourrissent le programme individuel.',
    nouveau: (id, nom) => ({ id, nom, court: idDepuisNom(nom).toUpperCase().slice(0, 3).padEnd(2, 'X'), resume: '', exercices: ['', '', ''], archive: false }),
  },
  camps: {
    titre: 'Camps', unite: ['camp', 'camps'], max: 2, maxNom: 24, prefixe: 'camp', ajout: (S) => !S.modele.camps.length, masquer: false, compact: true,
    aide: (S) => (S.modele.camps.length
      ? 'Les deux camps du jeu se renomment ; ils ne se masquent pas.'
      : 'Ce modèle n’a pas de camps. Si les manches se jouent en attaque et en défense, ajoute les deux camps : zéro ou deux camps actifs.'),
    nouveau: (id, nom) => ({ id, nom, archive: false }),
  },
  typesStrat: {
    titre: 'Types de strat', unite: ['type', 'types'], max: 20, maxNom: 30, prefixe: 'strat', ajout: () => true, masquer: true,
    aide: 'Les familles du stratbook. Coche les camps où un type s’applique (aucun coché : les deux).',
    nouveau: (id, nom) => ({ id, nom, camps: [], resume: '', archive: false }),
  },
  typesBloc: {
    titre: 'Blocs d’entraînement propres au jeu', unite: ['bloc', 'blocs'], max: 10, maxNom: 30, prefixe: 'bloc', ajout: () => true, masquer: true,
    aide: `Les blocs communs à tous les jeux (${TYPES_BLOC_COMMUNS.map((b) => b.nom).join(', ')}) ne se changent pas ici. Durée par défaut en minutes.`,
    reserves: TYPES_BLOC_COMMUNS.map((b) => b.id),
    nouveau: (id, nom) => ({ id, nom, duree: 60, archive: false }),
  },
  rangs: {
    titre: 'Rangs', unite: ['rang', 'rangs'], max: 60, maxNom: 30, prefixe: 'rang', ajout: () => true, masquer: true, compact: true, ordre: true,
    aide: 'Du plus bas au plus haut : l’ordre sert aux courbes de progression et aux paliers.',
    nouveau: (id, nom) => ({ id, nom, archive: false }),
  },
  chiffres: {
    titre: 'Chiffres suivis', unite: ['chiffre', 'chiffres'], max: 8, maxNom: 30, prefixe: 'chiffre', ajout: () => true, masquer: true,
    aide: 'Ce que chaque joueur saisit chaque semaine. Le minimum doit être inférieur au maximum.',
    nouveau: (id, nom) => ({ id, nom, unite: '', min: 0, max: 100, decimales: 0, aide: '', archive: false }),
  },
  checklistMatch: {
    titre: 'Checklist d’avant-match', unite: ['point', 'points'], max: 12, maxNom: 80, prefixe: 'point', ajout: () => true, masquer: true, compact: true,
    aide: 'Les points à cocher avant chaque match officiel, dans la fiche d’un adversaire.',
    nouveau: (id, nom) => ({ id, nom, archive: false }),
  },
  domaines: {
    titre: 'Domaines de progression', unite: ['domaine', 'domaines'], max: 6, ajout: () => false, masquer: false,
    aide: 'Les six domaines des objectifs : leurs noms et leurs résumés se modifient, pas leur nombre.',
  },
};

// Copie d'une liste du modèle, dans la forme des Réglages du jeu.
export function copieModele(S, cle) {
  const m = S.modele;
  const a = (x) => !!x.archive;
  switch (cle) {
    case 'roles': return m.roles.map((r) => ({ id: r.id, nom: r.nom, court: r.court || '', resume: r.resume || '', exercices: [...(m.parRole?.[r.id] || [])].slice(0, 3), archive: a(r) }));
    case 'camps': return m.camps.map((c) => ({ id: c.id, nom: c.nom, archive: a(c) }));
    case 'typesStrat': return m.typesStrat.map((t) => ({ id: t.id, nom: t.nom, camps: [...(t.camps || [])], resume: t.resume || '', archive: a(t) }));
    case 'typesBloc': return m.typesBloc.map((t) => ({ id: t.id, nom: t.nom, duree: t.duree ?? 60, archive: a(t) }));
    case 'rangs': return m.rangs.map((r) => ({ id: r.id, nom: r.nom, archive: a(r) }));
    case 'chiffres': return m.chiffres.map((c) => ({ id: c.id, nom: c.nom, unite: c.unite || '', min: c.min ?? 0, max: c.max ?? 100, decimales: c.decimales ?? 0, aide: c.aide || '', archive: a(c) }));
    case 'checklistMatch': return m.checklistMatch.map((c) => ({ id: c.id, nom: c.nom, archive: a(c) }));
    default: return m.domaines.map((d) => ({ id: d.id, nom: d.nom, resume: d.resume || '' }));
  }
}

export const listeEffective = (S, cle) => S.reglages.listes[cle] || copieModele(S, cle);

export function sectionListes(S, numero) {
  let blocs = [];
  return section(S, {
    cle: 'listes',
    numero,
    titre: 'Listes',
    intro: 'Renomme, ajoute ou masque les éléments des listes du jeu. Masquer retire un élément des choix proposés, sans toucher aux fiches qui l’utilisent déjà.',
    resume: () => ['roles', 'camps', 'typesStrat', 'rangs', 'chiffres']
      .map((k) => { const n = actifs(listeEffective(S, k)).length; return `${n} ${LISTES[k].unite[n > 1 ? 1 : 0]}`; }).join(' · '),
    personnalise: () => ORDRE.some((k) => S.reglages.listes[k]),
    revenir: () => { for (const k of ORDRE) S.reglages.listes[k] = null; },
    corps: () => {
      blocs = ORDRE.map((k) => blocListe(S, k, () => blocs));
      return h('div', { class: 'rgl-listes' }, blocs.map((b) => b.element));
    },
  });
}

function blocListe(S, cle, tousLesBlocs) {
  const conf = LISTES[cle];
  const id = idUnique('rgl-liste');
  const element = h('details', { class: 'rgl-liste', dataset: { chemin: `listes.${cle}`, libelle: conf.titre } });
  const bloc = { cle, element, dessiner: null };

  bloc.dessiner = (focus = null) => {
    const l = listeEffective(S, cle);
    const etat = h('span', { class: 'rgl-liste__etat' });
    let revenir = null;
    // Puce et bouton de retour suivent le brouillon dès la première saisie, sans redessiner la liste.
    const majEtat = () => {
      etat.replaceChildren(S.reglages.listes[cle] ? puce('Personnalisée', 'accent') : puce('Modèle'));
      if (revenir) revenir.disabled = !S.reglages.listes[cle];
    };
    const materialiser = () => { if (!S.reglages.listes[cle]) S.reglages.listes[cle] = l; majEtat(); };
    const ecrire = () => { materialiser(); S.modifie(); };
    const refaire = (cibleFocus = null) => { materialiser(); bloc.dessiner(cibleFocus); S.modifie(); };
    const autres = (k) => tousLesBlocs().find((b) => b.cle === k);
    const outils = { S, cle, conf, l, ecrire, refaire, autres };
    const n = actifs(l).length;
    const masques = l.length - n;
    revenir = bouton('Revenir au modèle', {
      classe: 'btn--petit btn--discret', icone: 'actualiser', disabled: !S.reglages.listes[cle],
      onclick: () => {
        S.reglages.listes[cle] = null;
        bloc.dessiner();
        if (cle === 'camps') autres('typesStrat')?.dessiner();
        S.modifie();
      },
    });
    element.replaceChildren(
      h('summary', { class: 'rgl-liste__titre' },
        h('span', { id }, conf.titre),
        h('span', { class: 'rgl-liste__compte' }, `${n} ${conf.unite[n > 1 ? 1 : 0]}${masques ? `, ${masques} masqué${masques > 1 ? 's' : ''}` : ''}`),
        etat),
      h('div', { class: 'rgl-liste__corps' },
        h('div', { class: 'rangee rangee--espace' },
          h('p', { class: 'texte-3 petit rgl-liste__aide' }, typeof conf.aide === 'function' ? conf.aide(S) : conf.aide),
          revenir),
        l.length ? h('ol', { class: ['rgl-elements', conf.compact && 'rgl-elements--compact'], 'aria-labelledby': id }, l.map((item, i) => ligne(outils, item, i)))
          : h('p', { class: 'texte-3 petit' }, 'Aucun élément.'),
        conf.ajout(S) ? ajout(outils) : null));
    majEtat();
    if (focus) element.querySelector(`[data-focus="${focus}"]`)?.focus();
  };
  bloc.dessiner();
  return bloc;
}

function ligne(o, item, i) {
  const { S, cle, conf, l, refaire } = o;
  const duModele = S.modele[cle].some((x) => x.id === item.id);
  const nomCourt = item.nom || 'élément sans nom';
  const actions = [];
  if (conf.ordre) {
    actions.push(
      bouton('', { classe: 'btn--petit btn--discret btn--icone', icone: 'haut', 'aria-label': `Monter ${nomCourt}`, disabled: i === 0, dataset: { focus: `${item.id}-haut` },
        onclick: () => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; refaire(i - 1 === 0 ? `${item.id}-bas` : `${item.id}-haut`); } }),
      bouton('', { classe: 'btn--petit btn--discret btn--icone', icone: 'bas', 'aria-label': `Descendre ${nomCourt}`, disabled: i === l.length - 1, dataset: { focus: `${item.id}-bas` },
        onclick: () => { [l[i + 1], l[i]] = [l[i], l[i + 1]]; refaire(i + 1 === l.length - 1 ? `${item.id}-haut` : `${item.id}-bas`); } }));
  }
  if (duModele && conf.masquer) {
    actions.push(bouton(item.archive ? 'Rétablir' : 'Masquer', {
      classe: 'btn--petit btn--discret', 'aria-label': `${item.archive ? 'Rétablir' : 'Masquer'} ${nomCourt}`, dataset: { focus: `${item.id}-masque` },
      onclick: () => { item.archive = !item.archive; refaire(`${item.id}-masque`); },
    }));
  } else if (!duModele) {
    actions.push(bouton('Supprimer', {
      classe: 'btn--petit btn--discret rgl-supprimer', icone: 'supprimer', 'aria-label': `Supprimer ${nomCourt}`,
      onclick: () => {
        l.splice(i, 1);
        refaire();
        if (cle === 'camps') retirerCamp(o, item.id);
      },
    }));
  }
  const origine = item.archive ? puce('Masqué', 'attention') : (duModele ? null : puce('Ajouté', 'info'));
  return h('li', { class: ['rgl-element', item.archive && 'rgl-element--masque', `rgl-element--${cle}`] },
    h('div', { class: 'rgl-element__repere', 'aria-hidden': 'true', title: `Identifiant : ${item.id}` },
      cle === 'roles' ? h('span', { class: `role role--r${(i % 8) + 1}` }, symboleRole(i)) : h('span', { class: 'rgl-element__num' }, String(i + 1))),
    h('div', { class: 'rgl-element__champs' }, champs(o, item, i)),
    h('div', { class: 'rgl-element__actions' }, origine,
      duModele ? null : h('span', { class: 'texte-3 tres-petit rgl-element__id', title: 'Identifiant, fixé à l’ajout' }, item.id), actions));
}

// Champs d'un élément, selon la liste.
function champs(o, item, i) {
  const { S, cle, conf, ecrire } = o;
  const c = (k) => `listes.${cle}[${i}].${k}`;
  const ctx = (k) => `${conf.titre} · ${item.nom || `ligne ${i + 1}`} · ${k}`;
  const nom = (max, libelle = 'Nom') => {
    const el = texteReglage({ libelle, valeur: item.nom, max, chemin: c('nom'), contexte: ctx('nom'), ecrire: (v) => { item.nom = v; ecrire(); } });
    el.querySelector('input').dataset.focus = `${item.id}-nom`;
    return el;
  };
  switch (cle) {
    case 'roles': {
      const code = texteReglage({
        libelle: 'Code', valeur: item.court, max: 4, chemin: c('court'), contexte: ctx('code'), placeholder: 'ABC',
        ecrire: (v) => { item.court = v.toUpperCase().replace(/[^A-Z0-9]/g, ''); ecrire(); }, attrs: { class: 'saisie rgl-code', autocapitalize: 'characters', spellcheck: 'false' },
      });
      code.querySelector('input').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      return [
        h('div', { class: 'rgl-rangee-champs' }, nom(24), code),
        texteReglage({ libelle: 'Résumé', valeur: item.resume, max: 160, chemin: c('resume'), contexte: ctx('résumé'), multi: true, lignes: 2, ecrire: (v) => { item.resume = v; ecrire(); } }),
        h('details', { class: 'rgl-exercices' },
          h('summary', {}, `Exercices du programme individuel (${(item.exercices || []).filter(Boolean).length} sur 3)`),
          h('div', { class: 'rgl-exercices__champs' }, [0, 1, 2].map((j) => texteReglage({
            libelle: `Exercice ${j + 1}`, valeur: item.exercices?.[j] || '', max: 200, chemin: `${c('exercices')}[${j}]`, contexte: ctx(`exercice ${j + 1}`),
            ecrire: (v) => { item.exercices = [0, 1, 2].map((x) => (x === j ? v : item.exercices?.[x] || '')); ecrire(); },
          })))),
      ];
    }
    case 'typesStrat': {
      const camps = actifs(listeEffective(S, 'camps'));
      return [
        nom(30),
        camps.length ? h('fieldset', { class: 'rgl-camps', dataset: { chemin: c('camps'), libelle: ctx('camps') } },
          h('legend', {}, 'Camps concernés'),
          camps.map((cp) => {
            const input = h('input', { type: 'checkbox', checked: item.camps.includes(cp.id) });
            input.addEventListener('change', () => {
              item.camps = input.checked ? [...new Set([...item.camps, cp.id])] : item.camps.filter((x) => x !== cp.id);
              ecrire();
            });
            return h('label', { class: 'case' }, input, cp.nom);
          })) : null,
        texteReglage({ libelle: 'Résumé', valeur: item.resume, max: 160, chemin: c('resume'), contexte: ctx('résumé'), multi: true, lignes: 2, ecrire: (v) => { item.resume = v; ecrire(); } }),
      ];
    }
    case 'typesBloc':
      return h('div', { class: 'rgl-rangee-champs' }, nom(30),
        nombreReglage(S, { libelle: 'Durée', unite: 'min', valeur: item.duree, min: 0, max: 600, chemin: c('duree'), contexte: ctx('durée'), ecrire: (v) => { item.duree = v; ecrire(); } }));
    case 'chiffres':
      return [
        h('div', { class: 'rgl-rangee-champs rgl-rangee-champs--chiffre' },
          nom(30),
          texteReglage({ libelle: 'Unité', valeur: item.unite, max: 6, chemin: c('unite'), contexte: ctx('unité'), placeholder: '%', ecrire: (v) => { item.unite = v; ecrire(); } }),
          nombreReglage(S, { libelle: 'Min.', valeur: item.min, min: -100000, max: 100000, decimales: 2, chemin: c('min'), contexte: ctx('minimum'), ecrire: (v) => { item.min = v; ecrire(); } }),
          nombreReglage(S, { libelle: 'Max.', valeur: item.max, min: -100000, max: 100000, decimales: 2, chemin: c('max'), contexte: ctx('maximum'), ecrire: (v) => { item.max = v; ecrire(); } }),
          nombreReglage(S, { libelle: 'Décimales', valeur: item.decimales, min: 0, max: 2, chemin: c('decimales'), contexte: ctx('décimales'), ecrire: (v) => { item.decimales = v; ecrire(); } })),
        texteReglage({ libelle: 'Aide à la saisie', valeur: item.aide, max: 160, chemin: c('aide'), contexte: ctx('aide'), ecrire: (v) => { item.aide = v; ecrire(); } }),
      ];
    case 'domaines':
      return h('div', { class: 'rgl-rangee-champs rgl-rangee-champs--domaine' }, nom(30),
        texteReglage({ libelle: 'Résumé', valeur: item.resume, max: 120, chemin: c('resume'), contexte: ctx('résumé'), ecrire: (v) => { item.resume = v; ecrire(); } }));
    case 'camps': {
      const el = nom(24);
      // Les types de strat affichent le nom des camps : mis à jour quand on quitte le champ.
      el.querySelector('input').addEventListener('change', () => o.autres('typesStrat')?.dessiner());
      return el;
    }
    case 'checklistMatch':
      return nom(80, 'Point à vérifier');
    default:
      return nom(30);
  }
}

// Un camp ajouté puis supprimé disparaît aussi des types de strat qui le citaient.
function retirerCamp(o, campId) {
  const types = o.S.reglages.listes.typesStrat;
  if (types) for (const t of types) t.camps = t.camps.filter((x) => x !== campId);
  o.autres('typesStrat')?.dessiner();
}

function ajout(o) {
  const { cle, conf, l, refaire } = o;
  if (l.length >= conf.max) return h('p', { class: 'texte-3 tres-petit' }, `${conf.max} ${conf.unite[1]} au plus : ${conf.masquer ? 'masque ou supprime' : 'supprime'} un élément pour en ajouter un.`);
  const nom = saisie({ maxlength: conf.maxNom, placeholder: `Nom du nouveau ${conf.unite[0]}`, autocomplete: 'off', 'data-pas-brouillon': '' });
  const apres = conf.ordre && l.length
    ? menu(l.map((x, i) => ({ valeur: String(i), libelle: `après ${x.nom || x.id}` })), { valeur: String(l.length - 1), class: 'saisie', 'data-pas-brouillon': '' })
    : null;
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const ajouter = () => {
    const texte = nom.value.trim().replace(/\s+/g, ' ');
    if (!texte) {
      erreur.textContent = 'Donne d’abord un nom.';
      nom.focus();
      return;
    }
    const id = nouvelId(texte, l.map((x) => x.id), { prefixe: conf.prefixe, reserves: conf.reserves || [] });
    const item = conf.nouveau(id, texte.slice(0, conf.maxNom));
    if (apres) l.splice(Number(apres.value) + 1, 0, item);
    else l.push(item);
    refaire(`${id}-nom`);
    // Après refaire : la liste des camps est alors dans le brouillon, les types de strat la relisent.
    if (cle === 'camps') o.autres('typesStrat')?.dessiner();
  };
  nom.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });
  return h('div', { class: 'rgl-ajout' },
    champ(`Ajouter un ${conf.unite[0]}`, nom),
    apres ? champ('Position', apres) : null,
    bouton('Ajouter', { icone: 'ajouter', classe: 'btn--petit', onclick: ajouter }),
    erreur,
    h('p', { class: 'texte-3 tres-petit rgl-ajout__aide' }, 'Son identifiant se tire du nom et ne change plus ensuite.'));
}
