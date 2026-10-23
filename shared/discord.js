// Textes prêts pour Discord (bouton « Copier pour Discord » et notifications du serveur) : une seule source.
// Mise en forme Markdown de Discord ; 2 000 caractères maximum par message. Le vocabulaire vient du jeu.

import { JOURS, TYPES_SCRIM, libelle } from './referentiel.js';
import { trierParDate, manchesParCamp, resultat, scoreLisible, estClassement, pointsClassement } from './stats.js';
import { formatDate, minutes } from './temps.js';
import { libelleDans, mot, formatParId } from './jeux/definition.js';
import { MARQUE } from './marque.js';

export const LIMITE_DISCORD = 2000;

export function couper(texte, limite = LIMITE_DISCORD) {
  return texte.length <= limite ? texte : `${texte.slice(0, limite - 1)}…`;
}

const PUBLICS = { equipe: 'toute l’équipe', titulaires: 'titulaires', individuel: 'chacun de son côté', staff: 'staff', choix: 'membres choisis' };

export function texteSemaine({ def, titre, blocs, nomMap = (id) => id, collectifSeulement = false }) {
  const tries = [...blocs]
    .filter((b) => !collectifSeulement || b.pour !== 'individuel')
    .sort((a, b) => a.jour - b.jour || minutes(a.debut) - minutes(b.debut));
  const lignes = [`📅 **${titre}**`];
  for (const j of JOURS) {
    const duJour = tries.filter((b) => b.jour === j.n);
    if (!duJour.length) continue;
    lignes.push('', `**${j.nom}**`);
    for (const b of duJour) {
      const quoi = b.titre || libelleDans(def.typesBlocTous, b.type);
      const extra = [b.map ? nomMap(b.map) : null, PUBLICS[b.pour] || null].filter(Boolean).join(', ');
      lignes.push(`\`${b.debut}–${b.fin}\` ${quoi}${extra ? ` (${extra})` : ''}`);
    }
  }
  if (lignes.length === 1) lignes.push('Aucune séance prévue.');
  return couper(lignes.join('\n'));
}

function icone(s) {
  const r = resultat(s);
  if (estClassement(s)) return r === 'V' ? '🏆' : r === 'D' ? '🔻' : '🏁';
  return r === 'V' ? '✅' : r === 'D' ? '❌' : '➖';
}

export function texteScrim(def, s, nomMap = (id) => id) {
  const type = libelle(TYPES_SCRIM, s.type).toLowerCase();
  const lieu = s.map ? ` sur ${nomMap(s.map)}` : '';
  const lignes = [];
  if (estClassement(s)) {
    const pts = pointsClassement(s, def.score);
    lignes.push(`${icone(s)} **${scoreLisible(s)}**${typeof pts === 'number' ? ` · ${pts} pts` : ''} : ${s.adversaire}${lieu} (${type}, ${formatDate(s.date)})`);
  } else {
    const r = resultat(s);
    const tete = r === 'V' ? '✅ **Victoire' : r === 'D' ? '❌ **Défaite' : '➖ **Égalité';
    lignes.push(`${tete} ${s.scoreNous}–${s.scoreEux}** contre ${s.adversaire}${lieu} (${type}, ${formatDate(s.date)})`);
    const camps = def.camps.map((c) => c.id);
    const mc = manchesParCamp(s, camps);
    if (mc) lignes.push(def.camps.map((c) => `${c.nom} ${mc[c.id].gagnes}–${mc[c.id].perdus}`).join(', '));
  }
  if (s.bien) lignes.push(`👍 ${s.bien}`);
  if (s.corriger) lignes.push(`🎯 ${s.corriger}`);
  return couper(lignes.join('\n'));
}

export function texteDerniersScrims(scrims, nomMap = (id) => id, n = 5) {
  const derniers = trierParDate(scrims, -1).slice(0, n);
  if (!derniers.length) return 'Aucun résultat.';
  return couper(['**Derniers résultats**', ...derniers.map((s) => `${icone(s)} ${scoreLisible(s)} ${estClassement(s) ? ':' : 'contre'} ${s.adversaire}${s.map ? `, ${nomMap(s.map)}` : ''} (${formatDate(s.date)})`)].join('\n'));
}

export function texteActionsVod(vod, notes, nomMembre = () => 'Équipe') {
  const actions = notes.filter((n) => n.action);
  const lignes = [`🎬 **Review : ${vod.titre}**`];
  if (!actions.length) lignes.push('Aucune action retenue.');
  for (const n of actions) lignes.push(`• **${n.membre ? nomMembre(n.membre) : 'Équipe'}** : ${n.action}${n.temps ? ` (${n.temps})` : ''}`);
  return couper(lignes.join('\n'));
}

// Texte venu de l'extérieur (méta écrite par le modèle d'après des pages web) : la syntaxe Discord est neutralisée,
// pour qu'aucun lien masqué [texte](adresse) ni mise en forme trompeuse n'arrive dans le salon de l'équipe.
export function echapperMarkdown(t) {
  return String(t ?? '').replace(/[\\`*_~|>[\]()#<]/g, '\\$&');
}
const liste = (noms) => noms.map(echapperMarkdown).join(', ');

export function texteMeta(def, meta, ecart) {
  const lignes = [`🗺️ **Méta ${def.nom} : patch ${echapperMarkdown(meta.patch)}** (${echapperMarkdown(meta.saison)})`];
  if (ecart?.entrees?.length) lignes.push(`Entrent dans le pool : ${liste(ecart.entrees)}`);
  if (ecart?.sorties?.length) lignes.push(`Sortent du pool : ${liste(ecart.sorties)}`);
  const perso = mot(def, 'personnages', true) || 'Personnages';
  if (ecart?.personnagesModifies?.length) lignes.push(`${perso} modifiés : ${liste(ecart.personnagesModifies)}`);
  if (ecart?.nouveauxPersonnages?.length) lignes.push(`Nouveaux ${mot(def, 'personnages') || 'personnages'} : ${liste(ecart.nouveauxPersonnages)}`);
  lignes.push(`Détails et suggestions sur ${MARQUE.nom}, page Méta.`);
  return couper(lignes.join('\n'));
}

export function texteMatch(def, adv) {
  const m = adv.prochainMatch || {};
  const format = m.format ? formatParId(def, m.format)?.nom || '' : '';
  return couper(`⚔️ **Prochain match : ${adv.nom}**${m.date ? ` le ${formatDate(m.date)}` : ''}${m.heure ? ` à ${m.heure}` : ''}${format ? ` (${format})` : ''}\nPréparation sur ${MARQUE.nom}, page Adversaires.`);
}

export function texteAbsence(a, nom) {
  return couper(`🚫 **Absence : ${nom}** le ${formatDate(a.date)}${a.debut ? ` de ${a.debut}${a.fin ? ` à ${a.fin}` : ''}` : ''}${a.raison ? ` (${a.raison})` : ''}`);
}
