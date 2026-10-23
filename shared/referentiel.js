// Référentiel commun à tous les jeux : statuts, publics, jours, catégories, événements Discord.
// Ce qui change d'un jeu à l'autre (rôles, camps, types de strat, rangs, chiffres…) vit dans shared/jeux/.
// Source unique : toute nouvelle valeur commune s'ajoute ici et nulle part ailleurs.

export const STATUTS_MAP = [
  { id: 'pick', nom: 'Pick', resume: 'Notre map : on la choisit en priorité.' },
  { id: 'confort', nom: 'Confort', resume: 'Jouable sereinement contre la plupart des équipes.' },
  { id: 'travail', nom: 'En travail', resume: 'Pas encore prête pour un match officiel.' },
  { id: 'ban', nom: 'Ban', resume: 'On la retire en priorité au veto.' },
];

export const STATUTS_STRAT = [
  { id: 'apprendre', nom: 'À apprendre' },
  { id: 'rodage', nom: 'En rodage' },
  { id: 'maitrisee', nom: 'Maîtrisée' },
  { id: 'archivee', nom: 'Archivée' },
];

export const PUBLICS_BLOC = [
  { id: 'equipe', nom: 'Toute l’équipe' },
  { id: 'titulaires', nom: 'Titulaires' },
  { id: 'individuel', nom: 'Chacun de son côté' },
  { id: 'staff', nom: 'Staff' },
  { id: 'choix', nom: 'Membres choisis' },
];

export const TYPES_SCRIM = [
  { id: 'scrim', nom: 'Scrim' },
  { id: 'officiel', nom: 'Match officiel' },
  { id: 'tournoi', nom: 'Tournoi' },
  { id: 'ligue', nom: 'Ligue ou circuit' },
  { id: 'amical', nom: 'Amical' },
];

export const RESULTATS_MANCHE = [
  { id: 'gagne', nom: 'Gagné' },
  { id: 'perdu', nom: 'Perdu' },
];

export const STATUTS_OBJECTIF = [
  { id: 'afaire', nom: 'À travailler' },
  { id: 'encours', nom: 'En cours' },
  { id: 'atteint', nom: 'Atteint' },
];

export const CATEGORIES_NOTE = [
  { id: 'placement', nom: 'Placement' },
  { id: 'utilitaires', nom: 'Utilitaires et ressources' },
  { id: 'communication', nom: 'Communication' },
  { id: 'mecanique', nom: 'Mécanique' },
  { id: 'decision', nom: 'Décision' },
  { id: 'economie', nom: 'Économie et tempo' },
  { id: 'mental', nom: 'Mental' },
  { id: 'positif', nom: 'À refaire' },
];

export const STATUTS_VOD = [
  { id: 'arevoir', nom: 'À revoir' },
  { id: 'encours', nom: 'En cours' },
  { id: 'revue', nom: 'Revue' },
];

export const TYPES_MEMBRE = [
  { id: 'joueur', nom: 'Joueur' },
  { id: 'staff', nom: 'Staff' },
];

export const STATUTS_MEMBRE = [
  { id: 'titulaire', nom: 'Titulaire', pour: 'joueur' },
  { id: 'remplacant', nom: 'Remplaçant', pour: 'joueur' },
  { id: 'essai', nom: 'À l’essai', pour: 'joueur' },
  { id: 'actif', nom: 'Actif', pour: 'staff' },
  { id: 'ancien', nom: 'Ancien', pour: 'tous' },
];

export const FONCTIONS_STAFF = [
  { id: 'manager', nom: 'Manager' },
  { id: 'headcoach', nom: 'Head coach' },
  { id: 'coach', nom: 'Coach adjoint' },
  { id: 'analyste', nom: 'Analyste' },
  { id: 'autre', nom: 'Autre' },
];

export const JOURS = [
  { n: 1, nom: 'Lundi', court: 'Lun' },
  { n: 2, nom: 'Mardi', court: 'Mar' },
  { n: 3, nom: 'Mercredi', court: 'Mer' },
  { n: 4, nom: 'Jeudi', court: 'Jeu' },
  { n: 5, nom: 'Vendredi', court: 'Ven' },
  { n: 6, nom: 'Samedi', court: 'Sam' },
  { n: 7, nom: 'Dimanche', court: 'Dim' },
];

// Créneaux d'une heure proposés dans la grille des disponibilités (début de créneau).
export const HEURES_DISPO = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

export const TYPES_SUGGESTION = [
  { id: 'planning', nom: 'Planning' },
  { id: 'compo', nom: 'Compo' },
  { id: 'strats', nom: 'Stratbook' },
  { id: 'roster', nom: 'Roster' },
];

export const STATUTS_PRESENCE = [
  { id: 'present', nom: 'Présent', court: 'P' },
  { id: 'retard', nom: 'En retard', court: 'R' },
  { id: 'excuse', nom: 'Excusé', court: 'E' },
  { id: 'absent', nom: 'Absent', court: 'A' },
];

export const TYPES_BIBLIO = [
  { id: 'astuce', nom: 'Lineup ou astuce' },
  { id: 'ressource', nom: 'Ressource' },
];

export const CATEGORIES_RESSOURCE = [
  { id: 'guide', nom: 'Guide' },
  { id: 'video', nom: 'Vidéo' },
  { id: 'pro', nom: 'Match pro à regarder' },
  { id: 'outil', nom: 'Outil' },
  { id: 'autre', nom: 'Autre' },
];

export const STATUTS_CANDIDAT = [
  { id: 'propose', nom: 'Proposé' },
  { id: 'essai', nom: 'À l’essai' },
  { id: 'accepte', nom: 'Accepté' },
  { id: 'refuse', nom: 'Refusé' },
];

export const AVIS = [
  { id: 'pour', nom: 'Pour' },
  { id: 'neutre', nom: 'Neutre' },
  { id: 'contre', nom: 'Contre' },
];

export const STATUTS_TOURNOI = [
  { id: 'envisage', nom: 'Envisagé' },
  { id: 'inscrit', nom: 'Inscrits' },
  { id: 'encours', nom: 'En cours' },
  { id: 'termine', nom: 'Terminé' },
  { id: 'abandonne', nom: 'Abandonné' },
];

export const STATUTS_PARTENAIRE = [
  { id: 'actif', nom: 'Partenaire régulier' },
  { id: 'essai', nom: 'À essayer' },
  { id: 'pause', nom: 'En pause' },
  { id: 'eviter', nom: 'À éviter' },
];

// Incidents notés dans le carnet des partenaires de scrim (les scrims joués se comptent tout seuls).
export const INCIDENTS_PARTENAIRE = [
  { id: 'annule', nom: 'Annulé par eux', court: 'Annulé' },
  { id: 'absent', nom: 'Pas venus', court: 'Absents' },
  { id: 'retard', nom: 'Arrivés en retard', court: 'Retard' },
  { id: 'annuleNous', nom: 'Annulé par nous', court: 'Annulé (nous)' },
];

export const EVENEMENTS_DISCORD = [
  { id: 'planning', nom: 'Planning de la semaine publié ou modifié' },
  { id: 'scrims', nom: 'Résultats de scrims et de matchs' },
  { id: 'matchs', nom: 'Prochain match officiel fixé' },
  { id: 'meta', nom: 'Changements de méta (patch, maps, personnages)' },
  { id: 'absences', nom: 'Absences déclarées' },
];

export function ids(liste) {
  return liste.map((e) => e.id);
}

export function trouver(liste, id) {
  return liste.find((e) => e.id === id) || null;
}

// Noms de jeu interdits : ceux des rôles de fonction que le bot Discord crée (lugh-bot, src/structure.js). Un jeu nommé
// ainsi verrait le bot donner ce rôle de fonction (Administrateur compris) à tous les membres du jeu.
const NOMS_RESERVES = ['administrateur', 'responsable', 'staff', 'capitaine / igl', 'capitaine', 'igl', 'joueur', 'remplacant', 'invite'];
const normeNom = (n) => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export const estNomJeuReserve = (nom) => NOMS_RESERVES.includes(normeNom(nom));
// Nom ou nom court déjà pris par un AUTRE jeu (actif ou désactivé) : le bot nomme le rôle d'après le nom et la catégorie
// d'après le nom court, et ne fait que bloquer un doublon. Renvoie l'erreur à lever (chemin et message) ou null.
export function nomJeuDejaPris(jeux, id, { nom = '', court = '' } = {}) {
  for (const [chemin, valeur, libelleChamp] of [['nom', nom, 'ce nom'], ['court', court, 'ce nom court']]) {
    if (!normeNom(valeur)) continue;
    const autre = jeux.find((j) => j._id !== id && normeNom(j[chemin]) === normeNom(valeur));
    if (autre) return { chemin, message: `${libelleChamp} est déjà celui du jeu « ${autre.nom} » (le bot Discord nomme rôle et catégorie d’après lui) : choisis-en un autre` };
  }
  return null;
}
export const MESSAGE_NOM_RESERVE = 'ce nom est celui d’un rôle de fonction sur Discord (Administrateur, Responsable, Staff, Capitaine / IGL, Joueur, Remplaçant, Invité) : choisis un autre nom';

export function libelle(liste, id, parDefaut = '') {
  return trouver(liste, id)?.nom ?? (parDefaut || id || '');
}
