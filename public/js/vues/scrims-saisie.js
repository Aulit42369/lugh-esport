// Saisie d'un résultat de scrim ou de match. Le formulaire suit le type de score du jeu : manches (camp de départ,
// mi-temps, score final, pistols), score simple (buts, parties, maps…) ou classement (place, lobby, éliminations, points).
// La map n'est demandée que si le jeu a un map pool, la compo que s'il a des personnages, le partenaire que si le carnet
// des partenaires de scrim en compte.

import { h, modale, confirmer, champ, saisie, zone, liste, toast } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jour } from '../navigation.js';
import { nomMap, nomPersonnage, optionsMaps, optionsPersonnages } from '../composants/jetons.js';
import { nombre } from '../composants/courbe.js';
import { scoreLisible, estClassement, pointsClassement } from '/shared/stats.js';
import { TYPES_SCRIM, RESULTATS_MANCHE, STATUTS_PARTENAIRE, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { formatDate } from '/shared/temps.js';

const optionsDe = (liste_) => liste_.map((x) => ({ valeur: x.id, libelle: x.nom }));

// ——— Carnet des partenaires (repris par la page Partenaires de scrim) ———

const ORDRE_PARTENAIRE = STATUTS_PARTENAIRE.map((s) => s.id);
const memeNom = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Réguliers d'abord, « à éviter » à la fin, puis par nom.
export function partenairesTries(liste_ = E.liste('partenaires')) {
  const rang = (p) => (ORDRE_PARTENAIRE.includes(p.statut) ? ORDRE_PARTENAIRE.indexOf(p.statut) : ORDRE_PARTENAIRE.length);
  return [...liste_].sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
}

export const partenaireDe = (s) => (s?.partenaire ? E.doc('partenaires', s.partenaire) : null);

// Garde une ancienne valeur (map retirée de la méta, personnage renommé…) parmi les choix, pour ne jamais la perdre.
function avecValeur(options, valeur, nommer) {
  if (!valeur) return options;
  const plates = options.flatMap((o) => (o.groupe ? o.options : [o]));
  return plates.some((o) => o.valeur === valeur) ? options : [...options, { valeur, libelle: nommer(valeur) }];
}

const lireEntier = (el) => (el.value.trim() === '' ? null : Number(el.value));
function lireDecimal(el) {
  const t = el.value.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

function nombreSaisi(v, { min = 0, max = 99 } = {}) {
  return saisie({ type: 'number', min, max, step: 1, valeur: v ?? '', inputmode: 'numeric' });
}

// Titre d'un résultat : « 13–9 contre Orage » ou « 3e / 20 · 6 élim. · Cup du jeudi ».
export function titreScrim(s) {
  return estClassement(s) ? `${scoreLisible(s)} · ${s.adversaire}` : `${scoreLisible(s)} contre ${s.adversaire}`;
}

// ——— Blocs de score selon le type ———

function blocManches(d) {
  const def = J.def();
  const mt = def.score.miTemps;
  const camps = J.camps();
  const manches = J.v('manches');
  const campDepart = camps.length === 2
    ? liste(avecValeur(optionsDe(camps), d.campDepart, (id) => J.nomCamp(id)), { valeur: d.campDepart || camps[0].id })
    : null;
  const mtNous = nombreSaisi(d.mtNous, { max: mt });
  const mtEux = nombreSaisi(d.mtEux, { max: mt });
  const scoreNous = nombreSaisi(d.scoreNous);
  const scoreEux = nombreSaisi(d.scoreEux);
  const pistols = def.score.pistols
    ? camps.map((c) => ({ camp: c, el: liste(optionsDe(RESULTATS_MANCHE), { valeur: d.pistols?.[c.id] || '', vide: 'Non noté' }) }))
    : [];
  return {
    elements: h('fieldset', { class: 'compo-editeur saisie-scrim' }, h('legend', {}, `Score (${manches})`),
      h('div', { class: 'grille-champs' },
        campDepart ? champ('Camp de départ', campDepart, { large: true }) : null,
        champ('Mi-temps : nous', mtNous, { aide: `Facultatif : ${mt} ${manches} au plus, sert aux stats par camp.` }),
        champ('Mi-temps : eux', mtEux),
        champ('Score final : nous', scoreNous),
        champ('Score final : eux', scoreEux),
        pistols.map((p) => champ(`Pistol · ${p.camp.nom}`, p.el)))),
    lire() {
      const choisis = Object.fromEntries(pistols.filter((p) => p.el.value).map((p) => [p.camp.id, p.el.value]));
      return {
        campDepart: campDepart ? campDepart.value : (d.campDepart || ''),
        mtNous: lireEntier(mtNous), mtEux: lireEntier(mtEux), scoreNous: lireEntier(scoreNous), scoreEux: lireEntier(scoreEux),
        pistols: def.score.pistols ? choisis : (d.pistols || {}),
      };
    },
    verifier(v) {
      if (v.scoreNous === null || v.scoreEux === null) throw new Error('Indique le score final des deux équipes.');
      if ((v.mtNous === null) !== (v.mtEux === null)) throw new Error('Indique le score de la mi-temps des deux équipes, ou aucun.');
      if (v.mtNous !== null && v.mtNous + v.mtEux > mt) throw new Error(`Une mi-temps compte ${mt} ${manches} au plus.`);
      if (v.mtNous !== null && (v.scoreNous < v.mtNous || v.scoreEux < v.mtEux)) throw new Error('Le score final ne peut pas être inférieur à celui de la mi-temps.');
    },
    camp: () => campDepart?.value || '',
  };
}

function blocSimple(d) {
  const nous = nombreSaisi(d.scoreNous, { max: 999 });
  const eux = nombreSaisi(d.scoreEux, { max: 999 });
  return {
    elements: h('fieldset', { class: 'compo-editeur saisie-scrim' }, h('legend', {}, `Score (${J.v('manches')})`),
      h('div', { class: 'grille-champs' }, champ('Nous', nous), champ('Eux', eux))),
    lire: () => ({ scoreNous: lireEntier(nous), scoreEux: lireEntier(eux) }),
    verifier(v) {
      if (v.scoreNous === null || v.scoreEux === null) throw new Error('Indique le score des deux équipes.');
    },
  };
}

function blocClassement(d) {
  const score = J.def().score;
  const place = nombreSaisi(d.place, { min: 1, max: 150 });
  const equipes = nombreSaisi(d.equipes ?? score.equipes ?? 20, { min: 2, max: 150 });
  const elims = nombreSaisi(d.eliminations, { max: 300 });
  const points = saisie({ inputmode: 'decimal', maxlength: 7, valeur: typeof d.points === 'number' ? nombre(d.points, d.points % 1 ? 1 : 0) : '', placeholder: score.bareme ? 'Barème' : 'Facultatif' });
  const champPoints = champ('Points', points, { aide: ' ' });
  const aide = champPoints.querySelector('.champ__aide');
  const majAide = () => {
    const p = lireEntier(place);
    const calcul = score.bareme && p ? pointsClassement({ place: p, equipes: lireEntier(equipes), eliminations: lireEntier(elims) || 0 }, score) : null;
    aide.textContent = score.bareme
      ? (calcul === null ? 'Vide : points du barème officiel (place + éliminations).' : `Vide : barème officiel, ${nombre(calcul, calcul % 1 ? 1 : 0)} pts.`)
      : 'Facultatif : points de la partie s’ils sont comptés.';
  };
  for (const el of [place, equipes, elims]) el.addEventListener('input', majAide);
  majAide();
  return {
    elements: h('fieldset', { class: 'compo-editeur saisie-scrim' }, h('legend', {}, 'Classement'),
      h('div', { class: 'grille-champs' },
        champ('Place', place, { aide: '1 = top 1.' }), champ('Équipes dans le lobby', equipes),
        champ('Éliminations', elims, { aide: 'Facultatif.' }), champPoints)),
    lire: () => ({ place: lireEntier(place), equipes: lireEntier(equipes), eliminations: lireEntier(elims), points: lireDecimal(points) }),
    verifier(v) {
      if (!v.place) throw new Error('Indique la place finale.');
      if (v.equipes && v.place > v.equipes) throw new Error('La place ne peut pas dépasser le nombre d’équipes du lobby.');
      if (Number.isNaN(v.points)) throw new Error('Points : un nombre, par exemple 18 ou 18,5.');
    },
  };
}

// Partenaire du carnet (facultatif) : le choisir remplit le nom de l'adversaire ; un nom tapé qui correspond à une fiche
// la sélectionne. Absent si le carnet est vide.
function champPartenaire(d, adversaire) {
  const partenaires = partenairesTries();
  if (!partenaires.length) return null;
  const actuel = partenaires.some((p) => p._id === d.partenaire) ? d.partenaire : '';
  const el = liste(partenaires.map((p) => ({ valeur: p._id, libelle: p.statut === 'eviter' ? `${p.nom} (à éviter)` : p.nom })), { valeur: actuel, vide: 'Hors carnet' });
  el.addEventListener('change', () => {
    const p = E.doc('partenaires', el.value);
    if (p) adversaire.value = p.nom;
  });
  adversaire.addEventListener('change', () => {
    const p = el.value ? null : partenaires.find((x) => memeNom(x.nom, adversaire.value));
    if (p) el.value = p._id;
  });
  return el;
}

// ——— Formulaire complet ———

// s : résultat à modifier ; prerempli : valeurs de départ d'un NOUVEAU résultat (adversaire, date, heure, type, partenaire…).
export function editeur(s = null, prerempli = {}) {
  const def = J.def();
  const type = J.typeScore();
  const classement = type === 'classement';
  const nouveau = !s;
  const d = s || { ...prerempli };
  if (nouveau && d.partenaire && !d.adversaire) d.adversaire = E.doc('partenaires', d.partenaire)?.nom || '';
  const date = saisie({ type: 'date', valeur: d.date || jour(), required: true });
  const heure = saisie({ type: 'time', valeur: d.heure ?? '20:00', step: 300 });
  const typeMatch = liste(optionsDe(TYPES_SCRIM), { valeur: d.type || 'scrim' });
  const adversaire = saisie({ valeur: d.adversaire || '', maxlength: 40, required: true, placeholder: classement ? 'Ex. : cup du jeudi, lobby 3' : 'Nom de l’équipe' });
  const partenaire = champPartenaire(d, adversaire);
  const optionsCartes = J.aPool() ? avecValeur(optionsMaps({ horsPool: true }), d.map, nomMap) : [];
  const map = J.aPool() ? liste(optionsCartes, { valeur: d.map || '', vide: `${J.v('carte', true)} à choisir` }) : null;
  const score = classement ? blocClassement(d) : type === 'manches' ? blocManches(d) : blocSimple(d);

  const titulaires = def.equipe.titulaires;
  const persos = J.aPersonnages()
    ? Array.from({ length: titulaires }, (_, i) => liste(avecValeur(optionsPersonnages(), d.compo?.[i], nomPersonnage), {
      valeur: d.compo?.[i] || '', vide: J.v('personnage', true), 'aria-label': `${J.v('personnage', true)} ${i + 1}`,
    }))
    : [];
  // Compo de départ : celle de la fiche de la map (ou la compo principale d'un jeu sans maps), si rien n'est encore choisi.
  const proposerCompo = (ficheId) => {
    const fiche = E.doc('mapsEquipe', ficheId);
    if (!fiche || persos.some((p) => p.value)) return;
    const autreCamp = J.parCamp() && score.camp?.() && score.camp() === J.camps()[1]?.id;
    (autreCamp ? fiche.compoAlt : fiche.compo)?.forEach((e, i) => { if (persos[i] && e.personnage) persos[i].value = e.personnage; });
  };
  if (persos.length) {
    if (map) map.addEventListener('change', () => proposerCompo(map.value));
    if (nouveau) proposerCompo(map ? d.map : 'general');
  }
  const bien = zone({ valeur: d.bien, lignes: 3, maxlength: 1000 });
  const corriger = zone({ valeur: d.corriger, lignes: 3, maxlength: 1000 });
  const vod = saisie({ type: 'url', valeur: d.vod, placeholder: 'https://…', maxlength: 500 });

  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer('Supprimer ce résultat ? Les statistiques seront recalculées.', { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('scrims', s._id);
        toast('Résultat supprimé.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Ajouter le résultat' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      if (!date.value) throw new Error('Indique la date.');
      if (!adversaire.value.trim()) throw new Error(classement ? 'Indique le lobby ou le tournoi.' : 'Indique l’adversaire.');
      if (map && !map.value) throw new Error(`${J.v('carte', true)} à choisir.`);
      const v = {
        date: date.value, heure: heure.value, adversaire: adversaire.value.trim(), type: typeMatch.value,
        partenaire: partenaire ? partenaire.value : '',
        map: map ? map.value : (d.map || ''),
        compo: persos.length ? persos.map((p) => p.value).filter(Boolean) : (d.compo || []),
        bien: bien.value.trim(), corriger: corriger.value.trim(), vod: vod.value.trim(),
        ...score.lire(),
      };
      score.verifier(v);
      await E.enregistrer('scrims', s?._id || nouvelId('x'), v, { revBase: nouveau ? 0 : s.rev });
      toast(nouveau ? 'Résultat ajouté.' : 'Résultat enregistré.');
    },
  });

  // Deuxième ligne de 3 colonnes : [partenaire] adversaire [map] ; l'adversaire prend la place libre.
  const libres = 3 - (partenaire ? 1 : 0) - (map ? 1 : 0);
  const champAdversaire = champ(classement ? 'Lobby ou tournoi' : 'Adversaire', adversaire, { large: libres === 3 });
  if (libres === 2) champAdversaire.classList.add('champ--double');
  modale({
    titre: nouveau ? 'Nouveau résultat' : `${d.adversaire}, ${formatDate(d.date)}`,
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--3 saisie-scrim' },
        champ('Date', date), champ('Heure', heure), champ('Type', typeMatch),
        partenaire ? champ('Partenaire', partenaire, { aide: 'Facultatif : le scrim compte dans sa fiabilité.' }) : null,
        champAdversaire,
        map ? champ(J.v('carte', true), map, { aide: optionsCartes.length ? '' : `Pas encore de ${J.v('cartes')} dans la méta : voir la page Méta.` }) : null),
      score.elements,
      persos.length ? h('fieldset', { class: 'compo-editeur saisie-scrim' }, h('legend', {}, 'Compo jouée'),
        h('div', { class: ['grille-champs', titulaires > 2 && 'grille-champs--3'] }, persos)) : null,
      h('div', { class: 'grille-champs saisie-scrim' },
        champ('Ce qui a marché', bien), champ('À corriger', corriger),
        champ('Lien de la VOD', vod, { large: true })),
    ],
    actions,
  });
}

// Nouveau résultat prérempli (adversaire, date, heure, type, partenaire…), par exemple depuis le jour de match.
export function nouveauScrim(prerempli = {}) {
  editeur(null, prerempli || {});
}

// ——— VOD à revoir depuis un résultat ———

export function titreVod(s) {
  const type = libelle(TYPES_SCRIM, s.type);
  const lieu = s.map ? ` ${nomMap(s.map)}` : '';
  return (estClassement(s) ? `${type}${lieu} · ${s.adversaire}` : `${type}${lieu} contre ${s.adversaire}`).slice(0, 80);
}

export async function creerVod(s) {
  const id = nouvelId('v');
  await E.enregistrer('vods', id, {
    titre: titreVod(s), lien: s.vod, date: s.date, map: s.map || '', scrimId: s._id, statut: 'arevoir', consigne: (s.corriger || '').slice(0, 500),
  }, { revBase: 0 });
  window.location.hash = J.lien(`/vod/${id}`);
}
