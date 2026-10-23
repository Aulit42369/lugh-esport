// Administration générale (Administrateur général) : jeux (activation depuis le catalogue, ajout d'un « Autre jeu »,
// suppression définitive d'un jeu désactivé), état du service et journal complet. Les comptes sont dans routes/comptes.js.

import { envoyerJson, erreurs, listeTransmise } from '../http/outils.js';
import { exigerConnexion, exigerAdmin } from '../auth/acces.js';
import { MODELES, ORDRE, ID_AUTRE, resumeModele } from '../../shared/jeux/index.js';
import { MOTIFS } from '../../shared/validation.js';
import { accesEspace } from '../../shared/roles.js';
import { MAX_ESPACES } from '../domaine/collections.js';
import { lireParametresBot, alerteSauvegarde } from '../domaine/bot.js';
import { estCouleurJeu } from '../../shared/couleurs.js';
import { PLAFONDS_MANUELS } from '../config.js';

// Identifiants interdits pour un « Autre jeu » : ils servent déjà d'adresses de pages (#/admin, #/planning…).
export const ID_RESERVES = new Set(['admin', 'jeux', 'compte', 'api', 'accueil', 'planning', 'presences', 'dispos', 'match', 'maps',
  'strats', 'bibliotheque', 'adversaires', 'tournois', 'meta', 'scrims', 'partenaires', 'vod', 'progression', 'programme', 'bilan',
  'roster', 'recrutement', 'gestion', 'reglages', 'structure', 'annonces', 'tresorerie']);

// Identifiant d'un « Autre jeu » tiré de son nom : « Marvel Rivals » → « marvelrivals ».
export function idDepuisNom(nom) {
  return String(nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20);
}

export function routesAdmin(routeur, s) {
  const admin = [exigerConnexion(s), exigerAdmin()];

  async function resumeJeux() {
    const comptes = await s.global.lister('comptes');
    return s.registre.liste().map((doc) => {
      const e = s.registre.obtenir(doc._id);
      return {
        id: doc._id,
        modele: doc.modele,
        nom: e?.def?.nom || doc.nom,
        court: e?.def?.court || doc.court,
        couleur: doc.couleur || '',
        actif: doc.actif !== false,
        ordre: doc.ordre ?? 99,
        creeLe: doc.creeLe || null,
        comptes: comptes.filter((c) => !c.admin && accesEspace(c, doc._id)).length,
      };
    });
  }

  routeur.get('/api/admin/jeux', ...admin, async (r) => {
    envoyerJson(r.res, 200, {
      catalogue: ORDRE.map((id) => resumeModele(MODELES[id])),
      jeux: await resumeJeux(),
      max: MAX_ESPACES,
    });
  });

  // Active un jeu du catalogue (ou le réactive), ou crée un « Autre jeu » avec son nom.
  routeur.post('/api/admin/jeux', ...admin, async (r) => {
    const { modele, nom = '', id: idPropose = '' } = await r.corps();
    if (typeof modele !== 'string' || !Object.hasOwn(MODELES, modele)) throw erreurs.requete('Modèle de jeu inconnu.');
    let id = modele;
    let nomJeu = '';
    let court = '';
    if (modele === ID_AUTRE) {
      nomJeu = typeof nom === 'string' ? nom.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
      if (nomJeu.length < 2) throw erreurs.invalide([{ chemin: 'nom', message: 'nom du jeu obligatoire (2 caractères au moins)' }]);
      id = typeof idPropose === 'string' && idPropose ? idPropose : idDepuisNom(nomJeu);
      if (!MOTIFS.jeu.test(id)) throw erreurs.invalide([{ chemin: 'id', message: 'identifiant : 2 à 20 minuscules ou chiffres' }]);
      if (ID_RESERVES.has(id)) throw erreurs.invalide([{ chemin: 'id', message: `« ${id} » est un mot réservé (page de l’application) : choisis un autre identifiant` }]);
      if (Object.hasOwn(MODELES, id)) throw erreurs.conflit(`« ${id} » est réservé au modèle ${MODELES[id].nom} : choisis ce modèle ou un autre identifiant.`);
      if (s.registre.obtenir(id)) throw erreurs.conflit('Un jeu existe déjà avec cet identifiant.');
      court = nomJeu.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'JEU';
    }
    const avant = s.registre.obtenir(id);
    const existait = !!avant;
    const etaitInactif = existait && avant.doc.actif === false;
    try {
      const e = await s.registre.creer({ modele, id, nom: nomJeu, court, compte: r.compteGlobal });
      if (etaitInactif) await s.historique.ecrire(r.compteGlobal, 'jeu réactivé', e.doc.nom, '', e.id);
      envoyerJson(r.res, existait ? 200 : 201, { jeu: { id: e.id, nom: e.def.nom, modele, couleur: e.doc.couleur, actif: true }, jeux: await resumeJeux() });
    } catch (err) {
      if (err.statut) throw err;
      throw erreurs.conflit(err.message);
    }
  });

  routeur.put('/api/admin/jeux/:id', ...admin, async (r) => {
    const e = s.registre.obtenir(r.params.id);
    if (!e) throw erreurs.introuvable('Jeu introuvable.');
    const corps = await r.corps();
    const champs = {};
    if (typeof corps.actif === 'boolean') champs.actif = corps.actif;
    if (typeof corps.nom === 'string' && corps.nom.trim()) champs.nom = corps.nom.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (typeof corps.court === 'string' && corps.court.trim()) champs.court = corps.court.trim().slice(0, 12);
    if (Number.isInteger(corps.ordre) && corps.ordre >= 0 && corps.ordre <= 99) champs.ordre = corps.ordre;
    if (typeof corps.couleur === 'string' && estCouleurJeu(corps.couleur)) champs.couleur = corps.couleur;
    await s.registre.modifier(e.id, champs);
    if ('actif' in champs) await s.historique.ecrire(r.compteGlobal, champs.actif ? 'jeu réactivé' : 'jeu désactivé', e.doc.nom, '', e.id);
    else await s.historique.ecrire(r.compteGlobal, 'jeu modifié', e.doc.nom, '', e.id);
    envoyerJson(r.res, 200, { jeux: await resumeJeux() });
  });

  // Suppression définitive d'un jeu désactivé, après avoir tapé son nom. Irréversible : seule une sauvegarde (export,
  // copie hebdomadaire du Pi) permet de le retrouver. Sont aussi retirés : les accès des comptes à ce jeu, son point
  // de restauration, et le jeu dans les annonces (une annonce qui ne visait que lui est supprimée, sinon elle
  // deviendrait une annonce pour tous les jeux). Le journal général garde la trace.
  routeur.post('/api/admin/jeux/:id/supprimer', ...admin, async (r) => {
    const e = s.registre.obtenir(r.params.id);
    if (!e) throw erreurs.introuvable('Jeu introuvable.');
    if (e.doc.actif !== false) throw erreurs.conflit('Désactive d’abord ce jeu, puis supprime-le.');
    const { confirmation } = (await r.corps()) || {};
    const nom = e.def?.nom || e.doc.nom;
    const norme = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
    if (norme(confirmation) !== norme(nom)) throw erreurs.invalide([{ chemin: 'confirmation', message: `tape exactement le nom du jeu : ${nom}` }]);

    const bilan = { acces: 0, sansJeu: 0, annoncesModifiees: 0, annoncesSupprimees: 0 };
    await s.registre.supprimer(e.id);
    for (const c of await s.global.lister('comptes')) {
      if (!c.acces || !Object.hasOwn(c.acces, e.id)) continue;
      delete c.acces[e.id];
      await s.global.ecrire('comptes', c);
      bilan.acces += 1;
      if (!c.admin && !Object.keys(c.acces).length) bilan.sansJeu += 1;
    }
    await s.global.supprimerPlusieurs('restaurations', { jeu: e.id });
    await s.global.supprimerPlusieurs('autorisations', { jeu: e.id });
    for (const a of await s.global.lister('annonces')) {
      if (!a.jeux?.includes(e.id)) continue;
      const reste = a.jeux.filter((j) => j !== e.id);
      if (reste.length) {
        await s.global.ecrire('annonces', { ...a, jeux: reste });
        bilan.annoncesModifiees += 1;
      } else {
        await s.global.supprimer('annonces', a._id);
        bilan.annoncesSupprimees += 1;
      }
    }
    await s.historique.ecrire(r.compteGlobal, 'jeu supprimé définitivement', nom, `${bilan.acces} accès retiré${bilan.acces > 1 ? 's' : ''}`);
    envoyerJson(r.res, 200, { bilan, jeux: await resumeJeux() });
  });

  routeur.get('/api/admin/journal', ...admin, async (r) => {
    envoyerJson(r.res, 200, { entrees: await s.historique.lister({ limite: 400 }) });
  });

  routeur.get('/api/admin/etat', ...admin, async (r) => {
    const jeux = [];
    for (const doc of s.registre.liste()) {
      const e = s.registre.obtenir(doc._id);
      const meta = await e.stockage.lire('meta', 'courante');
      jeux.push({
        id: e.id,
        nom: e.def.nom,
        actif: doc.actif !== false,
        metaAuto: e.def.meta.auto,
        meta: meta ? { patch: meta.patch, derniereVerif: meta.derniereVerif || '', statut: meta.statut || '', erreur: meta.erreur || '' } : null,
        couts: meta?.couts || {},
        discord: (await e.notifications.reglagesPublics()).configure,
      });
    }
    // Espace occupé dans Atlas (base générale + une base par jeu), à surveiller sous la limite de 512 Mo.
    let octets = 0;
    try {
      octets += await s.global.taille();
      for (const doc of s.registre.liste()) octets += await s.registre.obtenir(doc._id).stockage.taille();
    } catch {
      octets = null;
    }
    envoyerJson(r.res, 200, {
      espace: { mo: octets === null ? null : Math.round((octets / 1048576) * 10) / 10, limiteMo: 512 },
      version: s.config.version,
      stockage: s.fabrique.type,
      cleClaude: !!s.config.claude.cle,
      modele: s.config.claude.modele,
      cronConfigure: !!s.config.secretCron,
      // Réservé à l'Administrateur général : sa propre adresse, pour vérifier que Lugh lit la bonne (voir PIEGES).
      reseau: {
        ip: r.ip,
        transmis: String(r.req.headers['x-forwarded-for'] || '').slice(0, 300),
        elements: listeTransmise(r.req).length,
        derriereProxy: s.config.derriereProxy,
        sauts: s.config.proxySauts,
      },
      plafonds: PLAFONDS_MANUELS,
      veilleManuels: (await s.veille.etat()).couts?.[s.maintenant().toISOString().slice(0, 7)]?.manuels || 0,
      avertissements: [...s.config.avertissements, alerteSauvegarde((await lireParametresBot(s.global)).etat, s.maintenant(), s.config.cleBot)].filter(Boolean),
      jeux,
    });
  });
}
