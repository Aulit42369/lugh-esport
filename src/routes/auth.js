// Routes de connexion : se connecter, se déconnecter, savoir qui on est et à quels jeux on a accès,
// changer son mot de passe.

import { envoyerJson, erreurs, ErreurHttp, lireCookies } from '../http/outils.js';
import { hacherMdp, verifierMdp, controlerMdp, empreinteLeurre } from '../auth/mdp.js';
import { NOM_COOKIE } from '../auth/sessions.js';
import { exigerConnexion, profilCompte, cookieSession, cookieEfface, doitActiver2fa } from '../auth/acces.js';
import { verifierSecondFacteur } from '../auth/deuxfacteurs.js';
import { accesEspace } from '../../shared/roles.js';

// Jeux visibles par un compte : ceux où il a un accès et qui sont actifs ; tous pour l'Administrateur général.
export function jeuxDuCompteVisibles(registre, compte) {
  return registre.liste()
    .filter((doc) => (compte.admin || doc.actif !== false) && accesEspace(compte, doc._id))
    .map((doc) => {
      const e = registre.obtenir(doc._id);
      return {
        id: doc._id,
        modele: doc.modele,
        nom: e?.def?.nom || doc.nom,
        court: e?.def?.court || doc.court,
        couleur: doc.couleur || '',
        actif: doc.actif !== false,
        metiers: accesEspace(compte, doc._id).metiers,
      };
    });
}

export function routesAuth(routeur, s) {
  const connecte = exigerConnexion(s, { autoriserMdpAChanger: true, autoriser2fa: true });

  routeur.post('/api/auth/connexion', async (r) => {
    const corps = await r.corps();
    const identifiant = typeof corps.identifiant === 'string' ? corps.identifiant.trim().toLowerCase() : '';
    const mdp = typeof corps.mdp === 'string' ? corps.mdp : '';
    if (!identifiant || !mdp || identifiant.length > 24 || mdp.length > 128) throw erreurs.identifiants();

    const cles = [`id:${identifiant}`, `ip:${r.ip}`];
    const attente = s.limiteurConnexion.attente(cles);
    if (attente) throw erreurs.tropDeRequetes(`Trop d’essais. Réessaie dans ${Math.ceil(attente / 60_000)} min.`);

    const [compte] = await s.global.lister('comptes', { identifiant });
    let ok = false;
    if (compte && compte.actif !== false) ok = await verifierMdp(mdp, compte.hash);
    else await verifierMdp(mdp, await empreinteLeurre());
    if (!ok) {
      s.limiteurConnexion.echec(cles);
      throw erreurs.identifiants();
    }

    // Double authentification : le mot de passe ne suffit pas, il faut le code de l'application (ou un code de
    // secours). Sans code, la réponse le demande ; un code faux compte comme un échec de connexion.
    const frais = (await s.global.lire('comptes', compte._id)) || compte;
    let secoursUtilise = false;
    if (frais.deuxFacteurs) {
      const code = typeof corps.code === 'string' ? corps.code.trim().slice(0, 20) : '';
      // Code manquant : réponse normale (pas d'erreur dans la console), sans session ; l'interface demande le code.
      if (!code) return envoyerJson(r.res, 200, { code2fa: true });
      const verif = verifierSecondFacteur(frais.deuxFacteurs, code, s.maintenant());
      if (!verif) {
        s.limiteurConnexion.echec(cles);
        throw erreurs.codeDeuxFacteurs('Code incorrect ou déjà utilisé.');
      }
      frais.deuxFacteurs = verif.deuxFacteurs;
      secoursUtilise = verif.secours;
    }
    s.limiteurConnexion.reussite([`id:${identifiant}`]);

    const jeton = await s.sessions.creer(compte._id, r.req.headers['user-agent']);
    frais.derniereConnexion = s.maintenant().toISOString();
    await s.global.ecrire('comptes', frais);
    await s.historique.ecrire(frais, secoursUtilise ? 'connexion avec un code de secours' : 'connexion');
    envoyerJson(r.res, 200, { compte: profilCompte(frais) }, { 'Set-Cookie': cookieSession(jeton, s.config) });
  });

  routeur.post('/api/auth/deconnexion', async (r) => {
    await s.sessions.supprimer(lireCookies(r.req)[NOM_COOKIE]);
    envoyerJson(r.res, 200, { ok: true }, { 'Set-Cookie': cookieEfface(s.config) });
  });

  // État de la session sans erreur 401 : évite un message d'erreur dans la console au chargement de la page.
  routeur.get('/api/auth/session', async (r) => {
    try {
      await connecte(r);
    } catch {
      return envoyerJson(r.res, 200, { connecte: false });
    }
    envoyerJson(r.res, 200, {
      connecte: true,
      identifiant: r.compte.identifiant,
      doitChangerMdp: !!r.compte.doitChangerMdp,
      doitActiver2fa: await doitActiver2fa(s, r.compte),
    });
  });

  routeur.get('/api/auth/moi', connecte, async (r) => {
    envoyerJson(r.res, 200, {
      compte: profilCompte(r.compte),
      jeux: jeuxDuCompteVisibles(s.registre, r.compte),
      doitActiver2fa: await doitActiver2fa(s, r.compte),
    });
  });

  routeur.post('/api/auth/mdp', connecte, async (r) => {
    const cle = [`mdp:${r.compte._id}`];
    const attente = s.limiteurConnexion.attente(cle);
    if (attente) throw erreurs.tropDeRequetes(`Trop d’essais. Réessaie dans ${Math.ceil(attente / 60_000)} min.`);
    const { ancien, nouveau } = await r.corps();
    if (typeof ancien !== 'string' || !(await verifierMdp(ancien, r.compte.hash))) {
      s.limiteurConnexion.echec(cle);
      throw new ErreurHttp(400, 'ancien_mdp', 'Le mot de passe actuel est incorrect.');
    }
    const refus = controlerMdp(nouveau, r.compte.identifiant);
    if (refus) throw new ErreurHttp(400, 'mdp_refuse', refus);
    if (nouveau === ancien) throw new ErreurHttp(400, 'mdp_refuse', 'Choisis un mot de passe différent de l’actuel.');
    s.limiteurConnexion.reussite(cle);

    const compte = (await s.global.lire('comptes', r.compte._id)) || r.compte;
    compte.hash = await hacherMdp(nouveau);
    compte.doitChangerMdp = false;
    compte.mdpChangeLe = s.maintenant().toISOString();
    await s.global.ecrire('comptes', compte);
    await s.sessions.supprimerPourCompte(compte._id, r.jeton);
    await s.historique.ecrire(compte, 'mot de passe changé');
    envoyerJson(r.res, 200, { compte: profilCompte(compte) });
  });
}
