// Vitrine publique : page d'accueil publique, espace privé sous /app/, consentement de chaque membre, photo contrôlée,
// rien de privé dans l'API publique, masquage par le staff, mineurs sans droit à l'image, effacement avec le compte.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { demarrer, adminPret, compteConnecte, client, requeteBrute } from './simulation.js';
import { nettoyerJpeg, PHOTO_OCTETS_MAX } from '../src/domaine/photo.js';
import { nouvelId } from '../shared/validation.js';

const seg = (marqueur, contenu) => {
  const b = Buffer.alloc(4 + contenu.length);
  b[0] = 0xff; b[1] = marqueur; b.writeUInt16BE(contenu.length + 2, 2); Buffer.from(contenu).copy(b, 4);
  return b;
};
const sof = (l, h) => seg(0xc0, Buffer.from([8, h >> 8, h & 255, l >> 8, l & 255, 1, 1, 0x11, 0]));
// JPEG synthétique : JFIF, EXIF avec « GPS », commentaire, tables, en-tête d'image, données, fin.
function jpeg({ largeur = 64, hauteur = 64, remplissage = 16 } = {}) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    seg(0xe1, Buffer.from('Exif\0\0GPS-48.85-2.35-Pixel', 'latin1')),
    seg(0xfe, Buffer.from('commentaire secret', 'latin1')),
    seg(0xdb, Buffer.alloc(65, 1)),
    sof(largeur, hauteur),
    seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.alloc(remplissage, 0x55),
    Buffer.from([0xff, 0xd9]),
  ]);
}

test('photo : JPEG seulement, métadonnées retirées, taille et dimensions plafonnées', () => {
  const { octets, largeur, hauteur } = nettoyerJpeg(jpeg());
  assert.equal(largeur, 64);
  assert.equal(hauteur, 64);
  const texte = octets.toString('latin1');
  assert.ok(!texte.includes('Exif') && !texte.includes('GPS') && !texte.includes('commentaire'), 'EXIF et commentaire retirés');
  assert.ok(texte.includes('JFIF'), 'JFIF gardé');
  assert.deepEqual([...octets.subarray(-2)], [0xff, 0xd9], 'données de l’image intactes');
  assert.throws(() => nettoyerJpeg(Buffer.from('\x89PNG\r\n\x1a\n0000', 'latin1')), /pas une image JPEG/);
  assert.throws(() => nettoyerJpeg(Buffer.from('<svg onload=alert(1)>')), /pas une image JPEG/);
  assert.throws(() => nettoyerJpeg(jpeg({ largeur: 4000 })), /trop grande/);
  assert.throws(() => nettoyerJpeg(jpeg({ remplissage: PHOTO_OCTETS_MAX })), /trop lourde/);
  assert.throws(() => nettoyerJpeg(jpeg().subarray(0, 40)), /tronquée|illisible/);
});

let sim;
let admin;
before(async () => {
  sim = await demarrer({ jeux: ['valorant', 'lol'] });
  admin = await adminPret(sim);
});
after(() => sim.arreter());

async function membre(jeu, champs) {
  const m = { _id: nouvelId('m'), type: 'joueur', statut: 'titulaire', rev: 1, ...champs };
  await sim.espace(jeu).stockage.ecrire('membres', m);
  return m;
}
const autoriser = (jeu, m, champs) => sim.global.ecrire('autorisations', { _id: `${jeu}:${m._id}`, jeu, membreId: m._id, ...champs });
const vitrine = async () => (await client(sim.base).get('/api/public/vitrine')).json;
const jeuDe = (v, id) => v.jeux.find((j) => j.id === id);

test('adresses : vitrine à la racine (indexable), espace privé sous /app/ (noindex), robots et sitemap', async () => {
  const racine = await requeteBrute(sim.base, '/');
  assert.equal(racine.statut, 200);
  const html = racine.corps.toString();
  assert.match(html, /vitrine\.js/);
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /vitrine-renvoi\.js/, 'les anciens liens /#/… sont renvoyés vers /app/');
  assert.ok(!/noindex/.test(html), 'la vitrine est indexable');
  const app = await requeteBrute(sim.base, '/app/');
  assert.equal(app.statut, 200);
  assert.match(app.corps.toString(), /noindex, nofollow/);
  assert.match(app.corps.toString(), /\/js\/app\.js/);
  const sans = await requeteBrute(sim.base, '/app?x=1');
  assert.equal(sans.statut, 301);
  assert.equal(sans.entetes.location, '/app/?x=1');
  const robots = (await requeteBrute(sim.base, '/robots.txt')).corps.toString();
  assert.match(robots, /Disallow: \/app\//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/lugh\.aulit42369\.fr\/sitemap\.xml/);
  const plan = await requeteBrute(sim.base, '/sitemap.xml');
  assert.match(plan.entetes['content-type'], /xml/);
  assert.match(plan.corps.toString(), /<loc>https:\/\/lugh\.aulit42369\.fr\/<\/loc>/);
});

test('consentement : personne n’apparaît sans avoir coché, puis seulement pseudo, rôle, statut et photo', async () => {
  const role = sim.espace('valorant').definition().roles[0];
  const m = await membre('valorant', { pseudo: 'Solaris', roleJeu: role.id, idJeu: 'Solaris#EUW', forces: 'note privée' });
  const joueur = await compteConnecte(sim, { identifiant: 'solaris', nomAffiche: 'Jean Dupont', acces: { valorant: { metiers: ['joueur'], membreId: m._id } } });

  let v = await vitrine();
  assert.deepEqual(jeuDe(v, 'valorant').membres, [], 'décoché par défaut : rien');
  assert.equal(jeuDe(v, 'valorant').places, 0, 'pas de recrutement par défaut');

  assert.equal((await joueur.put('/api/moi/vitrine', { visible: 'oui' })).statut, 400);
  assert.equal((await joueur.put('/api/moi/vitrine', { visible: true })).statut, 200);
  assert.equal((await joueur.get('/api/auth/moi')).json.compte.vitrine.visible, true);
  assert.deepEqual(jeuDe(await vitrine(), 'valorant').membres, [], 'sans fiche d’autorisations : rien, même coché');
  assert.deepEqual((await joueur.get('/api/moi/vitrine')).json.enAttente, [sim.registre.liste().find((j) => j._id === 'valorant').nom]);
  await autoriser('valorant', m, { mineur: false });
  assert.deepEqual((await joueur.get('/api/moi/vitrine')).json.enAttente, []);
  v = await vitrine();
  assert.deepEqual(jeuDe(v, 'valorant').membres, [{ pseudo: 'Solaris', type: 'joueur', role: role.nom, statut: 'Titulaire', photo: null }]);
  const brut = JSON.stringify(v);
  for (const prive of ['solaris"', 'Jean Dupont', 'Solaris#EUW', 'note privée', m._id, joueur.id, 'chef']) assert.ok(!brut.includes(prive), `rien de privé : ${prive}`);
  assert.deepEqual(jeuDe(v, 'lol').membres, [], 'un seul jeu : celui où il est au roster');

  // Le staff apparaît aussi s'il a coché la même case (type « staff », sa fonction pour rôle).
  const sm = await membre('valorant', { type: 'staff', statut: 'actif', fonction: 'coach', pseudo: 'Orion' });
  const staff = await compteConnecte(sim, { identifiant: 'orion', acces: { valorant: { metiers: ['coach'], membreId: sm._id } } });
  assert.equal((await staff.put('/api/moi/vitrine', { visible: true })).statut, 200);
  await autoriser('valorant', sm, { mineur: false });
  const orion = jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Orion');
  assert.equal(orion?.type, 'staff');
  assert.ok(orion.role);
  await sim.espace('valorant').stockage.modifier('membres', sm._id, { statut: 'ancien' });

  // Le staff le masque : il disparaît, même consentant.
  await sim.espace('valorant').stockage.modifier('membres', m._id, { vitrineMasque: true });
  assert.deepEqual(jeuDe(await vitrine(), 'valorant').membres, []);
  await sim.espace('valorant').stockage.modifier('membres', m._id, { vitrineMasque: false, statut: 'ancien' });
  assert.deepEqual(jeuDe(await vitrine(), 'valorant').membres, [], 'un ancien n’apparaît plus');
  await sim.espace('valorant').stockage.modifier('membres', m._id, { statut: 'titulaire' });

  // Décocher retire tout de suite.
  await joueur.put('/api/moi/vitrine', { visible: false });
  assert.deepEqual(jeuDe(await vitrine(), 'valorant').membres, []);
});

test('photo : envoyée, nettoyée, servie seulement publiée ; retirée, décochée, mineur sans droit à l’image, compte supprimé', async () => {
  const m = await membre('valorant', { pseudo: 'Nova' });
  const joueur = await compteConnecte(sim, { identifiant: 'nova', acces: { valorant: { metiers: ['joueur'], membreId: m._id } } });
  const image = jpeg().toString('base64');
  assert.equal((await joueur.put('/api/moi/photo', { image: Buffer.from('<svg/>').toString('base64') })).statut, 400, 'pas une image JPEG');
  assert.equal((await client(sim.base).put('/api/moi/photo', { image })).statut, 401, 'connexion obligatoire');
  assert.equal((await joueur.put('/api/moi/photo', { image })).statut, 200);
  assert.equal((await joueur.get('/api/moi/photo')).statut, 200, 'aperçu pour soi, même non publiée');
  await autoriser('valorant', m, { mineur: false });

  assert.equal(jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova'), undefined, 'photo sans consentement : rien');
  await joueur.put('/api/moi/vitrine', { visible: true });
  const { photo } = jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova');
  assert.match(photo, /^\/api\/public\/photo\/[a-f0-9]{24}$/);
  const servie = await requeteBrute(sim.base, photo);
  assert.equal(servie.statut, 200);
  assert.equal(servie.entetes['content-type'], 'image/jpeg');
  assert.equal(servie.entetes['x-content-type-options'], 'nosniff');
  assert.ok(!servie.corps.toString('latin1').includes('GPS'), 'EXIF retiré avant stockage');

  // Mineur sans droit à l'image : ni pseudo ni photo (et l'adresse n'est plus servie).
  await autoriser('valorant', m, { mineur: true, parentale: '2026-10-01', image: '' });
  assert.equal(jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova'), undefined);
  assert.equal((await requeteBrute(sim.base, photo)).statut, 404);
  await sim.global.modifier('autorisations', `valorant:${m._id}`, { image: '2026-10-02' });
  assert.equal(jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova').photo, photo);

  // Décoché : la photo n'est plus servie.
  await joueur.put('/api/moi/vitrine', { visible: false });
  assert.equal((await requeteBrute(sim.base, photo)).statut, 404);
  await joueur.put('/api/moi/vitrine', { visible: true });

  // Nouvelle photo : nouvelle adresse, l'ancienne n'est plus servie.
  await joueur.put('/api/moi/photo', { image });
  const nouvelle = jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova').photo;
  assert.notEqual(nouvelle, photo);
  assert.equal((await requeteBrute(sim.base, photo)).statut, 404);

  // Retirée.
  assert.equal((await joueur.del('/api/moi/photo')).statut, 200);
  assert.equal(jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova').photo, null);
  assert.equal((await requeteBrute(sim.base, nouvelle)).statut, 404);
  assert.equal(await sim.global.lire('photos', joueur.id), null);

  // Compte supprimé : la photo part avec.
  await joueur.put('/api/moi/photo', { image });
  assert.ok(await sim.global.lire('photos', joueur.id));
  assert.equal((await admin.del(`/api/admin/comptes/${joueur.id}`)).statut, 200);
  assert.equal(await sim.global.lire('photos', joueur.id), null);
  assert.equal(jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Nova'), undefined);
});

test('mineurs : sans fiche, mineur sans droit à l’image, moins de 15 ans sans son accord → ni pseudo ni photo', async () => {
  const cas = {};
  for (const pseudo of ['SansFiche', 'MineurSansDroit', 'MineurAvecDroit', 'Majeur', 'Moins15', 'Moins15Accord']) {
    const m = await membre('valorant', { pseudo });
    const c = await compteConnecte(sim, { identifiant: pseudo.toLowerCase(), acces: { valorant: { metiers: ['joueur'], membreId: m._id } } });
    await c.put('/api/moi/vitrine', { visible: true });
    await c.put('/api/moi/photo', { image: jpeg().toString('base64') });
    cas[pseudo] = { m, c };
  }
  await autoriser('valorant', cas.MineurSansDroit.m, { mineur: true, parentale: '2026-10-01', image: '' });
  await autoriser('valorant', cas.MineurAvecDroit.m, { mineur: true, parentale: '2026-10-01', image: '2026-10-01' });
  await autoriser('valorant', cas.Majeur.m, { mineur: false });
  await autoriser('valorant', cas.Moins15.m, { mineur: true, parentale: '2026-10-01', image: '2026-10-01', moins15: true, accordJeune: '' });
  await autoriser('valorant', cas.Moins15Accord.m, { mineur: true, parentale: '2026-10-01', image: '2026-10-01', moins15: true, accordJeune: '2026-10-03' });
  const membres = jeuDe(await vitrine(), 'valorant').membres;
  const montre = (p) => membres.find((x) => x.pseudo === p);
  for (const p of ['SansFiche', 'MineurSansDroit', 'Moins15']) {
    assert.equal(montre(p), undefined, `${p} : ni pseudo ni photo`);
    assert.equal((await cas[p].c.get('/api/moi/vitrine')).json.enAttente.length, 1, `${p} : en attente dans Mon compte`);
  }
  for (const p of ['MineurAvecDroit', 'Majeur', 'Moins15Accord']) {
    assert.match(montre(p)?.photo || '', /^\/api\/public\/photo\//, `${p} : pseudo et photo`);
    assert.deepEqual((await cas[p].c.get('/api/moi/vitrine')).json.enAttente, []);
  }
  // Le Responsable enregistre la fiche par la route : les nouveaux champs sont validés et relus.
  const resp = await compteConnecte(sim, { identifiant: 'respval', acces: { valorant: ['responsable'] } });
  const put = await resp.put(`/api/e/valorant/autorisations/${cas.Moins15.m._id}`, { mineur: true, parentale: '2026-10-01', image: '2026-10-01', moins15: true, accordJeune: '2026-10-05' });
  assert.equal(put.statut, 200, put.texte);
  assert.deepEqual(put.json.manques, []);
  assert.equal((await resp.get('/api/e/valorant/autorisations')).json.autorisations[cas.Moins15.m._id].accordJeune, '2026-10-05');
  assert.ok(jeuDe(await vitrine(), 'valorant').membres.find((x) => x.pseudo === 'Moins15'));
  for (const { c } of Object.values(cas)) await c.put('/api/moi/vitrine', { visible: false });
});

test('recrutement, résultats, présentation et lien « Postuler » ; jeu désactivé absent', async () => {
  const eq = sim.espace('lol').stockage;
  const profil = await eq.lire('equipe', 'profil');
  await eq.ecrire('equipe', { ...profil, nom: 'Lugh Rift', tag: 'LGH', placesRecrutement: 2, objectifSaison: 'objectif interne' });
  await eq.ecrire('tournois', { _id: nouvelId('t'), nom: 'Coupe d’automne', statut: 'termine', fin: '2026-10-12', place: 3, resultat: 'Demi-finale', notes: 'note interne', rev: 1 });
  await eq.ecrire('tournois', { _id: nouvelId('t'), nom: 'Ligue prévue', statut: 'inscrit', rev: 1 });
  assert.equal((await admin.put('/api/admin/administratif/identite', { nom: 'Lugh Esport', presentation: 'On joue ensemble.', postuler: 'https://discord.gg/lugh' })).statut, 200);
  assert.equal((await admin.put('/api/admin/administratif/identite', { postuler: 'javascript:alert(1)' })).statut, 400, 'lien https seulement');

  let v = await vitrine();
  assert.deepEqual(v.structure, { nom: 'Lugh Esport', presentation: 'On joue ensemble.', postuler: 'https://discord.gg/lugh' });
  const lol = jeuDe(v, 'lol');
  assert.equal(lol.places, 2);
  assert.deepEqual(lol.equipe, { nom: 'Lugh Rift', tag: 'LGH', devise: '', circuit: '' });
  assert.deepEqual(lol.resultats, [{ nom: 'Coupe d’automne', date: '2026-10-12', place: 3, resultat: 'Demi-finale' }]);
  assert.ok(!JSON.stringify(v).includes('interne'), 'ni objectif ni notes internes');

  // Le champ est validé comme le reste du profil (0 à 20).
  const coach = await compteConnecte(sim, { identifiant: 'coachlol', acces: { lol: ['headcoach'] } });
  const rev = (await eq.lire('equipe', 'profil')).rev ?? 0;
  assert.equal((await coach.put('/api/e/lol/c/equipe/profil', { valeur: { ...profil, placesRecrutement: 99 }, revBase: rev })).statut, 400);
  const ok = await coach.put('/api/e/lol/c/equipe/profil', { valeur: { ...profil, nom: 'Lugh Rift', placesRecrutement: 3 }, revBase: rev });
  assert.equal(ok.statut, 200, ok.texte);
  assert.equal(jeuDe(await vitrine(), 'lol').places, 3, 'réglé par le staff du jeu');

  // Rôles recherchés : même endroit, même validation (texte court sur une ligne, gardé tel quel, jamais interprété).
  const rev2 = (await eq.lire('equipe', 'profil')).rev;
  assert.equal((await coach.put('/api/e/lol/c/equipe/profil', { valeur: { ...profil, placesRecrutement: 3, rolesRecherches: 'x'.repeat(121) }, revBase: rev2 })).statut, 400);
  const avecRoles = await coach.put('/api/e/lol/c/equipe/profil', { valeur: { ...profil, nom: 'Lugh Rift', placesRecrutement: 3, rolesRecherches: '  un jungler\n et un <b>support</b> ' }, revBase: rev2 });
  assert.equal(avecRoles.statut, 200, avecRoles.texte);
  assert.equal(jeuDe(await vitrine(), 'lol').recherche, 'un jungler et un <b>support</b>');
  const rev3 = (await eq.lire('equipe', 'profil')).rev;
  await coach.put('/api/e/lol/c/equipe/profil', { valeur: { ...profil, placesRecrutement: 0, rolesRecherches: 'un jungler' }, revBase: rev3 });
  assert.equal(jeuDe(await vitrine(), 'lol').recherche, '', 'pas de rôles affichés sans place ouverte');
  assert.equal(jeuDe(await vitrine(), 'valorant').recherche, '', 'optionnel');

  // Jeu désactivé : absent de la vitrine.
  const doc = sim.registre.liste().find((j) => j._id === 'lol');
  doc.actif = false;
  v = await vitrine();
  assert.equal(jeuDe(v, 'lol'), undefined);
  doc.actif = true;
});

test('pages légales servies sans JavaScript (même texte que les fenêtres), 404 habillée, API en JSON, aperçu social', async () => {
  const { texteMentionsLegales } = await import('../shared/administratif/mentions-legales.js');
  for (const [chemin, titre] of [['/mentions-legales', 'Mentions légales'], ['/confidentialite', 'Données et confidentialité'], ['/conditions', 'Conditions d’utilisation']]) {
    const r = await requeteBrute(sim.base, chemin);
    assert.equal(r.statut, 200, chemin);
    assert.match(r.entetes['content-type'], /text\/html/);
    const html = r.corps.toString();
    assert.match(html, /<html lang="fr">/);
    assert.match(html, new RegExp(`<h1>${titre}</h1>`));
    assert.match(html, /<meta name="robots" content="noindex">/, 'comme les pages légales des autres sites');
    assert.ok(!/<script/.test(html), 'aucun script : CSP stricte, lisible sans JavaScript');
    assert.match(html, /href="\/mentions-legales"/);
  }
  const mentions = (await requeteBrute(sim.base, '/mentions-legales')).corps.toString();
  for (const sec of texteMentionsLegales()) assert.ok(mentions.includes(`<h2>${sec.titre}</h2>`), `même source que la fenêtre : ${sec.titre}`);
  // Nom de la structure échappé (jamais interprété).
  await admin.put('/api/admin/administratif/identite', { nom: 'Lugh <b>Esport</b>' });
  assert.ok((await requeteBrute(sim.base, '/conditions')).corps.toString().includes('Lugh &lt;b&gt;Esport&lt;/b&gt;'));
  await admin.put('/api/admin/administratif/identite', { nom: 'Lugh Esport' });

  const page = await requeteBrute(sim.base, '/nimporte-quoi');
  assert.equal(page.statut, 404);
  assert.match(page.entetes['content-type'], /text\/html/);
  assert.match(page.corps.toString(), /Page introuvable[\s\S]*href="\/"/, 'lien de retour');
  const api = await requeteBrute(sim.base, '/api/nimporte-quoi');
  assert.equal(api.statut, 404);
  assert.match(api.entetes['content-type'], /json/, 'l’API garde ses erreurs en JSON');

  const vitrineHtml = (await requeteBrute(sim.base, '/')).corps.toString();
  for (const m of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:url', 'og:locale', 'twitter:card']) assert.match(vitrineHtml, new RegExp(`"${m}"`), m);
  const ld = JSON.parse(vitrineHtml.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'SportsTeam');
  assert.match(vitrineHtml, /href="\/confidentialite"/, 'liens légaux en HTML sur la vitrine');
  const image = await requeteBrute(sim.base, '/og-image.jpg');
  assert.equal(image.statut, 200);
  assert.equal(image.entetes['content-type'], 'image/jpeg');
  assert.ok(image.corps.length <= 200 * 1024, 'image d’aperçu ≤ 200 Ko');
  assert.deepEqual([image.corps.readUInt16BE(0)], [0xffd8]);
});
