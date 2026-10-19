// Fichiers statiques : l'application (public/) et le code commun (shared/), sans sortie de dossier possible.

import { stat, readFile } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export function creerStatique(racines) {
  // racines : [{ prefixe: '/shared/', dossier: '/chemin/shared' }, { prefixe: '/', dossier: '/chemin/public' }]
  return async function servir(req, res, chemin) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const racine = racines.find((r) => chemin.startsWith(r.prefixe));
    if (!racine) return false;
    let relatif = chemin.slice(racine.prefixe.length);
    if (relatif === '' || relatif.endsWith('/')) relatif += 'index.html';
    let decode;
    try {
      decode = decodeURIComponent(relatif);
    } catch {
      return false;
    }
    if (decode.split('/').some((p) => p.startsWith('.'))) return false;
    const fichier = normalize(join(racine.dossier, decode));
    if (!fichier.startsWith(racine.dossier + sep)) return false;
    const type = TYPES[extname(fichier).toLowerCase()];
    if (!type) return false;

    let infos;
    try {
      infos = await stat(fichier);
    } catch {
      return false;
    }
    if (!infos.isFile()) return false;

    const etag = `W/"${infos.size.toString(16)}-${Math.floor(infos.mtimeMs).toString(16)}"`;
    const entetes = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, entetes);
      res.end();
      return true;
    }
    const contenu = await readFile(fichier);
    res.writeHead(200, { ...entetes, 'Content-Length': contenu.length });
    res.end(req.method === 'HEAD' ? undefined : contenu);
    return true;
  };
}
