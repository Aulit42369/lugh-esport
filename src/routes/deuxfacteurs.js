// Double authentification : activation (QR code puis premier code), codes de secours, désactivation ;
// côté Administrateur général, l'obligation pour les Responsables et la remise à zéro d'un compte.

import { envoyerJson, erreurs, ErreurHttp } from '../http/outils.js';
import { exigerConnexion, exigerAdmin, profilCompte, modifierCompte } from '../auth/acces.js';
import { verifierMdp } from '../auth/mdp.js';
import { nouveauSecret, verifierCode, nouveauxCodesSecours, adresseOtpauth } from '../auth/totp.js';
import { verifierSecondFacteur, lireSecret } from '../auth/deuxfacteurs.js';
import { qrCode } from '../auth/qr.js';
import { soumisA2fa } from '../domaine/parametres.js';
import { MOTIFS } from '../../shared/validation.js';
import { MARQUE } from '../../shared/marque.js';

const DUREE_ACTIVATION_MS = 10 * 60_000;

export function routesDeuxFacteurs(routeur, s) {
  const connecte = exigerConnexion(s, { autoriser2fa: true });
  const admin = [exigerConnexion(s), exigerAdmin()];

  // Chaque route qui l'appelle passe aussi par exclusif() : un essai à la fois par compte.
  function limiter(r) {
    const cle = [`2fa:${r.compteGlobal._id}`];
    const attente = s.limiteurConnexion.attente(cle);
    if (attente) throw erreurs.tropDeRequetes(`Trop d’essais. Réessaie dans ${Math.ceil(attente / 60_000)} min.`);
    return cle;
  }

  // Relue après le corps de la requête (jamais avant : l'attente du corps est choisie par le client).
  async function compteFrais(r) {
    const compte = await s.global.lire('comptes', r.compteGlobal._id);
    if (!compte || compte.actif === false) throw erreurs.nonConnecte();
    return compte;
  }

  // 1. Préparation : une clé neuve, montrée une seule fois (QR code et texte), valable 10 minutes ; chiffrée en base.
  routeur.post('/api/auth/2fa/preparer', connecte, async (r) => {
    const compte = await compteFrais(r);
    if (compte.deuxFacteurs) throw erreurs.conflit('La double authentification est déjà active sur ce compte.');
    const secret = nouveauSecret();
    compte.deuxFacteursEnAttente = { secret: s.coffre2fa.chiffrer(secret), expire: new Date(s.maintenant().getTime() + DUREE_ACTIVATION_MS).toISOString() };
    await modifierCompte(s, compte._id, { deuxFacteursEnAttente: compte.deuxFacteursEnAttente });
    const adresse = adresseOtpauth({ emetteur: MARQUE.nom, compte: compte.identifiant, secret });
    envoyerJson(r.res, 200, { secret: secret.match(/.{1,4}/g).join(' '), qr: qrCode(adresse).lignes, emetteur: MARQUE.nom });
  });

  // 2. Activation : le premier code prouve que l'application est réglée. Les codes de secours sont montrés une fois.
  routeur.post('/api/auth/2fa/activer', connecte, (r) => s.limiteurConnexion.exclusif(`2fa:${r.compteGlobal._id}`, async () => {
    const cle = limiter(r);
    const { code } = await r.corps();
    const compte = await compteFrais(r);
    const attente = compte.deuxFacteursEnAttente;
    if (!attente || new Date(attente.expire) <= s.maintenant()) throw erreurs.conflit('Préparation expirée : recommence l’activation.');
    const secret = lireSecret(s.coffre2fa, attente.secret);
    const pas = verifierCode(secret, code, { maintenantMs: s.maintenant().getTime() });
    if (pas === null) {
      s.limiteurConnexion.echec(cle);
      throw new ErreurHttp(400, 'code_2fa', 'Code incorrect : vérifie l’heure du téléphone et saisis le code affiché.');
    }
    s.limiteurConnexion.reussite(cle);
    const { codes, empreintes } = nouveauxCodesSecours();
    compte.deuxFacteurs = { secret: s.coffre2fa.chiffrer(secret), depuis: s.maintenant().toISOString(), dernierPas: pas, secours: empreintes };
    delete compte.deuxFacteursEnAttente;
    await modifierCompte(s, compte._id, { deuxFacteurs: compte.deuxFacteurs, deuxFacteursEnAttente: null });
    await s.sessions.supprimerPourCompte(compte._id, r.jeton);
    await s.historique.ecrire(compte, 'double authentification activée');
    envoyerJson(r.res, 200, { codesSecours: codes, compte: profilCompte(compte) });
  }));

  // Nouveaux codes de secours (les anciens ne marchent plus) : il faut un code de l'application.
  routeur.post('/api/auth/2fa/codes', connecte, (r) => s.limiteurConnexion.exclusif(`2fa:${r.compteGlobal._id}`, async () => {
    const cle = limiter(r);
    const { code } = await r.corps();
    const compte = await compteFrais(r);
    if (!compte.deuxFacteurs) throw erreurs.conflit('La double authentification n’est pas active.');
    const secret = lireSecret(s.coffre2fa, compte.deuxFacteurs.secret);
    const pas = verifierCode(secret, code, { maintenantMs: s.maintenant().getTime(), dernierPas: compte.deuxFacteurs.dernierPas ?? -1 });
    if (pas === null) {
      s.limiteurConnexion.echec(cle);
      throw new ErreurHttp(400, 'code_2fa', 'Code incorrect.');
    }
    s.limiteurConnexion.reussite(cle);
    const { codes, empreintes } = nouveauxCodesSecours();
    compte.deuxFacteurs = { ...compte.deuxFacteurs, secret: s.coffre2fa.chiffrer(secret), dernierPas: pas, secours: empreintes };
    await modifierCompte(s, compte._id, { deuxFacteurs: compte.deuxFacteurs });
    await s.historique.ecrire(compte, 'codes de secours renouvelés');
    envoyerJson(r.res, 200, { codesSecours: codes, compte: profilCompte(compte) });
  }));

  // Désactivation : mot de passe et code (de l'application ou de secours). Refusée si la structure l'exige.
  routeur.post('/api/auth/2fa/desactiver', connecte, (r) => s.limiteurConnexion.exclusif(`2fa:${r.compteGlobal._id}`, async () => {
    const cle = limiter(r);
    const { mdp, code } = await r.corps();
    const compte = await compteFrais(r);
    if (!compte.deuxFacteurs) throw erreurs.conflit('La double authentification n’est pas active.');
    if (soumisA2fa(compte) && (await s.parametres.lire()).exiger2fa) {
      throw erreurs.conflit('La structure exige la double authentification pour ton rôle : tu peux renouveler tes codes, pas la désactiver.');
    }
    const verif = typeof mdp === 'string' && (await verifierMdp(mdp, compte.hash)) ? verifierSecondFacteur(compte.deuxFacteurs, code, s.maintenant(), s.coffre2fa) : null;
    if (!verif) {
      s.limiteurConnexion.echec(cle);
      throw new ErreurHttp(400, 'code_2fa', 'Mot de passe ou code incorrect.');
    }
    s.limiteurConnexion.reussite(cle);
    delete compte.deuxFacteurs;
    await modifierCompte(s, compte._id, { deuxFacteurs: null });
    await s.historique.ecrire(compte, 'double authentification désactivée');
    envoyerJson(r.res, 200, { compte: profilCompte(compte) });
  }));

  // ——— Administrateur général ———

  routeur.get('/api/admin/parametres', ...admin, async (r) => {
    const comptes = await s.global.lister('comptes');
    envoyerJson(r.res, 200, {
      ...(await s.parametres.lire()),
      sansDeuxFacteurs: comptes.filter((c) => c.actif !== false && soumisA2fa(c) && !c.deuxFacteurs)
        .map((c) => ({ _id: c._id, identifiant: c.identifiant, nomAffiche: c.nomAffiche, admin: !!c.admin })),
    });
  });

  routeur.put('/api/admin/parametres', ...admin, async (r) => {
    const { exiger2fa } = await r.corps();
    if (typeof exiger2fa !== 'boolean') throw erreurs.requete();
    const moi = await compteFrais(r);
    if (exiger2fa && !moi.deuxFacteurs) throw erreurs.conflit('Active d’abord la double authentification sur ton propre compte (Mon compte).');
    const parametres = await s.parametres.ecrire({ exiger2fa }, r.compteGlobal);
    await s.historique.ecrire(r.compteGlobal, exiger2fa ? 'double authentification exigée' : 'double authentification facultative');
    envoyerJson(r.res, 200, parametres);
  });

  // Téléphone perdu sans codes de secours : l'Administrateur général remet la double authentification à zéro.
  routeur.post('/api/admin/comptes/:id/2fa/reinitialiser', ...admin, async (r) => {
    if (!MOTIFS.compte.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    if (r.params.id === r.compteGlobal._id) throw erreurs.conflit('Pour ton propre compte, passe par « Mon compte » (mot de passe et code demandés).');
    const compte = await s.global.lire('comptes', r.params.id);
    if (!compte) throw erreurs.introuvable('Compte introuvable.');
    delete compte.deuxFacteurs;
    delete compte.deuxFacteursEnAttente;
    await modifierCompte(s, compte._id, { deuxFacteurs: null, deuxFacteursEnAttente: null });
    if (compte._id !== r.compteGlobal._id) await s.sessions.supprimerPourCompte(compte._id);
    await s.historique.ecrire(r.compteGlobal, 'double authentification réinitialisée', compte.nomAffiche);
    envoyerJson(r.res, 200, { compte: profilCompte(compte) });
  });
}
