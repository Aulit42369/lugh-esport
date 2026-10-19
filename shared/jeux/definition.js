// Définition effective d'un jeu : le modèle, complété par les Réglages du jeu et le nom de l'espace.
// C'est elle que le serveur utilise pour valider et qu'il envoie au navigateur : une seule fusion, au même endroit.

import { completerModele, PALIERS_BASE, TYPES_BLOC_COMMUNS, FORMATS_SERIE, TYPES_SCORE, GENRES, normaliserSources } from './commun.js';

// Listes que les Réglages du jeu peuvent remplacer (un élément retiré est « archivé » : masqué mais toujours valide).
export const LISTES_REGLABLES = ['roles', 'camps', 'typesStrat', 'typesBloc', 'rangs', 'chiffres', 'checklistMatch', 'domaines'];
const MOTS = ['personnage', 'personnages', 'carte', 'cartes', 'manche', 'manches', 'astuce', 'astuces'];

function copier(liste) {
  return liste.map((x) => ({ ...x }));
}

function fusionnerScore(base, r) {
  if (!r || !TYPES_SCORE.some((t) => t.id === r.type)) return base;
  if (r.type === 'manches') return { type: 'manches', gagnant: r.gagnant || 13, miTemps: r.miTemps || 12, pistols: !!r.pistols };
  if (r.type === 'classement') return { type: 'classement', equipes: r.equipes || 20, bareme: r.bareme || null };
  return { type: 'simple' };
}

export function definitionEffective(modele, reglages = null, espace = null) {
  const base = completerModele(modele);
  const r = reglages || {};
  const { initiale, ...def } = base;

  def.modele = modele.id;
  def.espace = espace?.id || modele.id;
  def.nom = espace?.nom || base.nom;
  def.court = espace?.court || base.court;

  def.vocabulaire = { ...base.vocabulaire };
  for (const mot of MOTS) {
    if (r.vocabulaire && Object.hasOwn(r.vocabulaire, mot)) def.vocabulaire[mot] = r.vocabulaire[mot] || null;
  }
  for (const [s, p] of [['personnage', 'personnages'], ['carte', 'cartes'], ['astuce', 'astuces']]) {
    if (!def.vocabulaire[s] || !def.vocabulaire[p]) def.vocabulaire[s] = def.vocabulaire[p] = null;
  }
  if (!def.vocabulaire.manche || !def.vocabulaire.manches) Object.assign(def.vocabulaire, { manche: 'manche', manches: 'manches' });
  if (!def.vocabulaire.astuce) Object.assign(def.vocabulaire, { astuce: 'astuce', astuces: 'astuces' });

  if (r.equipe) def.equipe = { titulaires: r.equipe.titulaires, remplacants: r.equipe.remplacants };
  def.score = fusionnerScore(base.score, r.score);

  for (const cle of LISTES_REGLABLES) def[cle] = copier(Array.isArray(r.listes?.[cle]) ? r.listes[cle] : base[cle]);
  def.rangs = def.rangs.map((x, i) => ({ ...x, n: i + 1 }));
  def.typesStrat = def.typesStrat.map((t) => ({ ...t, camps: t.camps || [] }));

  def.parRole = { ...base.parRole };
  for (const role of def.roles) if (Array.isArray(role.exercices) && role.exercices.some(Boolean)) def.parRole[role.id] = role.exercices.filter(Boolean);

  const textes = r.objectifs || {};
  const reecrire = (o) => (textes[o.id] ? { ...o, texte: textes[o.id].texte || o.texte, critere: textes[o.id].critere || o.critere } : o);
  def.objectifs = base.objectifs.map(reecrire);
  def.collectifs = base.collectifs.map(reecrire);

  def.routines = { ...base.routines };
  for (const [n, routine] of Object.entries(r.routines || {})) if (def.routines[n]) def.routines[n] = { ...def.routines[n], ...routine };

  if (r.profil) {
    const { site, modele: adresse, format, aide } = r.profil;
    def.profil = r.profil.actif ? { site, modele: adresse, format, aide, separateur: adresse === base.profil?.modele ? base.profil.separateur : undefined } : null;
  }

  def.meta = {
    ...base.meta,
    sources: Array.isArray(r.meta?.sources) ? normaliserSources(r.meta.sources) : base.meta.sources,
    consigne: r.meta?.consigne || base.meta.consigne,
    auto: r.meta?.auto !== false,
  };
  def.charge = r.charge ? { heuresMax: r.charge.heuresMax, joursOffMin: r.charge.joursOffMin } : { ...base.charge };
  def.couleur = espace?.couleur || '';

  // Valeurs calculées, pour que l'interface et le serveur posent les mêmes questions.
  def.paliers = PALIERS_BASE.map((p, i) => ({ ...p, rangs: base.paliers.rangs[i] || '', resume: base.paliers.resumes[i] || '' }));
  def.typesBlocTous = [TYPES_BLOC_COMMUNS[0], ...def.typesBloc, ...TYPES_BLOC_COMMUNS.slice(1)];
  def.formats = def.veto.type === 'cartes' && def.veto.formats.length ? def.veto.formats : FORMATS_SERIE;
  def.aPersonnages = !!def.vocabulaire.personnage;
  def.aCartes = !!def.vocabulaire.carte;
  def.aPool = def.aCartes && def.meta.pool;
  def.personnagesParCamp = def.aPersonnages && base.personnagesParCamp && actifs(def.camps).length === 2;
  def.shotcall = GENRES.find((g) => g.id === def.genre)?.shotcall !== false;
  def.seuils = Object.fromEntries(Object.entries(base.seuils).filter(([, s]) => def.chiffres.some((c) => c.id === s.chiffre)));
  return def;
}

// ——— Lecture des listes ———

export const actifs = (liste = []) => liste.filter((x) => !x.archive);
export const idsDe = (liste = []) => liste.map((x) => x.id);
export const trouverDans = (liste = [], id) => liste.find((x) => x.id === id) || null;

export function libelleDans(liste, id, parDefaut = '') {
  return trouverDans(liste, id)?.nom ?? (parDefaut || id || '');
}

// Mot du vocabulaire du jeu, avec majuscule si demandé : mot(def, 'cartes', true) → « Maps ».
export function mot(def, cle, majuscule = false) {
  const m = def?.vocabulaire?.[cle] || '';
  return majuscule && m ? m[0].toUpperCase() + m.slice(1) : m;
}

export function typesStratPour(def, camp = '') {
  return actifs(def.typesStrat).filter((t) => !camp || !t.camps.length || t.camps.includes(camp));
}

export function formatParId(def, id) {
  return trouverDans(def.formats, id) || def.formats[Math.min(1, def.formats.length - 1)] || FORMATS_SERIE[1];
}

// Lien vers le profil public d'un joueur, si le jeu en a un et si l'identifiant a le bon format.
export function urlProfil(def, identifiant) {
  const p = def?.profil;
  const id = String(identifiant || '').trim();
  if (!p?.modele || !id || id.length > 40) return null; // court : le motif reste rapide à tester
  try {
    if (p.format && !new RegExp(p.format).test(id)) return null;
  } catch {
    return null;
  }
  const valeur = p.separateur ? id.replace('#', p.separateur) : id;
  const url = p.modele.replace('{id}', encodeURIComponent(valeur));
  return /^https:\/\/[^\s]+$/.test(url) ? url : null;
}
