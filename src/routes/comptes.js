// Comptes : un compte par personne, des accès par jeu (métiers et membre lié dans chaque jeu).
// - Administrateur général (/api/admin/comptes) : tous les comptes, tous les jeux, et ce rôle lui-même.
// - Responsable d'un jeu (/api/e/:jeu/comptes) : les comptes de son jeu. Il ne change jamais le mot de passe, le nom
//   ou l'activation d'un compte qui a accès à un jeu qu'il ne gère pas (sinon il pourrait entrer dans cet autre jeu).

import { envoyerJson, erreurs, ErreurHttp } from '../http/outils.js';
import { hacherMdp, genererMdpTemporaire, verifierMdp } from '../auth/mdp.js';
import { exigerConnexion, exigerAdmin, exigerEspace, exigerPerm, profilCompte, profilCompteJeu, modifierCompte, cookieEfface } from '../auth/acces.js';
import { valider, nouvelId } from '../../shared/validation.js';
import { creationCompte, creationCompteJeu, modificationCompte, modificationCompteJeu } from '../../shared/schemas-comptes.js';
import { estMetier, ordonnerMetiers, jeuxDuCompte, estResponsable, accesEspace } from '../../shared/roles.js';
import { MAX_COMPTES } from '../domaine/collections.js';
import { noterDelie } from '../domaine/bot.js';

function metiersValides(metiers) {
  const uniques = [...new Set(metiers)];
  const inconnus = uniques.filter((m) => !estMetier(m));
  if (inconnus.length) throw erreurs.invalide([{ chemin: 'metiers', message: `métier inconnu : ${inconnus.join(', ')}` }]);
  return ordonnerMetiers(uniques);
}

// Un compte est « gérable » par un Responsable s'il n'a accès qu'à des jeux que ce Responsable gère.
// Accès à un jeu, compte désactivé compris : un Responsable doit pouvoir voir et réactiver un compte de son jeu.
const aAccesAuJeu = (c, jeu) => !!c && !!accesEspace({ ...c, actif: true }, jeu);

export function gerable(par, cible) {
  if (par.admin) return true;
  // Un compte Trésorier tient l'argent de l'association : seul l'Administrateur général y touche.
  if (cible.admin || cible.tresorier) return false;
  return jeuxDuCompte(cible).every((jeu) => estResponsable(par, jeu));
}

// Message d'un refus : un compte Trésorier n'est géré que par l'Administrateur général, quels que soient ses jeux.
const refus = (cible, sinon) => erreurs.interdit(cible.tresorier ? 'Compte Trésorier : seul l’Administrateur général peut le modifier, réinitialiser son mot de passe ou le supprimer.' : sinon);

export function routesComptes(routeur, s) {
  const admin = [exigerConnexion(s), exigerAdmin()];
  const responsable = [exigerConnexion(s), exigerEspace(s), exigerPerm('comptes.gerer')];
  const maintenantIso = () => s.maintenant().toISOString();
  const journaliser = (compte, action, cible = '', details = '', jeu = '') => s.historique.ecrire(compte, action, cible, details, jeu);

  async function lire(id) {
    const c = typeof id === 'string' ? await s.global.lire('comptes', id) : null;
    if (!c) throw erreurs.introuvable('Compte introuvable.');
    return c;
  }

  async function verifierAutreAdmin(saufId) {
    const actifs = await s.global.lister('comptes', { actif: true });
    if (!actifs.some((c) => c._id !== saufId && c.admin)) throw erreurs.conflit('Il doit rester au moins un Administrateur général actif.');
  }

  // Compte, liaison Discord (rôles retirés par le bot), liaison Riot et sessions : effacés ensemble.
  async function effacerCompte(cible) {
    await s.global.supprimer('comptes', cible._id);
    if (cible.discord?.id) await noterDelie(s.global, cible.discord.id, s.maintenant());
    await s.riot.delier?.(cible._id); // liaison Riot, jetons et parties : effacés avec le compte
    await s.sessions.supprimerPourCompte(cible._id);
  }

  // Le membre lié doit exister dans ce jeu et n'être lié à aucun autre compte dans ce jeu.
  async function verifierMembreLibre(jeu, membreId, saufCompteId) {
    if (!membreId) return;
    const espace = s.registre.obtenir(jeu);
    if (!espace || !(await espace.stockage.lire('membres', membreId))) throw erreurs.invalide([{ chemin: 'membreId', message: 'membre introuvable dans ce jeu' }]);
    const lies = (await s.global.lister('comptes')).filter((c) => c._id !== saufCompteId && c.acces?.[jeu]?.membreId === membreId);
    if (lies.length) throw erreurs.conflit('Ce membre est déjà lié à un autre compte dans ce jeu.');
  }

  // Entrées vides (ni métier ni membre) retirées ; jeux inconnus refusés ; membre libre vérifié dans chaque jeu.
  async function nettoyerAcces(acces, compteId) {
    const propre = {};
    for (const [jeu, a] of Object.entries(acces || {})) {
      if (!s.registre.obtenir(jeu)) throw erreurs.invalide([{ chemin: `acces.${jeu}`, message: 'jeu inconnu' }]);
      if (!a.metiers.length && !a.membreId) continue;
      await verifierMembreLibre(jeu, a.membreId, compteId);
      propre[jeu] = { metiers: metiersValides(a.metiers), membreId: a.membreId || '' };
    }
    return propre;
  }

  async function creer({ identifiant, nomAffiche, admin: estAdmin = false, tresorier = false, acces }, par) {
    if ((await s.global.compter('comptes')) >= MAX_COMPTES) throw erreurs.conflit('Nombre maximal de comptes atteint.');
    if ((await s.global.lister('comptes', { identifiant })).length) throw erreurs.conflit('Cet identifiant est déjà pris.');
    const mdpTemporaire = genererMdpTemporaire();
    const compte = {
      _id: nouvelId('c'),
      identifiant,
      nomAffiche,
      admin: !!estAdmin,
      tresorier: !!tresorier,
      acces,
      actif: true,
      doitChangerMdp: true,
      hash: await hacherMdp(mdpTemporaire),
      creeLe: maintenantIso(),
      creePar: par._id,
      derniereConnexion: null,
    };
    await s.global.ecrire('comptes', compte);
    return { compte, mdpTemporaire };
  }

  async function reinitialiserMdp(cible) {
    const mdpTemporaire = genererMdpTemporaire();
    cible.hash = await hacherMdp(mdpTemporaire);
    cible.doitChangerMdp = true;
    await modifierCompte(s, cible._id, { hash: cible.hash, doitChangerMdp: true });
    await s.sessions.supprimerPourCompte(cible._id);
    return mdpTemporaire;
  }

  // ——— Administrateur général ———

  routeur.get('/api/admin/comptes', ...admin, async (r) => {
    const comptes = await s.global.lister('comptes', {}, { tri: { creeLe: 1 } });
    envoyerJson(r.res, 200, { comptes: comptes.map(profilCompte) });
  });

  routeur.post('/api/admin/comptes', ...admin, async (r) => {
    const v = valider(creationCompte, await r.corps());
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const acces = await nettoyerAcces(v.valeur.acces, null);
    const { compte, mdpTemporaire } = await creer({ ...v.valeur, acces }, r.compteGlobal);
    await journaliser(r.compteGlobal, 'compte créé', compte.identifiant, [compte.admin ? 'Administrateur général' : '', ...Object.keys(acces)].filter(Boolean).join(', '));
    envoyerJson(r.res, 201, { compte: profilCompte(compte), mdpTemporaire });
  });

  // Corps lu AVANT la fiche (partout où la fiche est réécrite) : l'attente du corps est choisie par le client.
  routeur.put('/api/admin/comptes/:id', ...admin, async (r) => {
    const v = valider(modificationCompte, await r.corps());
    const cible = await lire(r.params.id);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const { nomAffiche, actif, admin: estAdmin, tresorier } = v.valeur;
    const soi = cible._id === r.compteGlobal._id;
    if (soi && (!estAdmin || !actif)) throw erreurs.conflit('Tu ne peux pas retirer ton propre rôle d’Administrateur général ni désactiver ton compte.');
    if (cible.admin && cible.actif !== false && (!estAdmin || !actif)) await verifierAutreAdmin(cible._id);
    const acces = await nettoyerAcces(v.valeur.acces, cible._id);
    const desactive = cible.actif !== false && !actif;
    Object.assign(cible, { nomAffiche, actif, admin: estAdmin, tresorier, acces });
    await modifierCompte(s, cible._id, { nomAffiche, actif, admin: estAdmin, tresorier, acces });
    if (desactive) await s.sessions.supprimerPourCompte(cible._id);
    await journaliser(r.compteGlobal, desactive ? 'compte désactivé' : 'compte modifié', cible.identifiant, [estAdmin ? 'Administrateur général' : '', ...Object.keys(acces)].filter(Boolean).join(', '));
    envoyerJson(r.res, 200, { compte: profilCompte(cible) });
  });

  routeur.post('/api/admin/comptes/:id/mdp', ...admin, async (r) => {
    const cible = await lire(r.params.id);
    if (cible._id === r.compteGlobal._id) throw erreurs.conflit('Change ton propre mot de passe depuis « Mon compte ».');
    const mdpTemporaire = await reinitialiserMdp(cible);
    await journaliser(r.compteGlobal, 'mot de passe réinitialisé', cible.identifiant);
    envoyerJson(r.res, 200, { compte: profilCompte(cible), mdpTemporaire });
  });

  routeur.delete('/api/admin/comptes/:id', ...admin, async (r) => {
    const cible = await lire(r.params.id);
    if (cible._id === r.compteGlobal._id) throw erreurs.conflit('Tu ne peux pas supprimer ton propre compte.');
    if (cible.admin && cible.actif !== false) await verifierAutreAdmin(cible._id);
    await effacerCompte(cible);
    await journaliser(r.compteGlobal, 'compte supprimé', cible.identifiant);
    envoyerJson(r.res, 200, { ok: true });
  });

  // ——— Mon compte : chacun peut supprimer le sien (droit à l'effacement), mot de passe exigé ———
  routeur.post('/api/moi/supprimer', exigerConnexion(s), (r) => s.limiteurConnexion.exclusif(`mdp:${r.compte._id}`, async () => {
    const cle = [`mdp:${r.compte._id}`];
    const attente = s.limiteurConnexion.attente(cle);
    if (attente) throw erreurs.tropDeRequetes(`Trop d’essais. Réessaie dans ${Math.ceil(attente / 60_000)} min.`);
    const { mdp } = await r.corps();
    const cible = await lire(r.compte._id);
    if (cible.admin) throw erreurs.conflit('Un Administrateur général ne supprime pas son propre compte : demande-le à un autre Administrateur général.');
    if (typeof mdp !== 'string' || !(await verifierMdp(mdp, cible.hash))) {
      s.limiteurConnexion.echec(cle);
      throw new ErreurHttp(400, 'ancien_mdp', 'Mot de passe incorrect.');
    }
    s.limiteurConnexion.reussite(cle);
    await effacerCompte(cible);
    await journaliser(null, 'compte supprimé par son titulaire', cible.identifiant);
    envoyerJson(r.res, 200, { ok: true }, { 'Set-Cookie': cookieEfface(s.config) });
  }));

  // ——— Responsable d'un jeu ———

  routeur.get('/api/e/:jeu/comptes', ...responsable, async (r) => {
    const jeu = r.espace.id;
    const comptes = (await s.global.lister('comptes', {}, { tri: { creeLe: 1 } })).filter((c) => aAccesAuJeu(c, jeu));
    envoyerJson(r.res, 200, { comptes: comptes.map((c) => profilCompteJeu(c, jeu, gerable(r.compteGlobal, c))) });
  });

  // Nouveau compte, ou accès à ce jeu pour une personne qui a déjà un compte (« existant »).
  routeur.post('/api/e/:jeu/comptes', ...responsable, async (r) => {
    const jeu = r.espace.id;
    const corps = await r.corps();
    const v = valider(creationCompteJeu, corps);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const metiers = metiersValides(v.valeur.metiers);
    await verifierMembreLibre(jeu, v.valeur.membreId, null);
    const [existant] = await s.global.lister('comptes', { identifiant: v.valeur.identifiant });
    if (existant) {
      if (corps.existant !== true) throw erreurs.conflit('Cet identifiant est déjà pris. Si cette personne a déjà un compte pour un autre jeu, coche « Compte existant ».');
      if (aAccesAuJeu(existant, jeu)) throw erreurs.conflit('Ce compte a déjà accès à ce jeu.');
      if ((existant.admin || existant.tresorier) && !r.compteGlobal.admin) throw erreurs.interdit('Seul l’Administrateur général donne un accès de jeu à ce compte.');
      // Un compte sans aucun jeu (ancien membre, compte désactivé) ne relève d'aucun Responsable : lui donner ce jeu
      // le rendrait « gérable » (mot de passe, activation, suppression). Seul l'Administrateur général le rattache.
      if (!jeuxDuCompte(existant).length && !r.compteGlobal.admin) throw erreurs.interdit('Ce compte n’a accès à aucun jeu : seul l’Administrateur général peut lui redonner un accès.');
      existant.acces = { ...(existant.acces || {}), [jeu]: { metiers, membreId: v.valeur.membreId } };
      await modifierCompte(s, existant._id, { [`acces.${jeu}`]: existant.acces[jeu] });
      await journaliser(r.compteGlobal, 'accès ajouté', existant.identifiant, metiers.join(', '), jeu);
      return envoyerJson(r.res, 200, { compte: profilCompteJeu(existant, jeu, gerable(r.compteGlobal, existant)) });
    }
    if (corps.existant === true) throw erreurs.introuvable('Aucun compte avec cet identifiant.');
    if (!v.valeur.nomAffiche) throw erreurs.invalide([{ chemin: 'nomAffiche', message: 'nom affiché obligatoire' }]);
    const { compte, mdpTemporaire } = await creer({
      identifiant: v.valeur.identifiant, nomAffiche: v.valeur.nomAffiche, acces: { [jeu]: { metiers, membreId: v.valeur.membreId } },
    }, r.compteGlobal);
    await journaliser(r.compteGlobal, 'compte créé', compte.identifiant, metiers.join(', '), jeu);
    envoyerJson(r.res, 201, { compte: profilCompteJeu(compte, jeu, true), mdpTemporaire });
  });

  async function cibleDuJeu(r) {
    const cible = await lire(r.params.id);
    if (!aAccesAuJeu(cible, r.espace.id)) throw erreurs.introuvable('Compte introuvable.');
    if (cible.admin && !r.compteGlobal.admin) throw erreurs.interdit('Seul un Administrateur général modifie un Administrateur général.');
    return cible;
  }

  routeur.put('/api/e/:jeu/comptes/:id', ...responsable, async (r) => {
    const jeu = r.espace.id;
    const v = valider(modificationCompteJeu, await r.corps());
    const cible = await cibleDuJeu(r);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const metiers = metiersValides(v.valeur.metiers);
    const soi = cible._id === r.compteGlobal._id;
    if (soi && !r.compteGlobal.admin && !metiers.includes('responsable')) throw erreurs.conflit('Tu ne peux pas retirer ton propre rôle de Responsable.');
    await verifierMembreLibre(jeu, v.valeur.membreId, cible._id);
    const changeNom = v.valeur.nomAffiche && v.valeur.nomAffiche !== cible.nomAffiche;
    const changeActif = v.valeur.actif !== (cible.actif !== false);
    if ((changeNom || changeActif) && !gerable(r.compteGlobal, cible)) {
      throw refus(cible, 'Ce compte a aussi accès à d’autres jeux : seul l’Administrateur général peut changer son nom ou le désactiver.');
    }
    if (soi && changeActif) throw erreurs.conflit('Tu ne peux pas désactiver ton propre compte.');
    // Un Administrateur général est Responsable partout : seuls ses autres métiers et son membre lié sont notés.
    const propres = cible.admin ? metiers.filter((m) => m !== 'responsable') : metiers;
    cible.acces = { ...(cible.acces || {}), [jeu]: { metiers: propres, membreId: v.valeur.membreId } };
    if (changeNom) cible.nomAffiche = v.valeur.nomAffiche;
    const desactive = changeActif && !v.valeur.actif;
    if (changeActif) cible.actif = v.valeur.actif;
    await modifierCompte(s, cible._id, {
      [`acces.${jeu}`]: cible.acces[jeu], ...(changeNom ? { nomAffiche: cible.nomAffiche } : {}), ...(changeActif ? { actif: cible.actif } : {}),
    });
    if (desactive) await s.sessions.supprimerPourCompte(cible._id);
    await journaliser(r.compteGlobal, desactive ? 'compte désactivé' : 'compte modifié', cible.identifiant, metiers.join(', '), jeu);
    envoyerJson(r.res, 200, { compte: profilCompteJeu(cible, jeu, gerable(r.compteGlobal, cible)) });
  });

  routeur.post('/api/e/:jeu/comptes/:id/mdp', ...responsable, async (r) => {
    const cible = await cibleDuJeu(r);
    if (cible._id === r.compteGlobal._id) throw erreurs.conflit('Change ton propre mot de passe depuis « Mon compte ».');
    if (!gerable(r.compteGlobal, cible)) throw refus(cible, 'Ce compte a aussi accès à d’autres jeux : seul l’Administrateur général peut réinitialiser son mot de passe.');
    const mdpTemporaire = await reinitialiserMdp(cible);
    await journaliser(r.compteGlobal, 'mot de passe réinitialisé', cible.identifiant, '', r.espace.id);
    envoyerJson(r.res, 200, { compte: profilCompteJeu(cible, r.espace.id, true), mdpTemporaire });
  });

  // Retire l'accès à ce jeu (le compte reste, avec ses autres jeux).
  routeur.delete('/api/e/:jeu/comptes/:id/acces', ...responsable, async (r) => {
    const jeu = r.espace.id;
    const cible = await cibleDuJeu(r);
    if (cible._id === r.compteGlobal._id) throw erreurs.conflit('Tu ne peux pas retirer ton propre accès.');
    if (cible.admin) throw erreurs.conflit('Un Administrateur général a accès à tous les jeux.');
    const { [jeu]: retire, ...reste } = cible.acces || {};
    cible.acces = reste;
    await modifierCompte(s, cible._id, { acces: reste });
    await journaliser(r.compteGlobal, 'accès retiré', cible.identifiant, '', jeu);
    envoyerJson(r.res, 200, { ok: true });
  });

  // Supprime le compte entier : seulement s'il n'a accès qu'à des jeux gérés par ce Responsable.
  routeur.delete('/api/e/:jeu/comptes/:id', ...responsable, async (r) => {
    const cible = await cibleDuJeu(r);
    if (cible._id === r.compteGlobal._id) throw erreurs.conflit('Tu ne peux pas supprimer ton propre compte.');
    if (!gerable(r.compteGlobal, cible)) throw refus(cible, 'Ce compte a aussi accès à d’autres jeux : retire seulement son accès à ce jeu.');
    if (cible.admin) await verifierAutreAdmin(cible._id);
    await effacerCompte(cible);
    await journaliser(r.compteGlobal, 'compte supprimé', cible.identifiant, '', r.espace.id);
    envoyerJson(r.res, 200, { ok: true });
  });
}
