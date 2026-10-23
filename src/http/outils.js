// Outils HTTP : erreurs typées, réponses JSON (compressées au-delà de 16 Ko), corps de requête, cookies, adresse IP.

import { gzipSync } from 'node:zlib';

export class ErreurHttp extends Error {
  constructor(statut, code, message, details = null) {
    super(message);
    this.statut = statut;
    this.code = code;
    this.details = details;
  }
}

export const erreurs = {
  requete: (message = 'Requête invalide.') => new ErreurHttp(400, 'requete', message),
  invalide: (details) => new ErreurHttp(400, 'invalide', 'Certaines valeurs sont invalides.', details),
  nonConnecte: () => new ErreurHttp(401, 'non_connecte', 'Connecte-toi pour continuer.'),
  identifiants: () => new ErreurHttp(401, 'identifiants', 'Identifiant ou mot de passe incorrect.'),
  interdit: (message = 'Ton rôle ne permet pas cette action.') => new ErreurHttp(403, 'interdit', message),
  mdpAChanger: () => new ErreurHttp(403, 'mdp_a_changer', 'Choisis un nouveau mot de passe avant de continuer.'),
  deuxFacteursAActiver: () => new ErreurHttp(403, 'activer_2fa', 'Active la double authentification avant de continuer.'),
  codeDeuxFacteurs: (message = 'Saisis le code à 6 chiffres de ton application d’authentification.') => new ErreurHttp(401, 'code_2fa', message),
  introuvable: (message = 'Élément introuvable.') => new ErreurHttp(404, 'introuvable', message),
  methode: () => new ErreurHttp(405, 'methode', 'Méthode non autorisée.'),
  conflit: (message, details = null) => new ErreurHttp(409, 'conflit', message, details),
  tropGros: () => new ErreurHttp(413, 'trop_gros', 'Envoi trop volumineux.'),
  tropDeRequetes: (message = 'Trop de requêtes. Patiente un instant.') => new ErreurHttp(429, 'trop_de_requetes', message),
  indisponible: (message = 'Service momentanément indisponible.') => new ErreurHttp(503, 'indisponible', message),
};

const SEUIL_COMPRESSION = 16 * 1024;

export function envoyerJson(res, statut, donnees, entetes = {}) {
  let corps = Buffer.from(JSON.stringify(donnees));
  const compression = {};
  if (corps.length > SEUIL_COMPRESSION && /\bgzip\b/.test(String(res.req?.headers?.['accept-encoding'] || ''))) {
    corps = gzipSync(corps);
    compression['Content-Encoding'] = 'gzip';
    compression.Vary = 'Accept-Encoding';
  }
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': corps.length,
    ...compression,
    ...entetes,
  });
  res.end(corps);
}

export function envoyerErreur(res, err) {
  const statut = err instanceof ErreurHttp ? err.statut : 500;
  const code = err instanceof ErreurHttp ? err.code : 'interne';
  const message = err instanceof ErreurHttp ? err.message : 'Erreur interne du serveur.';
  const corps = { erreur: { code, message } };
  if (err instanceof ErreurHttp && err.details) corps.erreur.details = err.details;
  if (!res.headersSent) envoyerJson(res, statut, corps);
  else res.end();
}

export async function lireCorpsJson(req, limite = 256 * 1024) {
  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('application/json')) {
    throw erreurs.requete('Le corps de la requête doit être du JSON.');
  }
  const morceaux = [];
  let taille = 0;
  for await (const morceau of req) {
    taille += morceau.length;
    if (taille > limite) throw erreurs.tropGros();
    morceaux.push(morceau);
  }
  if (!taille) return {};
  try {
    const valeur = JSON.parse(Buffer.concat(morceaux).toString('utf8'));
    if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new Error('objet attendu');
    return valeur;
  } catch {
    throw erreurs.requete('JSON illisible.');
  }
}

export function lireCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const nom = part.slice(0, i).trim();
    const valeur = part.slice(i + 1).trim();
    try {
      cookies[nom] = decodeURIComponent(valeur);
    } catch {
      // cookie mal formé : ignoré
    }
  }
  return cookies;
}

export function serialiserCookie(nom, valeur, { maxAge, httpOnly = true, secure = true, sameSite = 'Lax', path = '/' } = {}) {
  const parts = [`${nom}=${encodeURIComponent(valeur)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

// Liste de X-Forwarded-For, du client (à gauche) au dernier proxy (à droite).
export function listeTransmise(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
}

// sauts : nombre de proxys de confiance. Chacun AJOUTE l'adresse qu'il voit à la fin : le début de la liste peut être
// écrit par le client, seuls les « sauts » derniers éléments sont sûrs. Liste plus courte : on prend son premier élément.
export function ipClient(req, derriereProxy, sauts = 1) {
  if (derriereProxy) {
    const liste = listeTransmise(req);
    if (liste.length) return liste.at(-Math.min(sauts, liste.length));
  }
  return req.socket?.remoteAddress || 'inconnue';
}
