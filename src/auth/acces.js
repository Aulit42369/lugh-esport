// Contrôle d'accès des routes : session obligatoire, accès à un espace de jeu, permission par métier,
// projection des comptes (jamais le mot de passe haché).

import { lireCookies, serialiserCookie, erreurs } from '../http/outils.js';
import { NOM_COOKIE, DUREE_SESSION_MS } from './sessions.js';
import { peut, accesEspace, ordonnerMetiers } from '../../shared/roles.js';
import { soumisA2fa } from '../domaine/parametres.js';

function accesPropres(c) {
  return Object.fromEntries(Object.entries(c.acces || {})
    .filter(([, a]) => a?.metiers?.length || a?.membreId)
    .map(([jeu, a]) => [jeu, { metiers: ordonnerMetiers(a.metiers), membreId: a.membreId || '' }]));
}

// Ce qu'un compte voit de lui-même, et ce que l'Administrateur général voit de chaque compte.
export function profilCompte(c) {
  return {
    _id: c._id,
    identifiant: c.identifiant,
    nomAffiche: c.nomAffiche,
    admin: !!c.admin,
    acces: accesPropres(c),
    actif: c.actif !== false,
    doitChangerMdp: !!c.doitChangerMdp,
    creeLe: c.creeLe || null,
    derniereConnexion: c.derniereConnexion || null,
    deuxFacteurs: etatDeuxFacteurs(c),
    discord: c.discord?.id ? { pseudo: c.discord.pseudo || '', lieLe: c.discord.lieLe || null } : null,
    discordAttente: c.discordAttente?.id ? { pseudo: c.discordAttente.pseudo || '', expire: c.discordAttente.expire } : null,
  };
}

// Ce qu'on montre de la double authentification d'un compte : jamais la clé ni les codes.
export function etatDeuxFacteurs(c) {
  return c.deuxFacteurs
    ? { actif: true, depuis: c.deuxFacteurs.depuis || null, codesRestants: (c.deuxFacteurs.secours || []).length }
    : { actif: false, depuis: null, codesRestants: 0 };
}

// Ce qu'un Responsable voit d'un compte de son jeu : l'accès à ce jeu seulement, et s'il peut gérer le compte.
export function profilCompteJeu(c, jeu, gerable) {
  const a = accesEspace(c, jeu);
  return {
    _id: c._id,
    identifiant: c.identifiant,
    nomAffiche: c.nomAffiche,
    admin: !!c.admin,
    metiers: a?.metiers || [],
    membreId: a?.membreId || '',
    actif: c.actif !== false,
    doitChangerMdp: !!c.doitChangerMdp,
    derniereConnexion: c.derniereConnexion || null,
    deuxFacteurs: !!c.deuxFacteurs,
    gerable,
  };
}

// Ce que les autres membres d'un jeu voient d'un compte : de quoi afficher « modifié par … ».
export function comptePublic(c, jeu) {
  const a = accesEspace(c, jeu);
  return { _id: c._id, nomAffiche: c.nomAffiche, metiers: a?.metiers || [], membreId: a?.membreId || '', actif: c.actif !== false, admin: !!c.admin };
}

export function cookieSession(jeton, config) {
  return serialiserCookie(NOM_COOKIE, jeton, { maxAge: DUREE_SESSION_MS / 1000, secure: config.cookieSecurise });
}

export function cookieEfface(config) {
  return serialiserCookie(NOM_COOKIE, '', { maxAge: 0, secure: config.cookieSecurise });
}

// autoriser2fa : route permise à un compte qui doit encore activer sa double authentification (activation, session).
export function exigerConnexion(services, { autoriserMdpAChanger = false, autoriser2fa = false } = {}) {
  return async (r) => {
    const jeton = lireCookies(r.req)[NOM_COOKIE];
    const session = await services.sessions.lire(jeton);
    if (!session) throw erreurs.nonConnecte();
    const compte = await services.global.lire('comptes', session.compteId);
    if (!compte || compte.actif === false) {
      await services.sessions.supprimer(jeton);
      throw erreurs.nonConnecte();
    }
    if (compte.doitChangerMdp && !autoriserMdpAChanger) throw erreurs.mdpAChanger();
    if (!autoriser2fa && (await doitActiver2fa(services, compte))) throw erreurs.deuxFacteursAActiver();
    r.compte = compte;
    r.compteGlobal = compte;
    r.jeton = jeton;
  };
}

// La structure exige la double authentification et ce compte (Administrateur général ou Responsable) ne l'a pas.
export async function doitActiver2fa(services, compte) {
  if (compte.deuxFacteurs || !soumisA2fa(compte) || !services.parametres) return false;
  return (await services.parametres.lire()).exiger2fa;
}

export function exigerAdmin() {
  return async (r) => {
    if (!r.compteGlobal?.admin) throw erreurs.interdit('Réservé à l’Administrateur général.');
  };
}

// Espace de jeu de l'adresse (/api/e/:jeu/…). Sans accès, la réponse est la même que pour un jeu inexistant.
// Ensuite, r.compte est le compte VU DANS CE JEU : ses métiers et son membre lié dans ce jeu.
export function exigerEspace(services) {
  return async (r) => {
    const espace = services.registre.obtenir(r.params.jeu);
    const acces = espace ? accesEspace(r.compteGlobal, espace.id) : null;
    if (!espace || !acces || (!espace.doc.actif && !r.compteGlobal.admin)) throw erreurs.introuvable('Espace de jeu introuvable.');
    r.espace = espace;
    r.compte = { ...r.compteGlobal, metiers: acces.metiers, membreId: acces.membreId };
    espace.automatismes?.verifier();
  };
}

export function exigerPerm(perm) {
  return async (r) => {
    if (!peut(r.compte, perm)) throw erreurs.interdit();
  };
}
