// Suivi de l'équipe, fonctions pures : présences, chiffres des joueurs, « quoi de neuf », bilan du mois.

import { STATUTS_PRESENCE, JOURS } from './referentiel.js';
import { lundiDe, ajouterJours, isoCivile, semaineIso } from './temps.js';
import { statsScrims, scoreLisible } from './stats.js';
import { TYPES_SANS_APPEL } from './jeux/commun.js';

// ——— Présences ———

// Séances collectives d'une semaine où l'appel a un sens (ni échauffement, ni sport, ni repos, ni travail seul).
export function seancesAppel(blocs = []) {
  return blocs.filter((b) => b.pour !== 'individuel' && b.pour !== 'staff' && !TYPES_SANS_APPEL.has(b.type));
}

export function moisDeSemaine(semaine) {
  return isoCivile(ajouterJours(lundiDe(semaine), 3)).slice(0, 7);
}

export function statsPresences(presences, { filtre = () => true } = {}) {
  const parMembre = {};
  for (const p of presences.filter(filtre)) {
    for (const [membreId, statut] of Object.entries(p.statuts || {})) {
      const m = parMembre[membreId] || (parMembre[membreId] = { present: 0, retard: 0, excuse: 0, absent: 0, total: 0 });
      if (STATUTS_PRESENCE.some((s) => s.id === statut)) {
        m[statut] += 1;
        m.total += 1;
      }
    }
  }
  for (const m of Object.values(parMembre)) {
    const comptees = m.present + m.retard + m.absent;
    m.taux = comptees ? Math.round(((m.present + m.retard) / comptees) * 100) : null;
  }
  return parMembre;
}

// ——— Chiffres ———

export function rangN(def, id) {
  return def?.rangs?.find((r) => r.id === id)?.n ?? null;
}

// Séries hebdomadaires d'un joueur, triées par semaine.
export function seriesMesures(mesures, membreId) {
  return mesures.filter((x) => x.membreId === membreId && x.semaine).sort((a, b) => a.semaine.localeCompare(b.semaine));
}

function moyenne(valeurs) {
  const v = valeurs.filter((x) => typeof x === 'number');
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null;
}

// Moyenne de chaque chiffre suivi par le jeu, et total des parties jouées.
export function moyennesMesures(liste, chiffres = []) {
  return {
    valeurs: Object.fromEntries(chiffres.map((c) => [c.id, moyenne(liste.map((x) => x.valeurs?.[c.id]))])),
    parties: liste.reduce((s, x) => s + (x.parties || 0), 0),
  };
}

// ——— Quoi de neuf ———

const JOURS_COURTS = JOURS.map((j) => j.court.toLowerCase());

function apres(d, depuis) {
  return d?.maj?.le && d.maj.le > depuis;
}

function nouveau(d, depuis) {
  return d?.cree?.le && d.cree.le > depuis;
}

export function quoiDeNeuf({ depuis, moi, monMembreId, liste, nomMap = (id) => id, nomMembre = () => '', semaineCourante = null }) {
  if (!depuis) return [];
  const autre = (d) => d?.maj?.par && d.maj.par !== moi;
  const items = [];
  const ajouter = (quand, texte, lien) => items.push({ quand, texte, lien });

  for (const s of liste('strats')) {
    if (apres(s, depuis) && autre(s)) ajouter(s.maj.le, `${nouveau(s, depuis) ? 'Nouvelle strat' : 'Strat modifiée'} : « ${s.nom} »${s.map ? ` sur ${nomMap(s.map)}` : ''}`, `#/strats${s.map ? `/${s.map}` : ''}`);
  }
  for (const p of liste('planning')) {
    if ((p._id === semaineCourante || p._id === 'modele') && apres(p, depuis) && autre(p)) {
      ajouter(p.maj.le, p._id === 'modele' ? 'Semaine type modifiée' : 'Planning de la semaine mis à jour', p._id === 'modele' ? '#/planning/modele' : '#/planning');
    }
  }
  for (const s of liste('scrims')) if (nouveau(s, depuis) && autre(s)) ajouter(s.cree.le, `Nouveau résultat : ${scoreLisible(s)} contre ${s.adversaire}`, '#/scrims');
  for (const v of liste('vods')) if (nouveau(v, depuis) && autre(v)) ajouter(v.cree.le, `VOD à revoir : ${v.titre}`, `#/vod/${v._id}`);
  for (const n of liste('vodNotes')) {
    if (monMembreId && n.membre === monMembreId && nouveau(n, depuis) && autre(n)) ajouter(n.cree.le, `Note de VOD te concernant : ${n.texte.slice(0, 70)}`, `#/vod/${n.vodId}`);
  }
  if (monMembreId) {
    const o = liste('objectifs').find((x) => x._id === monMembreId);
    if (apres(o, depuis) && autre(o)) ajouter(o.maj.le, 'Tes objectifs ont été mis à jour par le staff', `#/progression/${monMembreId}`);
  }
  const meta = liste('meta')[0];
  if (meta?.derniereVerif > depuis && meta.dernierEcart && !meta.dernierEcart.vide) ajouter(meta.derniereVerif, `Méta : patch ${meta.patch}, changements à consulter`, '#/meta');
  for (const a of liste('adversaires')) if (apres(a, depuis) && autre(a) && a.prochainMatch?.date) ajouter(a.maj.le, `Prochain match contre ${a.nom} mis à jour`, `#/adversaires/${a._id}`);
  for (const c of liste('candidats')) if (nouveau(c, depuis) && autre(c)) ajouter(c.cree.le, `Nouveau candidat : ${c.pseudo}`, '#/recrutement');
  for (const a of liste('absences')) if (nouveau(a, depuis) && autre(a)) ajouter(a.cree.le, `Absence déclarée : ${nomMembre(a.membreId)}`, '#/presences');
  const biblio = liste('bibliotheque').filter((b) => nouveau(b, depuis) && autre(b));
  if (biblio.length) ajouter(biblio.map((b) => b.cree.le).sort().at(-1), `${biblio.length} ajout${biblio.length > 1 ? 's' : ''} dans la bibliothèque`, '#/bibliotheque');
  for (const c of liste('seances')) {
    if (nouveau(c, depuis) && autre(c)) ajouter(c.cree.le, `Compte rendu de séance : ${c.titre || 'séance'} (${JOURS_COURTS[(c.jour || 1) - 1]} ${c.debut})`, `#/planning/${c.semaine}`);
  }
  for (const t of liste('tournois')) {
    if (apres(t, depuis) && autre(t)) ajouter(t.maj.le, `${nouveau(t, depuis) ? 'Nouveau tournoi' : 'Tournoi mis à jour'} : ${t.nom}`, '#/tournois');
  }
  const sugg = liste('suggestions').filter((s) => s.statut === 'nouvelle' && s.creeLe > depuis);
  if (sugg.length) ajouter(sugg.map((s) => s.creeLe).sort().at(-1), `${sugg.length} suggestion${sugg.length > 1 ? 's' : ''} après la mise à jour de la méta`, '#/meta');
  return items.sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, 12);
}

// ——— Bilan du mois ———

export function bilanMois({ mois, scrims = [], presences = [], objectifs = [], mesures = [], seances = [], tournois = [], def = null }) {
  const duMois = (iso) => iso?.slice(0, 7) === mois;
  const precedent = (() => {
    const [a, m] = mois.split('-').map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  })();
  const atteints = {};
  for (const o of objectifs) {
    const ids = [
      ...Object.entries(o.suivis || {}).filter(([, s]) => s.statut === 'atteint' && duMois(s.le)).map(([id]) => id),
      ...(o.perso || []).filter((p) => p.statut === 'atteint' && duMois(p.le)).map((p) => p.id),
    ];
    if (ids.length) atteints[o._id] = ids;
  }
  const chiffres = {};
  for (const x of mesures) {
    if (!/^\d{4}-W\d{2}$/.test(x.semaine || '') || !x.membreId) continue;
    const m = moisDeSemaine(x.semaine);
    if (m !== mois && m !== precedent) continue;
    const c = chiffres[x.membreId] || (chiffres[x.membreId] = { mois: [], precedent: [] });
    c[m === mois ? 'mois' : 'precedent'].push(x);
  }
  return {
    mois,
    scrims: statsScrims(scrims.filter((s) => duMois(s.date)), def),
    presences: statsPresences(presences, { filtre: (p) => moisDeSemaine(p.semaine) === mois }),
    atteints,
    chiffres: Object.fromEntries(Object.entries(chiffres).map(([id, c]) => [id, { mois: moyennesMesures(c.mois, def?.chiffres), precedent: moyennesMesures(c.precedent, def?.chiffres) }])),
    // Comptes rendus de séance du mois, dans l'ordre, et tournois joués ou terminés dans le mois.
    seances: seances.filter((c) => /^\d{4}-W\d{2}$/.test(c.semaine || '') && moisDeSemaine(c.semaine) === mois)
      .sort((a, b) => a.semaine.localeCompare(b.semaine) || a.jour - b.jour || a.debut.localeCompare(b.debut)),
    tournois: tournois.filter((t) => duMois(t.fin || t.debut) && ['encours', 'termine'].includes(t.statut)),
  };
}

export function semainesDuMois(mois) {
  const [a, m] = mois.split('-').map(Number);
  const semaines = new Set();
  for (let j = 1; j <= 31; j += 1) {
    const d = new Date(Date.UTC(a, m - 1, j));
    if (d.getUTCMonth() !== m - 1) break;
    semaines.add(semaineIso({ a, m, j }));
  }
  return [...semaines];
}
