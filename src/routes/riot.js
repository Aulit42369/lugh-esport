// « Valorant · Stats de l'équipe » : liaison Riot (opt-in par Riot Sign On), déliaison, mes parties, tableau d'équipe.
// Sans les variables Riot, tout répond « inactif » et la page reste masquée. Jeux du modèle Valorant seulement.
// Interdits par Riot et absents ici : adversaires, MMR / ELO, temps réel, données d'un joueur qui n'a pas relié son compte.

import { envoyerJson, erreurs, ErreurHttp } from '../http/outils.js';
import { exigerConnexion, exigerEspace, exigerPerm } from '../auth/acces.js';
import { accesEspace } from '../../shared/roles.js';
import { ErreurRiot } from '../riot/client.js';
import { statsJoueur, statsEquipe } from '../riot/agregats.js';
import { AUTORISATION_DEMO } from '../riot/rso.js';

// Erreur Riot → réponse lisible ; un refus de la clé API ne dit rien de la clé.
function versHttp(e) {
  if (!(e instanceof ErreurRiot)) return e;
  if (e.statut === 401 || e.statut === 403) return new ErreurHttp(503, 'riot', 'Riot refuse l’accès pour l’instant. Réessaie plus tard.');
  return new ErreurHttp([400, 409, 410, 429].includes(e.statut) ? e.statut : 503, 'riot', e.message);
}

function redirection(res, cible) {
  res.writeHead(302, { Location: cible, 'Cache-Control': 'no-store' });
  res.end();
}

export function routesRiot(routeur, s) {
  const riot = s.riot;
  const valorant = async (r) => {
    if (r.espace.doc.modele !== 'valorant') throw erreurs.introuvable('Réservé aux jeux Valorant.');
  };
  const actif = async () => {
    if (!riot.actif) throw erreurs.indisponible('Stats Valorant : bientôt disponible.');
  };
  const espace = [exigerConnexion(s), exigerEspace(s), valorant];

  routeur.get('/api/e/:jeu/riot', ...espace, async (r) => {
    if (!riot.actif) return envoyerJson(r.res, 200, { actif: false });
    envoyerJson(r.res, 200, { actif: true, demo: riot.demo, liaison: await riot.liaison(r.compteGlobal._id) });
  });

  // Opt-in explicite : la case « J'accepte » est vérifiée ici aussi.
  routeur.post('/api/e/:jeu/riot/relier', ...espace, actif, async (r) => {
    const corps = await r.corps();
    if (corps.accord !== true) throw erreurs.requete('Coche la case pour accepter le partage de tes parties.');
    envoyerJson(r.res, 200, { url: await riot.commencer(r.compteGlobal._id, r.espace.id) });
  });

  // Retour de Riot Sign On (navigation du navigateur, cookie de session SameSite=Lax envoyé).
  routeur.get('/api/riot/retour', async (r) => {
    if (!riot.actif) return redirection(r.res, '/#/jeux');
    try {
      await exigerConnexion(s)(r);
    } catch {
      return redirection(r.res, '/');
    }
    const code = r.query.get('error') ? '' : r.query.get('code') || '';
    try {
      const { jeu } = await riot.terminer(r.compteGlobal._id, r.query.get('state') || '', code);
      await s.historique.ecrire(r.compteGlobal, 'compte Riot relié', '', '', jeu);
      redirection(r.res, `/#/${encodeURIComponent(jeu)}/riot/relie`);
    } catch (e) {
      if (!(e instanceof ErreurRiot)) s.journal.error?.('[riot] liaison :', e?.message);
      const motif = { 403: 'annule', 409: 'deja', 400: 'expire' }[e.statut] || 'erreur';
      redirection(r.res, e.jeu ? `/#/${encodeURIComponent(e.jeu)}/riot/${motif}` : '/#/jeux');
    }
  });

  // Démo seulement : imite la page d'autorisation de Riot (« Autoriser ») et renvoie au retour avec un faux code.
  if (riot.demo) {
    routeur.get(AUTORISATION_DEMO, exigerConnexion(s), async (r) => {
      if (r.query.get('redirect_uri') !== s.config.riot.redirectUri) throw erreurs.requete('Adresse de retour inconnue.');
      const p = new URLSearchParams({ code: `demo-${r.compteGlobal.identifiant}`, state: r.query.get('state') || '' });
      redirection(r.res, `${s.config.riot.redirectUri}?${p}`);
    });
  }

  routeur.delete('/api/e/:jeu/riot', ...espace, actif, async (r) => {
    if (await riot.delier(r.compteGlobal._id)) await s.historique.ecrire(r.compteGlobal, 'compte Riot délié', '', '', r.espace.id);
    envoyerJson(r.res, 200, { ok: true });
  });

  // Mes parties : synchro au plus toutes les 10 minutes ; si Riot ne répond pas, le cache s'affiche avec un avertissement.
  routeur.get('/api/e/:jeu/riot/parties', ...espace, actif, async (r) => {
    const id = r.compteGlobal._id;
    let avertissement = '';
    try {
      await riot.synchroniser(id, { forcer: r.query.get('actualiser') === '1' });
    } catch (e) {
      if (!(e instanceof ErreurRiot) || e.statut === 410) throw versHttp(e);
      avertissement = versHttp(e).message;
    }
    const liaison = await riot.liaison(id);
    if (!liaison) throw erreurs.introuvable('Aucun compte Riot relié.');
    const parties = await riot.parties(id);
    envoyerJson(r.res, 200, { liaison, parties, stats: statsJoueur(parties), avertissement });
  });

  // Tableau « Équipe » (staff) : uniquement les comptes de ce jeu qui ont eux-mêmes relié leur compte Riot.
  routeur.get('/api/e/:jeu/riot/equipe', ...espace, actif, exigerPerm('objectifs.fixer'), async (r) => {
    const joueurs = [];
    let avertissement = '';
    for (const c of await s.global.lister('comptes')) {
      if (c.actif === false || !accesEspace(c, r.espace.id)) continue;
      const liaison = await riot.liaison(c._id);
      if (!liaison) continue;
      try {
        await riot.synchroniser(c._id);
      } catch (e) {
        if (!(e instanceof ErreurRiot)) throw e;
        if (e.statut === 410) continue; // accord retiré chez Riot : liaison déjà effacée
        avertissement = versHttp(e).message;
      }
      joueurs.push({ nom: c.nomAffiche, nomRiot: liaison.nomRiot, parties: await riot.parties(c._id) });
    }
    envoyerJson(r.res, 200, { ...statsEquipe(joueurs), avertissement });
  });
}
