// Installation de Lugh comme une appli (écran d'accueil, fenêtre à part) : l'invitation du navigateur est gardée
// pour le bouton « Installer l'appli » de Mon compte.

let invitation = null;

window.addEventListener('beforeinstallprompt', (e) => {
  invitation = e;
});
window.addEventListener('appinstalled', () => {
  invitation = null;
});

export function dejaInstallee() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function installable() {
  return !!invitation;
}

export async function installer() {
  if (!invitation) return false;
  const e = invitation;
  invitation = null;
  await e.prompt();
  const choix = await e.userChoice.catch(() => null);
  return choix?.outcome === 'accepted';
}
