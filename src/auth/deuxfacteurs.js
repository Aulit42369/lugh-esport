// Second facteur d'un compte : vérification d'un code (application d'authentification ou code de secours) et
// remise à zéro au démarrage quand LUGH_REINITIALISER_2FA désigne un compte (dernier recours, accès Render requis).

import { verifierCode, utiliserCodeSecours } from './totp.js';

// Rend { deuxFacteurs (mis à jour), secours (true si un code de secours a servi) }, ou null si le code est refusé.
export function verifierSecondFacteur(df, code, maintenant) {
  if (!df?.secret) return null;
  const pas = verifierCode(df.secret, code, { maintenantMs: maintenant.getTime(), dernierPas: df.dernierPas ?? -1 });
  if (pas !== null) return { deuxFacteurs: { ...df, dernierPas: pas }, secours: false };
  const reste = utiliserCodeSecours(df.secours, code);
  if (reste) return { deuxFacteurs: { ...df, secours: reste }, secours: true };
  return null;
}

// Usage unique : la valeur appliquée est notée dans les paramètres de la structure ; tant que la variable reste
// identique, les redémarrages suivants (réveils de Render) ne refont rien.
export async function reinitialiserAuDemarrage({ global, historique, identifiant, journal = console }) {
  if (!identifiant) return false;
  const parametres = (await global.lire('parametres', 'structure')) || { _id: 'structure' };
  if (parametres.reinitialisation2fa === identifiant) return false;
  await global.ecrire('parametres', { ...parametres, reinitialisation2fa: identifiant });
  const [compte] = await global.lister('comptes', { identifiant });
  if (!compte) {
    journal.warn?.(`[2FA] LUGH_REINITIALISER_2FA : aucun compte « ${identifiant} ».`);
    return false;
  }
  if (!compte.deuxFacteurs && !compte.deuxFacteursEnAttente) return false;
  delete compte.deuxFacteurs;
  delete compte.deuxFacteursEnAttente;
  await global.ecrire('comptes', compte);
  await historique.ecrire(null, 'double authentification réinitialisée au démarrage', compte.nomAffiche || identifiant);
  journal.warn?.(`[2FA] Double authentification de « ${identifiant} » réinitialisée. Retire LUGH_REINITIALISER_2FA des variables Render.`);
  return true;
}
