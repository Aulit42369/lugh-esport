// Annonces de la structure : l'Administrateur général publie un message en tête de l'accueil de tous les jeux, ou de
// certains ; chacun le marque comme lu, et l'Administrateur général voit qui l'a lu.

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, exigerAdmin } from '../auth/acces.js';
import { jeuxDuCompteVisibles } from './auth.js';
import { texte, booleen, identifiant, date, tableau, objet, valider, nouvelId, MOTIFS } from '../../shared/validation.js';
import { aujourdhui } from '../../shared/temps.js';

const MAX_ANNONCES = 100;

export const formeAnnonce = objet({
  titre: texte({ max: 80, requis: true }),
  texte: texte({ max: 1500, multi: true, requis: true }),
  jeux: tableau(identifiant(MOTIFS.jeu, { requis: true }), { max: 15 }), // vide = tous les jeux
  importante: booleen(),
  expireLe: date(),
});

export function routesAnnonces(routeur, s) {
  const connecte = exigerConnexion(s);
  const admin = [exigerConnexion(s), exigerAdmin()];

  const jour = () => aujourdhui(s.config.fuseau);
  const enCours = (a) => !a.expireLe || a.expireLe >= jour();
  const visePour = (a, jeux) => !a.jeux?.length || a.jeux.some((j) => jeux.includes(j));

  // Comptes à qui une annonce s'adresse : actifs, avec accès à un des jeux visés ; l'auteur n'a pas à la lire.
  function destinataires(a, comptes) {
    return comptes.filter((c) => c.actif !== false && c._id !== a.par
      && visePour(a, jeuxDuCompteVisibles(s.registre, c).filter((j) => j.actif).map((j) => j.id)));
  }

  async function nomDe(id) {
    return id ? (await s.global.lire('comptes', id))?.nomAffiche || '' : '';
  }

  function controler(corps) {
    const v = valider(formeAnnonce, corps);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const inconnus = v.valeur.jeux.filter((j) => !s.registre.obtenir(j));
    if (inconnus.length) throw erreurs.invalide([{ chemin: 'jeux', message: `jeu inconnu : ${inconnus.join(', ')}` }]);
    return { ...v.valeur, jeux: [...new Set(v.valeur.jeux)] };
  }

  // Annonces en cours pour la personne connectée ; ?jeu= limite à celles qui visent ce jeu.
  routeur.get('/api/annonces', connecte, async (r) => {
    const mesJeux = jeuxDuCompteVisibles(s.registre, r.compteGlobal).map((j) => j.id);
    const jeu = r.query.get('jeu') || '';
    if (jeu && !mesJeux.includes(jeu)) throw erreurs.introuvable('Espace de jeu introuvable.');
    const toutes = (await s.global.lister('annonces', {}, { tri: { creeLe: -1 } }))
      .filter((a) => enCours(a) && visePour(a, jeu ? [jeu] : mesJeux));
    const annonces = [];
    for (const a of toutes) {
      annonces.push({
        _id: a._id, titre: a.titre, texte: a.texte, jeux: a.jeux, importante: !!a.importante, creeLe: a.creeLe,
        expireLe: a.expireLe || '', auteur: await nomDe(a.par), lu: !!a.lus?.[r.compteGlobal._id] || a.par === r.compteGlobal._id,
      });
    }
    annonces.sort((a, b) => Number(b.importante) - Number(a.importante) || b.creeLe.localeCompare(a.creeLe));
    envoyerJson(r.res, 200, { annonces });
  });

  routeur.post('/api/annonces/:id/lu', connecte, async (r) => {
    if (!MOTIFS.annonce.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const a = await s.global.lire('annonces', r.params.id);
    const mesJeux = jeuxDuCompteVisibles(s.registre, r.compteGlobal).map((j) => j.id);
    if (!a || !visePour(a, mesJeux)) throw erreurs.introuvable('Annonce introuvable.');
    // Écriture partielle : deux « lu » simultanés sont gardés tous les deux, et une correction de l'annonce n'est pas annulée.
    if (!a.lus?.[r.compteGlobal._id]) await s.global.modifier('annonces', a._id, { [`lus.${r.compteGlobal._id}`]: s.maintenant().toISOString() });
    envoyerJson(r.res, 200, { ok: true });
  });

  // ——— Administrateur général : toutes les annonces, avec qui les a lues ———

  routeur.get('/api/admin/annonces', ...admin, async (r) => {
    const comptes = await s.global.lister('comptes');
    const annonces = [];
    for (const a of await s.global.lister('annonces', {}, { tri: { creeLe: -1 } })) {
      const cibles = destinataires(a, comptes);
      annonces.push({
        _id: a._id, titre: a.titre, texte: a.texte, jeux: a.jeux, importante: !!a.importante, creeLe: a.creeLe,
        expireLe: a.expireLe || '', enCours: enCours(a), auteur: await nomDe(a.par), modifieLe: a.modifieLe || null,
        lus: cibles.filter((c) => a.lus?.[c._id]).map((c) => ({ nomAffiche: c.nomAffiche, le: a.lus[c._id] })),
        nonLus: cibles.filter((c) => !a.lus?.[c._id]).map((c) => c.nomAffiche),
      });
    }
    envoyerJson(r.res, 200, { annonces, max: MAX_ANNONCES, discord: (await s.annoncesDiscord.etat()).configure });
  });

  routeur.post('/api/admin/annonces', ...admin, async (r) => {
    const valeur = controler(await r.corps());
    // Les annonces expirées depuis plus de 30 jours disparaissent d'elles-mêmes.
    const limite = new Date(s.maintenant().getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const a of await s.global.lister('annonces')) if (a.expireLe && a.expireLe < limite) await s.global.supprimer('annonces', a._id);
    if ((await s.global.compter('annonces')) >= MAX_ANNONCES) throw erreurs.conflit(`${MAX_ANNONCES} annonces au maximum : supprime les plus anciennes.`);
    const corps = await r.corps();
    const doc = { _id: nouvelId('an'), ...valeur, creeLe: s.maintenant().toISOString(), par: r.compteGlobal._id, lus: {} };
    await s.global.ecrire('annonces', doc);
    await s.historique.ecrire(r.compteGlobal, 'annonce publiée', doc.titre);
    // Reprise dans #annonces du serveur Discord (sauf si décochée) ; un échec n'empêche jamais l'annonce dans Lugh.
    let discord = 'non';
    if (corps.discord !== false) {
      const noms = doc.jeux.map((j) => s.registre.obtenir(j)?.def.nom || j);
      discord = await s.annoncesDiscord.publier(doc, noms);
      if (discord === 'echec') await s.historique.ecrire(null, 'échec de la publication d’une annonce sur Discord', doc.titre);
    }
    envoyerJson(r.res, 201, { annonce: { _id: doc._id }, discord });
  });

  // relire: true remet les lectures à zéro (changement important du texte).
  routeur.put('/api/admin/annonces/:id', ...admin, async (r) => {
    if (!MOTIFS.annonce.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const a = await s.global.lire('annonces', r.params.id);
    if (!a) throw erreurs.introuvable('Annonce introuvable.');
    const corps = await r.corps();
    const valeur = controler(corps);
    // Les lectures ne sont réécrites que pour « relire » : un « lu » arrivé pendant la correction reste.
    const champs = { ...valeur, modifieLe: s.maintenant().toISOString(), ...(corps.relire === true ? { lus: {} } : {}) };
    await s.global.modifier('annonces', a._id, champs);
    await s.historique.ecrire(r.compteGlobal, 'annonce modifiée', valeur.titre);
    envoyerJson(r.res, 200, { ok: true });
  });

  routeur.delete('/api/admin/annonces/:id', ...admin, async (r) => {
    if (!MOTIFS.annonce.test(r.params.id)) throw erreurs.requete('Identifiant invalide.');
    const a = await s.global.lire('annonces', r.params.id);
    const ok = a ? await s.global.supprimer('annonces', a._id) : false;
    if (ok) await s.historique.ecrire(r.compteGlobal, 'annonce supprimée', a.titre);
    envoyerJson(r.res, 200, { ok });
  });
}
