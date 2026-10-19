// Couleur d'accent de chaque jeu : on voit d'un coup d'œil dans quel jeu on saisit. Palette fermée, inspirée des
// couleurs des jeux sans les reproduire, et vérifiée : chaque teinte contraste à 4,5:1 au moins avec les fonds des
// deux thèmes (sombre par défaut, clair), et le texte posé sur la pastille du jeu aussi. Source unique des couleurs
// de jeu : rien d'autre n'en définit.

export const COULEURS_JEU = [
  { id: 'corail', nom: 'Corail', sombre: '#f45b69', clair: '#b82a3a' },
  { id: 'ambre', nom: 'Ambre', sombre: '#e9a847', clair: '#8a590c' },
  { id: 'sarcelle', nom: 'Sarcelle', sombre: '#2dc2b5', clair: '#0f6b62' },
  { id: 'acier', nom: 'Acier', sombre: '#84a9d8', clair: '#3d6597' },
  { id: 'orange', nom: 'Orange', sombre: '#f39233', clair: '#984a06' },
  { id: 'azur', nom: 'Azur', sombre: '#4d97f7', clair: '#1f5ec0' },
  { id: 'vert', nom: 'Vert', sombre: '#45d68e', clair: '#186c40' },
  { id: 'brique', nom: 'Brique', sombre: '#f0714f', clair: '#b23a24' },
  { id: 'violet', nom: 'Violet', sombre: '#a97df2', clair: '#6b3fc0' },
  { id: 'sable', nom: 'Sable', sombre: '#cdb98b', clair: '#6c5a30' },
  { id: 'menthe', nom: 'Menthe', sombre: '#7fd6b0', clair: '#286f53' },
  { id: 'rose', nom: 'Rose', sombre: '#f28fc6', clair: '#a8326f' },
  { id: 'lavande', nom: 'Lavande', sombre: '#9aa5f5', clair: '#4c56b8' },
  { id: 'citron', nom: 'Citron', sombre: '#d4d85a', clair: '#5f6110' },
];

// Texte posé sur la pastille du jeu : encre sombre sur la teinte du thème sombre, blanc sur celle du thème clair.
export const ENCRE_PASTILLE = { sombre: '#0f0c09', clair: '#ffffff' };

// Teinte proposée à l'activation d'un jeu du catalogue (proche de l'esprit du jeu, jamais sa couleur exacte).
export const COULEUR_PAR_MODELE = {
  valorant: 'corail', cs2: 'ambre', lol: 'sarcelle', r6: 'acier', ow2: 'orange', rl: 'azur', fc: 'vert', apex: 'brique', fortnite: 'violet',
};

export const estCouleurJeu = (id) => COULEURS_JEU.some((c) => c.id === id);

export function couleurJeu(id) {
  return COULEURS_JEU.find((c) => c.id === id) || null;
}

// Couleur d'un nouveau jeu : celle de son modèle si aucun autre jeu ne l'a déjà, sinon la première encore libre.
export function couleurPourNouveauJeu(modele, prises = []) {
  const prefere = COULEUR_PAR_MODELE[modele];
  if (prefere && !prises.includes(prefere)) return prefere;
  return (COULEURS_JEU.find((c) => !prises.includes(c.id) && !Object.values(COULEUR_PAR_MODELE).includes(c.id))
    || COULEURS_JEU.find((c) => !prises.includes(c.id))
    || COULEURS_JEU[0]).id;
}
