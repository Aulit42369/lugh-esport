// Gestion administrative : identité publique, suivi des obligations, veille légale (sources officielles seulement,
// rien d'appliqué sans validation), autorisations des mineurs, livre des comptes (trésorier, exercices, clôture,
// rapprochement, export tableur).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrer, adminPret, compteConnecte, creerCompte, connecter, attendreQue, reponseClaude, MDP, compteGlobal, client,
} from './simulation.js';
import { soumisA2fa } from '../src/domaine/parametres.js';
import { obligationsEffectives, tousLesPoints, SECTIONS } from '../shared/administratif/obligations.js';
import { bornesExercice, exerciceDe, bilanExercice, soldes, lireMontant, euros, csvEcritures } from '../shared/administratif/comptes.js';
import { propositionsDepuis, sourceOfficielle } from '../src/domaine/veille.js';
import { documentType, DOCUMENTS } from '../shared/administratif/documents.js';
import { texteConfidentialite } from '../shared/administratif/confidentialite.js';

const OFFICIEL = { titre: 'Service public', url: 'https://www.service-public.gouv.fr/associations/vosdroits/F1119' };

test('référentiel : identifiants uniques, sources https officielles ou connues, chaque point a un niveau', () => {
  const cles = tousLesPoints().map((p) => `${p.section}.${p.id}`);
  assert.equal(new Set(cles).size, cles.length);
  for (const p of tousLesPoints()) {
    assert.ok(['obligatoire', 'condition', 'recommande'].includes(p.niveau), p.id);
    assert.ok(p.texte.length > 20 && p.texte.length <= 600, p.id);
    for (const s of p.sources) assert.match(s.url, /^https:\/\//);
  }
  assert.ok(SECTIONS.some((s) => s.id === 'mineurs'));
});

test('veille : seules les sources officielles comptent ; points inconnus et ajouts en double ignorés', () => {
  const ob = obligationsEffectives();
  assert.equal(sourceOfficielle({ url: 'https://blog.exemple.com/a' }), null);
  assert.equal(sourceOfficielle({ url: 'http://www.service-public.gouv.fr/x' }), null, 'https seulement');
  assert.ok(sourceOfficielle({ url: 'https://www.economie.gouv.fr/x' }));
  const props = propositionsDepuis({
    changements: [
      { cle: 'gestion.impots', type: 'modifier', texte: 'Seuil 2027 : 82 000 €.', raison: 'nouveau seuil', sources: [OFFICIEL] },
      { cle: 'gestion.impots', type: 'modifier', texte: 'Sans source officielle.', sources: [{ url: 'https://forum.exemple.com' }] },
      { cle: 'inconnu.point', type: 'modifier', texte: 'x', sources: [OFFICIEL] },
      { cle: 'jeux.marque', type: 'supprimer', sources: [OFFICIEL] },
    ],
    ajouts: [
      { section: 'mineurs', id: 'honorabilite', titre: 'Contrôle d’honorabilité', texte: 'Nouvelle obligation pour les encadrants.', niveau: 'obligatoire', sources: [OFFICIEL] },
      { section: 'mineurs', id: 'image', titre: 'Doublon', texte: 'Déjà là.', sources: [OFFICIEL] },
      { section: 'nulle-part', id: 'x', titre: 'x', texte: 'x', sources: [OFFICIEL] },
    ],
  }, ob, '2026-11-01T00:00:00.000Z');
  assert.deepEqual(props.map((p) => [p.type, p.cle]), [['modifier', 'gestion.impots'], ['supprimer', 'jeux.marque'], ['ajouter', 'mineurs.honorabilite']]);
  assert.equal(props[0].avant.texte.includes('81 051'), true);
});

test('comptes : exercices, soldes, bilan, montants saisis, export tableur sans formule', () => {
  assert.deepEqual(bornesExercice(2026, 1), { annee: 2026, debut: '2026-01-01', fin: '2026-12-31', libelle: '2026' });
  assert.deepEqual(bornesExercice(2026, 9), { annee: 2026, debut: '2026-09-01', fin: '2027-08-31', libelle: '2026-2027' });
  assert.equal(exerciceDe('2027-03-15', 9).annee, 2026);
  assert.equal(lireMontant('12,5'), 1250);
  assert.equal(lireMontant('1 234,56 €'), 123456);
  assert.equal(lireMontant('-3'), null);
  assert.equal(lireMontant('abc'), null);
  assert.equal(euros(123456), '1 234,56 €');
  const ecritures = [
    { date: '2025-12-20', sens: 'recette', montant: 5000, moyen: 'banque', categorie: 'dons', libelle: 'Don' },
    { date: '2026-01-10', sens: 'recette', montant: 20000, moyen: 'banque', categorie: 'cotisations', libelle: 'Cotisations' },
    { date: '2026-02-01', sens: 'depense', montant: 3000, moyen: 'caisse', categorie: 'materiel', libelle: '=CMD()' },
    { date: '2026-02-02', sens: 'transfert', montant: 4000, moyen: 'banque', vers: 'caisse', libelle: 'Retrait' },
  ];
  const ouverture = { date: '2025-12-01', banque: 1000, caisse: 0 };
  assert.deepEqual(soldes(ecritures, ouverture), { banque: 1000 + 5000 + 20000 - 4000, caisse: -3000 + 4000, total: 23000 });
  const b = bilanExercice(ecritures, bornesExercice(2026, 1), ouverture);
  assert.deepEqual([b.totalRecettes, b.totalDepenses, b.resultat, b.soldeDebut.total, b.soldeFin.total], [20000, 3000, 17000, 6000, 23000]);
  const csv = csvEcritures(ecritures);
  assert.ok(csv.startsWith('﻿Date;Type;'));
  assert.ok(csv.includes(";'=CMD();"), 'formule neutralisée');
  assert.ok(csv.includes('200,00'));
});

test('documents et confidentialité : identité reprise, rien de personnel', () => {
  for (const d of DOCUMENTS) {
    const doc = documentType(d.id, { nom: 'Lugh', referent: 'Brume', contact: 'contact@lugh.gg' });
    assert.ok(doc.blocs.length > 3, d.id);
    assert.ok(!JSON.stringify(doc).includes('undefined'), d.id);
  }
  assert.match(JSON.stringify(documentType('statuts', { nom: 'Lugh' })), /association Lugh/);
  assert.match(JSON.stringify(documentType('charte-mineurs', { referent: 'Brume' })), /Brume/);
  assert.equal(documentType('inconnu'), null);
  assert.match(JSON.stringify(texteConfidentialite({ nom: 'Lugh', contact: 'contact@lugh.gg' })), /contact@lugh\.gg/);
});

test('identité et suivi : validation, identité publique limitée au nom et au contact, réservé à l’Administrateur général', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const joueur = await compteConnecte(sim, { identifiant: 'brume', acces: { valorant: 'joueur' } });
    assert.equal((await joueur.get('/api/admin/administratif')).statut, 403);
    assert.equal((await admin.put('/api/admin/administratif/identite', { nom: 'Lugh', rna: 'X123' })).statut, 400);
    assert.equal((await admin.put('/api/admin/administratif/identite', { nom: 'Lugh', rna: 'W123456789', contact: 'contact@lugh.gg', referent: 'Brume' })).statut, 200);
    joueur.oublier();
    assert.deepEqual((await joueur.get('/api/public/structure')).json, { nom: 'Lugh', contact: 'contact@lugh.gg' }, 'aucun RNA ni référent sans connexion');

    assert.equal((await admin.put('/api/admin/administratif/suivi/creation.inconnu', { statut: 'fait' })).statut, 404);
    assert.equal((await admin.put('/api/admin/administratif/suivi/creation.declaration', { statut: 'peut-etre' })).statut, 400);
    const ok = await admin.put('/api/admin/administratif/suivi/creation.declaration', { statut: 'fait', le: '2026-11-02', note: 'RNA reçu' });
    assert.equal(ok.statut, 200);
    assert.equal(ok.json.suivi['creation.declaration'].statut, 'fait');
    assert.equal((await admin.get('/api/admin/administratif')).json.identite.rna, 'W123456789');
  } finally {
    await sim.arreter();
  }
});

test('veille légale : lancée au bouton, propositions à valider, accepter modifie le référentiel, import manuel', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    sim.claude.repondre = (params) => {
      assert.deepEqual(params.outils[0].allowed_domains.includes('service-public.gouv.fr'), true);
      return reponseClaude({ changements: [{ cle: 'gestion.impots', type: 'modifier', texte: 'Seuil 2027 : 82 000 €.', raison: 'loi de finances', sources: [OFFICIEL] }], ajouts: [] });
    };
    assert.equal((await admin.post('/api/admin/administratif/veille', {})).statut, 202);
    await attendreQue(async () => (await admin.get('/api/admin/administratif')).json.veille.statut === 'ok');
    let v = (await admin.get('/api/admin/administratif')).json.veille;
    assert.equal(v.propositions.length, 1);
    assert.match(tousLesPoints(v.obligations).find((p) => p.id === 'impots').texte, /81 051/, 'rien d’appliqué sans validation');
    assert.ok(v.couts['2026-10'] || Object.keys(v.couts).length === 1);

    v = (await admin.post(`/api/admin/administratif/veille/propositions/${v.propositions[0]._id}`, { accepter: true })).json.veille;
    const impots = tousLesPoints(v.obligations).find((p) => p.id === 'impots');
    assert.equal(impots.texte, 'Seuil 2027 : 82 000 €.');
    assert.ok(impots.modifieLe);
    assert.equal((await admin.post(`/api/admin/administratif/veille/propositions/${v.propositions[0]._id}`, { accepter: true })).statut, 404, 'déjà traitée');

    assert.match((await admin.get('/api/admin/administratif/veille/consigne')).json.texte, /Seuil 2027/);
    assert.equal((await admin.post('/api/admin/administratif/veille/import', { texte: 'pas de json' })).statut, 400);
    const imp = await admin.post('/api/admin/administratif/veille/import', { texte: `\`\`\`json\n${JSON.stringify({ changements: [], ajouts: [{ section: 'mineurs', id: 'honorabilite', titre: 'Contrôle d’honorabilité', texte: 'Vérifier les encadrants bénévoles.', niveau: 'recommande', sources: [OFFICIEL] }] })}\n\`\`\`` });
    assert.equal(imp.json.nouvelles, 1);
    const ajout = imp.json.veille.propositions.find((p) => p.type === 'ajouter');
    const apres = (await admin.post(`/api/admin/administratif/veille/propositions/${ajout._id}`, { accepter: true })).json.veille;
    assert.ok(apres.obligations.find((s) => s.id === 'mineurs').points.some((p) => p.id === 'honorabilite'));
  } finally {
    await sim.arreter();
  }
});

test('autorisations des mineurs : le Responsable les coche, le joueur ne les voit pas, l’administration liste les manques', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const [membre] = await sim.joueurs('valorant');
    const resp = await compteConnecte(sim, { identifiant: 'chefval', acces: { valorant: 'responsable' } });
    const joueur = await compteConnecte(sim, { identifiant: 'brume', acces: { valorant: 'joueur' } });
    assert.equal((await joueur.get('/api/e/valorant/autorisations')).statut, 403);
    assert.equal((await resp.put('/api/e/valorant/autorisations/m-inexistant00', { mineur: true })).statut, 404);
    const r = await resp.put(`/api/e/valorant/autorisations/${membre._id}`, { mineur: true, parentale: '2026-10-01' });
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.manques, ['droit à l’image']);
    assert.deepEqual((await resp.get('/api/e/valorant/autorisations')).json.autorisations[membre._id], { mineur: true, parentale: '2026-10-01', image: '', note: '' });
    const vue = (await admin.get('/api/admin/administratif')).json.mineurs[0];
    assert.equal(vue.id, 'valorant');
    assert.deepEqual(vue.membres[0].manques, ['droit à l’image']);
    assert.doesNotMatch(JSON.stringify(vue), /"(age|naissance|dateNaissance)"/, 'aucun âge');
  } finally {
    await sim.arreter();
  }
});

test('livre des comptes : trésorier sans jeu, écritures validées, clôture, réouverture par l’admin seul, rapprochement, export', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const cree = await admin.post('/api/admin/comptes', { identifiant: 'tresor', nomAffiche: 'Trésor', tresorier: true, acces: {} });
    assert.equal(cree.statut, 201);
    assert.equal(cree.json.compte.tresorier, true);
    await creerCompte(sim, { identifiant: 'brume', acces: { valorant: 'joueur' } });
    const joueur = await connecter(sim, 'brume', MDP);
    assert.equal((await joueur.get('/api/tresorerie')).statut, 403);
    await sim.global.ecrire('comptes', { ...(await sim.global.lister('comptes', { identifiant: 'tresor' }))[0], doitChangerMdp: false, hash: (await sim.global.lister('comptes', { identifiant: 'brume' }))[0].hash });
    const tresor = await connecter(sim, 'tresor', MDP);

    assert.equal((await tresor.put('/api/tresorerie/reglages', { debutExercice: 1, ouverture: { date: '2025-01-01', banque: 10000, caisse: 0 } })).statut, 200);
    assert.equal((await tresor.post('/api/tresorerie/ecritures', { date: '2026-03-01', sens: 'recette', libelle: 'x', montant: 100, moyen: 'banque', categorie: 'materiel' })).statut, 400, 'catégorie de dépense sur une recette');
    assert.equal((await tresor.post('/api/tresorerie/ecritures', { date: '2026-03-01', sens: 'transfert', libelle: 'x', montant: 100, moyen: 'banque', vers: 'banque' })).statut, 400);
    assert.equal((await tresor.post('/api/tresorerie/ecritures', { date: '2024-12-01', sens: 'recette', libelle: 'x', montant: 100, moyen: 'banque', categorie: 'dons' })).statut, 409, 'avant l’ouverture');
    const e0 = (await tresor.post('/api/tresorerie/ecritures', { date: '2025-06-01', sens: 'recette', libelle: 'Don', montant: 1000, moyen: 'banque', categorie: 'dons' })).json.ecriture;
    assert.equal((await tresor.put('/api/tresorerie/reglages', { debutExercice: 1, ouverture: { date: '2026-01-01', banque: 10000, caisse: 0 } })).statut, 409, 'ouverture après une écriture existante');
    const e1 = (await tresor.post('/api/tresorerie/ecritures', { date: '2026-03-01', sens: 'recette', libelle: 'Cotisations', montant: 15000, moyen: 'banque', categorie: 'cotisations', piece: 'R-001' })).json.ecriture;
    await tresor.post('/api/tresorerie/ecritures', { date: '2026-03-05', sens: 'depense', libelle: 'Inscription tournoi', montant: 2500, moyen: 'banque', categorie: 'inscriptions', piece: 'F-001' });
    let d = (await tresor.get('/api/tresorerie?exercice=2026')).json;
    assert.deepEqual([d.bilan.totalRecettes, d.bilan.totalDepenses, d.bilan.soldeFin.banque], [15000, 2500, 23500]);
    assert.equal(d.ecritures.length, 2);

    await tresor.post('/api/tresorerie/rapprochement', { date: '2026-03-31', solde: 22000 });
    d = (await tresor.get('/api/tresorerie?exercice=2026')).json;
    assert.deepEqual([d.rapprochement.calcule, d.rapprochement.ecart], [23500, -1500]);
    assert.equal((await tresor.post('/api/tresorerie/rapprochement', { date: '2026-02-30', solde: 1 })).statut, 400, 'date impossible');

    const csv = await tresor.get('/api/tresorerie/export?exercice=2026');
    assert.equal(csv.statut, 200);
    assert.match(csv.entetes.get('content-type'), /text\/csv/);
    assert.match(csv.texte, /Cotisations;;R-001;banque;150,00/);

    assert.equal((await tresor.post('/api/tresorerie/cloture', { exercice: 2026 })).statut, 409, 'exercice pas terminé');
    assert.equal((await tresor.post('/api/tresorerie/cloture', { exercice: 2025 })).statut, 200);
    assert.equal((await tresor.put(`/api/tresorerie/ecritures/${e0._id}`, { ...e0, montant: 1 })).statut, 409);
    assert.equal((await tresor.del(`/api/tresorerie/ecritures/${e0._id}`)).statut, 409);
    assert.equal((await tresor.put(`/api/tresorerie/ecritures/${e1._id}`, { ...e1, montant: 1 })).statut, 200, '2026 reste ouvert');
    assert.equal((await tresor.put('/api/tresorerie/reglages', { debutExercice: 9 })).statut, 409, 'réglages figés après une clôture');
    assert.equal((await tresor.post('/api/tresorerie/cloture', { exercice: 2025, rouvrir: true })).statut, 403);
    assert.equal((await admin.post('/api/tresorerie/cloture', { exercice: 2025, rouvrir: true })).statut, 200);
    assert.equal((await tresor.del(`/api/tresorerie/ecritures/${e0._id}`)).statut, 200);
    assert.equal((await tresor.get('/api/admin/administratif')).statut, 403, 'le trésorier ne voit que les comptes');
  } finally {
    await sim.arreter();
  }
});

test('compte Trésorier : un Responsable de jeu ne peut ni le reprendre ni le modifier ; double authentification exigible', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    await adminPret(sim);
    const t = await creerCompte(sim, { identifiant: 'tresor', acces: { valorant: 'joueur' } });
    await sim.global.ecrire('comptes', { ...t, tresorier: true });
    const resp = await compteConnecte(sim, { identifiant: 'chefval', acces: { valorant: 'responsable' } });
    assert.equal((await resp.post(`/api/e/valorant/comptes/${t._id}/mdp`, {})).statut, 403, 'pas de réinitialisation du mot de passe');
    const refus = await resp.del(`/api/e/valorant/comptes/${t._id}`);
    assert.equal(refus.statut, 403);
    assert.match(refus.json.erreur.message, /Trésorier/);
    const [membre] = await sim.joueurs('valorant');
    assert.equal((await resp.put(`/api/e/valorant/comptes/${t._id}`, { metiers: ['joueur'], membreId: membre._id, nomAffiche: 'Autre', actif: true })).statut, 403, 'ni renommé');
    // Parcours « compte existant » : pas d'accès ajouté à un trésorier sans accès à ce jeu.
    const t2 = await creerCompte(sim, { identifiant: 'tresor2' });
    await sim.global.ecrire('comptes', { ...t2, tresorier: true });
    assert.equal((await resp.post('/api/e/valorant/comptes', { identifiant: 'tresor2', metiers: ['joueur'], existant: true })).statut, 403);
    assert.deepEqual((await compteGlobal(sim, 'tresor2')).acces, {});
    assert.equal(soumisA2fa({ tresorier: true }), true);
    assert.equal(soumisA2fa({ acces: { valorant: { metiers: ['joueur'] } } }), false);
  } finally {
    await sim.arreter();
  }
});

test('sauvegarde de la structure : comptes, autorisations et suivi, téléchargeable par l’admin et rangée par le bot', async () => {
  const cle = 'k'.repeat(40);
  const sim = await demarrer({ jeux: ['valorant'], env: { LUGH_CLE_BOT: cle } });
  try {
    const admin = await adminPret(sim);
    const [membre] = await sim.joueurs('valorant');
    await admin.put('/api/admin/administratif/identite', { nom: 'Lugh' });
    await admin.post('/api/tresorerie/ecritures', { date: '2026-10-01', sens: 'recette', libelle: 'Cotisation', montant: 2000, moyen: 'banque', categorie: 'cotisations', tiers: 'Brume' });
    await admin.put(`/api/e/valorant/autorisations/${membre._id}`, { mineur: true, parentale: '2026-10-01' });
    const tele = await admin.get('/api/admin/administratif/sauvegarde');
    assert.equal(tele.statut, 200);
    assert.match(tele.entetes.get('content-disposition'), /lugh-structure-2026-10-21\.json/);
    const d = JSON.parse(tele.texte);
    assert.deepEqual([d.format, d.ecritures.length, d.autorisations.length, d.parametres['structure-identite'].nom], ['lugh-structure', 1, 1, 'Lugh']);
    assert.doesNotMatch(tele.texte, /hash|webhook|cle/i, 'aucun secret');
    const viaBot = await client(sim.base).post('/api/bot/sauvegarde', { jeu: '_structure' }, { entetes: { Authorization: `Bearer ${cle}` }, sansQg: true });
    assert.equal(viaBot.statut, 200);
    assert.equal(viaBot.json.ecritures.length, 1);
    const joueur = await compteConnecte(sim, { identifiant: 'brume', acces: { valorant: 'joueur' } });
    assert.equal((await joueur.get('/api/admin/administratif/sauvegarde')).statut, 403);

    // Le membre supprimé emporte ses autorisations.
    assert.equal((await admin.del(`/api/e/valorant/c/membres/${membre._id}`)).statut, 200);
    assert.equal((await sim.global.lister('autorisations')).length, 0);
  } finally {
    await sim.arreter();
  }
});

test('veille légale : réponse hors format en échec, propositions en attente jamais perdues, ajout accepté visible malgré un ancien retrait', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    const mauvais = await admin.post('/api/admin/administratif/veille/import', { texte: JSON.stringify({ changements: 'rien', ajouts: [] }) });
    assert.equal(mauvais.statut, 400);
    // 45 décisions anciennes et 1 proposition en attente : la limite retire d'abord les décisions.
    const vieilles = Array.from({ length: 45 }, (_, i) => ({ _id: `v-vieille${i}`, type: 'modifier', cle: 'gestion.impots', nouveau: { texte: 'x' }, sources: [OFFICIEL], statut: 'refusee', le: '2026-01-01T00:00:00.000Z' }));
    const attente = { _id: 'v-attente01', type: 'modifier', cle: 'mineurs.image', avant: { titre: 'a', texte: 'b' }, nouveau: { texte: 'Nouveau texte du droit à l’image.' }, sources: [OFFICIEL], statut: 'nouvelle', le: '2026-01-01T00:00:00.000Z' };
    await sim.global.ecrire('parametres', { _id: 'structure-veille', modifs: { 'mineurs.honorabilite': { supprime: true } }, ajouts: [], propositions: [attente, ...vieilles], couts: {} });
    const ajout = { section: 'mineurs', id: 'honorabilite', titre: 'Contrôle d’honorabilité', texte: 'Vérifier les encadrants bénévoles.', niveau: 'recommande', sources: [OFFICIEL] };
    const imp = await admin.post('/api/admin/administratif/veille/import', { texte: JSON.stringify({ changements: [], ajouts: [ajout] }) });
    assert.equal(imp.statut, 200);
    const props = imp.json.veille.propositions;
    assert.ok(props.some((p) => p._id === 'v-attente01'), 'la proposition en attente reste');
    assert.ok(props.length <= 40);
    const nouvelle = props.find((p) => p.type === 'ajouter');
    const apres = (await admin.post(`/api/admin/administratif/veille/propositions/${nouvelle._id}`, { accepter: true })).json.veille;
    assert.ok(apres.obligations.find((s) => s.id === 'mineurs').points.some((p) => p.id === 'honorabilite'), 'l’ancien retrait ne masque plus le point');
  } finally {
    await sim.arreter();
  }
});

test('mentions légales et confidentialité : éditeur, hébergeurs, bases légales, transferts, CNIL, candidatures', async () => {
  const { texteMentionsLegales } = await import('../shared/administratif/mentions-legales.js');
  const m = JSON.stringify(texteMentionsLegales({ nom: 'Lugh' }));
  for (const motif of [/Aulit42369/, /2004-575/, /Render Services, Inc\./, /render\.com\/contact/, /MongoDB, Inc\./, /aulit42369@gmail\.com/]) assert.match(m, motif);
  const c = JSON.stringify(texteConfidentialite({ nom: 'Lugh' }));
  for (const motif of [/pour le compte de l’équipe Lugh/, /6-1-b/, /6-1-c/, /6-1-a/, /Data Privacy Framework/, /Discord Inc\./, /3 place de Fontenoy/, /6 mois après le refus/, /article 45/, /Supprimer mon compte/]) assert.match(c, motif);
  assert.ok(!c.includes('undefined') && !m.includes('undefined'));
});
