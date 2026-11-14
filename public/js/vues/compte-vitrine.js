// Mon compte → Vitrine publique : chacun choisit d'apparaître sur la page d'accueil publique (décoché par défaut)
// et met ou retire sa photo. La photo est recadrée en carré et ré-encodée en JPEG ici (métadonnées perdues au
// passage) ; le serveur contrôle encore le type réel et retire ce qui resterait (src/domaine/photo.js).

import { h, bouton, caseACocher, toast, messageErreur } from '../ui.js';
import { api } from '../api.js';
import * as E from '../etat.js';

const COTE = 512;
const FICHIER_MAX = 10 * 1024 * 1024;

async function versJpeg(fichier) {
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) throw new Error('Choisis une image JPEG, PNG ou WebP.');
  if (fichier.size > FICHIER_MAX) throw new Error('Image trop lourde (10 Mo au plus).');
  const image = await createImageBitmap(fichier);
  const cote = Math.min(image.width, image.height);
  const toile = document.createElement('canvas');
  toile.width = COTE;
  toile.height = COTE;
  toile.getContext('2d').drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, COTE, COTE);
  image.close?.();
  const blob = await new Promise((ok) => { toile.toBlob(ok, 'image/jpeg', 0.85); });
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

async function rafraichir(fiche) {
  const r = await api('GET', '/api/auth/moi');
  E.majCompte(r.compte);
  fiche.replaceWith(ficheVitrine(r.compte));
}

export function ficheVitrine(c) {
  const v = c.vitrine || { visible: false, photo: false };
  const choix = caseACocher('Apparaître sur la vitrine publique', { coche: v.visible });
  const fichier = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'visuellement-cache', id: 'photo-vitrine' });
  const fiche = h('section', { class: 'fiche pile', 'aria-labelledby': 'titre-vitrine' },
    h('h2', { id: 'titre-vitrine' }, 'Vitrine publique'),
    h('p', { class: 'texte-2 petit' }, 'La page d’accueil du site, visible par tout le monde, présente l’équipe. Si tu coches la case, ton pseudo et ton rôle y apparaissent (et ta photo si tu en mets une). Jamais ton nom, ton identifiant ni tes autres données. Tu peux décocher ou retirer ta photo à tout moment ; le staff peut aussi te masquer.'),
    choix.element,
    h('div', { class: 'rangee' },
      v.photo ? h('img', { src: `/api/moi/photo?${Date.now()}`, alt: 'Ta photo actuelle', width: 72, height: 72, class: 'photo-vitrine' }) : null,
      fichier,
      h('label', { class: 'btn', for: 'photo-vitrine' }, v.photo ? 'Changer ma photo' : 'Ajouter une photo'),
      v.photo ? bouton('Retirer ma photo', { classe: 'btn--danger', onclick: async () => {
        try {
          await api('DELETE', '/api/moi/photo');
          toast('Photo retirée.');
          await rafraichir(fiche);
        } catch (e) { toast(messageErreur(e), { type: 'erreur' }); }
      } }) : null),
    h('p', { class: 'texte-3 petit' }, 'Photo carrée, recadrée au centre (JPEG, PNG ou WebP). Les informations cachées de l’image (lieu, appareil) sont retirées. Pour un joueur mineur, la photo ne s’affiche qu’une fois le droit à l’image signé par ses parents.'));

  choix.input.addEventListener('change', async () => {
    try {
      await api('PUT', '/api/moi/vitrine', { visible: choix.input.checked });
      toast(choix.input.checked ? 'Tu apparais sur la vitrine publique.' : 'Tu n’apparais plus sur la vitrine publique.');
      await rafraichir(fiche);
    } catch (e) {
      choix.input.checked = !choix.input.checked;
      toast(messageErreur(e), { type: 'erreur' });
    }
  });
  fichier.addEventListener('change', async () => {
    const f = fichier.files?.[0];
    if (!f) return;
    try {
      await api('PUT', '/api/moi/photo', { image: await versJpeg(f) });
      toast(v.visible ? 'Photo enregistrée.' : 'Photo enregistrée. Coche la case pour apparaître sur la vitrine.');
      await rafraichir(fiche);
    } catch (e) { toast(messageErreur(e), { type: 'erreur' }); }
  });
  return fiche;
}
