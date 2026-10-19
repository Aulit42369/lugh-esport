// Maps et compos, suite : fiche d'une map (ou fiche « general » d'un jeu sans map pool), formulaire de modification,
// attribution des joueurs à une compo pro. Compos sur les places de titulaires du jeu ; par camp quand les
// personnages appartiennent à un camp (Rainbow Six), sinon compo principale et compo de secours.

import { h, modale, champ, saisie, zone, liste, toast } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { nomMap, optionsPersonnages, personnageInfo, nomPersonnage } from '../composants/jetons.js';
import { STATUTS_MAP } from '/shared/referentiel.js';
import { optionsAvec, clesNotes, nomCleNotes, repereCamp, guillemets } from './maps-outils.js';

export function ficheMap(id) {
  return E.doc('mapsEquipe', id) || { ...J.schemas().documentParDefaut('mapsEquipe'), _id: id };
}

export const titulaires = () => J.def().equipe.titulaires;
export const emplacements = (compo) => Array.from({ length: titulaires() }, (_, i) => compo?.[i] || {});
export const nbRemplis = (compo) => (compo || []).filter((e) => e.personnage).length;

// Les deux compos d'une fiche, avec leur titre et le camp qui filtre les personnages (Rainbow Six).
export function compos(fiche) {
  if (J.parCamp()) {
    const [a, b] = J.camps();
    return [
      { cle: 'compo', titre: a.nom, camp: a.id, valeur: fiche.compo || [] },
      { cle: 'compoAlt', titre: b.nom, camp: b.id, valeur: fiche.compoAlt || [] },
    ];
  }
  return [
    { cle: 'compo', titre: 'Compo principale', camp: '', valeur: fiche.compo || [] },
    { cle: 'compoAlt', titre: 'Compo de secours', camp: '', valeur: fiche.compoAlt || [] },
  ];
}

// Propose un joueur pour chaque personnage : celui qui le joue sur cette map, puis en principal ou secondaire, puis par rôle.
export function attribuer(personnages, mapId) {
  const libres = E.joueurs().filter((j) => j.statut === 'titulaire');
  const pris = new Set();
  const choisir = (test) => {
    const j = libres.find((x) => !pris.has(x._id) && test(x));
    if (j) pris.add(j._id);
    return j?._id || '';
  };
  const passes = personnages.map((p) => ({ personnage: p, membre: choisir((j) => j.personnages?.parMap?.[mapId] === p) }));
  for (const e of passes) {
    if (!e.membre) e.membre = choisir((j) => [...(j.personnages?.principaux || []), ...(j.personnages?.secondaires || [])].includes(e.personnage));
  }
  for (const e of passes) if (!e.membre) e.membre = choisir((j) => j.roleJeu && j.roleJeu === personnageInfo(e.personnage)?.role);
  return passes;
}

// Compo pro chargée dans le formulaire : par camp quand les personnages en ont un (l'autre compo reste telle quelle).
export function depuisCompoPro(personnages, id) {
  const fiche = ficheMap(id);
  if (!J.parCamp()) return { compo: attribuer(personnages, id), compoAlt: fiche.compoAlt || [] };
  const [a, b] = J.camps().map((c) => c.id);
  const du = (camp) => personnages.filter((p) => personnageInfo(p)?.camp === camp);
  return {
    compo: du(a).length ? attribuer(du(a), id) : fiche.compo || [],
    compoAlt: du(b).length ? attribuer(du(b), id) : fiche.compoAlt || [],
  };
}

function optionsMembres() {
  return E.joueurs().map((m) => ({
    valeur: m._id,
    libelle: `${m.pseudo || 'Poste à pourvoir'}${m.statut === 'titulaire' ? '' : m.statut === 'essai' ? ' (à l’essai)' : ' (remplaçant)'}`,
  }));
}

export function nomMembreOuAncien(id) {
  const m = E.doc('membres', id);
  return m ? E.nomMembre(m) : 'Ancien membre';
}

function editeurCompo(c, valeurs) {
  const membres = optionsMembres();
  const nomPerso = J.v('personnage', true);
  const lignes = emplacements(valeurs).map((e, i) => ({
    personnage: liste(optionsAvec(optionsPersonnages({ camp: c.camp }), e.personnage, nomPersonnage(e.personnage)),
      { valeur: e.personnage || '', vide: nomPerso, 'aria-label': `${c.titre} : ${nomPerso} ${i + 1}` }),
    membre: liste(optionsAvec(membres, e.membre, nomMembreOuAncien(e.membre)),
      { valeur: e.membre || '', vide: 'Joueur', 'aria-label': `${c.titre} : joueur ${i + 1}` }),
  }));
  const element = h('fieldset', { class: 'compo-editeur' },
    h('legend', { class: 'legende-camp' }, c.camp ? repereCamp(c.camp) : null, c.titre),
    lignes.map((l, i) => h('div', { class: 'compo-editeur__ligne' }, h('span', { class: 'liste-editable__num' }, String(i + 1)), l.personnage, l.membre)));
  const lire = () => lignes.filter((l) => l.personnage.value || l.membre.value).map((l) => ({ personnage: l.personnage.value, membre: l.membre.value }));
  return { element, lire, titre: c.titre, cle: c.cle };
}

// Un même personnage ou un même joueur ne peut occuper deux places d'une compo.
function verifierCompo(entrees, titre) {
  const vus = new Set();
  for (const e of entrees.filter((x) => x.personnage)) {
    if (vus.has(e.personnage)) throw new Error(`${guillemets(nomPersonnage(e.personnage))} apparaît deux fois (${titre}).`);
    vus.add(e.personnage);
  }
  const joueurs = new Set();
  for (const e of entrees.filter((x) => x.membre)) {
    if (joueurs.has(e.membre)) throw new Error(`${nomMembreOuAncien(e.membre)} occupe deux places (${titre}).`);
    joueurs.add(e.membre);
  }
}

export function editeur(id, prefill = null) {
  const actuel = ficheMap(id);
  const general = id === 'general';
  const statut = liste(STATUTS_MAP.map((s) => ({ valeur: s.id, libelle: `${s.nom} : ${s.resume}` })), { valeur: actuel.statut || 'travail' });
  const prep = saisie({ type: 'range', min: 0, max: 100, step: 5, valeur: String(actuel.preparation || 0), class: 'curseur' });
  const sortiePrep = h('output', { class: 'chiffre' }, `${actuel.preparation || 0} %`);
  prep.addEventListener('input', () => { sortiePrep.textContent = `${prep.value} %`; });
  prep.id = `prep-${id}`;

  const editeurs = J.aPersonnages() ? compos({ ...actuel, ...(prefill || {}) }).map((c) => editeurCompo(c, c.valeur)) : [];
  const notes = clesNotes(actuel.notes).map((cle) => ({
    cle,
    zone: zone({ valeur: actuel.notes?.[cle] || '', lignes: 4, maxlength: 2000 }),
  }));
  const priorites = zone({ valeur: actuel.priorites, lignes: 3, maxlength: 1000 });

  modale({
    titre: general ? 'Modifier les compos' : `Modifier ${nomMap(id)}`,
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--haut' },
        general ? null : champ('Statut', statut),
        h('div', { class: 'champ' },
          h('label', { class: 'champ__label', for: prep.id }, 'Préparation'),
          h('div', { class: 'rangee rangee--curseur' }, prep, sortiePrep))),
      prefill ? h('p', { class: 'bandeau' }, 'Compo pro chargée : vérifie l’attribution des joueurs avant d’enregistrer.') : null,
      editeurs.length ? h('div', { class: 'grille-2' }, editeurs.map((e) => e.element)) : null,
      h('div', { class: 'grille-champs grille-champs--haut' },
        notes.map((n) => champ(n.cle === 'general' ? 'Plan de jeu' : `Notes : ${nomCleNotes(n.cle)}`, n.zone, { aide: 'Plan, timings, positions, appels.' })),
        champ('Priorités de travail', priorites, { large: true })),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const valeurs = Object.fromEntries(editeurs.map((e) => [e.cle, e.lire()]));
        for (const e of editeurs) verifierCompo(valeurs[e.cle], e.titre);
        const textes = {};
        for (const n of notes) {
          const t = n.zone.value.trim();
          if (t) textes[n.cle] = t;
        }
        await E.enregistrer('mapsEquipe', id, {
          statut: general ? actuel.statut || 'travail' : statut.value,
          preparation: Number(prep.value),
          compo: valeurs.compo ?? actuel.compo ?? [],
          compoAlt: valeurs.compoAlt ?? actuel.compoAlt ?? [],
          notes: Object.fromEntries(Object.entries(textes).slice(0, 3)),
          priorites: priorites.value.trim(),
        }, { revBase: E.doc('mapsEquipe', id)?.rev ?? 0 });
        toast(general ? 'Compos enregistrées.' : `${nomMap(id)} : fiche enregistrée.`);
      },
    }],
  });
}
