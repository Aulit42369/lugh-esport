// Double authentification par code à 6 chiffres (TOTP, RFC 6238 : HMAC-SHA1, pas de 30 s), compatible avec
// Google Authenticator, Aegis, Microsoft Authenticator… Aucun service externe. Codes de secours à usage unique,
// conservés seulement sous forme d'empreinte.

import { createHmac, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PAS_MS = 30_000;

export function versBase32(octets) {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) {
      sortie += BASE32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += BASE32[(valeur << (5 - bits)) & 31];
  return sortie;
}

export function depuisBase32(texte) {
  const propre = String(texte || '').toUpperCase().replace(/[\s=-]/g, '');
  const octets = [];
  let bits = 0;
  let valeur = 0;
  for (const c of propre) {
    const i = BASE32.indexOf(c);
    if (i < 0) throw new Error('clé invalide');
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

// Clé secrète de 160 bits (32 caractères en base 32), comme le recommande la RFC 4226.
export function nouveauSecret() {
  return versBase32(randomBytes(20));
}

export function hotp(cle, compteur, chiffres = 6) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(compteur));
  const h = createHmac('sha1', cle).update(message).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** chiffres).padStart(chiffres, '0');
}

export const pasDe = (ms) => Math.floor(ms / PAS_MS);

function egaux(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Vérifie un code : accepte le pas courant et ses deux voisins (horloges un peu décalées), jamais un pas déjà
// utilisé (un code vu par-dessus l'épaule ne resert pas). Rend le pas accepté, ou null.
export function verifierCode(secret, code, { maintenantMs, dernierPas = -1, fenetre = 1 }) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  let cle;
  try {
    cle = depuisBase32(secret);
  } catch {
    return null;
  }
  const courant = pasDe(maintenantMs);
  let accepte = null;
  for (let d = -fenetre; d <= fenetre; d += 1) {
    const pas = courant + d;
    if (pas > dernierPas && egaux(hotp(cle, pas), c)) accepte = pas;
  }
  return accepte;
}

// ——— Codes de secours ———

const ALPHABET_SECOURS = 'abcdefghjkmnpqrstuvwxyz23456789'; // sans 0/o, 1/l/i : se recopient sans erreur

const normaliserSecours = (code) => String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const empreinte = (code) => createHash('sha256').update(`secours:${normaliserSecours(code)}`).digest('hex');

export function nouveauxCodesSecours(n = 10) {
  const codes = [];
  for (let i = 0; i < n; i += 1) {
    let c = '';
    for (let j = 0; j < 8; j += 1) c += ALPHABET_SECOURS[randomInt(ALPHABET_SECOURS.length)];
    codes.push(`${c.slice(0, 4)}-${c.slice(4)}`);
  }
  return { codes, empreintes: codes.map(empreinte) };
}

export const estCodeSecours = (code) => normaliserSecours(code).length === 8;

// Rend la liste d'empreintes sans le code utilisé, ou null s'il n'en fait pas partie.
export function utiliserCodeSecours(empreintes = [], code) {
  if (!estCodeSecours(code)) return null;
  const e = empreinte(code);
  const i = empreintes.findIndex((x) => egaux(x, e));
  return i < 0 ? null : empreintes.filter((_, k) => k !== i);
}

// Adresse otpauth:// lue par les applications d'authentification (affichée en QR code, une seule fois).
export function adresseOtpauth({ emetteur, compte, secret }) {
  const e = encodeURIComponent(emetteur);
  return `otpauth://totp/${e}:${encodeURIComponent(compte)}?secret=${secret}&issuer=${e}&algorithm=SHA1&digits=6&period=30`;
}
