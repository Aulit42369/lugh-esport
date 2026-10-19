// Navigation par l'adresse : fonctionne sans configuration du serveur.
//   #/<jeu>/<page>/<paramètres>   page d'un jeu (ex. #/valorant/maps/bind)
//   #/admin/…  #/compte  #/jeux   pages générales
//   #/<page>/…                   lien relatif au jeu affiché (liens enregistrés dans les suggestions, les alertes…)

export const PAGES_GENERALES = new Set(['admin', 'compte', 'jeux', 'tresorerie']);

function morceaux() {
  const brut = window.location.hash.replace(/^#\/?/, '');
  return brut.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return '';
    }
  });
}

// pagesJeu : identifiants des pages d'un jeu (accueil, planning…) ; jeux : identifiants des jeux visibles.
export function routeCourante({ pagesJeu = new Set(), jeux = [] } = {}) {
  const parts = morceaux();
  const [a = '', ...reste] = parts;
  if (!a) return { jeu: null, route: '', params: [] };
  if (PAGES_GENERALES.has(a)) return { jeu: null, route: a, params: reste };
  if (pagesJeu.has(a) && !jeux.includes(a)) return { jeu: null, route: a, params: reste, relatif: true };
  return { jeu: a, route: reste[0] || 'accueil', params: reste.slice(1) };
}

export function surChangementRoute(fn) {
  window.addEventListener('hashchange', fn);
}

export function remplacerAdresse(hash) {
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(null, '', url);
}
