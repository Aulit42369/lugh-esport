// Vitrine publique : lecture sans connexion (données choisies publiques, voir domaine/vitrine.js), et pour chacun,
// depuis Mon compte, le choix d'y apparaître et sa photo (consentement, retrait à tout moment).

import { randomBytes } from 'node:crypto';
import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, modifierCompte } from '../auth/acces.js';
import { lireIdentite } from './administratif.js';
import { construireVitrine, photosPubliees } from '../domaine/vitrine.js';
import { nettoyerJpeg, PHOTO_OCTETS_MAX } from '../domaine/photo.js';

function envoyerImage(r, photo, cache) {
  const octets = Buffer.from(photo.donnees, 'base64');
  r.res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': octets.length, 'Cache-Control': cache });
  r.res.end(r.req.method === 'HEAD' ? undefined : octets);
}

export function routesVitrine(routeur, s) {
  const connecte = exigerConnexion(s);
  const vitrine = async () => construireVitrine({ global: s.global, registre: s.registre, identite: await lireIdentite(s.global) });

  // shortcut: recalculée à chaque visite (quelques lectures par jeu) ; ajouter un cache de 30 s si la vitrine devient très visitée.
  routeur.get('/api/public/vitrine', async (r) => {
    envoyerJson(r.res, 200, await vitrine());
  });

  // Servie seulement si elle est publiée en ce moment : retirée, masquée par le staff ou consentement retiré → 404.
  routeur.get('/api/public/photo/:cle', async (r) => {
    const cle = r.params.cle;
    if (!/^[a-f0-9]{24}$/.test(cle) || !photosPubliees(await vitrine()).has(`/api/public/photo/${cle}`)) throw erreurs.introuvable('Photo introuvable.');
    const [photo] = await s.global.lister('photos', { cle });
    if (!photo) throw erreurs.introuvable('Photo introuvable.');
    envoyerImage(r, photo, 'public, max-age=300');
  });

  routeur.put('/api/moi/vitrine', connecte, async (r) => {
    const { visible } = await r.corps();
    if (typeof visible !== 'boolean') throw erreurs.invalide([{ chemin: 'visible', message: 'doit être vrai ou faux' }]);
    await modifierCompte(s, r.compte._id, { 'vitrine.visible': visible });
    await s.historique.ecrire(r.compte, visible ? 'apparaît sur la vitrine publique' : 'retiré de la vitrine publique');
    envoyerJson(r.res, 200, { ok: true });
  });

  // Photo envoyée en JPEG (base64), déjà réduite et ré-encodée par le navigateur ; contrôlée et nettoyée ici.
  routeur.put('/api/moi/photo', connecte, async (r) => {
    const { image } = await r.corps(Math.ceil(PHOTO_OCTETS_MAX * 1.4) + 1024);
    if (typeof image !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(image)) throw erreurs.invalide([{ chemin: 'image', message: 'image manquante' }]);
    let propre;
    try {
      propre = nettoyerJpeg(Buffer.from(image, 'base64'));
    } catch (e) {
      throw erreurs.invalide([{ chemin: 'image', message: e.message }]);
    }
    const cle = randomBytes(12).toString('hex'); // nouvelle adresse à chaque photo : l'ancienne n'est plus servie
    await s.global.ecrire('photos', { _id: r.compte._id, cle, donnees: propre.octets.toString('base64'), le: s.maintenant().toISOString() });
    await modifierCompte(s, r.compte._id, { 'vitrine.photo': cle });
    await s.historique.ecrire(r.compte, 'photo de la vitrine changée');
    envoyerJson(r.res, 200, { ok: true });
  });

  routeur.delete('/api/moi/photo', connecte, async (r) => {
    await s.global.supprimer('photos', r.compte._id);
    await modifierCompte(s, r.compte._id, { 'vitrine.photo': null });
    await s.historique.ecrire(r.compte, 'photo de la vitrine retirée');
    envoyerJson(r.res, 200, { ok: true });
  });

  // Aperçu de sa propre photo dans Mon compte, même quand elle n'est pas (encore) publiée.
  routeur.get('/api/moi/photo', connecte, async (r) => {
    const photo = await s.global.lire('photos', r.compte._id);
    if (!photo) throw erreurs.introuvable('Aucune photo.');
    envoyerImage(r, photo, 'no-store');
  });
}
