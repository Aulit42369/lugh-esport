// Ce que tous les jeux partagent : paliers de progression, blocs d'entraînement communs, formats de série,
// et les valeurs par défaut d'un modèle de jeu. Source unique de ce qui ne change pas d'un jeu à l'autre.

export const MOTIF_ID = /^[a-z0-9]{2,20}$/;

// Six paliers, du débutant complet à l'expert : les noms sont communs, les repères (rangs, résumés) viennent du modèle.
export const PALIERS_BASE = [
  { id: 'debutant-complet', n: 1, nom: 'Débutant complet' },
  { id: 'debutant', n: 2, nom: 'Débutant' },
  { id: 'intermediaire', n: 3, nom: 'Intermédiaire' },
  { id: 'confirme', n: 4, nom: 'Confirmé' },
  { id: 'avance', n: 5, nom: 'Avancé' },
  { id: 'expert', n: 6, nom: 'Expert' },
];

// Blocs d'entraînement présents dans tous les jeux ; un modèle ajoute les siens (aim, laning, freeplay…).
export const TYPES_BLOC_COMMUNS = [
  { id: 'echauffement', nom: 'Échauffement', duree: 30 },
  { id: 'theorie', nom: 'Théorie et stratbook', duree: 60 },
  { id: 'scrim', nom: 'Scrim', duree: 120 },
  { id: 'match', nom: 'Match officiel', duree: 150 },
  { id: 'vod', nom: 'VOD review', duree: 60 },
  { id: 'debrief', nom: 'Débrief', duree: 20 },
  { id: 'classe', nom: 'Classé en groupe', duree: 120 },
  { id: 'physique', nom: 'Activité physique', duree: 45 },
  { id: 'repos', nom: 'Repos', duree: 0 },
  { id: 'autre', nom: 'Autre', duree: 60 },
];

// Blocs où l'appel des présences n'a pas de sens.
export const TYPES_SANS_APPEL = new Set(['echauffement', 'physique', 'repos']);

// Formats de série quand le modèle n'a pas de veto de maps (draft, ou pas de veto).
export const FORMATS_SERIE = [
  { id: 'bo1', nom: 'BO1', etapes: [] },
  { id: 'bo3', nom: 'BO3', etapes: [] },
  { id: 'bo5', nom: 'BO5', etapes: [] },
  { id: 'bo7', nom: 'BO7', etapes: [] },
];

// shotcall : le genre a un IGL (shotcaller) attitré ; sinon la case « IGL » du roster et son alerte n'ont pas de sens.
export const GENRES = [
  { id: 'fps-tactique', nom: 'FPS tactique', shotcall: true },
  { id: 'moba', nom: 'MOBA', shotcall: true },
  { id: 'fps-heros', nom: 'FPS à héros', shotcall: true },
  { id: 'battle-royale', nom: 'Battle royale', shotcall: true },
  { id: 'sport-auto', nom: 'Sport mécanique', shotcall: false },
  { id: 'football', nom: 'Football', shotcall: false },
  { id: 'autre', nom: 'Autre genre', shotcall: true },
];

// Charge d'entraînement : au-delà de ce plafond d'heures planifiées par semaine, ou sous ce nombre de jours sans
// séance, le moniteur de santé prévient. Réglable dans les Réglages du jeu.
export const CHARGE_DEFAUT = { heuresMax: 20, joursOffMin: 1 };

export const TYPES_SCORE = [
  { id: 'manches', nom: 'Manches avec mi-temps (rounds)', resume: 'Score en manches, deux camps qui s’échangent à la mi-temps.' },
  { id: 'simple', nom: 'Score simple', resume: 'Un score par match : buts, parties ou maps gagnées.' },
  { id: 'classement', nom: 'Classement (battle royale)', resume: 'Place finale, éliminations et points.' },
];

export const TYPES_VETO = ['cartes', 'draft', 'aucun'];

// Domaine d'une source de la méta : « https://www.site.com/chemin » → « site.com » (la recherche web filtre par domaine).
export function domaineSource(s) {
  const t = String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const d = t.split(/[/?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : '';
}

export function normaliserSources(liste = []) {
  return [...new Set(liste.map(domaineSource).filter(Boolean))].slice(0, 20);
}

const VOCABULAIRE_VIDE = { personnage: null, personnages: null, carte: null, cartes: null, manche: 'manche', manches: 'manches' };

function scoreParDefaut(score = {}) {
  const type = TYPES_SCORE.some((t) => t.id === score.type) ? score.type : 'simple';
  if (type === 'manches') {
    return { type, gagnant: score.gagnant || 13, miTemps: score.miTemps || 12, pistols: !!score.pistols };
  }
  if (type === 'classement') {
    const bareme = score.bareme && Array.isArray(score.bareme.places)
      ? { places: score.bareme.places.map((p) => Number(p) || 0).slice(0, 100), elimination: Number(score.bareme.elimination) || 0 }
      : null;
    return { type, equipes: score.equipes || 20, bareme };
  }
  return { type };
}

// Complète un modèle avec les valeurs par défaut : tout le reste du code peut compter sur ces champs.
export function completerModele(m) {
  const vocabulaire = { ...VOCABULAIRE_VIDE, ...(m.vocabulaire || {}) };
  if (!vocabulaire.astuce) vocabulaire.astuce = m.genre === 'fps-tactique' ? 'lineup' : 'astuce';
  if (!vocabulaire.astuces) vocabulaire.astuces = `${vocabulaire.astuce}s`;
  const veto = m.veto || {};
  return {
    ...m,
    court: m.court || m.nom,
    genre: GENRES.some((g) => g.id === m.genre) ? m.genre : 'autre',
    equipe: { titulaires: m.equipe?.titulaires || 5, remplacants: m.equipe?.remplacants ?? 2 },
    vocabulaire,
    roles: m.roles || [],
    camps: m.camps || [],
    typesStrat: (m.typesStrat || []).map((t) => ({ ...t, camps: t.camps || [] })),
    typesBloc: m.typesBloc || [],
    rangs: (m.rangs || []).map((r, i) => ({ ...r, n: i + 1 })),
    chiffres: m.chiffres || [],
    score: scoreParDefaut(m.score),
    veto: {
      type: TYPES_VETO.includes(veto.type) ? veto.type : 'aucun',
      formats: Array.isArray(veto.formats) ? veto.formats : [],
      notes: veto.notes || '',
    },
    checklistMatch: m.checklistMatch || [],
    profil: m.profil || null,
    meta: { sources: normaliserSources(m.meta?.sources), consigne: m.meta?.consigne || '', pool: m.meta?.pool !== false, auto: true },
    personnagesParCamp: !!m.personnagesParCamp,
    charge: { ...CHARGE_DEFAUT, ...(m.charge || {}) },
    seuils: m.seuils || {},
    paliers: { rangs: m.paliers?.rangs || [], resumes: m.paliers?.resumes || [] },
    domaines: m.domaines || [],
    objectifs: m.objectifs || [],
    collectifs: m.collectifs || [],
    ebauches: m.ebauches || [],
    routines: m.routines || {},
    parRole: m.parRole || {},
  };
}
