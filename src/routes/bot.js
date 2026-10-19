// API du bot Discord de Lugh (Raspberry Pi). Authentification par la clé LUGH_CLE_BOT dans l'en-tête Authorization,
// jamais dans l'adresse ; pas de cookie, donc exemptée de l'en-tête X-Lugh (voir app.js). Le bot ne lit que ce qu'il
// lui faut : rôles attendus des comptes liés, rappels des prochaines heures, semaine et matchs d'une personne. Il
// n'écrit que trois choses : une liaison en attente (code à usage unique créé par la personne dans Lugh, qu'elle
// confirme ensuite dans Lugh), des absences, et le webhook Discord d'un jeu (ou des annonces) qui n'en a pas encore.

import { createHash, timingSafeEqual } from 'node:crypto';
import { envoyerJson, erreurs } from '../http/outils.js';
import { verifierQuota } from './donnees.js';
import { sauvegardeDuJeu } from '../domaine/restauration.js';
import { MOTIF_WEBHOOK } from '../notifications/discord.js';
import { nouvelId } from '../../shared/validation.js';
import { accesEspace, peut } from '../../shared/roles.js';
import { dateCivile, isoCivile, civileDepuisIso, ajouterJours } from '../../shared/temps.js';
import {
  lireParametresBot, ecrireEtatBot, rolesAttendus, rappelsAVenir, semaineDe, matchsDe, joursAbsence, empreinte, DUREE_ATTENTE_MS,
} from '../domaine/bot.js';

const MOTIF_DISCORD = /^\d{15,25}$/;
const MOTIF_CODE = /^[A-Z0-9]{6}$/;
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MOTIF_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ESSAIS_LIAISON = 5;
const FENETRE_LIAISON_MS = 15 * 60_000;

function egal(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

const texteCourt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function routesBot(routeur, s) {
  const essais = new Map(); // discordId → { n, debut } : codes de liaison faux

  const exigerBot = async (r) => {
    if (!s.config.cleBot) throw erreurs.indisponible('Bot Discord non configuré (LUGH_CLE_BOT).');
    const recu = String(r.req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!recu || !egal(recu, s.config.cleBot)) throw erreurs.interdit('Clé du bot invalide.');
  };

  const espacesActifs = () => s.registre.liste().filter((d) => d.actif !== false).map((d) => s.registre.obtenir(d._id)).filter(Boolean);

  async function compteLie(discordId) {
    if (!MOTIF_DISCORD.test(String(discordId || ''))) throw erreurs.requete('Identifiant Discord invalide.');
    const [c] = (await s.global.lister('comptes')).filter((x) => x.discord?.id === discordId);
    if (!c || c.actif === false) throw erreurs.introuvable('Compte Discord non lié à Lugh : dans l’appli, Mon compte → Discord → Obtenir un code, puis /lier.');
    return c;
  }

  // Jeux visés par une commande : celui demandé (id, nom ou nom court), sinon tous ceux du compte.
  function jeuxDuCompte(compte, demande) {
    const q = texteCourt(demande, 40).toLowerCase();
    // L'Administrateur général a accès à tout : ses jeux à lui (accès noté), sinon tous les jeux actifs.
    const tous = espacesActifs().filter((e) => accesEspace(compte, e.id));
    const siens = tous.filter((e) => compte.acces?.[e.id]?.metiers?.length || compte.acces?.[e.id]?.membreId);
    const liste = compte.admin && !siens.length ? tous : siens;
    if (!q) return liste;
    const trouves = liste.filter((e) => [e.id, e.def.nom, e.def.court].some((n) => String(n).toLowerCase() === q));
    if (!trouves.length) throw erreurs.introuvable(`Jeu « ${demande} » introuvable dans tes jeux.`);
    return trouves;
  }

  // ——— Synchronisation : le bot donne de ses nouvelles, Lugh répond avec tout ce qu'il doit appliquer ———
  routeur.post('/api/bot/synchro', exigerBot, async (r) => {
    const corps = (await r.corps(64 * 1024)) || {};
    const maintenant = s.maintenant();
    const { reglages, delies } = await lireParametresBot(s.global);
    const etat = {
      dernierContact: maintenant.toISOString(),
      version: texteCourt(corps.version, 20),
      serveur: { id: MOTIF_DISCORD.test(corps.serveur?.id || '') ? corps.serveur.id : '', nom: texteCourt(corps.serveur?.nom, 100) },
      problemes: (Array.isArray(corps.problemes) ? corps.problemes : []).slice(0, 20).map((p) => texteCourt(p, 200)).filter(Boolean),
      stats: Object.fromEntries(['membres', 'lies', 'ajoutes', 'retires'].map((k) => [k, Number.isInteger(corps.stats?.[k]) ? corps.stats[k] : null])),
      sauvegarde: /^\d{4}-\d{2}-\d{2}T/.test(corps.sauvegarde?.le || '')
        ? { le: corps.sauvegarde.le.slice(0, 30), jeux: Number.isInteger(corps.sauvegarde.jeux) ? corps.sauvegarde.jeux : 0, octets: Number.isInteger(corps.sauvegarde.octets) ? corps.sauvegarde.octets : 0 }
        : null,
    };
    await ecrireEtatBot(s.global, etat);

    const espaces = espacesActifs();
    const jeux = espaces.map((e) => ({ id: e.id, nom: e.def.nom, court: e.def.court }));
    const membres = (await s.global.lister('comptes'))
      .filter((c) => c.discord?.id)
      .map((c) => ({ discordId: c.discord.id, nom: c.nomAffiche, ...rolesAttendus(c, jeux) }));
    const rappels = await rappelsAVenir({ espaces, maintenant, fuseau: s.config.fuseau, reglages });
    // Webhooks qui manquent : le bot crée les salons des jeux et renvoie ces adresses (POST /api/bot/webhooks).
    // Un webhook retiré à la main n'est pas rebranché.
    const a = await s.annoncesDiscord.etat();
    const manquants = { jeux: [], annonces: !a.configure && !a.retire };
    for (const e of espaces) {
      const p = await e.notifications.reglagesPublics();
      if (!p.configure && !p.retire) manquants.jeux.push(e.id);
    }
    envoyerJson(r.res, 200, {
      maintenant: maintenant.toISOString(),
      reglages,
      jeux,
      membres,
      delies: delies.map((d) => d.id).filter((id) => !membres.some((m) => m.discordId === id)),
      rappels,
      discord: { manquants },
    });
  });

  // ——— Webhooks créés par le bot (salon #lugh-notifs de chaque jeu, #annonces) : enregistrés seulement là où il n'y en
  // a pas encore. Un webhook collé à la main n'est jamais remplacé. L'adresse n'est jamais renvoyée.
  routeur.post('/api/bot/webhooks', exigerBot, async (r) => {
    const corps = (await r.corps(32 * 1024)) || {};
    const jeux = corps.jeux ?? [];
    if (!Array.isArray(jeux) || (corps.annonces != null && typeof corps.annonces !== 'string')) throw erreurs.requete();
    const actifs = espacesActifs();
    const resultats = [];
    for (const w of jeux.slice(0, 50)) {
      const e = actifs.find((x) => x.id === w?.jeu);
      const jeu = texteCourt(w?.jeu, 40);
      if (!e) { resultats.push({ jeu, statut: 'introuvable' }); continue; }
      if (typeof w.url !== 'string' || !MOTIF_WEBHOOK.test(w.url)) { resultats.push({ jeu, statut: 'invalide' }); continue; }
      const actuel = await e.notifications.reglagesPublics();
      if (actuel.configure || actuel.retire) { resultats.push({ jeu, statut: actuel.configure ? 'deja' : 'retire' }); continue; }
      await e.notifications.enregistrer({ webhook: w.url, evenements: actuel.evenements });
      await e.depot.journaliser(null, 'notifications Discord branchées par le bot');
      resultats.push({ jeu, statut: 'enregistre' });
    }
    let annonces = null;
    if (corps.annonces) {
      if (!MOTIF_WEBHOOK.test(corps.annonces)) annonces = 'invalide';
      else if ((await s.annoncesDiscord.etat()).configure) annonces = 'deja';
      else if ((await s.annoncesDiscord.etat()).retire) annonces = 'retire';
      else {
        await s.annoncesDiscord.enregistrer({ webhook: corps.annonces });
        await s.historique.ecrire(null, 'webhook des annonces branché par le bot');
        annonces = 'enregistre';
      }
    }
    envoyerJson(r.res, 200, { jeux: resultats, annonces });
  });

  // ——— Liaison : la personne a obtenu un code dans Lugh (Mon compte), elle le tape avec /lier ———
  routeur.post('/api/bot/lier', exigerBot, async (r) => {
    const corps = (await r.corps()) || {};
    const discordId = String(corps.discordId || '');
    if (!MOTIF_DISCORD.test(discordId)) throw erreurs.requete('Identifiant Discord invalide.');
    const t = s.maintenant().getTime();
    for (const [id, x] of essais) if (t - x.debut >= FENETRE_LIAISON_MS) essais.delete(id);
    const e = essais.get(discordId);
    if (e && t - e.debut < FENETRE_LIAISON_MS && e.n >= ESSAIS_LIAISON) throw erreurs.tropDeRequetes('Trop de codes faux : réessaie dans 15 minutes avec un nouveau code.');
    const code = String(corps.code || '').trim().toUpperCase();
    const comptes = await s.global.lister('comptes');
    const cible = MOTIF_CODE.test(code)
      ? comptes.find((c) => c.actif !== false && c.discordCode?.empreinte === empreinte(code) && new Date(c.discordCode.expire).getTime() > t)
      : null;
    if (!cible) {
      essais.set(discordId, e && t - e.debut < FENETRE_LIAISON_MS ? { n: e.n + 1, debut: e.debut } : { n: 1, debut: t });
      throw erreurs.requete('Code inconnu ou expiré : demande-en un nouveau dans Lugh (Mon compte → Discord).');
    }
    const autre = comptes.find((c) => c._id !== cible._id && c.discord?.id === discordId);
    if (autre) throw erreurs.conflit('Ce compte Discord est déjà lié à un autre compte Lugh : délie-le d’abord.');
    essais.delete(discordId);
    // Le code peut avoir été vu par quelqu'un d'autre (écran partagé, stream) : la personne confirme dans Lugh
    // le pseudo Discord qui l'a tapé avant que la liaison ne compte.
    const pseudo = texteCourt(corps.pseudo, 40) || discordId;
    cible.discordAttente = { id: discordId, pseudo, expire: new Date(t + DUREE_ATTENTE_MS).toISOString() };
    delete cible.discordCode;
    await s.global.ecrire('comptes', cible);
    envoyerJson(r.res, 200, { aConfirmer: true, pseudo });
  });

  // ——— Sauvegarde hebdomadaire sur le Pi : l'export d'un jeu, le même que « Exporter » dans Gestion du jeu
  // (sans mot de passe ni webhook). Atlas gratuit n'en fait aucune : c'est la copie hors de Render et d'Atlas.
  routeur.post('/api/bot/sauvegarde', exigerBot, async (r) => {
    const { jeu } = (await r.corps()) || {};
    const e = typeof jeu === 'string' ? s.registre.obtenir(jeu) : null;
    if (!e) throw erreurs.introuvable('Jeu introuvable.');
    const sauvegarde = await sauvegardeDuJeu(s, e);
    await e.depot.journaliser(null, 'sauvegarde automatique (Raspberry Pi)');
    envoyerJson(r.res, 200, sauvegarde);
  });

  // ——— Commandes ———
  routeur.post('/api/bot/planning', exigerBot, async (r) => {
    const corps = (await r.corps()) || {};
    const compte = await compteLie(corps.discordId);
    const jeux = [];
    for (const e of jeuxDuCompte(compte, corps.jeu)) {
      const membreId = accesEspace(compte, e.id)?.membreId || '';
      jeux.push({ id: e.id, nom: e.def.nom, court: e.def.court, blocs: await semaineDe({ espace: e, membreId, maintenant: s.maintenant(), fuseau: s.config.fuseau }) });
    }
    envoyerJson(r.res, 200, { nom: compte.nomAffiche, jeux });
  });

  routeur.post('/api/bot/match', exigerBot, async (r) => {
    const corps = (await r.corps()) || {};
    const compte = await compteLie(corps.discordId);
    const jeux = [];
    for (const e of jeuxDuCompte(compte, corps.jeu)) {
      jeux.push({ id: e.id, nom: e.def.nom, court: e.def.court, ...(await matchsDe({ espace: e, maintenant: s.maintenant(), fuseau: s.config.fuseau })) });
    }
    envoyerJson(r.res, 200, { nom: compte.nomAffiche, jeux });
  });

  // Absence déclarée sur Discord : enregistrée dans chaque jeu visé où la personne a une fiche et le droit de déclarer
  // ses absences, exactement comme depuis l'appli (mêmes contrôles, même journal, mêmes notifications).
  routeur.post('/api/bot/absence', exigerBot, async (r) => {
    const corps = (await r.corps()) || {};
    const compte = await compteLie(corps.discordId);
    const du = String(corps.du || '');
    const au = corps.au ? String(corps.au) : '';
    if (!MOTIF_DATE.test(du) || (au && !MOTIF_DATE.test(au))) throw erreurs.requete('Date invalide.');
    if (au && au < du) throw erreurs.requete('La date de fin est avant la date de début.');
    const auj = civileDepuisIso(isoCivile(dateCivile(s.maintenant(), s.config.fuseau)));
    if (du < isoCivile(auj) || du > isoCivile(ajouterJours(auj, 120))) throw erreurs.requete('Une absence se déclare pour aujourd’hui ou les 4 prochains mois.');
    const debut = MOTIF_HEURE.test(corps.debut || '') ? corps.debut : '';
    const fin = MOTIF_HEURE.test(corps.fin || '') ? corps.fin : '';
    const raison = texteCourt(corps.motif, 120);
    const jours = joursAbsence(du, au);
    const creees = [];
    const ignorees = [];
    for (const e of jeuxDuCompte(compte, corps.jeu)) {
      const vue = { ...compte, ...accesEspace(compte, e.id) };
      if (!vue.membreId || !peut(vue, 'dispos.soi')) {
        ignorees.push({ jeu: e.def.nom, raison: vue.membreId ? 'pas le droit de déclarer une absence' : 'pas de fiche dans le roster' });
        continue;
      }
      if (!(await e.stockage.lire('membres', vue.membreId))) {
        ignorees.push({ jeu: e.def.nom, raison: 'fiche du roster introuvable' });
        continue;
      }
      // Déjà déclarée (même jour, mêmes heures) : rien n'est recréé, une commande répétée ne fait pas de doublon.
      const deja = await e.stockage.lister('absences', { membreId: vue.membreId });
      let n = 0;
      for (const date of jours) {
        if (deja.some((a) => a.date === date && (a.debut || '') === debut && (a.fin || '') === fin)) {
          n += 1;
          continue;
        }
        const v = e.schemas().validerDocument('absences', { membreId: vue.membreId, date, debut, fin, raison });
        if (!v.ok) throw erreurs.invalide(v.erreurs);
        await verifierQuota(e.stockage, 'absences', null);
        await e.depot.enregistrer('absences', nouvelId('a'), v.valeur, vue);
        n += 1;
      }
      creees.push({ jeu: e.def.nom, jours: n });
    }
    envoyerJson(r.res, 200, { nom: compte.nomAffiche, jours, creees, ignorees });
  });
}
