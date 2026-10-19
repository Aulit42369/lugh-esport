// Livres des comptes de la structure (Administrateur général et comptes Trésorier) : celui de l'association et, une
// fois la société créée (Identité → forme « Société »), celui de la société. Chaque livre a ses écritures, ses
// catégories, ses réglages (début d'exercice, soldes d'ouverture), ses clôtures et son rapprochement bancaire.
// Les justificatifs restent hors de Lugh : seul leur numéro de pièce est noté.
// Collection « ecritures » (champ « livre », absent = association) et documents parametres/structure-comptes(-societe).

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion } from '../auth/acces.js';
import { valider, nouvelId, date } from '../../shared/validation.js';
import {
  schemaEcriture, reglagesComptes, bornesExercice, exerciceDe, bilanExercice, soldes, csvEcritures, euros, MONTANT_MAX,
  LIVRES, livreValide, recettesCommerciales,
} from '../../shared/administratif/comptes.js';
import { exerciceValide, contexteStructure } from '../../shared/administratif/identite.js';
import { SEUILS } from '../../shared/administratif/obligations.js';
import { MARQUE } from '../../shared/marque.js';
import { lireIdentite } from './administratif.js';

export const ID_COMPTES = 'structure-comptes';
export const ID_COMPTES_SOCIETE = 'structure-comptes-societe';
const ID_PARAMETRES = { association: ID_COMPTES, societe: ID_COMPTES_SOCIETE };
const MAX_ECRITURES = 5000; // par livre
const MOTIF_ID = /^e-[a-z0-9]{4,40}$/;

export const livreDe = (e) => (e?.livre === 'societe' ? 'societe' : 'association');
const nomLivre = (livre) => LIVRES.find((l) => l.id === livre)?.nom.toLowerCase() || livre;

export function exigerTresorier() {
  return async (r) => {
    if (!r.compteGlobal?.admin && !r.compteGlobal?.tresorier) throw erreurs.interdit('Réservé au trésorier et à l’Administrateur général.');
  };
}

export function routesTresorerie(routeur, s) {
  const tresorier = [exigerConnexion(s), exigerTresorier()];

  async function reglages(livre) {
    const doc = (await s.global.lire('parametres', ID_PARAMETRES[livre])) || {};
    return { ...valider(reglagesComptes, doc).valeur, clotures: Array.isArray(doc.clotures) ? doc.clotures : [], rapprochement: doc.rapprochement || null };
  }
  const ecrire = async (livre, r) => s.global.ecrire('parametres', { _id: ID_PARAMETRES[livre], ...r });
  const toutes = async (livre) => (await s.global.lister('ecritures', {}, { tri: { date: 1, creeLe: 1 } })).filter((e) => livreDe(e) === livre);
  const cloture = (reg, jour) => reg.clotures.includes(exerciceDe(jour, reg.debutExercice).annee);
  const aujourdhui = () => s.maintenant().toISOString().slice(0, 10);

  // Livres consultables : l'association toujours ; la société si elle est créée, ou si son livre a déjà des écritures
  // (retour à la forme « association » après une erreur : rien ne disparaît).
  async function livresDisponibles(ctx) {
    const societe = ctx.societe || (await toutes('societe')).length > 0;
    return LIVRES.filter((l) => l.id === 'association' || societe);
  }

  const SOCIETE_ABSENTE = 'La société n’est pas créée : passe la forme juridique à « Société » dans Administratif → Identité.';

  // ecriture : la requête modifie le livre ; celui de la société n'est modifiable que si la société existe.
  async function livreDemande(r, { ecriture = false } = {}) {
    const livre = r.query.get('livre') || 'association';
    if (!livreValide(livre)) throw erreurs.requete('Livre inconnu.');
    const ctx = contexteStructure(await lireIdentite(s.global));
    if (livre === 'societe' && ecriture && !ctx.societe) throw erreurs.conflit(SOCIETE_ABSENTE);
    return { livre, ctx };
  }

  function exerciceDemande(r, reg) {
    const brut = r.query.get('exercice');
    if (!brut) return exerciceDe(aujourdhui(), reg.debutExercice);
    const v = valider(exerciceValide, brut);
    if (!v.ok || v.valeur === null) throw erreurs.requete('Exercice invalide.');
    return bornesExercice(v.valeur, reg.debutExercice);
  }

  async function verifierEcriture(corps, reg, livre) {
    const v = valider(schemaEcriture(livre), corps);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    if (cloture(reg, v.valeur.date)) throw erreurs.conflit(`L’exercice ${exerciceDe(v.valeur.date, reg.debutExercice).libelle} est clôturé : rouvre-le d’abord.`);
    if (reg.ouverture.date && v.valeur.date < reg.ouverture.date) throw erreurs.conflit('Date antérieure à l’ouverture des comptes.');
    return v.valeur;
  }

  async function ecritureExistante(r) {
    const actuelle = MOTIF_ID.test(String(r.params.id)) ? await s.global.lire('ecritures', r.params.id) : null;
    if (!actuelle) throw erreurs.introuvable('Écriture introuvable.');
    const livre = livreDe(actuelle);
    if (livre === 'societe' && !contexteStructure(await lireIdentite(s.global)).societe) throw erreurs.conflit(SOCIETE_ABSENTE);
    const reg = await reglages(livre);
    if (cloture(reg, actuelle.date)) throw erreurs.conflit('Cette écriture appartient à un exercice clôturé.');
    return { actuelle, livre, reg };
  }

  // « Prêt pour la société ? » : recettes commerciales de l'association sur 12 mois, face à la franchise des impôts
  // commerciaux et au seuil de passage choisi dans Identité (s'il y a un passage prévu).
  function indicateur(liste, ctx) {
    return {
      commerciales: recettesCommerciales(liste, aujourdhui()),
      franchise: SEUILS.franchiseImpotsCommerciaux * 100,
      seuilPassage: ctx.passage && !ctx.societe ? ctx.seuilPassage * 100 : null,
    };
  }

  routeur.get('/api/tresorerie', ...tresorier, async (r) => {
    const { livre, ctx } = await livreDemande(r);
    const livres = await livresDisponibles(ctx);
    if (!livres.some((l) => l.id === livre)) throw erreurs.introuvable('La société n’a pas encore de livre des comptes.');
    const reg = await reglages(livre);
    const bornes = exerciceDemande(r, reg);
    const liste = await toutes(livre);
    const auj = aujourdhui();
    const rap = reg.rapprochement ? { ...reg.rapprochement, calcule: soldes(liste, reg.ouverture, reg.rapprochement.date).banque } : null;
    envoyerJson(r.res, 200, {
      livre,
      livres,
      ecriturePossible: livre === 'association' || ctx.societe,
      reglages: reg,
      exercice: { ...bornes, cloture: reg.clotures.includes(bornes.annee) },
      ecritures: liste.filter((e) => e.date >= bornes.debut && e.date <= bornes.fin).reverse(),
      bilan: bilanExercice(liste, bornes, reg.ouverture, livre),
      soldesDuJour: soldes(liste, reg.ouverture, auj),
      rapprochement: rap ? { ...rap, ecart: rap.solde - rap.calcule } : null,
      exercices: [...new Set([exerciceDe(auj, reg.debutExercice).annee, ...liste.map((e) => exerciceDe(e.date, reg.debutExercice).annee)])].sort((a, b) => b - a),
      indicateur: livre === 'association' ? indicateur(liste, ctx) : null,
      nombre: liste.length,
      max: MAX_ECRITURES,
    });
  });

  routeur.post('/api/tresorerie/ecritures', ...tresorier, async (r) => {
    const { livre } = await livreDemande(r, { ecriture: true });
    const reg = await reglages(livre);
    const valeur = await verifierEcriture(await r.corps(), reg, livre);
    if ((await toutes(livre)).length >= MAX_ECRITURES) throw erreurs.conflit(`${MAX_ECRITURES} écritures au maximum par livre.`);
    const quand = s.maintenant().toISOString();
    const doc = { _id: nouvelId('e'), livre, ...valeur, creeLe: quand, creePar: r.compteGlobal._id };
    await s.global.ecrire('ecritures', doc);
    await s.historique.ecrire(r.compteGlobal, `écriture ajoutée au livre des comptes (${nomLivre(livre)})`, valeur.libelle, `${valeur.sens} ${euros(valeur.montant)}`);
    envoyerJson(r.res, 201, { ecriture: doc });
  });

  // Une écriture reste dans son livre : le livre se lit sur l'écriture enregistrée, jamais dans la requête.
  routeur.put('/api/tresorerie/ecritures/:id', ...tresorier, async (r) => {
    const { actuelle, livre, reg } = await ecritureExistante(r);
    const valeur = await verifierEcriture(await r.corps(), reg, livre);
    const doc = { ...actuelle, ...valeur, livre, modifieLe: s.maintenant().toISOString(), modifiePar: r.compteGlobal._id };
    await s.global.ecrire('ecritures', doc);
    await s.historique.ecrire(r.compteGlobal, `écriture modifiée dans le livre des comptes (${nomLivre(livre)})`, valeur.libelle, `${valeur.sens} ${euros(valeur.montant)}`);
    envoyerJson(r.res, 200, { ecriture: doc });
  });

  routeur.delete('/api/tresorerie/ecritures/:id', ...tresorier, async (r) => {
    const { actuelle, livre } = await ecritureExistante(r);
    await s.global.supprimer('ecritures', actuelle._id);
    await s.historique.ecrire(r.compteGlobal, `écriture supprimée du livre des comptes (${nomLivre(livre)})`, actuelle.libelle, `${actuelle.sens} ${euros(actuelle.montant)}`);
    envoyerJson(r.res, 200, { ok: true });
  });

  // Début d'exercice et soldes d'ouverture : seulement tant qu'aucun exercice n'est clôturé.
  routeur.put('/api/tresorerie/reglages', ...tresorier, async (r) => {
    const { livre } = await livreDemande(r, { ecriture: true });
    const reg = await reglages(livre);
    const v = valider(reglagesComptes, await r.corps());
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    if (reg.clotures.length) throw erreurs.conflit('Un exercice est clôturé : le début d’exercice et l’ouverture ne changent plus.');
    const ouvreLe = v.valeur.ouverture?.date;
    if (ouvreLe && (await toutes(livre)).some((e) => e.date < ouvreLe)) {
      throw erreurs.conflit('Des écritures sont datées d’avant cette ouverture : choisis une date d’ouverture antérieure ou égale à la première écriture.');
    }
    await ecrire(livre, { ...reg, ...v.valeur });
    await s.historique.ecrire(r.compteGlobal, `réglages du livre des comptes modifiés (${nomLivre(livre)})`);
    envoyerJson(r.res, 200, { reglages: await reglages(livre) });
  });

  routeur.post('/api/tresorerie/cloture', ...tresorier, async (r) => {
    const { livre } = await livreDemande(r, { ecriture: true });
    const { exercice, rouvrir = false } = (await r.corps()) || {};
    const v = valider(exerciceValide, exercice);
    if (!v.ok || v.valeur === null) throw erreurs.requete('Exercice invalide.');
    if (rouvrir && !r.compteGlobal.admin) throw erreurs.interdit('Seul l’Administrateur général rouvre un exercice clôturé.');
    const reg = await reglages(livre);
    const bornes = bornesExercice(v.valeur, reg.debutExercice);
    if (!rouvrir && bornes.fin >= aujourdhui()) throw erreurs.conflit(`L’exercice ${bornes.libelle} n’est pas terminé : il se clôture après le ${bornes.fin}.`);
    const clotures = rouvrir ? reg.clotures.filter((a) => a !== v.valeur) : [...new Set([...reg.clotures, v.valeur])].sort();
    await ecrire(livre, { ...reg, clotures });
    await s.historique.ecrire(r.compteGlobal, `${rouvrir ? 'exercice rouvert' : 'exercice clôturé'} (${nomLivre(livre)})`, bornes.libelle);
    envoyerJson(r.res, 200, { reglages: await reglages(livre) });
  });

  // Rapprochement : le solde lu sur le relevé bancaire à une date, comparé au solde calculé.
  routeur.post('/api/tresorerie/rapprochement', ...tresorier, async (r) => {
    const { livre } = await livreDemande(r, { ecriture: true });
    const corps = (await r.corps()) || {};
    const jour = valider(date({ requis: true }), corps.date);
    if (!jour.ok || !Number.isInteger(corps.solde) || Math.abs(corps.solde) > MONTANT_MAX) throw erreurs.requete('Date ou solde invalide.');
    const reg = await reglages(livre);
    await ecrire(livre, { ...reg, rapprochement: { date: jour.valeur, solde: corps.solde, le: s.maintenant().toISOString(), par: r.compteGlobal._id } });
    await s.historique.ecrire(r.compteGlobal, `rapprochement bancaire (${nomLivre(livre)})`, jour.valeur, euros(corps.solde));
    envoyerJson(r.res, 200, { ok: true });
  });

  routeur.get('/api/tresorerie/export', ...tresorier, async (r) => {
    const { livre } = await livreDemande(r);
    const reg = await reglages(livre);
    const bornes = exerciceDemande(r, reg);
    const liste = (await toutes(livre)).filter((e) => e.date >= bornes.debut && e.date <= bornes.fin);
    const corps = csvEcritures(liste, livre);
    await s.historique.ecrire(r.compteGlobal, `export du livre des comptes (${nomLivre(livre)})`, bornes.libelle);
    r.res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${MARQUE.id}-comptes-${livre}-${bornes.libelle}.csv"`,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(corps),
    });
    r.res.end(corps);
  });
}
