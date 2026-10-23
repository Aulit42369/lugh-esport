// Automatismes d'un jeu, déclenchés par les visites de ce jeu (Render gratuit dort entre deux visites) :
// - méta : vérifiée à la première visite après chaque lundi et jeudi 7 h 45 (fuseau de la config : Paris), si elle est activée ;
// - planning : la semaine en cours est créée depuis la semaine type si personne ne l'a fait.

import { semaineIso, dateCivile, isoCivile, instantCivil } from '../../shared/temps.js';
import { nouvelId } from '../../shared/validation.js';

const JOURS_META = [1, 4]; // lundi, jeudi
const HEURE_META = '07:45';
const INTERVALLE_MS = 60_000;
const ATTENTE_APRES_ECHEC_MS = 3 * 3600_000;
const TENTATIVES_MAX = 3;

// Dernier créneau (lundi ou jeudi 7 h 45, heure du fuseau de la config) passé à l'instant donné.
export function creneauPrecedent(maintenant, fuseau) {
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(maintenant.getTime() - i * 86_400_000);
    const { a, m, j } = dateCivile(d, fuseau);
    const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay() || 7;
    if (!JOURS_META.includes(jourSemaine)) continue;
    const creneau = instantCivil(isoCivile({ a, m, j }), HEURE_META, fuseau);
    if (creneau <= maintenant) return creneau;
  }
  return null;
}

export function doitVerifierMeta(meta, maintenant, fuseau) {
  const creneau = creneauPrecedent(maintenant, fuseau);
  if (!creneau) return null;
  if (meta?.derniereVerif && new Date(meta.derniereVerif) >= creneau) return null;
  const n = meta?.tentatives?.creneau === creneau.toISOString() ? meta.tentatives.n : 0;
  if (n >= TENTATIVES_MAX) return null;
  if (n > 0 && maintenant - new Date(meta.derniereTentative || 0) < ATTENTE_APRES_ECHEC_MS) return null;
  return creneau.toISOString();
}

export function creerAutomatismes({
  depot, stockage, config, actualisation, definition = () => null, maintenant = () => new Date(), journal = console,
}) {
  let dernierPassage = 0;
  let enCours = false;

  async function semaineAuto(t) {
    const semaine = semaineIso(dateCivile(t, config.fuseau));
    if (await stockage.lire('planning', semaine)) return;
    const modele = await stockage.lire('planning', 'modele');
    if (!modele?.blocs?.length) return;
    // Révision de base 0 : création seulement. Un coach qui a écrit la semaine entre-temps gagne (refus 409 ignoré).
    try {
      await depot.enregistrer('planning', semaine, {
        blocs: modele.blocs.map((b) => ({ ...b, id: nouvelId('b') })),
        note: '',
        ebauche: modele.ebauche || '',
      }, null, { revBase: 0 });
    } catch (e) {
      if (e?.statut === 409) return;
      throw e;
    }
    await depot.journaliser(null, 'semaine créée depuis la semaine type', semaine);
  }

  async function metaAuto(t) {
    if (!config.claude.cle || actualisation.enCours || definition()?.meta?.auto === false) return;
    const meta = await stockage.lire('meta', 'courante');
    const creneau = doitVerifierMeta(meta, t, config.fuseau);
    if (creneau) actualisation.lancer({ declencheur: 'automatique', creneau });
  }

  return {
    // Appelé à chaque requête de l'API vers ce jeu ; ne travaille qu'une fois par minute et ne bloque jamais la requête.
    verifier() {
      const t = maintenant();
      if (enCours || t.getTime() - dernierPassage < INTERVALLE_MS) return;
      dernierPassage = t.getTime();
      enCours = true;
      Promise.all([semaineAuto(t), metaAuto(t)])
        .catch((e) => journal.error?.('[automatismes]', e?.message || e))
        .finally(() => { enCours = false; });
    },
  };
}
