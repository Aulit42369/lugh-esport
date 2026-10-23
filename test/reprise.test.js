// Reprise après sinistre de la base générale : sauvegarde de la structure version 2 sans aucun secret, import réservé
// à l'Administrateur général (mot RESTAURER, aperçu sans écriture), ne crée que ce qui manque, mots de passe temporaires.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrer, adminPret, compteConnecte, creerCompte, connecter, connecterEtChanger, activerJeu, compteGlobal, WEBHOOK,
} from './simulation.js';

// Une structure complète, puis sa sauvegarde téléchargée par l'Administrateur général.
async function structureSauvegardee() {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    await activerJeu(admin, 'autre', { nom: 'Marvel Rivals' });
    await admin.put('/api/admin/jeux/valorant', { couleur: 'violet', ordre: 5 });
    const [membre] = await sim.joueurs('valorant');
    await creerCompte(sim, { identifiant: 'brume', nomAffiche: 'Brume', acces: { valorant: { metiers: ['joueur'], membreId: membre._id }, marvelrivals: 'coach' } });
    // Des secrets écrits directement : rien ne doit en sortir.
    const brume = await compteGlobal(sim, 'brume');
    await sim.global.ecrire('comptes', {
      ...brume, deuxFacteurs: { secret: 'SECRETTOTP234567', codes: ['empreinte-code'] }, discordCode: { empreinte: 'empreinte-discord' },
      discordAttente: { id: '42', pseudo: 'brume#1' }, discord: { id: '43', pseudo: 'brume' },
    });
    await sim.global.ecrire('parametres', { _id: 'discord-annonces', webhook: WEBHOOK });
    await admin.put('/api/admin/administratif/identite', { nom: 'Lugh' });
    await admin.post('/api/tresorerie/ecritures', { date: '2026-10-01', sens: 'recette', libelle: 'Cotisation', montant: 2000, moyen: 'banque', categorie: 'cotisations', tiers: 'Brume' });
    await admin.put(`/api/e/valorant/autorisations/${membre._id}`, { mineur: true, parentale: '2026-10-01' });
    assert.equal((await admin.post('/api/admin/annonces', { titre: 'Bienvenue', texte: 'Saison 2', jeux: ['valorant'] })).statut, 201);
    const tele = await admin.get('/api/admin/administratif/sauvegarde');
    assert.equal(tele.statut, 200);
    return { texte: tele.texte, sauvegarde: JSON.parse(tele.texte) };
  } finally {
    await sim.arreter();
  }
}

test('sauvegarde de la structure version 2 : jeux, comptes et annonces, sans aucun secret', async () => {
  const { texte, sauvegarde: d } = await structureSauvegardee();
  assert.deepEqual([d.format, d.version], ['lugh-structure', 2]);
  assert.deepEqual(d.jeux.map((j) => [j._id, j.modele, j.nom]).sort(), [['marvelrivals', 'autre', 'Marvel Rivals'], ['valorant', 'valorant', 'Valorant']]);
  assert.deepEqual(d.jeux.find((j) => j._id === 'valorant').couleur, 'violet');
  const brume = d.comptes.find((c) => c.identifiant === 'brume');
  assert.deepEqual(Object.keys(brume).sort(), ['_id', 'acces', 'actif', 'admin', 'identifiant', 'nomAffiche', 'tresorier']);
  assert.deepEqual(brume.acces.valorant.metiers, ['joueur']);
  assert.equal(d.annonces.length, 1);
  assert.equal('lus' in d.annonces[0], false);
  assert.doesNotMatch(texte, /hash|scrypt|secret|codes|deuxFacteurs|discord|session|webhook|empreinte|mdp|SECRETTOTP/i, 'aucun secret');
  assert.ok(!texte.includes(WEBHOOK.split('/').at(-1)));
});

test('reprise : refusée sans le mot RESTAURER, aux non-admins, pour un autre format ou une autre version', async () => {
  const { sauvegarde } = await structureSauvegardee();
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    for (const confirmation of [undefined, '', 'restaurer', 'OUI']) {
      assert.equal((await admin.post('/api/admin/administratif/reprise', { sauvegarde, confirmation })).statut, 400);
    }
    for (const faux of [{ ...sauvegarde, version: 3 }, { ...sauvegarde, format: 'lugh' }, null, [1]]) {
      assert.equal((await admin.post('/api/admin/administratif/reprise', { sauvegarde: faux, confirmation: 'RESTAURER' })).statut, 400);
    }
    const tresorier = await compteConnecte(sim, { identifiant: 'tresor', acces: {} });
    assert.equal((await tresorier.post('/api/admin/administratif/reprise', { sauvegarde, confirmation: 'RESTAURER' })).statut, 403);
    assert.equal(sim.registre.liste().length, 0, 'rien de créé');
    assert.equal(await sim.global.compter('comptes'), 2);
  } finally {
    await sim.arreter();
  }
});

test('reprise sur une base vide : aperçu sans écriture, puis jeux, comptes, livre et documents recréés', async () => {
  const { sauvegarde } = await structureSauvegardee();
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    const chefAvant = await compteGlobal(sim, 'chef');
    const apercu = await admin.post('/api/admin/administratif/reprise', { sauvegarde, apercu: true });
    assert.equal(apercu.statut, 200);
    assert.deepEqual(apercu.json.resume.jeux.map((j) => j.action), ['creer', 'creer']);
    assert.deepEqual(Object.fromEntries(apercu.json.resume.comptes.map((c) => [c.identifiant, c.action])), { chef: 'ignorer', brume: 'creer' });
    assert.equal(apercu.json.motsDePasse, undefined);
    assert.equal(sim.registre.liste().length, 0, 'l’aperçu n’écrit rien');

    const r = await admin.post('/api/admin/administratif/reprise', { sauvegarde, confirmation: 'RESTAURER' });
    assert.equal(r.statut, 200, r.texte);
    assert.deepEqual([r.json.bilan.jeux, r.json.bilan.comptes, r.json.bilan.echecs], [2, 1, []]);
    const valorant = sim.registre.obtenir('valorant').doc;
    assert.deepEqual([valorant.couleur, valorant.ordre, sim.registre.obtenir('marvelrivals').doc.nom], ['violet', 5, 'Marvel Rivals']);
    const brume = await compteGlobal(sim, 'brume');
    assert.equal(brume._id, sauvegarde.comptes.find((c) => c.identifiant === 'brume')._id, 'même identifiant interne');
    assert.deepEqual(brume.acces.marvelrivals.metiers, ['coach']);
    assert.equal(brume.doitChangerMdp, true);
    assert.equal(brume.deuxFacteurs, undefined);
    assert.equal((await sim.global.lister('ecritures')).length, 1);
    assert.equal((await sim.global.lister('autorisations')).length, 1);
    assert.equal((await sim.global.lister('annonces')).length, 1);
    assert.equal((await sim.global.lire('parametres', 'structure-identite')).nom, 'Lugh');
    assert.equal(await sim.global.lire('parametres', 'discord-annonces'), null, 'aucun webhook');
    assert.deepEqual(await compteGlobal(sim, 'chef'), chefAvant, 'l’Administrateur général connecté n’est pas touché');

    // Mot de passe temporaire : montré une fois, jamais journalisé, à changer à la première connexion.
    const [{ identifiant, mdpTemporaire }] = r.json.motsDePasse;
    assert.equal(identifiant, 'brume');
    const journal = JSON.stringify(await sim.global.lister('journal'));
    assert.ok(journal.includes('reprise après sinistre de la structure'));
    assert.ok(!journal.includes(mdpTemporaire));
    assert.ok(!JSON.stringify(brume).includes(mdpTemporaire), 'jamais stocké en clair');
    const temporaire = await connecter(sim, 'brume', mdpTemporaire);
    assert.equal(temporaire.compte.doitChangerMdp, true);
    assert.notEqual((await temporaire.get('/api/annonces')).statut, 200, 'rien avant le changement du mot de passe');
    const definitif = await connecterEtChanger(sim, 'brume', mdpTemporaire);
    assert.equal((await definitif.get('/api/annonces')).statut, 200);

    // Deuxième reprise : tout existe, rien n'est créé ni modifié.
    const brumeAvant = await compteGlobal(sim, 'brume');
    const encore = await admin.post('/api/admin/administratif/reprise', { sauvegarde, confirmation: 'RESTAURER' });
    assert.equal(encore.statut, 200);
    assert.deepEqual([encore.json.bilan.jeux, encore.json.bilan.comptes, encore.json.bilan.donnees, encore.json.motsDePasse], [0, 0, 0, []]);
    assert.deepEqual(await compteGlobal(sim, 'brume'), brumeAvant);
  } finally {
    await sim.arreter();
  }
});

test('reprise : un compte existant au même identifiant et un livre déjà commencé restent intacts', async () => {
  const { sauvegarde } = await structureSauvegardee();
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const brume = await creerCompte(sim, { identifiant: 'brume', nomAffiche: 'Nouvelle Brume', acces: { valorant: 'coach' } });
    await admin.post('/api/tresorerie/ecritures', { date: '2026-10-15', sens: 'depense', libelle: 'Serveur', montant: 500, moyen: 'banque', categorie: 'materiel' });
    const ecrituresAvant = await sim.global.lister('ecritures');
    const r = await admin.post('/api/admin/administratif/reprise', { sauvegarde, confirmation: 'RESTAURER' });
    assert.equal(r.statut, 200, r.texte);
    assert.deepEqual(r.json.motsDePasse, []);
    assert.deepEqual(await compteGlobal(sim, 'brume'), brume);
    assert.deepEqual(await sim.global.lister('ecritures'), ecrituresAvant, 'livre déjà commencé : rien d’ajouté');
    assert.ok(r.json.resume.donnees.some((d) => d.nom.startsWith('Écritures') && d.action === 'ignorer'));
    assert.equal(r.json.resume.jeux.find((j) => j.id === 'valorant').action, 'ignorer');
    assert.equal(r.json.bilan.jeux, 1, 'seul le jeu absent est créé');
  } finally {
    await sim.arreter();
  }
});

test('reprise : une sauvegarde version 1 (sans jeux ni comptes) se relit', async () => {
  const sim = await demarrer();
  try {
    const admin = await adminPret(sim);
    const v1 = {
      format: 'lugh-structure',
      version: 1,
      exporteLe: '2026-10-01T10:00:00.000Z',
      parametres: { 'structure-identite': { _id: 'structure-identite', nom: 'Lugh v1' }, 'structure-comptes': { _id: 'structure-comptes', debutExercice: 9, clotures: [2025], hash: 'x' } },
      ecritures: [
        { _id: 'e-abcdefghij', date: '2026-09-01', sens: 'recette', libelle: 'Don', montant: 1000, moyen: 'caisse', categorie: 'dons', creeLe: '2026-09-01T10:00:00.000Z' },
        { _id: 'e-invalide', date: 'hier', sens: 'recette', libelle: 'Faux', montant: -1, moyen: 'caisse' },
      ],
      autorisations: [],
    };
    const r = await admin.post('/api/admin/administratif/reprise', { sauvegarde: v1, confirmation: 'RESTAURER' });
    assert.equal(r.statut, 200, r.texte);
    assert.equal(r.json.resume.invalides, 1);
    assert.equal((await sim.global.lire('parametres', 'structure-identite')).nom, 'Lugh v1');
    const reglages = await sim.global.lire('parametres', 'structure-comptes');
    assert.deepEqual([reglages.debutExercice, reglages.clotures, reglages.hash], [9, [2025], undefined]);
    assert.deepEqual((await sim.global.lister('ecritures')).map((e) => e._id), ['e-abcdefghij']);
  } finally {
    await sim.arreter();
  }
});
