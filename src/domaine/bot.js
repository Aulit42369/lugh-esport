// Bot Discord de Lugh, côté appli : réglages et état du bot, rôles attendus de chaque compte lié, rappels à venir,
// semaine et prochains matchs d'une personne, codes de liaison. Le bot (sur le Raspberry Pi) ne fait qu'appliquer.
// Données : trois documents de la collection parametres (base générale), un par écrivain pour qu'une écriture n'en
// écrase jamais une autre : réglages (Administrateur général), état (le bot), comptes déliés ; champ `discord` des comptes.

import { createHash, randomInt } from 'node:crypto';
import { dateCivile, isoCivile, civileDepuisIso, ajouterJours, semaineIso, decalerSemaine, joursDe, minutes } from '../../shared/temps.js';
import { accesEspace } from '../../shared/roles.js';
import { concerne } from '../../shared/charge.js';
import { tournoisAVenir } from '../../shared/organisation.js';
import { TYPES_SANS_APPEL } from '../../shared/jeux/commun.js';

export const IDS = { reglages: 'discord-bot-reglages', etat: 'discord-bot-etat', delies: 'discord-bot-delies' };
export const DUREE_CODE_MS = 10 * 60_000;
export const DUREE_ATTENTE_MS = 15 * 60_000; // liaison tapée sur Discord, à confirmer dans Lugh
export const HORIZON_RAPPELS_H = 27; // le bot se synchronise toutes les 3 h : 27 h couvrent largement une nuit sans réveil
const GARDE_DELIES_JOURS = 14;
// Sans les 0/O et 1/I/L, qu'on confond à la lecture.
const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const REGLAGES_DEFAUT = {
  roles: true,
  rappels: { actif: true, delai: 30, seances: true, scrims: true, matchs: true, tournois: true },
};
export const DELAIS_RAPPEL = [15, 30, 60, 120];

// Métier de Lugh → rôle de fonction sur Discord (clés de l'outil Lugh-Discord).
const FONCTION_DU_METIER = {
  responsable: 'responsable', headcoach: 'staff', coach: 'staff', analyste: 'staff',
  capitaine: 'capitaine', joueur: 'joueur', remplacant: 'remplacant', invite: 'invite',
};

export const empreinte = (code) => createHash('sha256').update(String(code).toUpperCase()).digest('hex');

export function nouveauCode() {
  return Array.from({ length: 6 }, () => ALPHABET_CODE[randomInt(ALPHABET_CODE.length)]).join('');
}

export function normaliserReglages(r = {}) {
  const rap = r.rappels || {};
  return {
    roles: r.roles !== false,
    rappels: {
      actif: rap.actif !== false,
      delai: DELAIS_RAPPEL.includes(rap.delai) ? rap.delai : REGLAGES_DEFAUT.rappels.delai,
      seances: rap.seances !== false,
      scrims: rap.scrims !== false,
      matchs: rap.matchs !== false,
      tournois: rap.tournois !== false,
    },
  };
}

export async function lireParametresBot(global) {
  const [r, e, d] = await Promise.all([global.lire('parametres', IDS.reglages), global.lire('parametres', IDS.etat), global.lire('parametres', IDS.delies)]);
  return { reglages: normaliserReglages(r?.reglages), etat: e?.etat || null, delies: d?.liste || [] };
}

export const ecrireReglagesBot = (global, reglages) => global.ecrire('parametres', { _id: IDS.reglages, reglages });
export const ecrireEtatBot = (global, etat) => global.ecrire('parametres', { _id: IDS.etat, etat });

// Un compte délié garde ses rôles Discord tant que le bot ne sait pas qu'il l'était : on le lui signale 14 jours.
export async function noterDelie(global, discordId, maintenant) {
  const { delies } = await lireParametresBot(global);
  const limite = maintenant.getTime() - GARDE_DELIES_JOURS * 86_400_000;
  const suivants = delies.filter((d) => d.id !== discordId && new Date(d.le).getTime() > limite);
  suivants.push({ id: discordId, le: maintenant.toISOString() });
  await global.ecrire('parametres', { _id: IDS.delies, liste: suivants.slice(-200) });
}

// Fonctions et jeux attendus d'un compte : l'union de ses métiers dans les jeux actifs où il a vraiment accès.
// L'Administrateur général reçoit « admin » ; ses rôles de jeu suivent ses accès explicites (Discord lui ouvre tout).
export function rolesAttendus(compte, jeuxActifs) {
  if (!compte || compte.actif === false) return { fonctions: [], jeux: [] };
  const fonctions = new Set(compte.admin ? ['admin'] : []);
  const jeux = [];
  for (const jeu of jeuxActifs) {
    const propre = compte.acces?.[jeu.id];
    const a = accesEspace(compte, jeu.id);
    if (!a) continue;
    const metiers = compte.admin ? (propre?.metiers || []) : a.metiers;
    if (compte.admin && !metiers.length && !propre?.membreId) continue;
    jeux.push(jeu.id);
    for (const m of metiers) if (FONCTION_DU_METIER[m]) fonctions.add(FONCTION_DU_METIER[m]);
  }
  return { fonctions: [...fonctions], jeux };
}

// ——— Instants : date civile + heure à Paris → instant UTC (heure d'été comprise) ———

function decalage(ms, fuseau) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

export function instantCivil(dateIso, heure, fuseau) {
  const { a, m, j } = civileDepuisIso(dateIso);
  const t = minutes(heure);
  const naif = Date.UTC(a, m - 1, j, Math.floor(t / 60), t % 60);
  const premier = naif - decalage(naif, fuseau);
  return new Date(naif - decalage(premier, fuseau));
}

// ——— Rappels des prochaines heures, tous jeux actifs ———
// Séances du planning (sauf repos, échauffement, activité physique et le travail chacun de son côté), scrims et
// matchs du planning, prochains matchs officiels des adversaires (s'il n'y a pas déjà un bloc « match » ce jour-là),
// tournois du jour (rappel à 9 h). Chaque rappel a un identifiant stable : le bot ne l'envoie qu'une fois.
export async function rappelsAVenir({ espaces, maintenant, fuseau, reglages, heures = HORIZON_RAPPELS_H }) {
  const r = reglages.rappels;
  if (!r.actif) return [];
  const debutFenetre = maintenant.getTime();
  const finFenetre = debutFenetre + heures * 3_600_000;
  const dedans = (d) => d.getTime() > debutFenetre && d.getTime() <= finFenetre;
  const auj = isoCivile(dateCivile(maintenant, fuseau));
  const semaines = [semaineIso(civileDepuisIso(auj))];
  semaines.push(decalerSemaine(semaines[0], 1));
  const rappels = [];
  for (const e of espaces) {
    const jeu = { id: e.id, nom: e.def.nom, court: e.def.court };
    const joursMatch = new Set();
    for (const semaine of semaines) {
      const p = await e.stockage.lire('planning', semaine);
      const jours = joursDe(semaine);
      for (const b of p?.blocs || []) {
        if (b.type === 'repos' || TYPES_SANS_APPEL.has(b.type) || b.pour === 'individuel') continue;
        const date = jours[b.jour - 1]?.iso;
        if (!date) continue;
        if (b.type === 'match') joursMatch.add(date);
        const genre = b.type === 'scrim' ? 'scrim' : b.type === 'match' ? 'match' : 'seance';
        if ((genre === 'seance' && !r.seances) || (genre === 'scrim' && !r.scrims) || (genre === 'match' && !r.matchs)) continue;
        const debut = instantCivil(date, b.debut, fuseau);
        if (!dedans(debut)) continue;
        const type = e.def.typesBlocTous.find((t) => t.id === b.type)?.nom || b.type;
        rappels.push({
          id: `${e.id}-${semaine}-${b.id}-${date}-${b.debut}`, jeu, genre, titre: b.titre || type, type,
          debut: debut.toISOString(), heure: b.debut, fin: b.fin || '', pour: b.pour || 'equipe',
        });
      }
    }
    if (r.matchs) {
      for (const a of await e.stockage.lister('adversaires')) {
        const m = a.prochainMatch;
        if (!m?.date || !m.heure || joursMatch.has(m.date)) continue;
        const debut = instantCivil(m.date, m.heure, fuseau);
        if (!dedans(debut)) continue;
        rappels.push({
          id: `${e.id}-match-${a._id}-${m.date}-${m.heure}`, jeu, genre: 'match', titre: `Match contre ${a.nom}`, type: 'Match officiel',
          debut: debut.toISOString(), heure: m.heure, fin: '', pour: 'equipe',
        });
      }
    }
    if (r.tournois) {
      for (const t of tournoisAVenir(await e.stockage.lister('tournois'), auj)) {
        if (!['inscrit', 'encours'].includes(t.statut) || !t.debut) continue;
        const debut = instantCivil(t.debut, '09:00', fuseau);
        // Envoyé le matin même ; un bot redémarré après 9 h l'envoie encore jusqu'à 21 h.
        if (!(debut.getTime() > debutFenetre - 12 * 3_600_000 && debut.getTime() <= finFenetre)) continue;
        rappels.push({
          id: `${e.id}-tournoi-${t._id}-${t.debut}`, jeu, genre: 'tournoi', titre: t.nom, type: 'Tournoi',
          debut: debut.toISOString(), heure: '', fin: '', pour: 'equipe', immediat: true,
        });
      }
    }
  }
  return rappels.sort((x, y) => x.debut.localeCompare(y.debut));
}

// ——— Ce qu'une personne a cette semaine et ses prochains matchs (commandes /planning et /match) ———

export async function semaineDe({ espace, membreId, maintenant, fuseau, jours = 7 }) {
  const auj = civileDepuisIso(isoCivile(dateCivile(maintenant, fuseau)));
  const fin = isoCivile(ajouterJours(auj, jours - 1));
  const debut = isoCivile(auj);
  const membre = membreId ? await espace.stockage.lire('membres', membreId) : null;
  const semaine = semaineIso(auj);
  const blocs = [];
  for (const s of [semaine, decalerSemaine(semaine, 1)]) {
    const p = await espace.stockage.lire('planning', s);
    const js = joursDe(s);
    for (const b of p?.blocs || []) {
      const date = js[b.jour - 1]?.iso;
      if (!date || date < debut || date > fin || b.type === 'repos') continue;
      if (membre ? !concerne(b, membre) : !['equipe', 'titulaires', 'staff', undefined].includes(b.pour)) continue;
      const type = espace.def.typesBlocTous.find((t) => t.id === b.type)?.nom || b.type;
      blocs.push({ date, debut: b.debut, fin: b.fin, titre: b.titre || type, type });
    }
  }
  return blocs.sort((x, y) => x.date.localeCompare(y.date) || x.debut.localeCompare(y.debut));
}

export async function matchsDe({ espace, maintenant, fuseau, jours = 30 }) {
  const auj = isoCivile(dateCivile(maintenant, fuseau));
  const fin = isoCivile(ajouterJours(civileDepuisIso(auj), jours));
  const matchs = (await espace.stockage.lister('adversaires'))
    .filter((a) => a.prochainMatch?.date && a.prochainMatch.date >= auj && a.prochainMatch.date <= fin)
    .map((a) => ({ date: a.prochainMatch.date, heure: a.prochainMatch.heure || '', adversaire: a.nom, format: a.prochainMatch.format || '' }))
    .sort((x, y) => (x.date + x.heure).localeCompare(y.date + y.heure));
  const tournois = tournoisAVenir(await espace.stockage.lister('tournois'), auj)
    .filter((t) => t.statut !== 'envisage' && (!t.debut || t.debut <= fin))
    .map((t) => ({ nom: t.nom, debut: t.debut || '', fin: t.fin || '', statut: t.statut }));
  return { matchs, tournois };
}

// Jours d'une absence déclarée sur Discord : du … au … (14 jours au plus).
export function joursAbsence(du, au) {
  const jours = [];
  let c = civileDepuisIso(du);
  const fin = au || du;
  for (let i = 0; i < 14; i += 1) {
    const iso = isoCivile(c);
    if (iso > fin) break;
    jours.push(iso);
    c = ajouterJours(c, 1);
  }
  return jours;
}
