// Données de démonstration Valorant, suite (simulation uniquement) : notes de VOD, adversaires, présences,
// absences, chiffres, bibliothèque, recrutement. Pseudos, équipes et liens inventés (example.com).

import { nouvelId } from '../../shared/validation.js';
import { semaineCourante, decalerSemaine, aujourdhui, ajouterJours, civileDepuisIso, isoCivile } from '../../shared/temps.js';
import { seancesAppel } from '../../shared/suivi.js';

export async function remplirDemoPlus({ e, config, comptes, ids, vodId }) {
  const { depot, stockage } = e;
  const { documentParDefaut } = e.schemas();
  const membres = await stockage.lister('membres', { type: 'joueur' });
  const titulaires = membres.filter((m) => m.statut === 'titulaire');
  const { coach, vesper } = comptes;
  const jour = (d) => isoCivile(ajouterJours(civileDepuisIso(aujourdhui(config.fuseau)), d));
  const semaine = semaineCourante(config.fuseau);

  // Notes de VOD.
  const notes = [
    ['04:12', ids.Talus, 'placement', 'Ancre trop exposée au début du round.', 'Reculer d’un mètre derrière la caisse.'],
    ['11:40', ids.Kairo, 'positif', 'Entrée parfaite avec la flash de Sable.', 'À refaire sur Haven.'],
    ['18:05', '', 'communication', 'Personne n’annonce la rotation du milieu.', 'Annonce obligatoire dès 2 joueurs vus.'],
  ];
  for (const [temps, membre, categorie, texte, action] of notes) {
    await depot.enregistrer('vodNotes', nouvelId('n'), { ...documentParDefaut('vodNotes', { vodId, temps, membre, categorie, texte, action }), auteur: coach?._id || 'systeme' }, coach);
  }

  // Adversaire avec match officiel samedi prochain.
  await depot.enregistrer('adversaires', nouvelId('d'), documentParDefaut('adversaires', {
    nom: 'Kraken eSport', tag: 'KRK', circuit: 'Premier, division Contender',
    prochainMatch: { date: jour(6), heure: '18:00', format: 'bo3', nousCommencons: false },
    fortes: ['bind', 'lotus'], faibles: ['haven'], bans: ['abyss'],
    debuts: 'Rush B à 5 en attaque sur Bind, stack A en défense.', setups: 'Double sentinelle sur Lotus.',
    tendances: 'Jouent très vite les rounds 2 et 3 après un pistol gagné.', joueursCles: 'Leur Jett ouvre presque tous les rounds en attaque.',
    vods: ['https://example.com/vod/kraken-premier'], checklist: { vod: true },
  }), coach);
  await depot.enregistrer('adversaires', nouvelId('d'), documentParDefaut('adversaires', {
    nom: 'Orage', circuit: 'Tournois communautaires', fortes: ['sunset'], faibles: ['corrode'],
  }), null);

  // Présences des séances de la semaine précédente.
  const precedente = decalerSemaine(semaine, -1);
  const planning = (await stockage.lire('planning', semaine)) || (await stockage.lire('planning', 'modele'));
  if (planning?.blocs?.length && !(await stockage.lire('planning', precedente))) {
    await depot.enregistrer('planning', precedente, documentParDefaut('planning', { blocs: planning.blocs }), coach);
  }
  for (const [i, b] of seancesAppel(planning?.blocs || []).slice(0, 6).entries()) {
    const statuts = Object.fromEntries(titulaires.map((m, k) => [m._id, (i + k) % 7 === 0 ? 'absent' : (i + k) % 5 === 0 ? 'retard' : 'present']));
    await depot.enregistrer('presences', `${precedente}_${b.id}`, { semaine: precedente, blocId: b.id, jour: b.jour, debut: b.debut, titre: b.titre || b.type, statuts, note: '' }, null);
  }
  if (ids.Talus) {
    await depot.enregistrer('absences', nouvelId('a'), { membreId: ids.Talus, date: jour(2), debut: '20:00', fin: '23:00', raison: 'Examen le lendemain' }, null);
  }

  // Chiffres des 6 dernières semaines (Talus et Mistral n'en saisissent pas : le moniteur de santé le signale).
  const progression = { Kairo: [18.5, 19.2, 20.1, 19.8, 21.4, 22.0], Sable: [14.0, 15.1, 15.6, 16.8, 16.2, 17.5], Vesper: [16.2, 16.0, 17.1, 17.9, 18.4, 18.1] };
  for (const [pseudo, hs] of Object.entries(progression)) {
    const id = ids[pseudo];
    if (!id) continue;
    for (let k = 0; k < hs.length; k += 1) {
      const s = decalerSemaine(semaine, k - hs.length);
      await depot.enregistrer('mesures', `${id}_${s}`, {
        membreId: id, semaine: s, rang: pseudo === 'Sable' ? (k < 3 ? 'platine2' : 'platine3') : (k < 4 ? 'diamant1' : 'diamant2'),
        valeurs: { hs: hs[k], acs: Math.round(190 + hs[k] * 3 + k * 4), kd: Math.round((0.9 + hs[k] / 60 + k * 0.02) * 100) / 100 },
        parties: 8 + k, note: '',
      }, null);
    }
  }

  // Bibliothèque.
  const lineup = nouvelId('l');
  await depot.enregistrer('bibliotheque', lineup, documentParDefaut('bibliotheque', {
    type: 'astuce', titre: 'Flèche de reco vers le site C', map: 'haven', personnage: 'sova', camp: 'att', site: 'C',
    lien: 'https://example.com/lineups/haven-c', description: 'Depuis le spawn, viser le haut du toit, deux rebonds, pleine charge.',
  }), null);
  await depot.enregistrer('bibliotheque', nouvelId('l'), documentParDefaut('bibliotheque', {
    type: 'astuce', titre: 'Smoke CT pour l’exécution A', map: 'lotus', personnage: 'omen', camp: 'att', site: 'A', description: 'Depuis A main, aligner sur l’antenne.',
  }), null);
  await depot.enregistrer('bibliotheque', nouvelId('l'), documentParDefaut('bibliotheque', {
    type: 'ressource', titre: 'Les bases de l’économie en équipe', categorie: 'guide', lien: 'https://example.com/guide/economie', description: 'Quand acheter ensemble, quand garder.',
  }), null);
  const exec = (await stockage.lister('strats', { map: 'haven' })).find((x) => x.type === 'execute');
  if (exec) await depot.enregistrer('strats', exec._id, { ...documentParDefaut('strats', exec), lineups: [lineup] }, null);

  // Recrutement avec avis du staff.
  const candidat = nouvelId('k');
  await depot.enregistrer('candidats', candidat, documentParDefaut('candidats', {
    pseudo: 'Nova', idJeu: 'Nova#4242', roleJeu: 'sentinelle', rang: 'diamant2', personnages: 'Killjoy, Cypher, Deadlock', twitch: 'nova_demo',
    disponibilites: 'Tous les soirs sauf le mercredi', source: 'Serveur Discord de recrutement', notes: 'Calme en vocal, bonne lecture du jeu.',
  }), null);
  await depot.enregistrer('candidats', nouvelId('k'), documentParDefaut('candidats', { pseudo: 'Pixel', roleJeu: 'duelliste', rang: 'platine3', statut: 'refuse' }), null);
  for (const [compte, avis] of [[coach, 'pour'], [vesper, 'neutre']]) {
    if (compte) await depot.enregistrer('votes', `${candidat}_${compte._id}`, { cible: candidat, compteId: compte._id, avis, commentaire: avis === 'pour' ? 'Bon profil pour remplacer Talus les soirs d’examen.' : '' }, compte);
  }
}
