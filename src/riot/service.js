// Service Riot : liaison d'un compte Lugh à un compte Riot (opt-in par Riot Sign On), jetons chiffrés au repos,
// déliaison complète, cache des parties résumées. Base générale : collections « riot » et « riotParties ».
//   riot        { _id: compteId, puuid, nomRiot, lieLe, jetons (chiffré), synchroLe }  et  { _id: 'etat-<empreinte>', … }
//   riotParties { _id: '<compteId>_<matchId>', compteId, …résumé de resumerPartie, _expire }

import { createHash, randomBytes } from 'node:crypto';
import { creerCoffre } from '../auth/chiffrement.js';
import { creerClientRiot, ErreurRiot } from './client.js';
import { creerRso } from './rso.js';
import { nomsContenu, resumerPartie } from './agregats.js';
import { creerFauxRiot } from './faux-riot.js';

const DUREE_ETAT_MS = 10 * 60_000;
const ECART_SYNCHRO_MS = 10 * 60_000; // une synchro par joueur toutes les 10 minutes au plus
const DUREE_PARTIES_MS = 90 * 86_400_000; // parties gardées 90 jours, effacées tout de suite à la déliaison
const DUREE_CONTENU_MS = 86_400_000;
export const PARTIES_MAX = 20;

const empreinte = (x) => createHash('sha256').update(String(x)).digest('hex');

export function creerServiceRiot({ config, global, maintenant = () => new Date(), fetchImpl = null, journal = console }) {
  const c = config.riot;
  if (!c?.actif) return { actif: false, demo: false };
  const faux = c.demo && !fetchImpl ? creerFauxRiot() : null;
  const f = fetchImpl || faux || fetch;
  const coffre = creerCoffre(c.cleChiffrement);
  const client = creerClientRiot({ cle: c.cle, fetchImpl: f });
  const rso = creerRso({ config: c, fetchImpl: f, maintenant });
  let contenu = null;

  const lireJetons = (liaison) => {
    const clair = coffre.dechiffrer(liaison.jetons);
    try {
      return clair ? JSON.parse(clair) : null;
    } catch {
      return null;
    }
  };
  const chiffrerJetons = (jetons) => coffre.chiffrer(JSON.stringify(jetons));

  async function noms() {
    if (!contenu || maintenant() - contenu.le > DUREE_CONTENU_MS) {
      try {
        contenu = { le: maintenant(), noms: nomsContenu(await client.contenu()) };
      } catch (e) {
        if (!contenu) contenu = { le: 0, noms: nomsContenu(null) }; // noms tirés des chemins, nouvel essai plus tard
        journal.warn?.('[riot] contenu indisponible :', e.message);
      }
    }
    return contenu.noms;
  }

  async function delier(compteId) {
    const liaison = await global.lire('riot', compteId);
    if (liaison) {
      await rso.revoquer(lireJetons(liaison));
      await global.supprimer('riot', compteId);
    }
    await global.supprimerPlusieurs('riotParties', { compteId });
    return !!liaison;
  }

  return {
    actif: true,
    demo: c.demo,
    faux,

    async liaison(compteId) {
      const l = await global.lire('riot', compteId);
      return l?.puuid ? { nomRiot: l.nomRiot, lieLe: l.lieLe, synchroLe: l.synchroLe || null } : null;
    },

    // Début de l'opt-in : un « state » aléatoire, gardé en empreinte 10 minutes, lié au compte et au jeu.
    async commencer(compteId, jeu) {
      const state = randomBytes(24).toString('base64url');
      await global.ecrire('riot', { _id: `etat-${empreinte(state)}`, compteId, jeu, _expire: new Date(maintenant().getTime() + DUREE_ETAT_MS) });
      return rso.adresseAutorisation(state);
    },

    // Retour de Riot : state vérifié (même compte, pas expiré, usage unique), code échangé, compte identifié par /accounts/me.
    async terminer(compteId, state, code) {
      const id = `etat-${empreinte(state)}`;
      const etat = state ? await global.lire('riot', id) : null;
      if (etat) await global.supprimer('riot', id);
      if (!etat || etat.compteId !== compteId || new Date(etat._expire) <= maintenant()) throw new ErreurRiot(400, 'Lien de connexion Riot expiré ou invalide : recommence depuis Lugh.');
      // Le jeu d'où la personne est partie accompagne chaque erreur : on l'y ramène.
      if (!code) throw Object.assign(new ErreurRiot(403, 'Connexion Riot annulée : rien n’a été partagé.'), { jeu: etat.jeu });
      try {
        await this.enregistrer(compteId, String(code));
      } catch (e) {
        throw Object.assign(e, { jeu: etat.jeu });
      }
      return { jeu: etat.jeu };
    },

    async enregistrer(compteId, code) {
      const jetons = await rso.echangerCode(code);
      const compte = await client.compteConnecte(jetons.acces);
      if (!compte?.puuid) throw new ErreurRiot(503, 'Riot n’a pas renvoyé de compte.');
      const deja = (await global.lister('riot', { puuid: compte.puuid })).find((l) => l._id !== compteId);
      if (deja) {
        await rso.revoquer(jetons);
        throw new ErreurRiot(409, 'Ce compte Riot est déjà relié à un autre compte Lugh.', 0);
      }
      const ancienne = await global.lire('riot', compteId);
      if (ancienne && ancienne.puuid !== compte.puuid) await delier(compteId);
      await global.ecrire('riot', {
        _id: compteId,
        puuid: compte.puuid,
        nomRiot: `${compte.gameName || '?'}#${compte.tagLine || ''}`,
        lieLe: maintenant().toISOString(),
        jetons: chiffrerJetons(jetons),
        synchroLe: null,
      });
    },

    delier,

    // Récupère les dernières parties (au plus une fois toutes les 10 minutes). L'autorisation est rafraîchie
    // quand elle a expiré : si Riot la refuse, le joueur a retiré son accord, la liaison et ses données sont effacées.
    async synchroniser(compteId, { forcer = false } = {}) {
      const l = await global.lire('riot', compteId);
      if (!l?.puuid) return false;
      // « Actualiser » raccourcit l'écart à une minute, sans jamais le supprimer.
      if (l.synchroLe && maintenant() - new Date(l.synchroLe) < (forcer ? 60_000 : ECART_SYNCHRO_MS)) return false;
      let jetons = lireJetons(l);
      if (!jetons) throw new ErreurRiot(503, 'Jetons Riot illisibles : LUGH_CLE_RIOT a changé ? Délie puis relie ton compte.');
      if (new Date(jetons.expire) <= maintenant()) {
        try {
          jetons = await rso.rafraichir(jetons);
        } catch (e) {
          if (e.statut === 401) {
            await delier(compteId);
            throw new ErreurRiot(410, 'Ton accord Riot a été retiré : la liaison et tes données ont été supprimées.');
          }
          throw e;
        }
        await global.modifier('riot', compteId, { jetons: chiffrerJetons(jetons) });
      }
      const histo = await client.historique(l.puuid);
      const n = await noms();
      const recents = [...(histo?.history || [])].sort((a, b) => b.gameStartTimeMillis - a.gameStartTimeMillis).slice(0, PARTIES_MAX);
      const expire = new Date(maintenant().getTime() + DUREE_PARTIES_MS);
      for (const { matchId } of recents) {
        const id = `${compteId}_${matchId}`;
        if (await global.lire('riotParties', id)) continue;
        const resume = resumerPartie(await client.partie(matchId), l.puuid, n);
        if (resume) await global.ecrire('riotParties', { _id: id, compteId, ...resume, _expire: expire });
      }
      // La liaison a pu être supprimée pendant la synchro (déliaison) : rien n'est recréé.
      if (!(await global.modifier('riot', compteId, { synchroLe: maintenant().toISOString() }))) {
        await global.supprimerPlusieurs('riotParties', { compteId });
      }
      return true;
    },

    async parties(compteId) {
      const liste = await global.lister('riotParties', { compteId }, { tri: { debut: -1 }, limite: PARTIES_MAX * 3 });
      return liste.map(({ _id, _expire, compteId: _c, ...p }) => p);
    },
  };
}
