// Automatismes d'un jeu, déclenchés par les visites de ce jeu (Render gratuit dort entre deux visites) :
// - méta : vérifiée à la première visite après chaque lundi et jeudi 7 h 45 (heure de Paris), si elle est activée ;
// - planning : la semaine en cours est créée depuis la semaine type si personne ne l'a fait.

import { semaineIso, dateCivile } from '../../shared/temps.js';
import { nouvelId } from '../../shared/validation.js';

const JOURS_META = [1, 4]; // lundi, jeudi
const HEURE_META = { h: 7, m: 45 };
const INTERVALLE_MS = 60_000;
const ATTENTE_APRES_ECHEC_MS = 3 * 3600_000;
const TENTATIVES_MAX = 3;

// Décalage de Paris par rapport à UTC (en minutes) à un instant donné.
function decalageParis(instant) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((local - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

export function instantParis(a, m, j, h, mi) {
  const naif = Date.UTC(a, m - 1, j, h, mi);
  return new Date(naif - decalageParis(new Date(naif)) * 60_000);
}

// Dernier créneau (lundi ou jeudi 7 h 45, heure de Paris) passé à l'instant donné.
export function creneauPrecedent(maintenant = new Date()) {
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(maintenant.getTime() - i * 86_400_000);
    const { a, m, j } = dateCivile(d, 'Europe/Paris');
    const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay() || 7;
    if (!JOURS_META.includes(jourSemaine)) continue;
    const creneau = instantParis(a, m, j, HEURE_META.h, HEURE_META.m);
    if (creneau <= maintenant) return creneau;
  }
  return null;
}

export function doitVerifierMeta(meta, maintenant = new Date()) {
  const creneau = creneauPrecedent(maintenant);
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
    await depot.enregistrer('planning', semaine, {
      blocs: modele.blocs.map((b) => ({ ...b, id: nouvelId('b') })),
      note: '',
      ebauche: modele.ebauche || '',
    }, null);
    await depot.journaliser(null, 'semaine créée depuis la semaine type', semaine);
  }

  async function metaAuto(t) {
    if (!config.claude.cle || actualisation.enCours || definition()?.meta?.auto === false) return;
    const meta = await stockage.lire('meta', 'courante');
    const creneau = doitVerifierMeta(meta, t);
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
