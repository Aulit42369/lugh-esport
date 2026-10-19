// Contrôle complet d'un modèle de jeu : identifiants, nombres, références croisées et méta initiale.
// Utilisé par les tests et au démarrage du serveur (un modèle invalide n'est jamais proposé).

import { MOTIF_ID, TYPES_BLOC_COMMUNS, completerModele } from './commun.js';
import { definitionEffective, idsDe } from './definition.js';
import { validerMeta } from '../schemas-meta.js';
import { ids, PUBLICS_BLOC } from '../referentiel.js';
import { minutes } from '../temps.js';

const MOTIF_DOMAINE = /^[a-z]{3,6}$/;
const MOTIF_OBJECTIF = /^([a-z]{3,6})-([1-6])-[1-9]$/;
const MOTIF_EBAUCHE = /^[a-z0-9-]{2,30}$/;
const MOTIF_HEURE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

function uniques(liste, nom, motif, erreurs) {
  const vus = new Set();
  for (const x of liste) {
    if (!x || typeof x.id !== 'string' || !motif.test(x.id)) erreurs.push(`${nom} : identifiant invalide « ${x?.id} »`);
    else if (vus.has(x.id)) erreurs.push(`${nom} : identifiant en double « ${x.id} »`);
    vus.add(x?.id);
    if (!x?.nom && nom !== 'objectifs' && nom !== 'collectifs') erreurs.push(`${nom} : nom manquant pour « ${x?.id} »`);
  }
}

export function controlerModele(modele) {
  const erreurs = [];
  if (!MOTIF_ID.test(modele?.id || '')) return [`identifiant du modèle invalide : ${modele?.id}`];
  const m = completerModele(modele);
  if (!m.nom) erreurs.push('nom manquant');

  uniques(m.roles, 'roles', MOTIF_ID, erreurs);
  if (!m.roles.length || m.roles.length > 8) erreurs.push('roles : 1 à 8 rôles');
  uniques(m.camps, 'camps', MOTIF_ID, erreurs);
  if (![0, 2].includes(m.camps.length)) erreurs.push('camps : zéro ou deux');
  uniques(m.typesStrat, 'typesStrat', MOTIF_ID, erreurs);
  const camps = idsDe(m.camps);
  for (const t of m.typesStrat) if (t.camps.some((c) => !camps.includes(c))) erreurs.push(`typesStrat : camp inconnu dans « ${t.id} »`);
  uniques(m.typesBloc, 'typesBloc', MOTIF_ID, erreurs);
  for (const t of m.typesBloc) if (TYPES_BLOC_COMMUNS.some((c) => c.id === t.id)) erreurs.push(`typesBloc : « ${t.id} » est déjà un bloc commun`);
  uniques(m.rangs, 'rangs', MOTIF_ID, erreurs);
  uniques(m.chiffres, 'chiffres', MOTIF_ID, erreurs);
  for (const c of m.chiffres) if (!(c.min < c.max)) erreurs.push(`chiffres : min ≥ max pour « ${c.id} »`);
  uniques(m.checklistMatch, 'checklistMatch', MOTIF_ID, erreurs);

  if (m.score.type === 'manches' && camps.length !== 2) erreurs.push('score : un score en manches demande deux camps');
  if (m.veto.type === 'cartes') {
    if (!m.veto.formats.length) erreurs.push('veto : formats manquants');
    for (const f of m.veto.formats) {
      if (!Array.isArray(f.etapes) || !f.etapes.length) erreurs.push(`veto : étapes manquantes pour ${f.id}`);
      else if (f.etapes.some((e) => !['A', 'B', null].includes(e[0]) || !['ban', 'pick', 'decisive'].includes(e[1]))) erreurs.push(`veto : étape invalide dans ${f.id}`);
    }
  }
  if (m.profil) {
    if (!/^https:\/\/[^\s]*\{id\}/.test(m.profil.modele || '')) erreurs.push('profil : adresse https:// avec {id} attendue');
    try {
      new RegExp(m.profil.format || '');
    } catch {
      erreurs.push('profil : format invalide');
    }
  }

  if (m.paliers.rangs.length !== 6 || m.paliers.resumes.length !== 6) erreurs.push('paliers : 6 rangs et 6 résumés');
  uniques(m.domaines, 'domaines', MOTIF_DOMAINE, erreurs);
  if (m.domaines.length !== 6) erreurs.push('domaines : exactement 6');
  const domaines = idsDe(m.domaines);

  const tous = new Set();
  for (const [nom, liste] of [['objectifs', m.objectifs], ['collectifs', m.collectifs]]) {
    for (const o of liste) {
      const x = MOTIF_OBJECTIF.exec(o.id || '');
      if (!x) {
        erreurs.push(`${nom} : identifiant invalide « ${o.id} »`);
        continue;
      }
      if (tous.has(o.id)) erreurs.push(`${nom} : identifiant en double « ${o.id} »`);
      tous.add(o.id);
      if (o.palier !== Number(x[2]) || o.domaine !== x[1]) erreurs.push(`${nom} : domaine ou palier incohérent pour « ${o.id} »`);
      if (!o.texte || !o.critere) erreurs.push(`${nom} : texte ou critère manquant pour « ${o.id} »`);
      if (nom === 'objectifs' && !domaines.includes(o.domaine)) erreurs.push(`objectifs : domaine inconnu pour « ${o.id} »`);
      if (nom === 'collectifs' && o.domaine !== 'coll') erreurs.push(`collectifs : « ${o.id} » doit commencer par coll-`);
    }
  }
  for (const d of domaines) for (let n = 1; n <= 6; n += 1) {
    if (!m.objectifs.some((o) => o.domaine === d && o.palier === n)) erreurs.push(`objectifs : aucun objectif ${d} au palier ${n}`);
  }
  for (let n = 1; n <= 6; n += 1) if (!m.collectifs.some((o) => o.palier === n)) erreurs.push(`collectifs : aucun au palier ${n}`);

  const blocs = new Set([...ids(TYPES_BLOC_COMMUNS), ...idsDe(m.typesBloc)]);
  const publics = ids(PUBLICS_BLOC);
  if (!m.ebauches.length) erreurs.push('ebauches : au moins une');
  for (const e of m.ebauches) {
    if (!MOTIF_EBAUCHE.test(e.id || '')) erreurs.push(`ebauches : identifiant invalide « ${e.id} »`);
    const parJour = {};
    for (const b of e.blocs || []) {
      const ok = b.jour >= 1 && b.jour <= 7 && MOTIF_HEURE.test(b.debut) && MOTIF_HEURE.test(b.fin) && minutes(b.fin) > minutes(b.debut);
      if (!ok) erreurs.push(`ebauches : bloc invalide dans ${e.id} (${b.jour} ${b.debut}-${b.fin})`);
      if (!blocs.has(b.type)) erreurs.push(`ebauches : type de bloc inconnu « ${b.type} » dans ${e.id}`);
      if (b.pour && !publics.includes(b.pour)) erreurs.push(`ebauches : public inconnu « ${b.pour} » dans ${e.id}`);
      (parJour[b.jour] ||= []).push(b);
    }
    for (const liste of Object.values(parJour)) {
      const tries = [...liste].sort((a, b) => minutes(a.debut) - minutes(b.debut));
      for (let i = 1; i < tries.length; i += 1) {
        if (minutes(tries[i].debut) < minutes(tries[i - 1].fin)) erreurs.push(`ebauches : blocs qui se chevauchent dans ${e.id} (jour ${tries[i].jour} ${tries[i].debut})`);
      }
    }
  }
  for (let n = 1; n <= 6; n += 1) {
    const r = m.routines[n];
    if (!r || !Array.isArray(r.echauffement) || !Array.isArray(r.hebdo)) erreurs.push(`routines : palier ${n} manquant`);
  }
  for (const cle of Object.keys(m.parRole)) if (!idsDe(m.roles).includes(cle)) erreurs.push(`parRole : rôle inconnu « ${cle} »`);
  for (const [id, s] of Object.entries(m.seuils)) {
    if (!tous.has(id)) erreurs.push(`seuils : objectif inconnu « ${id} »`);
    if (!m.chiffres.some((c) => c.id === s.chiffre)) erreurs.push(`seuils : chiffre inconnu « ${s.chiffre} »`);
    if (!['>=', '<='].includes(s.sens || '>=')) erreurs.push(`seuils : sens invalide pour « ${id} »`);
  }

  if (modele.initiale) {
    const def = definitionEffective(modele);
    const v = validerMeta(def, modele.initiale);
    if (!v.ok) for (const e of v.erreurs.slice(0, 10)) erreurs.push(`initiale : ${e.chemin} ${e.message}`);
    for (const a of v.avertissements.slice(0, 5)) erreurs.push(`initiale : ${a}`);
  } else {
    erreurs.push('initiale manquante');
  }
  return erreurs;
}
