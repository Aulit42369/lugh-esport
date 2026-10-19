// Passage de l'association à la société : forme juridique, sections d'obligations visibles, deux livres des comptes
// séparés, indicateur « Prêt pour la société ? », documents du passage, veille limitée à ce qui concerne la structure.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, connecterEtChanger } from './simulation.js';
import { SECTIONS, sectionsVisibles, statutParDefaut, tousLesPoints, SEUILS } from '../shared/administratif/obligations.js';
import { contexteStructure, nomPublic, identite as schemaIdentite } from '../shared/administratif/identite.js';
import { schemaEcriture, bilanExercice, bornesExercice, recettesCommerciales, nomCategorie } from '../shared/administratif/comptes.js';
import { documentType, DOCUMENTS } from '../shared/administratif/documents.js';
import { sourceOfficielle } from '../src/domaine/veille.js';
import { valider } from '../shared/validation.js';

const ids = (sections) => sections.map((s) => s.id);

test('forme juridique : sections visibles selon la forme et le passage prévu, statut « Plus tard » du passage', () => {
  const asso = contexteStructure(valider(schemaIdentite, {}).valeur);
  assert.deepEqual([asso.forme, asso.association, asso.societe, asso.passage], ['association', true, false, false]);
  assert.ok(!ids(sectionsVisibles(SECTIONS, asso)).includes('passage'));
  assert.ok(!ids(sectionsVisibles(SECTIONS, asso)).includes('societe'));
  const prevu = contexteStructure({ passagePrevu: true, seuilPassage: 15000 });
  assert.ok(ids(sectionsVisibles(SECTIONS, prevu)).includes('passage'));
  assert.equal(prevu.seuilPassage, 15000);
  const seule = contexteStructure({ forme: 'societe', associationMaintenue: false, societeNom: 'Lugh SAS' });
  const vues = ids(sectionsVisibles(SECTIONS, seule));
  assert.ok(vues.includes('societe') && vues.includes('passage') && vues.includes('mineurs'));
  assert.ok(!vues.includes('creation') && !vues.includes('gestion'), 'plus de gestion d’association si elle est dissoute');
  assert.ok(ids(sectionsVisibles(SECTIONS, contexteStructure({ forme: 'societe' }))).includes('gestion'), 'association maintenue par défaut');
  assert.equal(nomPublic({ forme: 'societe', societeNom: 'Lugh SAS', nom: 'Lugh', associationMaintenue: false }), 'Lugh SAS');
  assert.equal(nomPublic({ forme: 'societe', societeNom: 'Lugh SAS', nom: 'Lugh' }), 'Lugh et Lugh SAS', 'association maintenue : les deux');
  assert.equal(nomPublic({ forme: 'association', societeNom: 'Lugh SAS', nom: 'Lugh' }), 'Lugh');
  assert.equal(statutParDefaut(SECTIONS.find((s) => s.id === 'passage')), 'plus_tard');
  assert.equal(statutParDefaut(SECTIONS.find((s) => s.id === 'passage'), { societe: true }), 'a_faire', 'société créée : le passage est d’actualité');
  assert.equal(statutParDefaut(SECTIONS.find((s) => s.id === 'mineurs')), 'a_faire');
  // Toutes les sources du référentiel passent le filtre de la veille (sites officiels, https).
  for (const p of tousLesPoints()) for (const src of p.sources) assert.ok(sourceOfficielle(src), `${p.section}.${p.id} : ${src.url}`);
  assert.match(tousLesPoints().find((p) => p.id === 'impots').texte, new RegExp(String(SEUILS.franchiseImpotsCommerciaux).slice(0, 2)));
  assert.equal(valider(schemaIdentite, { siren: '12345' }).ok, false);
});

test('livres : catégories propres à la société, hors résultat à part, recettes commerciales sur 12 mois', () => {
  assert.equal(valider(schemaEcriture('societe'), { date: '2027-03-01', sens: 'depense', libelle: 'Salaire', montant: 100, moyen: 'banque', categorie: 'salaires' }).ok, true);
  assert.equal(valider(schemaEcriture('association'), { date: '2027-03-01', sens: 'depense', libelle: 'Salaire', montant: 100, moyen: 'banque', categorie: 'salaires' }).ok, false);
  assert.equal(valider(schemaEcriture('societe'), { date: '2027-03-01', sens: 'recette', libelle: 'x', montant: 100, moyen: 'banque', categorie: 'cotisations' }).ok, false);
  const e = [
    { date: '2027-01-10', sens: 'recette', montant: 100_000, moyen: 'banque', categorie: 'apports', libelle: 'Capital' },
    { date: '2027-02-10', sens: 'recette', montant: 50_000, moyen: 'banque', categorie: 'sponsors', libelle: 'Sponsor' },
    { date: '2027-03-10', sens: 'depense', montant: 20_000, moyen: 'banque', categorie: 'salaires', libelle: 'Salaire' },
  ];
  const b = bilanExercice(e, bornesExercice(2027, 1), {}, 'societe');
  assert.deepEqual([b.totalRecettes, b.totalDepenses, b.resultat], [50_000, 20_000, 30_000], 'le capital n’est pas un produit');
  assert.deepEqual(b.horsResultat.map((c) => [c.id, c.sens, c.montant]), [['apports', 'recette', 100_000]]);
  assert.equal(b.soldeFin.banque, 130_000, 'mais il est dans la trésorerie');
  assert.equal(nomCategorie('depense', 'salaires', 'societe'), 'Salaires (joueurs, staff)');
  const asso = [
    { date: '2026-11-01', sens: 'recette', montant: 300_000, categorie: 'sponsors' },
    { date: '2026-12-01', sens: 'recette', montant: 20_000, categorie: 'ventes' },
    { date: '2026-12-02', sens: 'recette', montant: 99_000, categorie: 'cotisations' },
    { date: '2025-06-01', sens: 'recette', montant: 500_000, categorie: 'sponsors' },
  ];
  assert.equal(recettesCommerciales(asso, '2027-01-15'), 320_000, 'cotisations et recettes de plus d’un an exclues');
  const bornes = [
    { date: '2026-01-15', sens: 'recette', montant: 1, categorie: 'sponsors' },
    { date: '2026-01-16', sens: 'recette', montant: 10, categorie: 'sponsors' },
    { date: '2027-01-15', sens: 'recette', montant: 100, categorie: 'sponsors' },
    { date: '2027-01-16', sens: 'recette', montant: 1000, categorie: 'sponsors' },
  ];
  assert.equal(recettesCommerciales(bornes, '2027-01-15'), 110, 'il y a un an jour pour jour exclu, aujourd’hui inclus, demain exclu');
  assert.equal(recettesCommerciales([{ date: '2027-03-01', sens: 'recette', montant: 5, categorie: 'ventes' }], '2028-02-29'), 5, '29 février');
});

test('passage en société de bout en bout : identité, deux livres séparés, indicateur, obligations, documents, veille', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    let d = (await admin.get('/api/admin/administratif')).json;
    assert.ok(!ids(d.veille.obligations).includes('passage'));
    assert.equal(d.contexte.forme, 'association');

    // Livre de l'association, indicateur sans seuil de passage tant qu'aucun passage n'est prévu.
    await admin.post('/api/tresorerie/ecritures', { date: '2026-10-01', sens: 'recette', libelle: 'Sponsor boutique', montant: 1_000_000, moyen: 'banque', categorie: 'sponsors' });
    let t = (await admin.get('/api/tresorerie')).json;
    assert.deepEqual(t.livres.map((l) => l.id), ['association']);
    assert.equal(t.indicateur.seuilPassage, null);
    assert.equal(t.indicateur.commerciales, 1_000_000);
    assert.equal(t.indicateur.franchise, SEUILS.franchiseImpotsCommerciaux * 100);
    assert.equal((await admin.post('/api/tresorerie/ecritures?livre=societe', { date: '2026-10-02', sens: 'depense', libelle: 'x', montant: 1, moyen: 'banque', categorie: 'salaires' })).statut, 409, 'pas de livre de société avant sa création');
    assert.equal((await admin.get('/api/tresorerie?livre=societe')).statut, 404);
    assert.equal((await admin.get('/api/tresorerie?livre=autre')).statut, 400);

    // Passage prévu : la section apparaît, l'indicateur reçoit le seuil, la veille vérifie aussi le passage.
    await admin.put('/api/admin/administratif/identite', { nom: 'Lugh', passagePrevu: true, seuilPassage: 12_000 });
    d = (await admin.get('/api/admin/administratif')).json;
    assert.ok(ids(d.veille.obligations).includes('passage'));
    assert.ok(!ids(d.veille.obligations).includes('societe'));
    assert.match((await admin.get('/api/admin/administratif/veille/consigne')).json.texte, /Passer en société/);
    t = (await admin.get('/api/tresorerie')).json;
    assert.equal(t.indicateur.seuilPassage, 1_200_000);
    const pv = documentType('pv-creation-societe', d.identite);
    assert.ok(pv.blocs.some((b) => /Lugh/.test(b.texte || '')));
    assert.ok(DOCUMENTS.filter((x) => x.groupe === 'passage').length === 2);

    // Société créée : son livre s'ouvre, séparé de celui de l'association.
    await admin.put('/api/admin/administratif/identite', { nom: 'Lugh', forme: 'societe', societeNom: 'Lugh Esport SAS', societeForme: 'SAS', siren: '123456789' });
    assert.equal((await admin.get('/api/public/structure')).json.nom, 'Lugh et Lugh Esport SAS');
    d = (await admin.get('/api/admin/administratif')).json;
    assert.ok(ids(d.veille.obligations).includes('societe') && ids(d.veille.obligations).includes('gestion'));
    assert.match(documentType('convention-asso-societe', d.identite).blocs.map((b) => b.texte || '').join(' '), /Lugh Esport SAS \(SAS\), SIREN 123456789/);
    assert.equal((await admin.put('/api/tresorerie/reglages?livre=societe', { debutExercice: 1, ouverture: { date: '2026-10-01', banque: 0, caisse: 0 } })).statut, 200);
    assert.equal((await admin.get('/api/tresorerie')).json.reglages.ouverture.date, '', 'les réglages de l’association ne bougent pas');
    const cree = await admin.post('/api/tresorerie/ecritures?livre=societe', { date: '2026-10-05', sens: 'recette', libelle: 'Capital', montant: 500_000, moyen: 'banque', categorie: 'apports' });
    assert.equal(cree.statut, 201);
    assert.equal(cree.json.ecriture.livre, 'societe');
    assert.equal((await admin.post('/api/tresorerie/ecritures?livre=societe', { date: '2026-10-05', sens: 'recette', libelle: 'x', montant: 1, moyen: 'banque', categorie: 'cotisations' })).statut, 400, 'catégorie d’association refusée');
    t = (await admin.get('/api/tresorerie?livre=societe')).json;
    assert.deepEqual(t.livres.map((l) => l.id), ['association', 'societe']);
    assert.deepEqual([t.ecritures.length, t.bilan.resultat, t.soldesDuJour.banque, t.indicateur], [1, 0, 500_000, null]);
    assert.equal((await admin.get('/api/tresorerie')).json.ecritures.length, 1, 'l’association garde son seul livre');
    // Une écriture reste dans son livre, même si la requête dit le contraire.
    const maj = await admin.put(`/api/tresorerie/ecritures/${cree.json.ecriture._id}?livre=association`, { ...cree.json.ecriture, montant: 600_000 });
    assert.equal(maj.json.ecriture.livre, 'societe');
    const csv = await admin.get('/api/tresorerie/export?livre=societe&exercice=2026');
    assert.match(csv.entetes.get('content-disposition'), /lugh-comptes-societe-2026\.csv/);
    assert.match(csv.texte, /Apports en capital/);
    const sauvegarde = JSON.parse((await admin.get('/api/admin/administratif/sauvegarde')).texte);
    assert.ok(sauvegarde.parametres['structure-comptes-societe']);
    assert.equal(sauvegarde.ecritures.length, 2);

    // Retour à « association » (erreur de saisie) : le livre de la société reste lisible, plus modifiable.
    await admin.put('/api/admin/administratif/identite', { siren: '987654321' });
    assert.equal((await admin.get('/api/admin/administratif')).json.identite.forme, 'societe', 'un envoi partiel ne change pas la forme');
    await admin.put('/api/admin/administratif/identite', { forme: 'association' });
    t = (await admin.get('/api/tresorerie?livre=societe')).json;
    assert.equal(t.ecriturePossible, false);
    assert.equal(t.ecritures.length, 1);
    assert.equal((await admin.post('/api/tresorerie/ecritures?livre=societe', { date: '2026-10-06', sens: 'recette', libelle: 'x', montant: 1, moyen: 'banque', categorie: 'sponsors' })).statut, 409);
    assert.equal((await admin.del(`/api/tresorerie/ecritures/${cree.json.ecriture._id}`)).statut, 409, 'ni supprimable');
    assert.equal((await admin.put(`/api/tresorerie/ecritures/${cree.json.ecriture._id}`, { ...cree.json.ecriture, montant: 1 })).statut, 409, 'ni modifiable');
    assert.equal((await admin.post('/api/tresorerie/cloture?livre=societe', { exercice: 2025 })).statut, 409, 'ni clôturable');
  } finally {
    await sim.arreter();
  }
});

test('livres : écritures 2.5.0 sans champ « livre », trésorier non administrateur, rapprochements séparés', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    // Écriture d'avant la 2.6.0 : aucun champ « livre ».
    await sim.global.ecrire('ecritures', { _id: 'e-ancienne01', date: '2026-09-01', sens: 'recette', libelle: 'Cotisation', montant: 1500, moyen: 'banque', categorie: 'cotisations', creeLe: '2026-09-01T10:00:00.000Z' });
    await admin.put('/api/admin/administratif/identite', { nom: 'Lugh', forme: 'societe', societeNom: 'Lugh SAS' });
    assert.equal((await admin.get('/api/tresorerie')).json.ecritures.length, 1);
    assert.equal((await admin.get('/api/tresorerie?livre=societe')).json.ecritures.length, 0);
    const maj = await admin.put('/api/tresorerie/ecritures/e-ancienne01', { date: '2026-09-01', sens: 'recette', libelle: 'Cotisation', montant: 2000, moyen: 'banque', categorie: 'cotisations' });
    assert.equal(maj.json.ecriture.livre, 'association');

    // Trésorier non administrateur : les deux livres, pas l'identité.
    const cree = await admin.post('/api/admin/comptes', { identifiant: 'tresor', nomAffiche: 'Trésor', tresorier: true, acces: {} });
    const t = await connecterEtChanger(sim, 'tresor', cree.json.mdpTemporaire);
    assert.equal((await t.post('/api/tresorerie/ecritures?livre=societe', { date: '2026-10-02', sens: 'depense', libelle: 'Comptable', montant: 30_000, moyen: 'banque', categorie: 'honoraires' })).statut, 201);
    assert.equal((await t.put('/api/admin/administratif/identite', { forme: 'association' })).statut, 403);

    // Rapprochements séparés.
    await t.post('/api/tresorerie/rapprochement?livre=societe', { date: '2026-10-05', solde: -30_000 });
    assert.equal((await t.get('/api/tresorerie')).json.rapprochement, null);
    assert.equal((await t.get('/api/tresorerie?livre=societe')).json.rapprochement.ecart, 0);
  } finally {
    await sim.arreter();
  }
});
