// Routeur minimal : méthode + motif (« /api/c/:collection/:id »), étapes enchaînées.

import { erreurs } from './outils.js';

export function creerRouteur() {
  const routes = [];

  function ajouter(methode, motif, etapes) {
    routes.push({ methode, segments: motif.split('/').filter(Boolean), etapes });
  }

  function trouver(methode, chemin) {
    const parts = chemin.split('/').filter(Boolean);
    let autreMethode = false;
    for (const route of routes) {
      if (route.segments.length !== parts.length) continue;
      const params = {};
      let correspond = true;
      for (let i = 0; i < parts.length; i += 1) {
        const segment = route.segments[i];
        if (segment.startsWith(':')) {
          try {
            params[segment.slice(1)] = decodeURIComponent(parts[i]);
          } catch {
            throw erreurs.requete('Adresse mal formée.');
          }
        } else if (segment !== parts[i]) {
          correspond = false;
          break;
        }
      }
      if (!correspond) continue;
      if (route.methode !== methode && !(methode === 'HEAD' && route.methode === 'GET')) {
        autreMethode = true;
        continue;
      }
      return { etapes: route.etapes, params };
    }
    if (autreMethode) throw erreurs.methode();
    return null;
  }

  return {
    get: (motif, ...etapes) => ajouter('GET', motif, etapes),
    post: (motif, ...etapes) => ajouter('POST', motif, etapes),
    put: (motif, ...etapes) => ajouter('PUT', motif, etapes),
    delete: (motif, ...etapes) => ajouter('DELETE', motif, etapes),
    trouver,
  };
}
