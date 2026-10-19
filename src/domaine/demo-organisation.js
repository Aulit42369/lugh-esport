// Démonstration (simulation uniquement) des nouveautés d'organisation : tournois, partenaires de scrim, comptes rendus
// de séance, annonces de la structure, et un conflit d'agenda entre Valorant et le second jeu. Noms inventés ;
// liens vers example.com (domaine réservé aux exemples).

import { nouvelId } from '../../shared/validation.js';
import { semaineCourante, decalerSemaine, aujourdhui, ajouterJours, civileDepuisIso, isoCivile, minutes, hhmm } from '../../shared/temps.js';

export async function remplirDemoOrganisation({ s, valorant, second, ids, idsSecond, admin, coach }) {
  const { global, config } = s;
  const jour = (d) => isoCivile(ajouterJours(civileDepuisIso(aujourdhui(config.fuseau)), d));
  const semaine = semaineCourante(config.fuseau);
  const { documentParDefaut } = valorant.schemas();
  const depot = valorant.depot;

  // Tournois : une inscription à boucler dans 3 jours, un tournoi inscrit dans 9 jours, un résultat du mois dernier.
  const titulaires = ['Vesper', 'Kairo', 'Talus', 'Mistral', 'Sillage'].map((p) => ids[p]).filter(Boolean);
  const tournois = [
    { nom: 'Coupe des Brumes', organisateur: 'Ligue associative', lien: 'https://example.com/coupe-des-brumes', format: 'BO1 en poules, BO3 en finale', dateLimite: jour(3), debut: jour(12), fin: jour(13), statut: 'envisage' },
    { nom: 'Open du Phare', organisateur: 'Association étudiante', lien: 'https://example.com/open-du-phare', format: 'Double élimination, BO3', dateLimite: jour(-2), debut: jour(9), fin: jour(10), statut: 'inscrit', roster: titulaires },
    { nom: 'Tournoi des Marées', organisateur: 'Ligue associative', format: 'Simple élimination, BO1', debut: jour(-26), fin: jour(-25), statut: 'termine', roster: titulaires, place: 3, resultat: 'Demi-finale' },
  ];
  for (const t of tournois) await depot.enregistrer('tournois', nouvelId('t'), documentParDefaut('tournois', t), coach);

  // Partenaires de scrim : leurs scrims déjà saisis leur sont rattachés.
  const partenaires = [
    { nom: 'Nébula', tag: 'NBL', niveau: 'Même niveau', contact: 'manager.nebula', lien: 'https://example.com/nebula', creneaux: 'Mardi et jeudi, 20 h', statut: 'actif', notes: 'Toujours à l’heure, scrims sérieux.' },
    { nom: 'Kraken eSport', tag: 'KRK', niveau: 'Un peu au-dessus', contact: 'kraken.staff', creneaux: 'Week-end', statut: 'actif', incidents: [{ date: jour(-17), type: 'annule', note: 'Annulé une heure avant' }, { date: jour(-6), type: 'retard', note: '20 minutes de retard' }] },
    { nom: 'Orage', tag: 'ORG', niveau: 'En dessous', creneaux: 'Mercredi 21 h', statut: 'eviter', notes: 'Deux absences sans prévenir.', incidents: [{ date: jour(-24), type: 'absent' }, { date: jour(-11), type: 'absent' }] },
  ];
  const idPartenaire = {};
  for (const p of partenaires) {
    const id = nouvelId('e');
    idPartenaire[p.nom] = id;
    await depot.enregistrer('partenaires', id, documentParDefaut('partenaires', p), coach);
  }
  for (const x of await valorant.stockage.lister('scrims')) {
    const p = idPartenaire[x.adversaire];
    if (p) await depot.enregistrer('scrims', x._id, { ...documentParDefaut('scrims', x), partenaire: p }, null);
  }

  // Comptes rendus de deux séances de la semaine passée.
  const precedente = decalerSemaine(semaine, -1);
  const planning = await valorant.stockage.lire('planning', precedente);
  const textes = [
    { travaille: 'Retakes du site B sur Lotus : trois scénarios à 3 contre 4, puis à 2 contre 3.', positif: 'Utilitaires bien gardés pour le retake.', aRevoir: 'On se regroupe trop tard : 15 secondes perdues à chaque fois.', suite: 'Refaire le scénario à 2 contre 3 avec un appel imposé.' },
    { travaille: 'VOD du scrim contre Nébula : les rounds 4 à 9.', positif: 'Bonne lecture des rotations adverses.', aRevoir: 'Prise de milieu abandonnée dès la première mort.', suite: '' },
  ];
  const blocs = (planning?.blocs || []).filter((b) => ['scrim', 'vod', 'theorie', 'debrief'].includes(b.type)).slice(0, 2);
  for (const [i, b] of blocs.entries()) {
    await depot.enregistrer('seances', `${precedente}_${b.id}`, documentParDefaut('seances', {
      semaine: precedente, blocId: b.id, jour: b.jour, debut: b.debut, type: b.type, titre: b.titre || '', ...textes[i],
    }), coach);
  }

  // Conflit d'agenda : Mistral joue dans les deux jeux ; une séance du second jeu chevauche une séance Valorant.
  const actuel = await valorant.stockage.lire('planning', semaine);
  const cible = (actuel?.blocs || []).find((b) => b.pour === 'equipe' && b.type !== 'repos');
  const secondPlanning = await second.stockage.lire('planning', semaine);
  if (cible && secondPlanning && idsSecond[5]) {
    const debut = hhmm(minutes(cible.debut) + 30);
    const bloc = { id: nouvelId('b'), jour: cible.jour, debut, fin: hhmm(Math.min(minutes(debut) + 90, 23 * 60 + 59)), type: 'scrim', titre: 'Scrim', details: '', pour: 'equipe', membres: [], map: '' };
    await second.depot.enregistrer('planning', semaine, { ...secondPlanning, blocs: [...secondPlanning.blocs, bloc] }, null);
  }

  // Annonces de la structure : une pour tous les jeux (importante), une pour Valorant seulement.
  const maintenant = new Date().toISOString();
  await global.ecrire('annonces', {
    _id: nouvelId('an'), titre: 'Nouvelle saison : réunion de rentrée', importante: true, jeux: [], expireLe: jour(14), creeLe: maintenant, par: admin?._id || 'systeme', lus: {},
    texte: 'Réunion de toute la structure dimanche à 18 h sur le Discord : objectifs de la saison, calendrier des tournois et nouvelles règles de présence.',
  });
  await global.ecrire('annonces', {
    _id: nouvelId('an'), titre: 'Bootcamp des vacances', importante: false, jeux: [valorant.id], expireLe: '', creeLe: maintenant, par: admin?._id || 'systeme', lus: {},
    texte: 'Trois jours d’entraînement renforcé pendant les vacances : remplissez vos disponibilités avant vendredi.',
  });
}
