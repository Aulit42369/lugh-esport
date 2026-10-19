// Données de démonstration, chargées uniquement en mode simulation (npm run simulation).
// Deux jeux actifs (Valorant très rempli, un second jeu plus léger) et des comptes qui montrent la séparation des accès.
// Pseudos et adversaires inventés ; liens vers example.com (domaine réservé aux exemples).

import { nouvelId } from '../../shared/validation.js';
import { blocsDepuisEbauche } from '../../shared/jeux/contenus.js';
import { MODELES } from '../../shared/jeux/index.js';
import { semaineCourante, aujourdhui, ajouterJours, civileDepuisIso, isoCivile } from '../../shared/temps.js';
import { hacherMdp } from '../auth/mdp.js';
import { idSuggestion } from '../../shared/alertes.js';
import { remplirDemoPlus } from './demo-plus.js';
import { remplirDemoOrganisation } from './demo-organisation.js';
import { remplirJeuGenerique } from './demo-jeux.js';

const JOUEURS = [
  { pseudo: 'Kairo', roleJeu: 'duelliste', statut: 'titulaire', principaux: ['jett', 'raze'], secondaires: ['neon'], palier: 'confirme' },
  { pseudo: 'Sable', roleJeu: 'initiateur', statut: 'titulaire', principaux: ['sova', 'fade'], secondaires: ['kayo'], palier: 'intermediaire' },
  { pseudo: 'Vesper', roleJeu: 'controleur', statut: 'titulaire', principaux: ['omen', 'viper'], secondaires: ['astra'], palier: 'confirme', igl: true },
  { pseudo: 'Talus', roleJeu: 'sentinelle', statut: 'titulaire', principaux: ['killjoy', 'cypher'], secondaires: ['sage'], palier: 'intermediaire' },
  { pseudo: 'Mistral', roleJeu: 'flex', statut: 'titulaire', principaux: ['skye', 'breach'], secondaires: ['viper'], palier: 'intermediaire' },
  { pseudo: 'Brume', roleJeu: 'flex', statut: 'remplacant', principaux: ['clove'], secondaires: ['sova'], palier: 'debutant' },
];

async function remplirValorant(e, config) {
  const { depot, stockage } = e;
  const { documentParDefaut } = e.schemas();
  const membres = await stockage.lister('membres');
  const jour = (d) => isoCivile(ajouterJours(civileDepuisIso(aujourdhui(config.fuseau)), d));

  await depot.enregistrer('equipe', 'profil', documentParDefaut('equipe', {
    nom: 'Équipe démo', tag: 'DEMO', devise: 'Une map à la fois.', palierVise: 'confirme',
    circuit: 'Premier et tournois communautaires', creneaux: 'Lun–Ven 20h–23h, samedi après-midi',
    objectifSaison: 'Atteindre le palier Confirmé avec 4 maps prêtes avant la fin de l’acte.',
  }), null);

  // Roster : on remplit les postes créés à l'activation du jeu.
  const ids = {};
  const postesJoueurs = membres.filter((m) => m.type === 'joueur');
  for (const [i, j] of JOUEURS.entries()) {
    const id = postesJoueurs[i]?._id || nouvelId('m');
    ids[j.pseudo] = id;
    await depot.enregistrer('membres', id, documentParDefaut('membres', {
      type: 'joueur', pseudo: j.pseudo, statut: j.statut, roleJeu: j.roleJeu, igl: !!j.igl, idJeu: `${j.pseudo}#DEMO`,
      personnages: { principaux: j.principaux, secondaires: j.secondaires, parMap: {} },
      forces: 'Bonne communication en défense.', axes: 'Placement en post-plant.',
    }), null);
    await depot.enregistrer('objectifs', id, documentParDefaut('objectifs', { palier: j.palier }), null);
  }
  for (const m of membres.filter((x) => x.type === 'staff')) {
    if (m.fonction === 'headcoach') ids.Ardent = m._id;
    const pseudo = m.fonction === 'headcoach' ? 'Ardent' : m.fonction === 'analyste' ? 'Lynx' : '';
    if (pseudo) await depot.enregistrer('membres', m._id, documentParDefaut('membres', { ...m, pseudo }), null);
  }

  // Maps de l'équipe.
  const etats = {
    haven: { statut: 'pick', preparation: 78, compo: ['jett', 'sova', 'omen', 'killjoy', 'skye'] },
    lotus: { statut: 'confort', preparation: 62, compo: ['raze', 'fade', 'omen', 'killjoy', 'breach'] },
    sunset: { statut: 'confort', preparation: 55, compo: ['neon', 'sova', 'omen', 'cypher', 'breach'] },
    abyss: { statut: 'travail', preparation: 34, compo: [] },
    bind: { statut: 'travail', preparation: 28, compo: [] },
    corrode: { statut: 'travail', preparation: 12, compo: [] },
    summit: { statut: 'ban', preparation: 8, compo: [] },
  };
  const ordre = ['Kairo', 'Sable', 'Vesper', 'Talus', 'Mistral'];
  for (const [map, x] of Object.entries(etats)) {
    await depot.enregistrer('mapsEquipe', map, documentParDefaut('mapsEquipe', {
      statut: x.statut, preparation: x.preparation,
      compo: x.compo.map((personnage, i) => ({ personnage, membre: ids[ordre[i]] })),
      notes: x.compo.length ? { att: 'Default 1-3-1, prise de milieu à 1:25.', def: 'Ancre solide sur le site le plus joué par l’adversaire.' } : {},
      priorites: x.statut === 'travail' ? 'Apprendre les callouts et un default d’attaque.' : '',
    }), null);
  }

  // Stratbook, avec le rôle de chaque titulaire.
  const strats = [
    { map: 'haven', camp: 'att', type: 'default', nom: 'Default 1-3-1', statut: 'maitrisee', etapes: ['Prise d’info au milieu à 1:30', 'Lurk côté A pour couper les rotations', 'Décision à 1:00 selon l’info'],
      roles: { Kairo: 'Milieu avec Sable, entrée sur l’appel', Sable: 'Flèche de recon au milieu à 1:30', Vesper: 'Smokes de coupure, appel à 1:00', Talus: 'Lurk A pour couper les rotations', Mistral: 'Garde du flanc C' } },
    { map: 'haven', camp: 'att', type: 'execute', nom: 'Exécution C rapide', statut: 'rodage', etapes: ['Smokes sur les deux angles du site', 'Flash et entrée du duelliste', 'Pose du spike à couvert'],
      roles: { Kairo: 'Premier à entrer, juste après la flash', Sable: 'Flash par-dessus le mur', Vesper: 'Smokes long C et garage', Talus: 'Garde du flanc par le garage', Mistral: 'Pose du spike à couvert' } },
    { map: 'haven', camp: 'def', type: 'retake', nom: 'Retake A à 4', statut: 'apprendre', etapes: ['Regroupement hors de vue', 'Utilitaires de nettoyage', 'Entrée par deux côtés'], roles: {} },
    { map: 'lotus', camp: 'att', type: 'pistol', nom: 'Pistol attaque rush B', statut: 'rodage', etapes: ['Achat léger + boucliers', 'Entrée à 5 au même moment'], roles: {} },
    { map: 'sunset', camp: 'def', type: 'setup', nom: 'Setup 2-1-2', statut: 'maitrisee', etapes: ['Deux joueurs par site', 'Un joueur au milieu pour l’info'], roles: {} },
  ];
  for (const st of strats) {
    const roles = Object.fromEntries(Object.entries(st.roles).filter(([p]) => ids[p]).map(([p, r]) => [ids[p], r]));
    await depot.enregistrer('strats', nouvelId('s'), documentParDefaut('strats', { ...st, roles }), null);
  }

  // Scrims des trois dernières semaines : [jour, adversaire, map, camp de départ, mi-temps nous, eux, score nous, eux, pistol att, def].
  const scrims = [
    [-20, 'Nébula', 'haven', 'att', 7, 5, 13, 9, 'gagne', 'perdu'], [-18, 'Les Sept', 'lotus', 'def', 5, 7, 11, 13, 'perdu', 'gagne'],
    [-15, 'Kraken eSport', 'sunset', 'att', 6, 6, 13, 11, 'gagne', 'gagne'], [-13, 'Nébula', 'abyss', 'def', 3, 9, 7, 13, 'perdu', 'perdu'],
    [-10, 'Orage', 'haven', 'def', 8, 4, 13, 7, 'gagne', 'gagne'], [-8, 'Les Sept', 'lotus', 'att', 6, 6, 13, 10, 'gagne', 'perdu'],
    [-5, 'Kraken eSport', 'bind', 'att', 4, 8, 9, 13, 'perdu', 'gagne'], [-3, 'Orage', 'sunset', 'def', 7, 5, 14, 12, 'gagne', 'perdu'],
  ];
  for (const [d, adv, map, camp, mtN, mtE, sN, sE, pA, pD] of scrims) {
    await depot.enregistrer('scrims', nouvelId('x'), documentParDefaut('scrims', {
      date: jour(d), heure: '20:00', adversaire: adv, type: d === -10 ? 'officiel' : 'scrim', map, campDepart: camp,
      mtNous: mtN, mtEux: mtE, scoreNous: sN, scoreEux: sE, pistols: { att: pA, def: pD },
      bien: 'Bons trades en défense.', corriger: 'Rotations trop lentes après la première info.',
    }), null);
  }

  // VOD.
  const vodId = nouvelId('v');
  await depot.enregistrer('vods', vodId, documentParDefaut('vods', {
    titre: 'Scrim Sunset contre Orage', lien: 'https://example.com/vod/sunset-orage', date: jour(-3), map: 'sunset', statut: 'encours',
    consigne: 'Regarder nos rotations après la première mort.',
  }), null);
  await depot.enregistrer('vods', nouvelId('v'), documentParDefaut('vods', {
    titre: 'Scrim Bind contre Kraken eSport', lien: 'https://example.com/vod/bind-kraken', date: jour(-5), map: 'bind', statut: 'arevoir',
  }), null);

  // Planning de la semaine et disponibilités.
  const semaine = semaineCourante(config.fuseau);
  await depot.enregistrer('planning', semaine, { blocs: blocsDepuisEbauche(e.def, 'progression'), note: '', ebauche: 'progression' }, null);
  for (const [i, pseudo] of ordre.entries()) {
    const creneaux = {};
    for (let j = 1; j <= 7; j += 1) {
      if (![2, 6].includes(j) && (j + i) % 4 === 0) continue;
      creneaux[String(j)] = j >= 6 ? [14, 15, 16, 17, 20, 21] : [19, 20, 21, 22];
    }
    await depot.enregistrer('dispos', `${semaine}_${ids[pseudo]}`, { creneaux, note: '', semaine, membreId: ids[pseudo] }, null);
  }

  // Objectifs suivis.
  await depot.enregistrer('objectifs', ids.Kairo, documentParDefaut('objectifs', {
    palier: 'confirme',
    suivis: { 'meca-4-1': { statut: 'encours', auto: 'encours' }, 'jeu-4-1': { statut: 'afaire' }, 'meca-3-2': { statut: 'atteint', le: jour(-4) } },
    focus: ['meca-4-1', 'jeu-4-1'],
  }), null);
  await depot.enregistrer('objectifs', ids.Sable, documentParDefaut('objectifs', {
    palier: 'intermediaire', suivis: { 'util-3-1': { statut: 'encours' }, 'comm-3-1': { statut: 'atteint' } }, focus: ['util-3-1'],
  }), null);

  // Suggestions issues du passage à l'acte 6.
  for (const sug of [
    { cle: 'map-entree-bind-13.08', type: 'planning', titre: 'Bind entre dans le pool', texte: 'Prévoir cette semaine une practice de découverte (90 min) et un scrim sur Bind, puis fixer son statut dans le pool.', lien: '#/maps/bind' },
    { cle: 'compo-corrode-13.08', type: 'compo', titre: 'Construire la compo Corrode', texte: 'Partir des agents que l’équipe maîtrise déjà et comparer avec les compos pro de la page Méta.', lien: '#/maps/corrode' },
  ]) {
    await depot.enregistrer('suggestions', idSuggestion(sug.cle), { ...sug, statut: 'nouvelle', patch: '13.08', creeLe: new Date().toISOString() }, null);
  }
  return { ids, vodId };
}

async function creerCompte(global, { identifiant, nomAffiche, acces, mdp, admin = false }) {
  const existant = (await global.lister('comptes', { identifiant }))[0];
  if (existant) return existant;
  const compte = {
    _id: nouvelId('c'), identifiant, nomAffiche, admin, acces, actif: true, doitChangerMdp: false,
    hash: await hacherMdp(mdp), creeLe: new Date().toISOString(), creePar: 'systeme', derniereConnexion: null,
  };
  await global.ecrire('comptes', compte);
  return compte;
}

export async function remplirDemo(s) {
  const { registre, global, config } = s;
  if (registre.obtenir('valorant')) return;
  const admin = (await global.lister('comptes', { identifiant: config.admin.identifiant }))[0];
  if (admin) await global.ecrire('comptes', { ...admin, doitChangerMdp: false });

  const valorant = await registre.creer({ modele: 'valorant', id: 'valorant', compte: admin });
  const { ids, vodId } = await remplirValorant(valorant, config);

  // Second jeu, plus léger : League of Legends si son modèle est présent, sinon un « Autre jeu ».
  const second = MODELES.lol
    ? await registre.creer({ modele: 'lol', id: 'lol', compte: admin })
    : await registre.creer({ modele: 'autre', id: 'demojeu', nom: 'Jeu de démo', court: 'DEMO', compte: admin });
  const idsSecond = await remplirJeuGenerique(second, config);

  // Comptes (mots de passe dans le README) : chacun ne voit que ses jeux.
  const v = (metiers, membreId = '') => ({ metiers, membreId });
  const coach = await creerCompte(global, { identifiant: 'coach', nomAffiche: 'Ardent', mdp: 'tactique-2026', acces: { valorant: v(['headcoach'], ids.Ardent) } });
  const vesper = await creerCompte(global, { identifiant: 'vesper', nomAffiche: 'Vesper', mdp: 'stratbook-26', acces: { valorant: v(['capitaine', 'joueur'], ids.Vesper) } });
  const kairo = await creerCompte(global, { identifiant: 'kairo', nomAffiche: 'Kairo', mdp: 'entrainement-26', acces: { valorant: v(['joueur'], ids.Kairo) } });
  await creerCompte(global, { identifiant: 'lune', nomAffiche: 'Lune', mdp: 'responsable-26', acces: { [second.id]: v(['responsable', 'joueur'], idsSecond[0] || '') } });
  await creerCompte(global, {
    identifiant: 'mistral', nomAffiche: 'Mistral', mdp: 'deux-jeux-26',
    acces: { valorant: v(['joueur'], ids.Mistral), [second.id]: v(['remplacant'], idsSecond[5] || '') },
  });

  await remplirDemoPlus({ e: valorant, config, comptes: { coach, vesper, kairo }, ids, vodId });
  await remplirDemoOrganisation({ s, valorant, second, ids, idsSecond, admin, coach });

  // Les comptes « reviennent » après trois jours : le fil « Quoi de neuf » montre ce qui a changé.
  const t = new Date(Date.now() - 3 * 86_400_000).toISOString();
  for (const id of [config.admin.identifiant, 'coach']) {
    const c = (await global.lister('comptes', { identifiant: id }))[0];
    if (c) await global.ecrire('comptes', { ...c, visites: { valorant: { debut: t, dernier: t, precedente: null } } });
  }
}
