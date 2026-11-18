// Automatismes d'un jeu, déclenchés par les visites de ce jeu (Render gratuit dort entre deux visites) :
// - méta : vérifiée à la première visite après chaque lundi et jeudi 7 h 45 (fuseau de la config : Paris), si elle est activée ;
// - planning : la semaine en cours est créée depuis la semaine type si personne ne l'a fait ;
// - recrutement : une candidature refusée est effacée (avec ses avis) 6 mois après le refus (RGPD : durée limitée).

import { semaineIso, dateCivile, isoCivile, instantCivil } from '../../shared/temps.js';
import { nouvelId } from '../../shared/validation.js';
import { ecartListesOfficielles } from '../../shared/listes-officielles.js';
import { idSuggestion } from '../../shared/alertes.js';
import { listesOfficielles } from '../meta/listes-officielles.js';

const JOURS_META = [1, 4]; // lundi, jeudi
const HEURE_META = '07:45';
const INTERVALLE_MS = 60_000;
const ATTENTE_APRES_ECHEC_MS = 3 * 3600_000;
const TENTATIVES_MAX = 3;
const LISTES_PERIODE_MS = 24 * 3600_000; // listes officielles : une fois par jour
export const DUREE_CANDIDAT_REFUSE_MS = 183 * 86_400_000; // 6 mois

// Candidatures refusées depuis plus de 6 mois (date de la dernière modification, donc du refus au plus tôt) :
// supprimées par le dépôt, pour que la suppression parte aussi vers les navigateurs, avec leurs avis.
export async function purgerCandidatsRefuses(depot, stockage, t) {
  const limite = t.getTime() - DUREE_CANDIDAT_REFUSE_MS;
  let n = 0;
  for (const c of await stockage.lister('candidats', { statut: 'refuse' })) {
    if (new Date(c.maj?.le || 0).getTime() > limite) continue;
    if (!(await depot.supprimer('candidats', c._id, null))) continue;
    for (const v of await stockage.lister('votes', { cible: c._id })) await depot.supprimer('votes', v._id, null);
    await depot.journaliser(null, 'suppression candidats (refusé depuis 6 mois)', c._id);
    n += 1;
  }
  return n;
}

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
  depot, stockage, config, actualisation, definition = () => null, maintenant = () => new Date(), journal = console, fetchListes = globalThis.fetch,
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

  // Valorant : compare les agents et cartes de la méta à la liste officielle (une fois par jour, au premier passage après le démarrage).
  // N'écrit que dans la liste « À traiter » (suggestion) : jamais dans la méta. Échec : réessai dans 3 h.
  async function listesAuto(t) {
    if (definition()?.id !== 'valorant') return;
    const etat = await stockage.lire('reglages', 'listes-officielles');
    const derniere = Math.max(new Date(etat?.derniereVerif || 0).getTime(), new Date(etat?.derniereTentative || 0).getTime() - LISTES_PERIODE_MS + ATTENTE_APRES_ECHEC_MS);
    if (t.getTime() - derniere < LISTES_PERIODE_MS) return;
    const base = { ...etat, _id: 'listes-officielles', derniereTentative: t.toISOString() };
    try {
      const meta = await stockage.lire('meta', 'courante');
      const ecart = ecartListesOfficielles(await listesOfficielles(fetchListes), meta);
      await stockage.ecrire('reglages', { ...base, derniereVerif: t.toISOString() });
      if (!meta || ecart.vide) return;
      const morceaux = [];
      if (ecart.agents.manquants.length) morceaux.push(`agents absents de la liste : ${ecart.agents.manquants.join(', ')}`);
      if (ecart.agents.enTrop.length) morceaux.push(`agents qui ne sont plus dans le jeu : ${ecart.agents.enTrop.join(', ')}`);
      if (ecart.cartes.manquants.length) morceaux.push(`cartes absentes de la liste : ${ecart.cartes.manquants.join(', ')}`);
      if (ecart.cartes.enTrop.length) morceaux.push(`cartes qui ne sont plus dans le jeu : ${ecart.cartes.enTrop.join(', ')}`);
      const noms = [...ecart.agents.manquants, ...ecart.agents.enTrop, ...ecart.cartes.manquants, ...ecart.cartes.enTrop];
      const id = idSuggestion(`liste-officielle-${noms.join('-')}`);
      if (await stockage.lire('suggestions', id)) return; // déjà signalé (traité ou ignoré) : pas de rappel
      await depot.enregistrer('suggestions', id, {
        cle: id, type: 'roster', titre: 'La liste officielle des agents ou cartes a changé',
        texte: `Selon valorant-api.com : ${morceaux.join(' ; ')}. Vérifie sur la page Méta et lance une actualisation (rien n'a été modifié).`,
        lien: '#/meta', statut: 'nouvelle', patch: meta.patch, creeLe: t.toISOString(),
      }, null);
    } catch (e) {
      await stockage.ecrire('reglages', base).catch(() => {});
      throw e;
    }
  }

  return {
    // Appelé à chaque requête de l'API vers ce jeu ; ne travaille qu'une fois par minute et ne bloque jamais la requête.
    verifier() {
      const t = maintenant();
      if (enCours || t.getTime() - dernierPassage < INTERVALLE_MS) return;
      dernierPassage = t.getTime();
      enCours = true;
      Promise.all([semaineAuto(t), metaAuto(t), purgerCandidatsRefuses(depot, stockage, t), listesAuto(t)])
        .catch((e) => journal.error?.('[automatismes]', e?.message || e))
        .finally(() => { enCours = false; });
    },
  };
}
