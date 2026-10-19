// Livre des comptes de l'association (Administrateur général et comptes Trésorier) : écritures, réglages (début
// d'exercice, soldes d'ouverture), clôture d'un exercice (plus aucune écriture modifiable dans ses dates),
// rapprochement avec le relevé bancaire, export tableur. Les justificatifs restent hors de Lugh : seul leur numéro
// de pièce est noté. Collection « ecritures » et document parametres/structure-comptes de la base globale.

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion } from '../auth/acces.js';
import { valider, nouvelId, date } from '../../shared/validation.js';
import {
  ecriture as schemaEcriture, reglagesComptes, bornesExercice, exerciceDe, bilanExercice, soldes, csvEcritures, euros, MONTANT_MAX,
} from '../../shared/administratif/comptes.js';
import { exerciceValide } from '../../shared/administratif/identite.js';
import { MARQUE } from '../../shared/marque.js';

export const ID_COMPTES = 'structure-comptes';
const MAX_ECRITURES = 5000;
const MOTIF_ID = /^e-[a-z0-9]{4,40}$/;

export function exigerTresorier() {
  return async (r) => {
    if (!r.compteGlobal?.admin && !r.compteGlobal?.tresorier) throw erreurs.interdit('Réservé au trésorier et à l’Administrateur général.');
  };
}

export function routesTresorerie(routeur, s) {
  const tresorier = [exigerConnexion(s), exigerTresorier()];

  async function reglages() {
    const doc = (await s.global.lire('parametres', ID_COMPTES)) || {};
    return { ...valider(reglagesComptes, doc).valeur, clotures: Array.isArray(doc.clotures) ? doc.clotures : [], rapprochement: doc.rapprochement || null };
  }
  const ecrire = async (r) => s.global.ecrire('parametres', { _id: ID_COMPTES, ...r });
  const toutes = () => s.global.lister('ecritures', {}, { tri: { date: 1, creeLe: 1 } });
  const cloture = (reg, jour) => reg.clotures.includes(exerciceDe(jour, reg.debutExercice).annee);

  function exerciceDemande(r, reg) {
    const brut = r.query.get('exercice');
    if (!brut) return exerciceDe(s.maintenant().toISOString().slice(0, 10), reg.debutExercice);
    const v = valider(exerciceValide, brut);
    if (!v.ok || v.valeur === null) throw erreurs.requete('Exercice invalide.');
    return bornesExercice(v.valeur, reg.debutExercice);
  }

  async function verifierEcriture(corps, reg) {
    const v = valider(schemaEcriture, corps);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    if (cloture(reg, v.valeur.date)) throw erreurs.conflit(`L’exercice ${exerciceDe(v.valeur.date, reg.debutExercice).libelle} est clôturé : rouvre-le d’abord.`);
    if (reg.ouverture.date && v.valeur.date < reg.ouverture.date) throw erreurs.conflit('Date antérieure à l’ouverture des comptes.');
    return v.valeur;
  }

  routeur.get('/api/tresorerie', ...tresorier, async (r) => {
    const reg = await reglages();
    const bornes = exerciceDemande(r, reg);
    const liste = await toutes();
    const auj = s.maintenant().toISOString().slice(0, 10);
    const rap = reg.rapprochement ? { ...reg.rapprochement, calcule: soldes(liste, reg.ouverture, reg.rapprochement.date).banque } : null;
    envoyerJson(r.res, 200, {
      reglages: reg,
      exercice: { ...bornes, cloture: reg.clotures.includes(bornes.annee) },
      ecritures: liste.filter((e) => e.date >= bornes.debut && e.date <= bornes.fin).reverse(),
      bilan: bilanExercice(liste, bornes, reg.ouverture),
      soldesDuJour: soldes(liste, reg.ouverture, auj),
      rapprochement: rap ? { ...rap, ecart: rap.solde - rap.calcule } : null,
      exercices: [...new Set([exerciceDe(auj, reg.debutExercice).annee, ...liste.map((e) => exerciceDe(e.date, reg.debutExercice).annee)])].sort((a, b) => b - a),
      nombre: liste.length,
      max: MAX_ECRITURES,
    });
  });

  routeur.post('/api/tresorerie/ecritures', ...tresorier, async (r) => {
    const reg = await reglages();
    const valeur = await verifierEcriture(await r.corps(), reg);
    if ((await s.global.compter('ecritures')) >= MAX_ECRITURES) throw erreurs.conflit(`${MAX_ECRITURES} écritures au maximum.`);
    const quand = s.maintenant().toISOString();
    const doc = { _id: nouvelId('e'), ...valeur, creeLe: quand, creePar: r.compteGlobal._id };
    await s.global.ecrire('ecritures', doc);
    await s.historique.ecrire(r.compteGlobal, 'écriture ajoutée au livre des comptes', valeur.libelle, `${valeur.sens} ${euros(valeur.montant)}`);
    envoyerJson(r.res, 201, { ecriture: doc });
  });

  routeur.put('/api/tresorerie/ecritures/:id', ...tresorier, async (r) => {
    const reg = await reglages();
    const actuelle = MOTIF_ID.test(String(r.params.id)) ? await s.global.lire('ecritures', r.params.id) : null;
    if (!actuelle) throw erreurs.introuvable('Écriture introuvable.');
    if (cloture(reg, actuelle.date)) throw erreurs.conflit('Cette écriture appartient à un exercice clôturé.');
    const valeur = await verifierEcriture(await r.corps(), reg);
    const doc = { ...actuelle, ...valeur, modifieLe: s.maintenant().toISOString(), modifiePar: r.compteGlobal._id };
    await s.global.ecrire('ecritures', doc);
    await s.historique.ecrire(r.compteGlobal, 'écriture modifiée dans le livre des comptes', valeur.libelle, `${valeur.sens} ${euros(valeur.montant)}`);
    envoyerJson(r.res, 200, { ecriture: doc });
  });

  routeur.delete('/api/tresorerie/ecritures/:id', ...tresorier, async (r) => {
    const reg = await reglages();
    const actuelle = MOTIF_ID.test(String(r.params.id)) ? await s.global.lire('ecritures', r.params.id) : null;
    if (!actuelle) throw erreurs.introuvable('Écriture introuvable.');
    if (cloture(reg, actuelle.date)) throw erreurs.conflit('Cette écriture appartient à un exercice clôturé.');
    await s.global.supprimer('ecritures', actuelle._id);
    await s.historique.ecrire(r.compteGlobal, 'écriture supprimée du livre des comptes', actuelle.libelle, `${actuelle.sens} ${euros(actuelle.montant)}`);
    envoyerJson(r.res, 200, { ok: true });
  });

  // Début d'exercice et soldes d'ouverture : seulement tant qu'aucun exercice n'est clôturé.
  routeur.put('/api/tresorerie/reglages', ...tresorier, async (r) => {
    const reg = await reglages();
    const v = valider(reglagesComptes, await r.corps());
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    if (reg.clotures.length) throw erreurs.conflit('Un exercice est clôturé : le début d’exercice et l’ouverture ne changent plus.');
    const ouvreLe = v.valeur.ouverture?.date;
    if (ouvreLe && (await toutes()).some((e) => e.date < ouvreLe)) {
      throw erreurs.conflit('Des écritures sont datées d’avant cette ouverture : choisis une date d’ouverture antérieure ou égale à la première écriture.');
    }
    await ecrire({ ...reg, ...v.valeur });
    await s.historique.ecrire(r.compteGlobal, 'réglages du livre des comptes modifiés');
    envoyerJson(r.res, 200, { reglages: await reglages() });
  });

  routeur.post('/api/tresorerie/cloture', ...tresorier, async (r) => {
    const { exercice, rouvrir = false } = (await r.corps()) || {};
    const v = valider(exerciceValide, exercice);
    if (!v.ok || v.valeur === null) throw erreurs.requete('Exercice invalide.');
    if (rouvrir && !r.compteGlobal.admin) throw erreurs.interdit('Seul l’Administrateur général rouvre un exercice clôturé.');
    const reg = await reglages();
    const bornes = bornesExercice(v.valeur, reg.debutExercice);
    if (!rouvrir && bornes.fin >= s.maintenant().toISOString().slice(0, 10)) throw erreurs.conflit(`L’exercice ${bornes.libelle} n’est pas terminé : il se clôture après le ${bornes.fin}.`);
    const clotures = rouvrir ? reg.clotures.filter((a) => a !== v.valeur) : [...new Set([...reg.clotures, v.valeur])].sort();
    await ecrire({ ...reg, clotures });
    await s.historique.ecrire(r.compteGlobal, rouvrir ? 'exercice rouvert' : 'exercice clôturé', bornes.libelle);
    envoyerJson(r.res, 200, { reglages: await reglages() });
  });

  // Rapprochement : le solde lu sur le relevé bancaire à une date, comparé au solde calculé.
  routeur.post('/api/tresorerie/rapprochement', ...tresorier, async (r) => {
    const corps = (await r.corps()) || {};
    const jour = valider(date({ requis: true }), corps.date);
    if (!jour.ok || !Number.isInteger(corps.solde) || Math.abs(corps.solde) > MONTANT_MAX) throw erreurs.requete('Date ou solde invalide.');
    const reg = await reglages();
    await ecrire({ ...reg, rapprochement: { date: jour.valeur, solde: corps.solde, le: s.maintenant().toISOString(), par: r.compteGlobal._id } });
    await s.historique.ecrire(r.compteGlobal, 'rapprochement bancaire', jour.valeur, euros(corps.solde));
    envoyerJson(r.res, 200, { ok: true });
  });

  routeur.get('/api/tresorerie/export', ...tresorier, async (r) => {
    const reg = await reglages();
    const bornes = exerciceDemande(r, reg);
    const liste = (await toutes()).filter((e) => e.date >= bornes.debut && e.date <= bornes.fin);
    const corps = csvEcritures(liste);
    await s.historique.ecrire(r.compteGlobal, 'export du livre des comptes', bornes.libelle);
    r.res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${MARQUE.id}-comptes-${bornes.libelle}.csv"`,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(corps),
    });
    r.res.end(corps);
  });
}

