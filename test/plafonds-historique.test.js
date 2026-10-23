// Relecture L99 (S1, S2, D5) : adresse vue par Lugh dans Service, plafond mensuel des vérifications lancées à la main
// (méta par jeu, veille légale), historique des écritures modifiées ou supprimées du livre des comptes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, attendreQue, reponseClaude, metaDe } from './simulation.js';
import { PLAFONDS_MANUELS } from '../src/config.js';
import { creneauPrecedent } from '../src/domaine/automatismes.js';

const MOIS = '2026-10'; // horloge de la simulation : 21 octobre 2026

test('Service : l’Administrateur général voit l’adresse retenue par Lugh et le X-Forwarded-For brut', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    const { reseau } = (await admin.get('/api/admin/etat', { entetes: { 'X-Forwarded-For': '6.6.6.6, 7.7.7.7' } })).json;
    assert.deepEqual(reseau, { ip: '7.7.7.7', transmis: '6.6.6.6, 7.7.7.7', elements: 2, derriereProxy: true, sauts: 1 });
  } finally {
    await sim.arreter();
  }
  const deux = await demarrer({ env: { LUGH_PROXY_SAUTS: '2' } });
  try {
    const admin = await adminPret(deux);
    const { reseau } = (await admin.get('/api/admin/etat', { entetes: { 'X-Forwarded-For': '5.5.5.5, 6.6.6.6, 7.7.7.7' } })).json;
    assert.deepEqual([reseau.ip, reseau.sauts], ['6.6.6.6', 2], 'deux proxys de confiance : l’avant-dernier');
  } finally {
    await deux.arreter();
  }
});

test('méta : plafond mensuel des vérifications à la main, échecs compris ; les passages automatiques n’y comptent pas', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const e = sim.espace('valorant');
    sim.claude.repondre = () => { throw new Error('API Claude en erreur 529 : surchargée'); };
    assert.equal((await admin.post('/api/e/valorant/meta/actualiser')).statut, 202);
    await attendreQue(() => !e.actualisation.enCours);
    assert.equal((await e.stockage.lire('meta', 'courante')).couts[MOIS].manuels, 1, 'un échec compte aussi');

    const doc = await e.stockage.lire('meta', 'courante');
    await e.stockage.ecrire('meta', { ...doc, couts: { [MOIS]: { ...doc.couts[MOIS], manuels: PLAFONDS_MANUELS.meta } } });
    const refus = await admin.post('/api/e/valorant/meta/actualiser');
    assert.equal(refus.statut, 429);
    assert.match(refus.json.erreur.message, new RegExp(`Plafond de ${PLAFONDS_MANUELS.meta} vérifications manuelles ce mois-ci atteint ; prochaine vérification automatique lundi ou jeudi`));

    sim.claude.repondre = () => reponseClaude({ ...metaDe('valorant'), patch: 'test-2', patchDate: '2026-10-20' });
    const auto = e.actualisation.lancer({ declencheur: 'automatique', creneau: creneauPrecedent(sim.maintenant()) });
    assert.equal(auto.lancee, true, 'le plafond ne bloque pas le lundi et le jeudi');
    assert.equal((await auto.promesse).ok, true);
    const couts = (await e.stockage.lire('meta', 'courante')).couts[MOIS];
    assert.equal(couts.manuels, PLAFONDS_MANUELS.meta, 'le passage automatique ne compte pas');
    assert.ok(couts.passages >= 1);

    const etat = (await admin.get('/api/admin/etat')).json;
    assert.deepEqual(etat.plafonds, PLAFONDS_MANUELS);
    assert.equal(etat.jeux.find((j) => j.id === 'valorant').couts[MOIS].manuels, PLAFONDS_MANUELS.meta);
  } finally {
    await sim.arreter();
  }
});

test('veille légale : plafond mensuel des vérifications par l’API, l’import manuel reste possible', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    sim.claude.repondre = () => reponseClaude({ changements: [], ajouts: [] });
    assert.equal((await admin.post('/api/admin/administratif/veille', {})).statut, 202);
    await attendreQue(async () => (await admin.get('/api/admin/administratif')).json.veille.statut === 'ok');
    assert.equal((await admin.get('/api/admin/etat')).json.veilleManuels, 1);

    const doc = await sim.global.lire('parametres', 'structure-veille');
    await sim.global.ecrire('parametres', { ...doc, couts: { [MOIS]: { ...doc.couts[MOIS], manuels: PLAFONDS_MANUELS.veille } } });
    const refus = await admin.post('/api/admin/administratif/veille', {});
    assert.equal(refus.statut, 429);
    assert.match(refus.json.erreur.message, new RegExp(`Plafond de ${PLAFONDS_MANUELS.veille} vérifications de la veille légale ce mois-ci atteint`));
    const texte = '```json\n{"changements": [], "ajouts": []}\n```';
    assert.equal((await admin.post('/api/admin/administratif/veille/import', { texte })).statut, 200);
    assert.equal((await admin.get('/api/admin/etat')).json.veilleManuels, PLAFONDS_MANUELS.veille, 'l’import ne compte pas');
  } finally {
    await sim.arreter();
  }
});

test('livre des comptes : chaque écriture modifiée ou supprimée garde sa version d’avant (qui, quand, avant, après)', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    const e = (await admin.post('/api/tresorerie/ecritures', { date: '2026-03-01', sens: 'recette', libelle: 'Cotisations', montant: 15000, moyen: 'banque', categorie: 'cotisations', piece: 'R-001' })).json.ecriture;
    assert.equal((await admin.put(`/api/tresorerie/ecritures/${e._id}`, { ...e, montant: 'x' })).statut, 400);
    assert.equal((await sim.global.lister('ecrituresHistorique')).length, 0, 'une modification refusée ne laisse pas de trace');

    assert.equal((await admin.put(`/api/tresorerie/ecritures/${e._id}`, { ...e, montant: 12000 })).statut, 200);
    sim.maintenant.avancer(60_000);
    assert.equal((await admin.del(`/api/tresorerie/ecritures/${e._id}`)).statut, 200);

    const d = (await admin.get('/api/tresorerie?exercice=2026')).json;
    assert.equal(d.ecritures.length, 0);
    assert.deepEqual(d.historique.map((x) => x.action), ['suppression', 'modification'], 'les plus récentes d’abord');
    const [suppression, modification] = d.historique;
    assert.deepEqual([modification.avant.montant, modification.apres.montant, modification.ecriture], [15000, 12000, e._id]);
    assert.deepEqual([suppression.avant.montant, suppression.apres], [12000, null]);
    assert.ok(modification.par && modification.le && modification.parNom);
    assert.equal((await admin.get('/api/tresorerie?exercice=2025')).json.historique.length, 0, 'rangé dans l’exercice de l’écriture');

    const csv = await admin.get('/api/tresorerie/export?exercice=2026&historique=1');
    assert.equal(csv.statut, 200);
    assert.match(csv.entetes.get('content-disposition'), /-historique\.csv/);
    assert.match(csv.texte, /Supprimée;.*2026-03-01 · Recette 120,00 €/);
    assert.match(csv.texte, /Modifiée;.*150,00 €.*;2026-03-01 · Recette 120,00 €/);
    // L'historique part aussi dans la sauvegarde de la structure (Pi, téléchargement).
    const sauvegarde = (await admin.get('/api/admin/administratif/sauvegarde')).json;
    assert.deepEqual(sauvegarde.ecrituresHistorique.map((x) => x.action), ['modification', 'suppression']);
  } finally {
    await sim.arreter();
  }
});
