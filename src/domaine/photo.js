// Photo de la vitrine publique : JPEG seulement (le navigateur ré-encode l'image avant l'envoi), type réel contrôlé
// sur les octets, taille et dimensions plafonnées, métadonnées retirées (EXIF, GPS, XMP, commentaires) sans dépendance.

export const PHOTO_OCTETS_MAX = 300 * 1024;
export const PHOTO_COTE_MAX = 2048;

// Segments gardés : JFIF (APP0), Adobe (APP14, nécessaire aux couleurs), tables et en-têtes d'image.
// Tous les autres APPn (EXIF, XMP, ICC, IPTC…) et les commentaires (COM) sont retirés.
const GARDES_APP = new Set([0xe0, 0xee]);
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

// Renvoie { octets, largeur, hauteur } ou lève une Error au message lisible.
export function nettoyerJpeg(entree) {
  const b = Buffer.from(entree);
  if (b.length > PHOTO_OCTETS_MAX) throw new Error(`photo trop lourde (${Math.round(PHOTO_OCTETS_MAX / 1024)} Ko au plus)`);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error('ce fichier n’est pas une image JPEG');
  const morceaux = [b.subarray(0, 2)];
  let i = 2;
  let largeur = 0;
  let hauteur = 0;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('image JPEG illisible');
    const marqueur = b[i + 1];
    if (marqueur === 0xff) { i += 1; continue; } // octet de bourrage
    const longueur = b.readUInt16BE(i + 2);
    if (longueur < 2 || i + 2 + longueur > b.length) throw new Error('image JPEG tronquée');
    const segment = b.subarray(i, i + 2 + longueur);
    if (SOF.has(marqueur)) {
      if (longueur < 7) throw new Error('image JPEG illisible');
      hauteur = b.readUInt16BE(i + 5);
      largeur = b.readUInt16BE(i + 7);
    }
    if (marqueur === 0xda) { // début des données de l'image : tout le reste est copié tel quel
      if (!largeur || !hauteur) throw new Error('image JPEG sans dimensions');
      morceaux.push(b.subarray(i));
      if (largeur > PHOTO_COTE_MAX || hauteur > PHOTO_COTE_MAX) throw new Error(`image trop grande (${PHOTO_COTE_MAX} px de côté au plus)`);
      return { octets: Buffer.concat(morceaux), largeur, hauteur };
    }
    const metadonnee = (marqueur >= 0xe0 && marqueur <= 0xef && !GARDES_APP.has(marqueur)) || marqueur === 0xfe;
    if (!metadonnee) morceaux.push(segment);
    i += 2 + longueur;
  }
  throw new Error('image JPEG tronquée');
}
