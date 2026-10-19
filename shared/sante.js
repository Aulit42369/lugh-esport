// Moniteur de santé de l'équipe : signaux faibles affichés dans « À traiter » de l'accueil du jeu.
// Présence en baisse, chiffres oubliés, série de défaites, map du pool délaissée, charge d'entraînement trop forte
// (seuils des Réglages du jeu). Fonctions pures.

import { lundiDe, ajouterJours, isoCivile, civileDepuisIso, decalerSemaine } from './temps.js';
import { statsPresences } from './suivi.js';
import { statsScrims, trierParDate } from './stats.js';
import { actifs, mot } from './jeux/definition.js';
import { alertesCharge } from './charge.js';

export const SEUILS_SANTE = {
  presenceMin: 70, // %
  joursPresence: 30,
  seancesMin: 4, // séances notées au minimum avant de juger une présence
  semainesSansChiffres: 2,
  defaitesDeSuite: 3,
  joursSansScrimMap: 21,
  scrimsMin: 3, // l'équipe doit avoir joué un peu avant qu'une map « délaissée » ait un sens
};

const JOUEURS_SUIVIS = new Set(['titulaire', 'remplacant', 'essai']);

function datePresence(p) {
  return isoCivile(ajouterJours(lundiDe(p.semaine), (p.jour || 1) - 1));
}

export function alertesSante({ def, membres = [], presences = [], mesures = [], scrims = [], meta = null, planning = [], semaineCourante, aujourdhui }) {
  const alertes = [];
  const S = SEUILS_SANTE;
  const joueurs = membres.filter((m) => m.type === 'joueur' && JOUEURS_SUIVIS.has(m.statut) && m.pseudo);
  const nom = (m) => m.pseudo;

  // 1. Présence sous 70 % sur 30 jours (présent ou en retard ; les excusés ne comptent pas).
  const depuis = isoCivile(ajouterJours(civileDepuisIso(aujourdhui), -S.joursPresence));
  const recentes = presences.filter((p) => /^\d{4}-W\d{2}$/.test(p.semaine || '') && datePresence(p) >= depuis && datePresence(p) <= aujourdhui);
  const parMembre = statsPresences(recentes);
  for (const j of joueurs) {
    const p = parMembre[j._id];
    const comptees = p ? p.present + p.retard + p.absent : 0;
    if (p && comptees >= S.seancesMin && p.taux !== null && p.taux < S.presenceMin) {
      alertes.push({ niveau: 'attention', texte: `Présence de ${nom(j)} : ${p.taux} % sur ${S.joursPresence} jours.`, lien: '#/presences' });
    }
  }

  // 2. Chiffres de la semaine oubliés depuis 2 semaines (seulement si l'équipe saisit des chiffres).
  if ((actifs(def.chiffres).length || def.rangs.length) && mesures.length) {
    const limite = decalerSemaine(semaineCourante, -(S.semainesSansChiffres - 1));
    for (const j of joueurs.filter((x) => x.statut !== 'essai')) {
      const dernieres = mesures.filter((m) => m.membreId === j._id && m.semaine).map((m) => m.semaine).sort();
      const derniere = dernieres.at(-1);
      if (!derniere) alertes.push({ niveau: 'info', texte: `${nom(j)} n’a encore saisi aucun chiffre.`, lien: `#/progression/${j._id}` });
      else if (derniere < limite) alertes.push({ niveau: 'info', texte: `Aucun chiffre de ${nom(j)} depuis ${S.semainesSansChiffres} semaines.`, lien: `#/progression/${j._id}` });
    }
  }

  // 3. Trois défaites de suite (scrims et matchs confondus).
  const stats = statsScrims(scrims, def);
  if (stats.serie?.type === 'D' && stats.serie.longueur >= S.defaitesDeSuite) {
    alertes.push({ niveau: 'attention', texte: `${stats.serie.longueur} défaites de suite : prévoir une VOD collective et un débrief.`, lien: '#/scrims' });
  }

  // 4. Map du pool sans scrim depuis 3 semaines.
  if (def.aPool && meta?.mapPool?.length && scrims.length >= S.scrimsMin) {
    const limite = isoCivile(ajouterJours(civileDepuisIso(aujourdhui), -S.joursSansScrimMap));
    const tries = trierParDate(scrims, -1);
    for (const id of meta.mapPool) {
      const dernier = tries.find((s) => s.map === id);
      if (!dernier || dernier.date < limite) {
        const nomMap = meta.maps?.find((x) => x.id === id)?.nom || id;
        alertes.push({ niveau: 'info', texte: `Aucun scrim sur ${nomMap} depuis ${S.joursSansScrimMap / 7} semaines${dernier ? '' : ` (${mot(def, 'carte')} jamais jouée)`}.`, lien: `#/maps/${id}` });
      }
    }
  }

  // 5. Charge d'entraînement de la semaine : plafond d'heures planifiées et jours off (Réglages du jeu).
  alertes.push(...alertesCharge({ def, planning, membres, mesures, semaine: semaineCourante }));
  return alertes;
}
