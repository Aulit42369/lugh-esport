// Sorties vers l'extérieur : copier un texte (Discord), télécharger un fichier (agenda, CSV).

import { h, modale, toast } from '../ui.js';

export async function copierTexte(texte, { titre = 'Texte à copier', succes = 'Copié : colle-le dans le salon Discord.' } = {}) {
  try {
    await navigator.clipboard.writeText(texte);
    toast(succes);
  } catch {
    // Presse-papiers refusé (navigateur ou réglage) : le texte s'affiche, déjà sélectionné.
    const zone = h('textarea', { class: 'saisie', rows: 10, readonly: true, value: texte });
    modale({ titre, contenu: [h('p', { class: 'texte-2 petit' }, 'Copie ce texte (Ctrl + C ou appui long), puis colle-le dans Discord.'), zone], actions: [{ libelle: 'Fermer', classe: 'btn--principal' }] });
    zone.focus();
    zone.select();
  }
}

export function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = h('a', { href: url, download: nom, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
