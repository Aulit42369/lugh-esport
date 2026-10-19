// Métiers (rôles des comptes dans un jeu), permissions et accès aux espaces.
// Source unique : le serveur applique ces droits à chaque requête, l'interface ne fait que les refléter.
// Un compte a des métiers PAR JEU (acces[jeu].metiers) ; l'Administrateur général est Responsable partout.

export const PERMISSIONS = {
  'comptes.gerer': 'Gérer les comptes du jeu et leurs métiers',
  'jeu.regler': 'Modifier les Réglages du jeu',
  'equipe.profil': 'Modifier le profil de l’équipe',
  'roster.modifier': 'Modifier le roster',
  'maps.modifier': 'Modifier les maps et les compos',
  'strats.modifier': 'Modifier le stratbook',
  'planning.modifier': 'Modifier le planning',
  'objectifs.fixer': 'Fixer les paliers et valider les objectifs',
  'objectifs.auto': 'S’auto-évaluer sur ses objectifs',
  'scrims.modifier': 'Saisir les scrims et les matchs',
  'vod.modifier': 'Gérer la file des VOD',
  'vod.noter': 'Ajouter des notes de VOD',
  'dispos.soi': 'Remplir ses disponibilités et déclarer ses absences',
  'dispos.tous': 'Remplir les disponibilités et absences de tout le monde',
  'suggestions.traiter': 'Appliquer ou ignorer les suggestions',
  'meta.actualiser': 'Vérifier ou importer la méta',
  'donnees.exporter': 'Exporter et restaurer les données du jeu',
  'reglages.gerer': 'Régler les notifications Discord',
  'presences.modifier': 'Noter les présences',
  'mesures.soi': 'Saisir ses propres chiffres',
  'adversaires.modifier': 'Préparer les adversaires et le veto',
  'tournois.modifier': 'Inscrire l’équipe aux tournois et suivre les résultats',
  'bibliotheque.modifier': 'Ajouter des lineups, astuces et ressources',
  'recrutement.voter': 'Voir les candidats et donner son avis',
  'recrutement.modifier': 'Gérer le recrutement',
};

const TOUTES = Object.keys(PERMISSIONS);

export const METIERS = {
  responsable: {
    nom: 'Responsable du jeu',
    resume: 'Gère les comptes et les réglages de ce jeu, et tout son espace.',
    perms: TOUTES,
  },
  headcoach: {
    nom: 'Head coach',
    resume: 'Dirige le sportif : planning, compos, stratbook, progression, roster.',
    perms: ['equipe.profil', 'roster.modifier', 'maps.modifier', 'strats.modifier', 'planning.modifier',
      'objectifs.fixer', 'scrims.modifier', 'vod.modifier', 'vod.noter', 'dispos.soi', 'dispos.tous',
      'suggestions.traiter', 'meta.actualiser', 'presences.modifier', 'adversaires.modifier', 'tournois.modifier',
      'bibliotheque.modifier', 'recrutement.voter', 'recrutement.modifier'],
  },
  coach: {
    nom: 'Coach adjoint',
    resume: 'Prépare les séances, les scrims et les reviews.',
    perms: ['maps.modifier', 'strats.modifier', 'planning.modifier', 'objectifs.fixer', 'scrims.modifier',
      'vod.modifier', 'vod.noter', 'dispos.soi', 'dispos.tous', 'suggestions.traiter', 'presences.modifier',
      'adversaires.modifier', 'tournois.modifier', 'bibliotheque.modifier', 'recrutement.voter'],
  },
  analyste: {
    nom: 'Analyste',
    resume: 'Saisit les scrims, analyse les VOD et documente les strats.',
    perms: ['strats.modifier', 'scrims.modifier', 'vod.modifier', 'vod.noter', 'dispos.soi', 'adversaires.modifier',
      'bibliotheque.modifier', 'recrutement.voter'],
  },
  capitaine: {
    nom: 'Capitaine / IGL',
    resume: 'Construit les compos et le stratbook avec le staff.',
    perms: ['maps.modifier', 'strats.modifier', 'scrims.modifier', 'vod.modifier', 'vod.noter',
      'objectifs.auto', 'dispos.soi', 'presences.modifier', 'mesures.soi', 'adversaires.modifier',
      'tournois.modifier', 'bibliotheque.modifier', 'recrutement.voter'],
  },
  joueur: {
    nom: 'Joueur',
    resume: 'Consulte tout, remplit ses dispos et ses chiffres, note les VOD.',
    perms: ['vod.noter', 'objectifs.auto', 'dispos.soi', 'mesures.soi', 'bibliotheque.modifier'],
  },
  remplacant: {
    nom: 'Remplaçant',
    resume: 'Mêmes accès qu’un joueur.',
    perms: ['vod.noter', 'objectifs.auto', 'dispos.soi', 'mesures.soi', 'bibliotheque.modifier'],
  },
  invite: {
    nom: 'Invité',
    resume: 'Consulte l’espace de ce jeu sans rien modifier.',
    perms: [],
  },
};

export const ORDRE_METIERS = ['responsable', 'headcoach', 'coach', 'analyste', 'capitaine', 'joueur', 'remplacant', 'invite'];

export function estMetier(id) {
  return Object.prototype.hasOwnProperty.call(METIERS, id);
}

export function ordonnerMetiers(metiers = []) {
  return ORDRE_METIERS.filter((m) => metiers.includes(m));
}

export function permissionsDe(metiers = []) {
  const perms = new Set();
  for (const m of metiers) {
    if (estMetier(m)) for (const p of METIERS[m].perms) perms.add(p);
  }
  return perms;
}

// « compte » ici est la vue d'un compte DANS un jeu : { metiers, membreId, actif } (voir accesEspace).
export function peut(compte, perm) {
  if (!compte || compte.actif === false) return false;
  return permissionsDe(compte.metiers).has(perm);
}

export function nomsMetiers(metiers = []) {
  return ORDRE_METIERS.filter((m) => metiers.includes(m)).map((m) => METIERS[m].nom);
}

// Accès d'un compte à un jeu : ses métiers et son membre dans ce jeu ; l'Administrateur général y est Responsable.
// null si le compte n'a pas accès à ce jeu.
export function accesEspace(compte, jeu) {
  if (!compte || compte.actif === false) return null;
  const a = compte.acces?.[jeu];
  if (compte.admin) {
    return { metiers: ordonnerMetiers([...new Set(['responsable', ...(a?.metiers || [])])]), membreId: a?.membreId || '', admin: true };
  }
  if (!a || !Array.isArray(a.metiers) || !a.metiers.length) return null;
  return { metiers: ordonnerMetiers(a.metiers), membreId: a.membreId || '', admin: false };
}

// Jeux auxquels un compte a accès (hors Administrateur général, qui les voit tous).
export function jeuxDuCompte(compte) {
  return Object.entries(compte?.acces || {}).filter(([, a]) => a?.metiers?.length).map(([jeu]) => jeu);
}

export function estResponsable(compte, jeu) {
  return !!accesEspace(compte, jeu)?.metiers.includes('responsable');
}
