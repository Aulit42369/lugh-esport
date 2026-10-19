// Charge d'entraînement, fonctions pures : qui est concerné par un bloc du planning, heures planifiées et jours
// sans séance de chaque joueur sur une semaine, alertes du moniteur de santé. Aucune donnée de santé : des heures
// planifiées, des jours off et le nombre de parties saisi par le joueur.

import { minutes, dureeLisible } from './temps.js';

const JOUEURS_SUIVIS = new Set(['titulaire', 'remplacant', 'essai']);

export const actif = (m) => m && m.statut !== 'ancien';

// Membres concernés par un bloc : toute l'équipe, les titulaires, chaque joueur de son côté, le staff ou un choix.
export function concerne(bloc, m) {
  if (!actif(m) || bloc.type === 'repos') return false;
  switch (bloc.pour) {
    case 'titulaires': return m.type === 'joueur' && m.statut === 'titulaire';
    case 'individuel': return m.type === 'joueur';
    case 'staff': return m.type === 'staff';
    case 'choix': return (bloc.membres || []).includes(m._id);
    default: return true;
  }
}

export function dureeBloc(b) {
  return Math.max(0, minutes(b.fin) - minutes(b.debut));
}

// Charge de chaque joueur suivi sur une semaine : minutes planifiées, jours avec au moins une séance, jours off,
// parties saisies, et les deux dépassements (plafond d'heures, jours off minimum).
export function chargeSemaine({ def, planning = null, membres = [], mesures = [], semaine }) {
  const { heuresMax, joursOffMin } = def.charge;
  const blocs = planning?.blocs || [];
  return membres
    .filter((m) => m.type === 'joueur' && JOUEURS_SUIVIS.has(m.statut))
    .map((m) => {
      const siens = blocs.filter((b) => concerne(b, m));
      const total = siens.reduce((s, b) => s + dureeBloc(b), 0);
      const jours = new Set(siens.map((b) => b.jour)).size;
      const mesure = mesures.find((x) => x.membreId === m._id && x.semaine === semaine);
      return {
        membreId: m._id,
        pseudo: m.pseudo || '',
        minutes: total,
        jours,
        joursOff: 7 - jours,
        parties: typeof mesure?.parties === 'number' ? mesure.parties : null,
        depasse: total > heuresMax * 60,
        sansRepos: 7 - jours < joursOffMin,
      };
    });
}

// Alertes de charge pour la semaine en cours (seulement si son planning existe).
export function alertesCharge({ def, planning = [], membres = [], mesures = [], semaine }) {
  const doc = planning.find((p) => p._id === semaine);
  if (!doc || !(doc.blocs || []).length) return [];
  const { heuresMax, joursOffMin } = def.charge;
  const alertes = [];
  for (const c of chargeSemaine({ def, planning: doc, membres, mesures, semaine })) {
    if (!c.pseudo) continue;
    if (c.depasse) {
      alertes.push({ niveau: 'attention', texte: `Charge de ${c.pseudo} : ${dureeLisible(c.minutes)} planifiées cette semaine (plafond ${heuresMax} h).`, lien: '#/presences' });
    }
    if (c.sansRepos) {
      alertes.push({
        niveau: 'attention',
        texte: c.joursOff === 0
          ? `${c.pseudo} n’a aucun jour off cette semaine.`
          : `${c.pseudo} n’a que ${c.joursOff} jour${c.joursOff > 1 ? 's' : ''} off cette semaine (${joursOffMin} au minimum).`,
        lien: '#/planning',
      });
    }
  }
  return alertes;
}
