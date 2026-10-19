// Thème d'affichage propre à cet appareil : sombre par défaut (plus reposant), clair sur demande.

const CLE = 'lugh-theme';

export function themeActuel() {
  try {
    return localStorage.getItem(CLE) === 'clair' ? 'clair' : 'sombre';
  } catch {
    return 'sombre';
  }
}

export function appliquerTheme(theme = themeActuel()) {
  const racine = document.documentElement;
  if (theme === 'clair') racine.dataset.theme = 'clair';
  else delete racine.dataset.theme;
  const couleur = document.querySelector('meta[name="theme-color"]');
  if (couleur) couleur.content = theme === 'clair' ? '#f7f1e6' : '#0f0c09';
}

export function definirTheme(theme) {
  try {
    localStorage.setItem(CLE, theme === 'clair' ? 'clair' : 'sombre');
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour cette visite.
  }
  appliquerTheme(theme);
}
