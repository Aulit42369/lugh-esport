// Nom de la structure et identifiants qui en découlent : source unique pour le code (serveur et navigateur).
// Les fichiers statiques (manifest.webmanifest, index.html, sw.js) reprennent les mêmes valeurs à la main.
// L'identifiant ne change plus après la première mise en ligne : il nomme l'application installée et ses données.

export const MARQUE = {
  nom: 'Lugh',
  id: 'lugh',
  symbole: '/icones/marque-symbole.svg', // écusson seul, valable sur les deux thèmes
  mot: '/icones/marque-mot.svg', // lettrage « LUGH » vectorisé (aucune police nécessaire)
  slogan: 'Le soleil se lève avec nous.', // Lugh « le brillant » et le soleil levant de l'écusson (choisie le 19/10/2026)
};
