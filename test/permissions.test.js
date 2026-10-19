// Ce que chaque métier peut et ne peut pas écrire dans un jeu : collections génériques, écritures « pour soi »
// (dispos, absences, chiffres, auto-évaluation), notes de VOD, recrutement, gestion du jeu.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, compteConnecte, adminPret, exemplesValorant } from './simulation.js';
import { METIERS, ORDRE_METIERS } from '../shared/roles.js';
import { EDITABLES } from '../src/domaine/collections.js';
import { nouvelId } from '../shared/validation.js';

let sim;
const c = {}; // client par métier (Valorant)
let m; // membres de Valorant : m[0] lié au joueur, m[1] au capitaine, m[2] à l'invité, m[5] au remplaçant

before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol'] });
  m = await sim.joueurs('valorant');
  const liens = { joueur: m[0]._id, capitaine: m[1]._id, invite: m[2]._id, remplacant: m[5]._id };
  for (const metier of ORDRE_METIERS) {
    c[metier] = await compteConnecte(sim, { identifiant: `p-${metier}`, acces: { valorant: { metiers: [metier], membreId: liens[metier] || '' } } });
  }
  c.admin = await adminPret(sim);
});
after(() => sim.arreter());

const perm = (metier, p) => metier === 'admin' || METIERS[metier].perms.includes(p);

test('chaque métier écrit et supprime exactement ce que roles.js lui permet, dans chaque collection', async () => {
  assert.deepEqual(Object.keys(exemplesValorant()).sort(), Object.keys(EDITABLES).sort(), 'un exemple par collection modifiable');
  for (const metier of [...ORDRE_METIERS, 'admin']) {
    for (const [coll, [id, valeur]] of Object.entries(exemplesValorant())) {
      const permis = perm(metier, EDITABLES[coll].perm);
      const ecrit = await c[metier].put(`/api/e/valorant/c/${coll}/${id}`, { valeur });
      assert.equal(ecrit.statut, permis ? 200 : 403, `${metier} écrit ${coll} : ${ecrit.texte.slice(0, 200)}`);
      const supprime = await c[metier].del(`/api/e/valorant/c/${coll}/${id}`);
      const attendu = coll === 'equipe' ? 404 : (permis ? 200 : 403);
      assert.equal(supprime.statut, attendu, `${metier} supprime ${coll}`);
    }
  }
  const invite = (await c.invite.get('/api/e/valorant/donnees')).json;
  assert.deepEqual(invite.permissions, [], 'l’invité lit tout sans rien pouvoir écrire');
  assert.ok(invite.donnees.meta.length === 1 && invite.donnees.membres.length > 0);
});

test('recrutement : candidats et avis n’arrivent qu’aux métiers qui votent, au chargement comme à la synchronisation', async () => {
  const depart = (await c.joueur.get('/api/e/valorant/donnees')).json.rev;
  const k = nouvelId('k');
  assert.equal((await c.headcoach.put(`/api/e/valorant/c/candidats/${k}`, { valeur: { pseudo: 'Nova', notes: 'Avis confidentiel', twitch: 'Nova_TV' } })).statut, 200);
  assert.equal((await c.headcoach.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'contre', commentaire: 'Pas assez régulier' } })).statut, 200);

  for (const metier of ORDRE_METIERS) {
    const voit = perm(metier, 'recrutement.voter');
    const tout = (await c[metier].get('/api/e/valorant/donnees')).json;
    assert.equal('candidats' in tout.donnees, voit, `${metier} : candidats au chargement`);
    assert.equal('votes' in tout.donnees, voit, `${metier} : avis au chargement`);
    const sync = await c[metier].get(`/api/e/valorant/sync?rev=${depart}`);
    for (const secret of ['Avis confidentiel', 'Pas assez régulier', 'nova_tv']) assert.equal(sync.texte.includes(secret), voit, `${metier} : ${secret}`);
  }
  const vuAnalyste = (await c.analyste.get('/api/e/valorant/donnees')).json.donnees;
  assert.equal(vuAnalyste.candidats.find((x) => x._id === k).twitch, 'nova_tv');
  assert.equal(vuAnalyste.votes.filter((v) => v.cible === k).length, 1);

  const avant = (await c.joueur.get('/api/e/valorant/sync?rev=0')).json.rev;
  assert.equal((await c.headcoach.del(`/api/e/valorant/c/candidats/${k}`)).statut, 200);
  const pourJoueur = (await c.joueur.get(`/api/e/valorant/sync?rev=${avant}`)).json;
  assert.deepEqual(pourJoueur.suppressions, [], 'même les suppressions restent invisibles');
  const pourAnalyste = (await c.analyste.get(`/api/e/valorant/sync?rev=${avant}`)).json;
  assert.deepEqual(pourAnalyste.suppressions.map((s) => s.coll).sort(), ['candidats', 'votes']);
});

test('disponibilités : les siennes avec un membre lié, celles de tous pour les coachs', async () => {
  const valeur = { creneaux: { 1: [20, 21], 3: [19] }, note: 'Le soir' };
  const dispo = (metier, membre, v = valeur, semaine = '2026-W43') => c[metier].put(`/api/e/valorant/dispos/${semaine}/${membre._id || membre}`, { valeur: v });
  const ok = await dispo('joueur', m[0]);
  assert.equal(ok.statut, 200);
  assert.deepEqual([ok.json.doc._id, ok.json.doc.semaine, ok.json.doc.membreId], [`2026-W43_${m[0]._id}`, '2026-W43', m[0]._id]);
  assert.equal((await dispo('joueur', m[1])).statut, 403);
  assert.equal((await dispo('capitaine', m[1])).statut, 200);
  assert.equal((await dispo('remplacant', m[5])).statut, 200);
  assert.equal((await dispo('analyste', m[0])).statut, 403, 'dispos.soi sans membre lié : rien');
  assert.equal((await dispo('invite', m[2])).statut, 403, 'invité lié à un membre : lecture seule');
  assert.equal((await dispo('coach', m[1])).statut, 200, 'dispos.tous');
  assert.equal((await dispo('joueur', m[0], { creneaux: { 1: [3] } })).statut, 400, 'hors de la grille');
  assert.equal((await dispo('joueur', m[0], { creneaux: { 8: [20] } })).statut, 400, 'jour 8');
  assert.equal((await dispo('coach', 'm-zzzzzzzzzz')).statut, 404);
  assert.equal((await dispo('coach', m[1], valeur, 'semaine-x')).statut, 400);
});

test('absences : les siennes, ou celles de tous pour les coachs ; retrait par les mêmes', async () => {
  const absence = { membreId: m[0]._id, date: '2026-10-28', debut: '20:00', fin: '23:00', raison: 'Examen' };
  const a = await c.joueur.post('/api/e/valorant/absences', { valeur: absence });
  assert.equal(a.statut, 201);
  assert.match(a.json.doc._id, /^a-[a-z0-9]{10}$/);
  assert.equal((await c.joueur.post('/api/e/valorant/absences', { valeur: { ...absence, membreId: m[1]._id } })).statut, 403);
  const parCoach = await c.coach.post('/api/e/valorant/absences', { valeur: { ...absence, membreId: m[1]._id } });
  assert.equal(parCoach.statut, 201);
  assert.equal((await c.remplacant.post('/api/e/valorant/absences', { valeur: { ...absence, membreId: m[5]._id } })).statut, 201);
  assert.equal((await c.joueur.post('/api/e/valorant/absences', { valeur: { ...absence, fin: '19:00' } })).statut, 400);
  assert.equal((await c.joueur.post('/api/e/valorant/absences', { valeur: { ...absence, membreId: 'm-zzzzzzzzzz' } })).statut, 403);
  assert.equal((await c.coach.post('/api/e/valorant/absences', { valeur: { ...absence, membreId: 'm-zzzzzzzzzz' } })).statut, 404);

  assert.equal((await c.joueur.del(`/api/e/valorant/absences/${parCoach.json.doc._id}`)).statut, 403);
  assert.equal((await c.joueur.del(`/api/e/valorant/absences/${a.json.doc._id}`)).statut, 200);
  assert.equal((await c.headcoach.del(`/api/e/valorant/absences/${parCoach.json.doc._id}`)).statut, 200);
  assert.equal((await c.headcoach.del('/api/e/valorant/absences/a-zzzzzzzzzz')).statut, 404);
  assert.equal((await c.headcoach.del('/api/e/valorant/absences/pas-un-id')).statut, 400);
});

test('notes de VOD : chacun ajoute les siennes, seul l’auteur ou le staff les modifie', async () => {
  const vodId = nouvelId('v');
  assert.equal((await c.coach.put(`/api/e/valorant/c/vods/${vodId}`, { valeur: { titre: 'Scrim Lotus', lien: 'https://example.com/vod' } })).statut, 200);
  const note = await c.joueur.post('/api/e/valorant/vod-notes', { valeur: { vodId, temps: '12:30', texte: 'Rotation tardive', membre: m[0]._id } });
  assert.equal(note.statut, 201);
  assert.equal(note.json.doc.auteur, c.joueur.id);
  const id = note.json.doc._id;

  assert.equal((await c.remplacant.put(`/api/e/valorant/vod-notes/${id}`, { valeur: { texte: 'modifié' } })).statut, 403);
  assert.equal((await c.remplacant.del(`/api/e/valorant/vod-notes/${id}`)).statut, 403);
  const modifiee = await c.joueur.put(`/api/e/valorant/vod-notes/${id}`, { valeur: { texte: 'Rotation tardive du milieu', vodId: nouvelId('v'), auteur: c.coach.id } });
  assert.equal(modifiee.statut, 200);
  assert.deepEqual([modifiee.json.doc.vodId, modifiee.json.doc.auteur], [vodId, c.joueur.id], 'VOD et auteur ne changent pas');
  assert.equal((await c.coach.del(`/api/e/valorant/vod-notes/${id}`)).statut, 200, 'le staff peut retirer une note');

  assert.equal((await c.invite.post('/api/e/valorant/vod-notes', { valeur: { vodId, texte: 'x' } })).statut, 403);
  assert.equal((await c.joueur.post('/api/e/valorant/vod-notes', { valeur: { vodId: nouvelId('v'), texte: 'x' } })).statut, 404, 'VOD inconnue');
  assert.equal((await c.joueur.post('/api/e/valorant/vod-notes', { valeur: { vodId, texte: 'x', membre: 'm-zzzzzzzzzz' } })).statut, 400);
  assert.equal((await c.joueur.post('/api/e/valorant/vod-notes', { valeur: { vodId, texte: 'x', temps: '99' } })).statut, 400);
  assert.equal((await c.joueur.put('/api/e/valorant/vod-notes/n-zzzzzzzzzz', { valeur: { texte: 'x' } })).statut, 404);
  assert.equal((await c.joueur.put('/api/e/valorant/vod-notes/autre', { valeur: { texte: 'x' } })).statut, 400);
});

test('chiffres de la semaine : les siens, ou ceux de tous pour qui fixe les objectifs', async () => {
  const saisir = (metier, membre, valeurs = { hs: 22 }, semaine = '2026-W43') => c[metier].put(`/api/e/valorant/mesures/${membre._id || membre}/${semaine}`, { valeur: { valeurs } });
  const ok = await saisir('joueur', m[0]);
  assert.equal(ok.statut, 200);
  assert.deepEqual([ok.json.doc._id, ok.json.doc.membreId, ok.json.doc.semaine], [`${m[0]._id}_2026-W43`, m[0]._id, '2026-W43']);
  assert.equal((await saisir('joueur', m[1])).statut, 403);
  assert.equal((await saisir('capitaine', m[1])).statut, 200);
  assert.equal((await saisir('headcoach', m[1])).statut, 200);
  assert.equal((await saisir('coach', m[0], { kd: 1.2 })).statut, 200);
  assert.equal((await saisir('analyste', m[0])).statut, 403);
  assert.equal((await saisir('invite', m[2])).statut, 403);
  assert.equal((await saisir('joueur', m[0], { hs: 140 })).statut, 400);
  assert.equal((await saisir('joueur', m[0], { hs: 20 }, '2026-W99')).statut, 400);
  assert.equal((await saisir('coach', 'm-zzzzzzzzzz')).statut, 404);
  assert.equal((await c.joueur.del(`/api/e/valorant/mesures/${m[1]._id}/2026-W43`)).statut, 403);
  assert.deepEqual((await c.joueur.del(`/api/e/valorant/mesures/${m[0]._id}/2026-W43`)).json, { ok: true });
});

test('auto-évaluation : sur ses propres objectifs seulement, sans toucher au statut fixé par le staff', async () => {
  assert.equal((await c.headcoach.put(`/api/e/valorant/c/objectifs/${m[0]._id}`, {
    valeur: { palier: 'intermediaire', suivis: { 'meca-3-2': { statut: 'encours', note: 'Bien parti' } } },
  })).statut, 200);
  const auto = (metier, membre, corps) => c[metier].put(`/api/e/valorant/objectifs/${membre._id}/auto`, corps);
  const r = await auto('joueur', m[0], { objectifId: 'meca-3-2', auto: 'atteint' });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.json.doc.suivis['meca-3-2'], { statut: 'encours', auto: 'atteint', note: 'Bien parti', le: '' });
  assert.equal(r.json.doc.palier, 'intermediaire');
  assert.equal((await auto('joueur', m[0], { objectifId: 'meca-3-2', auto: '' })).json.doc.suivis['meca-3-2'].auto, '');
  assert.equal((await auto('joueur', m[1], { objectifId: 'meca-3-2', auto: 'atteint' })).statut, 403);
  assert.equal((await auto('analyste', m[0], { objectifId: 'meca-3-2', auto: 'atteint' })).statut, 403);
  assert.equal((await auto('joueur', m[0], { objectifId: 'n’importe', auto: 'atteint' })).statut, 400);
  assert.equal((await auto('joueur', m[0], { objectifId: 'meca-3-2', auto: 'parfait' })).statut, 400);
  const neuf = await auto('capitaine', m[1], { objectifId: 'comm-2-1', auto: 'encours' });
  assert.equal(neuf.statut, 200, 'fiche créée si besoin');
  assert.equal(neuf.json.doc.suivis['comm-2-1'].statut, 'afaire');
  assert.equal((await c.joueur.put(`/api/e/valorant/c/objectifs/${m[0]._id}`, { valeur: { palier: 'expert' } })).statut, 403);
});

test('avis, passage à l’essai et suggestions : selon le métier', async () => {
  const k = nouvelId('k');
  await c.headcoach.put(`/api/e/valorant/c/candidats/${k}`, { valeur: { pseudo: 'Orion', roleJeu: 'sentinelle', idJeu: 'Orion#EUW' } });
  assert.equal((await c.analyste.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'pour' } })).statut, 200);
  assert.equal((await c.capitaine.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'neutre' } })).statut, 200);
  assert.equal((await c.joueur.put(`/api/e/valorant/votes/${k}`, { valeur: { avis: 'contre' } })).statut, 403);

  assert.equal((await c.coach.post(`/api/e/valorant/candidats/${k}/essai`)).statut, 403, 'le coach adjoint donne son avis, sans décider');
  const essai = await c.headcoach.post(`/api/e/valorant/candidats/${k}/essai`);
  assert.equal(essai.statut, 200);
  const membre = await sim.espace('valorant').stockage.lire('membres', essai.json.membreId);
  assert.deepEqual([membre.statut, membre.pseudo, membre.roleJeu, membre.idJeu], ['essai', 'Orion', 'sentinelle', 'Orion#EUW']);
  assert.equal(essai.json.doc.statut, 'essai');
  assert.equal((await c.headcoach.post(`/api/e/valorant/candidats/${k}/essai`)).json.membreId, essai.json.membreId, 'pas de doublon au roster');
  assert.equal((await c.headcoach.post('/api/e/valorant/candidats/k-zzzzzzzzzz/essai')).statut, 404);

  await sim.espace('valorant').depot.enregistrer('suggestions', 'g-test-1', { cle: 'test-1', type: 'planning', titre: 'T', texte: 'X', lien: '#/planning', statut: 'nouvelle', patch: '13.08', creeLe: sim.maintenant().toISOString() }, null);
  const traitee = await c.coach.post('/api/e/valorant/suggestions/g-test-1/traiter', { statut: 'appliquee' });
  assert.equal(traitee.statut, 200);
  assert.deepEqual([traitee.json.doc.statut, traitee.json.doc.titre, traitee.json.doc.traitePar], ['appliquee', 'T', c.coach.id]);
  assert.equal((await c.joueur.post('/api/e/valorant/suggestions/g-test-1/traiter', { statut: 'ignoree' })).statut, 403);
  assert.equal((await c.coach.post('/api/e/valorant/suggestions/g-test-1/traiter', { statut: 'supprimee' })).statut, 400);
  assert.equal((await c.coach.post('/api/e/valorant/suggestions/g-inconnue/traiter', { statut: 'ignoree' })).statut, 404);
});

test('gestion du jeu : comptes, Réglages, Discord, sauvegarde et journal au Responsable ; la méta aussi au head coach', async () => {
  const routes = [
    ['GET', '/api/e/valorant/comptes', 'comptes.gerer', 200],
    ['GET', '/api/e/valorant/journal', 'comptes.gerer', 200],
    ['GET', '/api/e/valorant/etat', 'comptes.gerer', 200],
    ['GET', '/api/e/valorant/reglages-jeu', 'jeu.regler', 200],
    ['GET', '/api/e/valorant/reglages', 'reglages.gerer', 200],
    ['GET', '/api/e/valorant/export', 'donnees.exporter', 200],
    ['POST', '/api/e/valorant/restaurer', 'donnees.exporter', 400, { format: 'autre' }],
    ['GET', '/api/e/valorant/meta/consigne', 'meta.actualiser', 200],
    ['POST', '/api/e/valorant/meta/importer', 'meta.actualiser', 400, { texte: '' }],
  ];
  for (const metier of [...ORDRE_METIERS, 'admin']) {
    for (const [methode, chemin, p, siPermis, corps] of routes) {
      const r = await c[metier].appel(methode, chemin, corps);
      assert.equal(r.statut, perm(metier, p) ? siPermis : 403, `${metier} ${methode} ${chemin}`);
    }
  }
  assert.ok(METIERS.headcoach.perms.includes('meta.actualiser') && !METIERS.headcoach.perms.includes('donnees.exporter'));
});
