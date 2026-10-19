// Organisation de la structure, fonctions pures : rappels des tournois, fiabilité des partenaires de scrim,
// conflits d'agenda d'une même personne entre deux jeux.

import { civileDepuisIso, isoCivile, ajouterJours, formatDateCourte, minutes } from './temps.js';
import { libelle, STATUTS_TOURNOI } from './referentiel.js';
import { concerne } from './charge.js';

function joursEntre(debutIso, finIso) {
  const a = civileDepuisIso(debutIso);
  const b = civileDepuisIso(finIso);
  return Math.round((Date.UTC(b.a, b.m - 1, b.j) - Date.UTC(a.a, a.m - 1, a.j)) / 86_400_000);
}

const dans = (n) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);

// Rappels pour « À traiter » : date limite d'inscription à J-7 (puis J-2 en urgent), début imminent, résultat à saisir.
export function rappelsTournois(tournois = [], aujourdhui) {
  const rappels = [];
  for (const t of tournois) {
    if (t.statut === 'envisage' && t.dateLimite) {
      const n = joursEntre(aujourdhui, t.dateLimite);
      if (n >= 0 && n <= 7) {
        rappels.push({
          niveau: n <= 2 ? 'attention' : 'info',
          texte: n === 0
            ? `Dernier jour pour s’inscrire à ${t.nom}.`
            : `Inscription à ${t.nom} : date limite ${dans(n)} (${formatDateCourte(t.dateLimite)}).`,
          lien: '#/tournois',
        });
      } else if (n < 0 && n >= -7) {
        rappels.push({ niveau: 'info', texte: `Date limite passée pour ${t.nom} : indique si l’équipe est inscrite.`, lien: '#/tournois' });
      }
    }
    if (t.statut === 'inscrit' && t.debut) {
      const n = joursEntre(aujourdhui, t.debut);
      if (n >= 0 && n <= 2) rappels.push({ niveau: 'info', texte: `${t.nom} commence ${dans(n)} : roster et horaires à confirmer.`, lien: '#/tournois' });
      if (n >= 0 && n <= 14 && !(t.roster || []).length) rappels.push({ niveau: 'attention', texte: `Aucun joueur inscrit dans le roster de ${t.nom}.`, lien: '#/tournois' });
    }
    if (['inscrit', 'encours'].includes(t.statut) && (t.fin || t.debut) && joursEntre(t.fin || t.debut, aujourdhui) > 0) {
      rappels.push({ niveau: 'info', texte: `${t.nom} est terminé ? Saisis le résultat.`, lien: '#/tournois' });
    }
  }
  return rappels;
}

// Tournois à venir ou en cours, du plus proche au plus lointain.
export function tournoisAVenir(tournois = [], aujourdhui) {
  return tournois
    .filter((t) => ['envisage', 'inscrit', 'encours'].includes(t.statut) && (!t.fin || t.fin >= aujourdhui) && (!t.debut || t.debut >= aujourdhui || t.statut === 'encours'))
    .sort((a, b) => (a.debut || '9999').localeCompare(b.debut || '9999'));
}

export function libelleStatutTournoi(id) {
  return libelle(STATUTS_TOURNOI, id);
}

// Fiabilité d'un partenaire de scrim : scrims joués (fiches de scrim liées) face aux annulations et absences notées.
export function fiabilitePartenaire(partenaire, scrims = []) {
  const joues = scrims.filter((s) => s.partenaire === partenaire._id);
  const compte = (type) => (partenaire.incidents || []).filter((i) => i.type === type).length;
  const annules = compte('annule');
  const absents = compte('absent');
  const retards = compte('retard');
  const prevus = joues.length + annules + absents;
  return {
    joues: joues.length,
    annules,
    absents,
    retards,
    annulesNous: compte('annuleNous'),
    taux: prevus ? Math.round((joues.length / prevus) * 100) : null,
    dernier: joues.map((s) => s.date).sort().at(-1) || null,
  };
}

// Créneaux occupés par un membre dans un planning de semaine (hors repos).
export function creneauxDe(planning, membre) {
  return (planning?.blocs || []).filter((b) => concerne(b, membre)).map((b) => ({ jour: b.jour, debut: b.debut, fin: b.fin, blocId: b.id }));
}

const chevauche = (a, b) => a.jour === b.jour && minutes(a.debut) < minutes(b.fin) && minutes(b.debut) < minutes(a.fin);

// Conflits d'une semaine : pour chaque bloc de ce jeu, les personnes qu'il concerne et qui ont déjà une séance au même
// moment dans un autre jeu. liens : [{ membre (fiche dans ce jeu), autres: [{ jeu: { id, nom, court, couleur },
// membre (fiche dans l'autre jeu), planning (semaine de l'autre jeu) }] }]. Seuls le jeu, le jour et l'horaire de
// l'autre séance sont rendus : son contenu reste privé.
export function conflitsEntreJeux({ planning, liens = [] }) {
  const conflits = [];
  for (const b of planning?.blocs || []) {
    for (const lien of liens) {
      if (!concerne(b, lien.membre)) continue;
      for (const autre of lien.autres) {
        for (const c of creneauxDe(autre.planning, autre.membre)) {
          if (chevauche(b, c)) conflits.push({ blocId: b.id, membreId: lien.membre._id, jeu: autre.jeu, jour: c.jour, debut: c.debut, fin: c.fin });
        }
      }
    }
  }
  return conflits;
}

// Semaines couvertes par l'agenda personnel : la semaine en cours et les suivantes.
export function datesAgenda(aujourdhui, jours = 28) {
  return { debut: aujourdhui, fin: isoCivile(ajouterJours(civileDepuisIso(aujourdhui), jours)) };
}
