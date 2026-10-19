// Service worker de Lugh : l'appli s'ouvre même quand le serveur gratuit se réveille ou que le réseau est faible.
// Les données (/api/) ne sont jamais mises en cache : elles passent toujours par le réseau.
// Préfixe des caches fixé pour toujours (« lugh- ») : seuls nos propres caches sont supprimés.

const CACHE = 'lugh-v1';
const DELAI_COQUILLE_MS = 3000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('lugh-') && nom !== CACHE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

async function reseauPuisCache(requete, { delai = 0 } = {}) {
  const cache = await caches.open(CACHE);
  const reseau = fetch(requete).then(async (rep) => {
    if (rep.ok && rep.type === 'basic' && !/no-store/.test(rep.headers.get('Cache-Control') || '')) {
      await cache.put(requete, rep.clone());
    }
    return rep;
  });
  if (delai) {
    // Coquille (page, styles, polices) : après quelques secondes sans réponse, la copie locale s'affiche
    // pendant que le serveur se réveille ; la réponse du réseau rafraîchit la copie pour la prochaine fois.
    const attente = new Promise((resoudre) => { setTimeout(resoudre, delai, null); });
    const premiere = await Promise.race([reseau.catch(() => null), attente]);
    if (premiere) return premiere;
    const copie = await cache.match(requete, { ignoreSearch: true });
    if (copie) {
      reseau.catch(() => {});
      return copie;
    }
  }
  try {
    return await reseau;
  } catch (err) {
    const copie = await cache.match(requete, { ignoreSearch: true }) || (requete.mode === 'navigate' ? await cache.match('/') : null);
    if (copie) return copie;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const requete = e.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const coquille = requete.mode === 'navigate' || /\.(css|woff2|png|svg|webmanifest)$/.test(url.pathname);
  e.respondWith(reseauPuisCache(requete, { delai: coquille ? DELAI_COQUILLE_MS : 0 }));
});
