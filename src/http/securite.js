// Sécurité HTTP : en-têtes, contrôle des écritures (anti-CSRF), limite de débit par adresse.

import { erreurs } from './outils.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function poserEntetesSecurite(res, { hsts }) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}

const METHODES_ECRITURE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Toute écriture venant du navigateur doit porter l'en-tête X-Lugh et venir du même site.
export function controlerEcriture(req, config) {
  if (!METHODES_ECRITURE.has(req.method)) return;
  if (req.headers['x-lugh'] !== '1') throw erreurs.interdit('Requête refusée : en-tête de sécurité manquant.');
  const origine = req.headers.origin;
  if (!origine) return;
  let hoteOrigine;
  try {
    hoteOrigine = new URL(origine).host;
  } catch {
    throw erreurs.interdit('Origine refusée.');
  }
  const hoteAttendu = config.origine ? new URL(config.origine).host : String(req.headers.host || '');
  if (hoteOrigine !== hoteAttendu) throw erreurs.interdit('Origine refusée.');
}

// Fenêtre glissante simple : nombre maximal de requêtes par adresse et par minute.
export function creerLimiteurDebit({ max = 300, fenetreMs = 60_000, maintenant = () => Date.now() } = {}) {
  const compteurs = new Map();
  const nettoyage = setInterval(() => {
    const t = maintenant();
    for (const [cle, c] of compteurs) if (t - c.debut > fenetreMs) compteurs.delete(cle);
  }, fenetreMs);
  nettoyage.unref?.();

  return {
    autoriser(cle) {
      const t = maintenant();
      const c = compteurs.get(cle);
      if (!c || t - c.debut > fenetreMs) {
        compteurs.set(cle, { debut: t, n: 1 });
        return true;
      }
      c.n += 1;
      return c.n <= max;
    },
    arreter() {
      clearInterval(nettoyage);
    },
  };
}
