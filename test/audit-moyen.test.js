// Correctifs de l'audit de sécurité (priorités moyenne et basse, 23/10) : requête lente qui ne réécrit plus une
// fiche compte périmée, rafale de connexions comptée une par une, restauration bornée et tracée, méta neutralisée
// avant Discord.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as requeteHttp } from 'node:http';
import { demarrer, adminPret, compteConnecte, client, attendreQue, MDP } from './simulation.js';
import { nouvelId } from '../shared/validation.js';
import { texteMeta, echapperMarkdown } from '../shared/discord.js';

// POST dont les en-têtes partent tout de suite et le corps seulement quand le test le décide (client lent).
function postLent(sim, chemin, cookie, corps) {
  const texte = JSON.stringify(corps);
  const req = requeteHttp(sim.base + chemin, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(texte), 'X-Lugh': '1', Cookie: cookie, 'X-Forwarded-For': '10.200.0.1',
    },
  });
  const reponse = new Promise((ok, ko) => {
    req.on('response', (rep) => {
      rep.resume();
      rep.on('end', () => ok(rep.statusCode));
    });
    req.on('error', ko);
  });
  req.flushHeaders();
  return { envoyer: () => req.end(texte), reponse };
}

// Signale quand la requête a lu la fiche du compte (passage dans exigerConnexion).
function guetterLecture(sim, id) {
  const etat = { lu: false };
  const lire = sim.global.lire;
  sim.global.lire = async (coll, x, ...reste) => {
    if (coll === 'comptes' && x === id) etat.lu = true;
    return lire.call(sim.global, coll, x, ...reste);
  };
  etat.retablir = () => { sim.global.lire = lire; };
  return etat;
}

test('requête lente de « Mon compte » : la désactivation, le nouveau mot de passe et la suppression ne sont pas annulés', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const v = await compteConnecte(sim, { identifiant: 'lente', acces: { valorant: 'joueur' } });
    const ancienHash = (await sim.global.lire('comptes', v.id)).hash;

    const guet = guetterLecture(sim, v.id);
    const lente = postLent(sim, '/api/moi/discord/confirmer', v.cookie, { accepter: false });
    await attendreQue(() => guet.lu, { message: 'fiche lue par la requête lente' });
    guet.retablir();
    const corps = { nomAffiche: 'lente', admin: false, actif: false, acces: { valorant: { metiers: ['joueur'] } } };
    assert.equal((await admin.put(`/api/admin/comptes/${v.id}`, corps)).statut, 200);
    assert.equal((await admin.post(`/api/admin/comptes/${v.id}/mdp`)).statut, 200);
    lente.envoyer();
    assert.notEqual(await lente.reponse, 200);
    const apres = await sim.global.lire('comptes', v.id);
    assert.equal(apres.actif, false, 'toujours désactivé');
    assert.notEqual(apres.hash, ancienHash, 'le nouveau mot de passe reste');
    assert.equal(apres.doitChangerMdp, true);

    // Suppression pendant une requête lente : le compte n'est pas recréé.
    const w = await compteConnecte(sim, { identifiant: 'lente2', acces: { valorant: 'joueur' } });
    const guet2 = guetterLecture(sim, w.id);
    const lente2 = postLent(sim, '/api/auth/2fa/desactiver', w.cookie, { mdp: MDP, code: '000000' });
    await attendreQue(() => guet2.lu, { message: 'fiche lue' });
    guet2.retablir();
    assert.equal((await admin.del(`/api/admin/comptes/${w.id}`)).statut, 200);
    lente2.envoyer();
    assert.notEqual(await lente2.reponse, 200);
    assert.equal(await sim.global.lire('comptes', w.id), null, 'pas recréé');
  } finally {
    await sim.arreter();
  }
});

test('rafale de connexions simultanées sur un identifiant : 5 essais évalués, puis blocage', async () => {
  const sim = await demarrer();
  try {
    await compteConnecte(sim, { identifiant: 'cible', acces: {} });
    // Une adresse différente par requête : seul le blocage par identifiant joue.
    const reponses = await Promise.all(Array.from({ length: 12 }, (_, i) => client(sim.base).post('/api/auth/connexion', { identifiant: 'cible', mdp: `faux-mdp-${i}` })));
    const statuts = reponses.map((r) => r.statut);
    assert.equal(statuts.filter((x) => x === 401).length, 5, statuts.join(','));
    assert.equal(statuts.filter((x) => x === 429).length, 7);
    assert.equal((await client(sim.base).post('/api/auth/connexion', { identifiant: 'cible', mdp: MDP })).statut, 429, 'bloqué, même avec le bon mot de passe');
  } finally {
    await sim.arreter();
  }
});

test('restauration : doublons regroupés, « equipe » plafonnée, avis au nom d’un autre compte comptés au journal', async () => {
  const sim = await demarrer({ jeux: ['valorant'] });
  try {
    const admin = await adminPret(sim);
    const st = sim.espace('valorant').stockage;
    const coach = await compteConnecte(sim, { identifiant: 'coach', acces: { valorant: ['coach'] } });
    const s = JSON.parse((await admin.get('/api/e/valorant/export')).texte);
    const k = nouvelId('k');
    s.equipe = Array.from({ length: 500 }, (_, i) => ({ _id: 'profil', nom: `Équipe ${i}` }));
    s.candidats = [{ _id: k, pseudo: 'Nova' }];
    s.votes = [{ _id: `${k}_${coach.id}`, avis: 'pour', commentaire: 'écrit par le fichier' }, { _id: `${k}_${admin.id}`, avis: 'contre' }];

    let ecritures = 0;
    const ecrire = st.ecrire;
    st.ecrire = async (coll, ...reste) => { if (coll === 'equipe') ecritures += 1; return ecrire.call(st, coll, ...reste); };
    const r = await admin.post('/api/e/valorant/restaurer', { ...s, confirmation: 'RESTAURER' });
    st.ecrire = ecrire;
    assert.equal(r.statut, 200, r.texte);
    assert.equal(ecritures, 1, 'une seule écriture de la fiche profil');
    assert.equal((await st.lire('equipe', 'profil')).nom, 'Équipe 499', 'la dernière compte');
    assert.equal(r.json.ignores, 499);
    assert.equal(r.json.autresAuteurs, 1, 'l’avis du coach, pas celui de l’admin qui restaure');
    const journal = (await admin.get('/api/e/valorant/journal')).json.entrees;
    assert.ok(JSON.stringify(journal).includes('1 avis ou notes de VOD au nom d’autres comptes'));
  } finally {
    await sim.arreter();
  }
});

test('méta vers Discord : lien masqué et mise en forme venus du modèle neutralisés', () => {
  assert.equal(echapperMarkdown('[Notes](https://x.invalid/a)'), '\\[Notes\\]\\(https://x.invalid/a\\)');
  assert.equal(echapperMarkdown('**FAUX** _a_ ~b~ `c` > d | e # \\'), '\\*\\*FAUX\\*\\* \\_a\\_ \\~b\\~ \\`c\\` \\> d \\| e \\# \\\\');
  assert.equal(echapperMarkdown('Patch 9.08 : Kay/O, Clove'), 'Patch 9.08 : Kay/O, Clove', 'texte ordinaire inchangé');
  const t = texteMeta({ nom: 'Valorant', vocabulaire: {} }, { patch: '[Notes](https://x.invalid/a)', saison: '**S1**' }, { entrees: ['[Map](https://x.invalid/b)'] });
  assert.ok(!/(^|[^\\])\[[^\]]*\]\(/.test(t), t);
  assert.ok(t.includes('**Méta Valorant'), 'la mise en forme de Lugh reste');
});
