// Second facteur d'un compte : vérification d'un code (application d'authentification ou code de secours),
// clé chiffrée en base quand LUGH_CLE_2FA est posée (conversion des anciennes clés en clair au démarrage), et
// remise à zéro au démarrage quand LUGH_REINITIALISER_2FA désigne un compte (dernier recours, accès Render requis).

import { verifierCode, utiliserCodeSecours } from './totp.js';
import { estChiffre } from './chiffrement.js';
import { ErreurHttp } from '../http/outils.js';

export const MESSAGE_CLE_2FA = 'La clé de chiffrement de la double authentification (LUGH_CLE_2FA) est absente ou fausse sur le serveur : préviens l’Administrateur général.';

// Clé TOTP en clair, ou refus propre (503) si elle est chiffrée et illisible avec la clé du serveur.
export function lireSecret(coffre, valeur) {
  const secret = coffre.dechiffrer(valeur);
  if (!secret) throw new ErreurHttp(503, 'cle_2fa', MESSAGE_CLE_2FA);
  return secret;
}

// Rend { deuxFacteurs (mis à jour, clé chiffrée si possible), secours (true si un code de secours a servi) },
// ou null si le code est refusé.
export function verifierSecondFacteur(df, code, maintenant, coffre) {
  if (!df?.secret) return null;
  const clair = lireSecret(coffre, df.secret);
  const frais = { ...df, secret: coffre.chiffrer(clair) };
  const pas = verifierCode(clair, code, { maintenantMs: maintenant.getTime(), dernierPas: df.dernierPas ?? -1 });
  if (pas !== null) return { deuxFacteurs: { ...frais, dernierPas: pas }, secours: false };
  const reste = utiliserCodeSecours(df.secours, code);
  if (reste) return { deuxFacteurs: { ...frais, secours: reste }, secours: true };
  return null;
}

// Au démarrage : chiffre les clés encore en clair (si LUGH_CLE_2FA est posée) et rend le nombre de comptes dont
// la clé chiffrée est illisible (variable absente ou changée), pour l'avertissement de l'état du service.
export async function convertirClesAuDemarrage({ global, coffre }) {
  let illisibles = 0;
  for (const compte of await global.lister('comptes')) {
    let change = false;
    for (const champ of ['deuxFacteurs', 'deuxFacteursEnAttente']) {
      const secret = compte[champ]?.secret;
      if (!secret) continue;
      if (estChiffre(secret)) {
        if (coffre.dechiffrer(secret) === null) illisibles += 1;
      } else if (coffre.actif) {
        compte[champ] = { ...compte[champ], secret: coffre.chiffrer(secret) };
        change = true;
      }
    }
    if (change) await global.ecrire('comptes', compte);
  }
  return illisibles;
}

// Usage unique par pose de la variable : la valeur appliquée est notée dans les paramètres de la structure ; tant
// que la variable reste identique, les redémarrages suivants (réveils de Render) ne refont rien. Variable retirée :
// la note est effacée au démarrage suivant, pour qu'une nouvelle pose (même identifiant) serve de nouveau.
export async function reinitialiserAuDemarrage({ global, historique, identifiant, journal = console }) {
  const parametres = (await global.lire('parametres', 'structure')) || { _id: 'structure' };
  if (!identifiant) {
    if (parametres.reinitialisation2fa) {
      delete parametres.reinitialisation2fa;
      await global.ecrire('parametres', parametres);
    }
    return false;
  }
  if (parametres.reinitialisation2fa === identifiant) return false;
  await global.ecrire('parametres', { ...parametres, reinitialisation2fa: identifiant });
  const [compte] = await global.lister('comptes', { identifiant });
  if (!compte) {
    journal.warn?.(`[2FA] LUGH_REINITIALISER_2FA : aucun compte « ${identifiant} ».`);
    return false;
  }
  if (!compte.deuxFacteurs && !compte.deuxFacteursEnAttente) return false;
  delete compte.deuxFacteurs;
  delete compte.deuxFacteursEnAttente;
  await global.ecrire('comptes', compte);
  await historique.ecrire(null, 'double authentification réinitialisée au démarrage', compte.nomAffiche || identifiant);
  journal.warn?.(`[2FA] Double authentification de « ${identifiant} » réinitialisée. Retire LUGH_REINITIALISER_2FA des variables Render.`);
  return true;
}
