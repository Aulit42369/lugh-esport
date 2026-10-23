// Chiffrement des clés de double authentification en base (AES-256-GCM, clé LUGH_CLE_2FA lue dans config.js).
// Format versionné « v1:iv:tag:chiffré » (base64) ; une valeur sans ce préfixe est une ancienne clé en clair.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIXE = 'v1:';

export const estChiffre = (valeur) => typeof valeur === 'string' && valeur.startsWith(PREFIXE);

// cleHex : 64 caractères hexadécimaux (32 octets), ou vide : les clés restent alors en clair (comportement d'avant).
export function creerCoffre(cleHex = '') {
  const cle = cleHex ? Buffer.from(cleHex, 'hex') : null;
  return {
    actif: !!cle,
    // Une valeur déjà chiffrée est rendue telle quelle ; sans clé, rien n'est chiffré.
    chiffrer(clair) {
      if (!cle || estChiffre(clair)) return clair;
      const iv = randomBytes(12);
      const chiffreur = createCipheriv('aes-256-gcm', cle, iv);
      const donnees = Buffer.concat([chiffreur.update(clair, 'utf8'), chiffreur.final()]);
      return PREFIXE + [iv, chiffreur.getAuthTag(), donnees].map((b) => b.toString('base64')).join(':');
    },
    // Rend la clé en clair, ou null si elle est chiffrée et que la clé du serveur est absente ou fausse.
    dechiffrer(valeur) {
      if (!estChiffre(valeur)) return valeur;
      if (!cle) return null;
      try {
        const [iv, tag, donnees] = valeur.slice(PREFIXE.length).split(':').map((p) => Buffer.from(p, 'base64'));
        const dechiffreur = createDecipheriv('aes-256-gcm', cle, iv);
        dechiffreur.setAuthTag(tag);
        return Buffer.concat([dechiffreur.update(donnees), dechiffreur.final()]).toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
