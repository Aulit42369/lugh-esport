// Progression : six paliers du débutant complet à l'expert (repères de rang propres au jeu), objectifs individuels
// et collectifs du jeu affiché, objectifs personnalisés, auto-évaluation du joueur et suivi par le coach.

import { h, modale, champ, saisie, liste, bouton, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jour } from '../navigation.js';
import { jetonRole, pucePalier, puceObjectif, jauge } from '../composants/jetons.js';
import { nombre } from '../composants/courbe.js';
import { objectifsDuPalier, collectifsDuPalier, seuilAtteint } from '/shared/jeux/contenus.js';
import { STATUTS_OBJECTIF, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { numeroSemaine } from '/shared/temps.js';
import { sectionChiffres, derniereMesure, formatChiffre, formatSeuil } from './progression-chiffres.js';

const palierN = (id) => J.palier(id)?.n || 0;
// « 0 objectif atteint », « 3 objectifs atteints »
const accord = (n, mot) => `${n} ${mot.split(' ').map((m) => (n > 1 ? `${m}s` : m)).join(' ')}`;

async function sauverObjectifs(id, modif) {
  const actuel = E.doc('objectifs', id);
  const base = actuel ? E.sansMeta(actuel) : J.schemas().documentParDefaut('objectifs');
  try {
    await E.enregistrer('objectifs', id, { ...base, ...modif(base) }, { revBase: actuel?.rev ?? 0 });
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

// La date d'atteinte alimente le bilan du mois.
const dateAtteinte = (avant, statut) => (statut === 'atteint' ? (avant?.statut === 'atteint' && avant.le ? avant.le : jour()) : '');

function changerStatut(id, objectifId, statut) {
  return sauverObjectifs(id, (b) => {
    const avant = b.suivis?.[objectifId] || { auto: '', note: '' };
    return { suivis: { ...b.suivis, [objectifId]: { ...avant, statut, le: dateAtteinte(avant, statut) } } };
  });
}

function selectStatut(valeur, surChoix, libelleAria) {
  return liste(STATUTS_OBJECTIF.map((s) => ({ valeur: s.id, libelle: s.nom })), {
    valeur: valeur || 'afaire', class: 'saisie saisie--compacte', 'aria-label': libelleAria, onchange: (e) => surChoix(e.target.value),
  });
}

// Indice automatique : un objectif dont le critère se lit dans un chiffre de la semaine (seuil du modèle).
function indiceChiffres(o, membreId, statut) {
  const regle = J.def().seuils?.[o.id];
  if (!regle || statut === 'atteint' || !membreId) return null;
  const mesure = derniereMesure(membreId, regle.chiffre);
  const s = seuilAtteint(J.def(), o.id, mesure);
  if (!s) return null;
  const c = J.chiffres(true).find((x) => x.id === s.chiffre);
  const nom = c?.nom || s.chiffre;
  const valeur = c ? formatChiffre(c, s.valeur) : nombre(s.valeur, 2);
  const seuil = c ? formatSeuil(c, s.seuil) : nombre(s.seuil, 2);
  const quand = `Chiffres S${numeroSemaine(mesure.semaine)}`;
  return h('span', { class: ['tres-petit indice-chiffres', s.atteint ? 'texte-positif' : 'texte-2'] },
    icone(s.atteint ? 'ok' : 'progression', { classe: 'icone-texte' }),
    s.atteint
      ? ` ${quand} : ${nom} ${valeur}, critère rempli. À valider par le coach.`
      : ` ${quand} : ${nom} ${valeur}, objectif ${regle.sens === '<=' ? 'au plus' : 'au moins'} ${seuil}.`);
}

function ligneObjectif(o, suivi, { cible, fixer, moi, focus }) {
  const statut = suivi?.statut || 'afaire';
  const enFocus = focus.includes(o.id);
  return h('li', { class: ['objectif', statut === 'atteint' && 'objectif--atteint'] },
    h('div', { class: 'objectif__texte' },
      h('span', { class: 'objectif__titre' }, enFocus ? icone('etoile', { titre: 'Objectif prioritaire', classe: 'objectif__etoile' }) : null, o.texte),
      h('span', { class: 'texte-3 petit' }, o.critere),
      suivi?.auto && !moi ? h('span', { class: 'tres-petit texte-2' }, `Avis du joueur : ${libelle(STATUTS_OBJECTIF, suivi.auto).toLowerCase()}`) : null,
      cible !== 'equipe' ? indiceChiffres(o, cible, statut) : null),
    h('div', { class: 'objectif__actions' },
      fixer ? selectStatut(statut, (v) => changerStatut(cible, o.id, v), `Statut de « ${o.texte} »`) : puceObjectif(statut),
      moi ? liste(STATUTS_OBJECTIF.map((s) => ({ valeur: s.id, libelle: `Mon avis : ${s.nom.toLowerCase()}` })), {
        valeur: suivi?.auto || '',
        vide: 'Mon avis',
        class: 'saisie saisie--compacte',
        'aria-label': `Mon auto-évaluation sur « ${o.texte} »`,
        onchange: async (e) => {
          try {
            await E.appeler('PUT', `/objectifs/${encodeURIComponent(cible)}/auto`, { objectifId: o.id, auto: e.target.value }, 'objectifs');
          } catch (err) {
            toast(messageErreur(err), { type: 'erreur' });
          }
        },
      }) : null,
      fixer && cible !== 'equipe' ? h('button', {
        type: 'button',
        class: ['btn btn--discret btn--icone', enFocus && 'btn--actif'],
        'aria-pressed': String(enFocus),
        'aria-label': enFocus ? 'Retirer des priorités' : 'Mettre en priorité (3 maximum)',
        onclick: () => sauverObjectifs(cible, (b) => {
          const f = b.focus || [];
          if (f.includes(o.id)) return { focus: f.filter((x) => x !== o.id) };
          if (f.length >= 3) {
            toast('3 objectifs prioritaires maximum.', { type: 'erreur' });
            return {};
          }
          return { focus: [...f, o.id] };
        }),
      }, icone('etoile')) : null));
}

function vueEquipe(page, fixer) {
  const def = J.def();
  const eq = E.equipe();
  const joueurs = E.joueurs();
  const docEquipe = E.doc('objectifs', 'equipe');
  const palierEquipe = docEquipe?.palier || J.paliers()[0].id;

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Profil de l’équipe'),
      h('span', { class: 'section__aide' }, `Objectif de saison : ${eq.palierVise ? J.nomPalier(eq.palierVise) : 'à définir dans Roster'}. Repères de rang de ${def.nom}.`)),
    h('div', { class: 'profil-paliers' }, J.paliers().map((p) => {
      const ici = joueurs.filter((j) => E.palierDe(j._id) === p.id);
      return h('div', { class: ['marche', p.id === eq.palierVise && 'marche--cible', p.id === palierEquipe && 'marche--equipe'], style: { '--n': String(p.n) } },
        h('ul', { class: 'marche__joueurs' }, ici.map((j) => h('li', {}, h('a', { href: J.lien(`/progression/${j._id}`) }, E.nomMembre(j))))),
        h('div', { class: 'marche__bloc', title: p.resume || '' },
          h('span', { class: 'marche__num' }, String(p.n)),
          h('span', { class: 'marche__nom' }, p.nom),
          p.rangs ? h('span', { class: 'marche__rangs' }, p.rangs) : null,
          p.id === eq.palierVise ? h('span', { class: 'marche__drapeau' }, 'Objectif') : null,
          p.id === palierEquipe ? h('span', { class: 'marche__drapeau marche__drapeau--equipe' }, 'Niveau collectif') : null));
    })),
    joueurs.some((j) => !E.palierDe(j._id)) ? h('p', { class: 'texte-3 petit' }, `Palier à définir pour : ${joueurs.filter((j) => !E.palierDe(j._id)).map(E.nomMembre).join(', ')}.`) : null));

  const coll = collectifsDuPalier(def, palierN(palierEquipe));
  const atteints = coll.filter((o) => docEquipe?.suivis?.[o.id]?.statut === 'atteint').length;
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, 'Objectifs collectifs'),
      fixer ? liste(J.paliers().map((p) => ({ valeur: p.id, libelle: `Palier ${p.n} : ${p.nom}` })), {
        valeur: palierEquipe, class: 'saisie saisie--compacte', 'aria-label': 'Palier collectif de l’équipe',
        onchange: (e) => sauverObjectifs('equipe', () => ({ palier: e.target.value })),
      }) : pucePalier(palierEquipe)),
    coll.length ? [
      jauge(Math.round((atteints / coll.length) * 100), { legende: `${atteints} sur ${coll.length} atteint${atteints > 1 ? 's' : ''}`, droite: '' }),
      h('ul', { class: 'objectifs' }, coll.map((o) => ligneObjectif(o, docEquipe?.suivis?.[o.id], { cible: 'equipe', fixer, moi: false, focus: [] })))]
      : h('p', { class: 'texte-3 petit' }, 'Pas d’objectif collectif pour ce palier.')));

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Référentiel complet'),
      h('span', { class: 'section__aide' }, `${def.objectifs.length} objectifs individuels pour ${def.nom}, chacun avec un critère vérifiable.`)),
    J.paliers().map((p) => h('details', { class: 'referentiel' },
      h('summary', {}, h('strong', {}, `${p.n}. ${p.nom}`), h('span', { class: 'texte-3 petit' }, [p.rangs, p.resume].filter(Boolean).map((t) => ` ${/[.!?…]$/.test(t) ? t : `${t}.`}`).join(''))),
      h('div', { class: 'grille-2' }, J.domaines().map((d) => {
        const liste_ = objectifsDuPalier(def, p.n, d.id);
        return liste_.length ? h('div', {},
          h('h3', { class: 'sous-titre' }, d.nom),
          h('ul', { class: 'liste-puces petit' }, liste_.map((o) => h('li', {}, h('strong', {}, o.texte), h('br'), h('span', { class: 'texte-3' }, o.critere))))) : null;
      }))))));
}

function ajouterPerso(membreId) {
  const domaines = J.domaines();
  const domaine = liste(domaines.map((d) => ({ valeur: d.id, libelle: d.nom })), { valeur: domaines[0]?.id || '' });
  const texte = saisie({ maxlength: 200, required: true, placeholder: 'Ex. : revoir une de ses parties chaque dimanche et noter 3 erreurs' });
  modale({
    titre: 'Objectif personnalisé',
    contenu: h('div', { class: 'grille-champs' }, champ('Domaine', domaine), champ('Objectif', texte, { large: true })),
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Ajouter',
      classe: 'btn--principal',
      action: async () => {
        if (!texte.value.trim()) throw new Error('Décris l’objectif.');
        if ((E.doc('objectifs', membreId)?.perso || []).length >= 20) throw new Error('20 objectifs personnalisés au plus.');
        await sauverObjectifs(membreId, (b) => ({ perso: [...(b.perso || []), { id: nouvelId('p'), domaine: domaine.value, texte: texte.value.trim(), statut: 'afaire' }] }));
      },
    }],
  });
}

function sectionPerso(page, membre, d, fixer) {
  const perso = d.perso || [];
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Objectifs personnalisés'),
      fixer ? bouton('Ajouter', { icone: 'ajouter', classe: 'btn--petit', onclick: () => ajouterPerso(membre._id) }) : null),
    perso.length ? h('ul', { class: 'objectifs' }, perso.map((p) => h('li', { class: ['objectif', p.statut === 'atteint' && 'objectif--atteint'] },
      h('div', { class: 'objectif__texte' }, h('span', { class: 'objectif__titre' }, p.texte), h('span', { class: 'texte-3 petit' }, J.nomDomaine(p.domaine))),
      h('div', { class: 'objectif__actions' },
        fixer ? selectStatut(p.statut, (v) => sauverObjectifs(membre._id, (b) => ({ perso: b.perso.map((x) => (x.id === p.id ? { ...x, statut: v, le: dateAtteinte(x, v) } : x)) })), `Statut de « ${p.texte} »`) : puceObjectif(p.statut),
        fixer ? h('button', {
          type: 'button', class: 'btn btn--discret btn--icone', 'aria-label': `Supprimer « ${p.texte} »`,
          onclick: () => sauverObjectifs(membre._id, (b) => ({ perso: b.perso.filter((x) => x.id !== p.id), focus: (b.focus || []).filter((x) => x !== p.id) })),
        }, icone('supprimer')) : null))))
      : h('p', { class: 'texte-3 petit' }, 'Aucun objectif personnalisé.')));
}

function vueMembre(page, membre, fixer) {
  const def = J.def();
  const d = E.doc('objectifs', membre._id) || J.schemas().documentParDefaut('objectifs');
  const moi = E.monMembreId() === membre._id && E.peut('objectifs.auto');
  const n = palierN(d.palier);
  const objectifs = n ? objectifsDuPalier(def, n) : [];
  const atteints = objectifs.filter((o) => d.suivis?.[o.id]?.statut === 'atteint').length;
  const taux = objectifs.length ? Math.round((atteints / objectifs.length) * 100) : 0;
  const suivant = n ? J.paliers().find((p) => p.n === n + 1) : null;
  const palier = J.palier(d.palier);

  page.append(h('section', { class: 'fiche entete-joueur' },
    h('div', { class: 'pile-s' },
      h('h2', {}, E.nomMembre(membre)),
      h('div', { class: 'rangee' }, jetonRole(membre.roleJeu), pucePalier(d.palier)),
      palier?.rangs ? h('span', { class: 'texte-3 petit' }, `Repère : ${palier.rangs}.`) : null),
    fixer ? champ('Palier', liste(J.paliers().map((p) => ({ valeur: p.id, libelle: `${p.n}. ${p.nom}${p.rangs ? ` (${p.rangs})` : ''}` })), {
      valeur: d.palier, vide: 'À définir',
      onchange: (e) => sauverObjectifs(membre._id, () => ({ palier: e.target.value })),
    })) : null,
    n ? h('div', { class: 'entete-joueur__jauge' }, jauge(taux, { legende: `${accord(atteints, 'objectif atteint')} sur ${objectifs.length}` }),
      fixer && taux >= 80 && suivant ? bouton(`Passer au palier ${suivant.n}`, { classe: 'btn--principal btn--petit', onclick: () => sauverObjectifs(membre._id, () => ({ palier: suivant.id })) }) : null) : null));

  page.append(sectionChiffres(membre));

  if (!n) {
    page.append(h('p', { class: 'texte-2 section' }, fixer ? 'Choisis le palier de ce joueur pour afficher ses objectifs.' : 'Le coach n’a pas encore défini le palier.'));
    sectionPerso(page, membre, d, fixer);
    return;
  }
  const options = { cible: membre._id, fixer, moi, focus: d.focus || [] };
  page.append(h('div', { class: 'grille-2 section' }, J.domaines().map((dom) => {
    const duDomaine = objectifsDuPalier(def, n, dom.id);
    return duDomaine.length ? h('section', { class: 'fiche' },
      h('div', { class: 'fiche__titre' }, h('h2', {}, dom.nom), dom.resume ? h('span', { class: 'fiche__meta' }, dom.resume) : null),
      h('ul', { class: 'objectifs' }, duDomaine.map((o) => ligneObjectif(o, d.suivis?.[o.id], options)))) : null;
  })));

  sectionPerso(page, membre, d, fixer);

  if (n > 1) {
    const precedents = def.objectifs.filter((o) => o.palier < n);
    const ok = precedents.filter((o) => d.suivis?.[o.id]?.statut === 'atteint').length;
    page.append(h('p', { class: 'texte-3 petit section' }, `Paliers précédents : ${accord(ok, 'objectif validé')} sur ${precedents.length}.`));
  }
}

export function rendre(page, params, ctx) {
  const fixer = E.peut('objectifs.fixer');
  const joueurs = E.joueurs();
  const moi = E.monMembre();
  const cible = params[0] || (moi?.type === 'joueur' ? moi._id : 'equipe');
  const membre = cible !== 'equipe' ? E.doc('membres', cible) : null;

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Progression'),
      h('p', { class: 'entete-page__intro' }, 'Six paliers, du débutant complet à l’expert. Chaque palier fixe des objectifs dans six domaines, avec un critère que le coach peut vérifier en VOD ou en practice.'))));

  const choix = joueurs.map((j) => ({ valeur: j._id, libelle: `${E.nomMembre(j)}${j.statut === 'titulaire' ? '' : ` (${j.statut === 'essai' ? 'essai' : 'remplaçant'})`}` }));
  if (membre && !joueurs.some((j) => j._id === membre._id)) choix.push({ valeur: membre._id, libelle: E.nomMembre(membre) });
  page.append(h('div', { class: 'barre-outils' },
    liste([{ valeur: 'equipe', libelle: 'Toute l’équipe' }, ...choix], {
      valeur: membre ? membre._id : 'equipe', class: 'saisie saisie--compacte', 'aria-label': 'Joueur', onchange: (e) => ctx.aller(J.lien(`/progression/${e.target.value}`)),
    }),
    membre ? h('a', { href: J.lien(`/programme/${membre._id}`), class: 'btn btn--discret btn--petit' }, icone('programme'), 'Programme individuel') : null));

  if (membre) vueMembre(page, membre, fixer);
  else if (cible !== 'equipe') page.append(h('p', { class: 'texte-2' }, 'Ce membre n’existe plus.'));
  else vueEquipe(page, fixer);
}
