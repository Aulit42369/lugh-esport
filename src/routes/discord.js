// Discord côté personnes : lier son compte (code à usage unique, 10 minutes, puis confirmation du pseudo), délier ; côté Administrateur général :
// état du bot, réglages des rappels et des rôles, comptes liés. Le bot lui-même passe par routes/bot.js.

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, exigerAdmin, profilCompte } from '../auth/acces.js';
import {
  lireParametresBot, ecrireReglagesBot, normaliserReglages, nouveauCode, empreinte, noterDelie, DUREE_CODE_MS, DELAIS_RAPPEL,
} from '../domaine/bot.js';

export function routesDiscord(routeur, s) {
  const connecte = exigerConnexion(s);
  const admin = [exigerConnexion(s), exigerAdmin()];

  async function delier(compte, par) {
    if (!compte.discord?.id) return false;
    const { id, pseudo } = compte.discord;
    delete compte.discord;
    await s.global.ecrire('comptes', compte);
    await noterDelie(s.global, id, s.maintenant());
    await s.historique.ecrire(par, 'compte Discord délié', compte.identifiant, pseudo || id);
    return true;
  }

  // ——— Mon compte ———
  routeur.post('/api/moi/discord/code', connecte, async (r) => {
    if (!s.config.cleBot) throw erreurs.indisponible('Le bot Discord de la structure n’est pas encore installé.');
    const compte = r.compteGlobal;
    if (compte.discord?.id) throw erreurs.conflit('Ton compte est déjà lié à Discord : délie-le d’abord pour en lier un autre.');
    const code = nouveauCode();
    const expire = new Date(s.maintenant().getTime() + DUREE_CODE_MS).toISOString();
    compte.discordCode = { empreinte: empreinte(code), expire };
    await s.global.ecrire('comptes', compte);
    envoyerJson(r.res, 200, { code, expire });
  });

  // Confirmation de la liaison tapée sur Discord (avec le pseudo qui l'a tapée), ou refus.
  routeur.post('/api/moi/discord/confirmer', connecte, async (r) => {
    const compte = r.compteGlobal;
    const { accepter } = (await r.corps()) || {};
    if (typeof accepter !== 'boolean') throw erreurs.requete();
    const a = compte.discordAttente;
    if (!a || new Date(a.expire).getTime() <= s.maintenant().getTime()) {
      delete compte.discordAttente;
      await s.global.ecrire('comptes', compte);
      throw erreurs.introuvable('Aucune liaison en attente (ou elle a expiré) : obtiens un nouveau code.');
    }
    delete compte.discordAttente;
    if (!accepter) {
      await s.global.ecrire('comptes', compte);
      await s.historique.ecrire(compte, 'liaison Discord refusée', compte.identifiant, a.pseudo);
      return envoyerJson(r.res, 200, { compte: profilCompte(compte) });
    }
    const autre = (await s.global.lister('comptes')).find((c) => c._id !== compte._id && c.discord?.id === a.id);
    if (autre) {
      await s.global.ecrire('comptes', compte);
      throw erreurs.conflit('Ce compte Discord est déjà lié à un autre compte Lugh.');
    }
    compte.discord = { id: a.id, pseudo: a.pseudo, lieLe: s.maintenant().toISOString() };
    await s.global.ecrire('comptes', compte);
    await s.historique.ecrire(compte, 'compte Discord lié', compte.identifiant, a.pseudo);
    envoyerJson(r.res, 200, { compte: profilCompte(compte) });
  });

  routeur.delete('/api/moi/discord', connecte, async (r) => {
    envoyerJson(r.res, 200, { ok: await delier(r.compteGlobal, r.compteGlobal) });
  });

  // ——— Administration ———
  routeur.get('/api/admin/discord', ...admin, async (r) => {
    const { reglages, etat } = await lireParametresBot(s.global);
    const liaisons = (await s.global.lister('comptes', {}, { tri: { creeLe: 1 } }))
      .filter((c) => c.discord?.id)
      .map((c) => ({ compteId: c._id, identifiant: c.identifiant, nomAffiche: c.nomAffiche, actif: c.actif !== false, pseudo: c.discord.pseudo, lieLe: c.discord.lieLe }));
    // Jeux actifs et leur salon Discord : le bot branche lui-même le webhook des jeux qui n'en ont pas.
    const jeux = [];
    for (const d of s.registre.liste().filter((x) => x.actif !== false)) {
      const e = s.registre.obtenir(d._id);
      if (e) {
        const p = await e.notifications.reglagesPublics();
        jeux.push({ id: e.id, nom: e.def.nom, configure: p.configure, retire: p.retire });
      }
    }
    envoyerJson(r.res, 200, {
      configure: !!s.config.cleBot, reglages, etat, liaisons, delais: DELAIS_RAPPEL, annonces: await s.annoncesDiscord.etat(), jeux,
    });
  });

  // Webhook du salon #annonces : les annonces de la structure y sont reprises.
  routeur.put('/api/admin/discord/annonces', ...admin, async (r) => {
    const { webhook = '', supprimer = false } = (await r.corps()) || {};
    if (typeof webhook !== 'string') throw erreurs.requete();
    let etat;
    try {
      etat = await s.annoncesDiscord.enregistrer({ webhook: webhook.trim(), supprimer: supprimer === true });
    } catch (e) {
      throw erreurs.invalide([{ chemin: 'webhook', message: e.message }]);
    }
    await s.historique.ecrire(r.compteGlobal, supprimer === true ? 'webhook des annonces retiré' : 'webhook des annonces enregistré');
    envoyerJson(r.res, 200, { annonces: etat });
  });

  routeur.post('/api/admin/discord/annonces/test', ...admin, async (r) => {
    try {
      await s.annoncesDiscord.tester(r.compteGlobal);
    } catch (e) {
      throw erreurs.conflit(e.message);
    }
    envoyerJson(r.res, 200, { ok: true });
  });

  routeur.put('/api/admin/discord/reglages', ...admin, async (r) => {
    const corps = (await r.corps()) || {};
    if (typeof corps !== 'object' || (corps.rappels !== undefined && typeof corps.rappels !== 'object')) throw erreurs.requete();
    if (corps.rappels?.delai !== undefined && !DELAIS_RAPPEL.includes(corps.rappels.delai)) {
      throw erreurs.invalide([{ chemin: 'rappels.delai', message: `délai possible : ${DELAIS_RAPPEL.join(', ')} minutes` }]);
    }
    const booleens = ['actif', 'seances', 'scrims', 'matchs', 'tournois'];
    if (corps.roles !== undefined && typeof corps.roles !== 'boolean') throw erreurs.requete();
    if (booleens.some((k) => corps.rappels?.[k] !== undefined && typeof corps.rappels[k] !== 'boolean')) throw erreurs.requete();
    const reglages = normaliserReglages(corps);
    await ecrireReglagesBot(s.global, reglages);
    await s.historique.ecrire(r.compteGlobal, 'réglages du bot Discord modifiés', '', `rôles ${reglages.roles ? 'oui' : 'non'}, rappels ${reglages.rappels.actif ? `${reglages.rappels.delai} min` : 'non'}`);
    envoyerJson(r.res, 200, { reglages });
  });

  routeur.delete('/api/admin/comptes/:id/discord', ...admin, async (r) => {
    const cible = typeof r.params.id === 'string' ? await s.global.lire('comptes', r.params.id) : null;
    if (!cible) throw erreurs.introuvable('Compte introuvable.');
    envoyerJson(r.res, 200, { ok: await delier(cible, r.compteGlobal) });
  });
}
