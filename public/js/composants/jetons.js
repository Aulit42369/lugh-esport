// Petits éléments récurrents : rôles, personnages, maps, statuts, jauges, forme récente, signature des modifications.
// Les rôles, personnages et maps sont ceux du jeu affiché (définition du jeu et méta).

import { h } from '../ui.js';
import { symboleRole } from '../icones.js';
import { meta, nomCompte } from '../etat.js';
import * as J from '../jeu.js';
import { STATUTS_MAP, STATUTS_STRAT, STATUTS_OBJECTIF, libelle } from '/shared/referentiel.js';
import { ilYA } from '/shared/temps.js';

export function jetonRole(role, { court = false } = {}) {
  if (!role) return h('span', { class: 'role role--r0' }, symboleRole(-1), 'Rôle à définir');
  const r = J.role(role);
  return h('span', { class: `role ${J.classeRole(role)}`, title: r?.nom || role }, symboleRole(J.indexRole(role)), court ? (r?.court || r?.nom || role) : (r?.nom || role));
}

// ——— Personnages (agents, champions, héros, légendes, opérateurs…) : liste tirée de la méta du jeu ———

export function personnageInfo(id) {
  return meta()?.personnages?.find((a) => a.id === id) || null;
}

export function nomPersonnage(id) {
  return personnageInfo(id)?.nom || id || '';
}

export function jetonPersonnage(id) {
  if (!id) return h('span', { class: 'agent agent--vide' }, 'À choisir');
  const a = personnageInfo(id);
  return h('span', { class: `agent ${J.classeRole(a?.role)}` }, symboleRole(J.indexRole(a?.role)), a?.nom || id);
}

// Options d'un menu de personnages, groupées par rôle (et limitées à un camp quand ils en dépendent).
export function optionsPersonnages({ camp = '' } = {}) {
  const tous = (meta()?.personnages || []).filter((a) => !camp || !a.camp || a.camp === camp);
  const tri = (liste) => liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((a) => ({ valeur: a.id, libelle: a.nom }));
  const groupes = J.roles(true).map((r) => ({ groupe: r.nom, options: tri(tous.filter((a) => a.role === r.id)) })).filter((g) => g.options.length);
  const sansRole = tous.filter((a) => !a.role || !J.role(a.role));
  if (sansRole.length) groupes.push({ groupe: 'Autres', options: tri(sansRole) });
  return groupes.length === 1 ? groupes[0].options : groupes;
}

// ——— Maps : liste tirée de la méta du jeu ———

export function nomMap(id) {
  if (id === 'general') return 'Compo principale';
  return meta()?.maps?.find((m) => m.id === id)?.nom || (id ? id[0].toUpperCase() + id.slice(1) : '');
}

export function optionsMaps({ horsPool = false } = {}) {
  const m = meta();
  const maps = m?.maps || [];
  const pool = maps.filter((x) => (m.mapPool || []).includes(x.id)).map((x) => ({ valeur: x.id, libelle: x.nom }));
  if (!horsPool) return pool;
  const autres = maps.filter((x) => !(m.mapPool || []).includes(x.id)).map((x) => ({ valeur: x.id, libelle: x.nom }));
  if (!pool.length) return autres; // jeu sans map pool : une seule liste, sans groupe « Pool » vide
  return autres.length ? [{ groupe: 'Pool', options: pool }, { groupe: 'Hors pool', options: autres }] : pool;
}

const TONS_MAP = { pick: 'accent', confort: 'positif', travail: 'attention', ban: 'negatif' };
const TONS_STRAT = { apprendre: 'attention', rodage: 'info', maitrisee: 'positif', archivee: '' };
const TONS_OBJECTIF = { afaire: '', encours: 'info', atteint: 'positif' };

export function puce(texte, ton = '') {
  return h('span', { class: ['puce', ton && `puce--${ton}`] }, texte);
}

export const puceStatutMap = (s) => puce(libelle(STATUTS_MAP, s, 'En travail'), TONS_MAP[s] || 'attention');
export const puceStatutStrat = (s) => puce(libelle(STATUTS_STRAT, s), TONS_STRAT[s] || '');
export const puceObjectif = (s) => puce(libelle(STATUTS_OBJECTIF, s || 'afaire'), TONS_OBJECTIF[s] || '');

export function pucePalier(id) {
  const p = J.palier(id);
  return p ? puce(`${p.n}. ${p.nom}`, 'plein') : puce('Palier à définir');
}

export function jauge(valeur, { legende = '', droite = null, couleur = null } = {}) {
  const v = Math.max(0, Math.min(100, Number(valeur) || 0));
  return h('div', { class: 'jauge' },
    legende || droite !== null ? h('div', { class: 'jauge__legende' }, h('span', {}, legende), h('span', {}, droite ?? `${v} %`)) : null,
    h('div', { class: 'jauge__piste', role: 'img', 'aria-label': `${legende} ${v} %` },
      h('div', { class: 'jauge__barre', style: { width: `${v}%`, ...(couleur ? { '--c-jauge': couleur } : {}) } })));
}

export function forme(tendance) {
  const mots = J.typeScore() === 'classement' ? { V: 'top 1', D: 'bas de tableau', N: 'milieu de tableau' } : { V: 'victoire', D: 'défaite', N: 'nul' };
  return h('span', { class: 'forme', role: 'img', 'aria-label': `Forme : ${tendance.map((t) => mots[t]).join(', ') || 'aucun match'}` },
    tendance.map((t) => h('span', { class: t })));
}

export function signature(d) {
  if (!d?.maj) return null;
  return h('span', { class: 'signature' }, `Modifié par ${nomCompte(d.maj.par)}, ${ilYA(d.maj.le)}`);
}
