// Reprise après sinistre de la base générale : relit une sauvegarde de la structure (_structure.json, version 1 ou 2)
// et ne remplit que ce qui manque. Règle unique, la plus sûre : rien de ce qui existe n'est jamais modifié.
// - Jeux absents : créés par le registre (comme à l'activation), puis nom, couleur, ordre et état remis ; un jeu
//   existant est ignoré. Leurs fiches reviennent ensuite jeu par jeu avec les sauvegardes de jeu (restauration.js).
// - Comptes absents (ni le même identifiant interne, ni le même identifiant de connexion) : recréés avec leur
//   identifiant interne (les fiches des jeux qui les citent restent reliées) et un mot de passe temporaire aléatoire
//   à changer à la première connexion, montré une seule fois, jamais journalisé ni stocké en clair.
// - Identité, suivi, réglages des livres, veille : un document absent est créé, un document présent est gardé.
// - Écritures des livres, autorisations des mineurs, annonces : remises seulement si la collection est vide ; sinon
//   toute la collection du fichier est ignorée (mélanger deux états d'un livre des comptes fausserait les soldes).
// Tout est contrôlé (format, version, chaque document revalidé) avant la première écriture.

import { erreurs } from '../http/outils.js';
import { hacherMdp, genererMdpTemporaire } from '../auth/mdp.js';
import { valider, date, MOTIFS } from '../../shared/validation.js';
import { creationCompte } from '../../shared/schemas-comptes.js';
import { estMetier, ordonnerMetiers } from '../../shared/roles.js';
import { MODELES, ID_AUTRE } from '../../shared/jeux/index.js';
import { estCouleurJeu } from '../../shared/couleurs.js';
import { identite as schemaIdentite, suiviPoint, autorisation as schemaAutorisation } from '../../shared/administratif/identite.js';
import { schemaEcriture, reglagesComptes, livreValide, MONTANT_MAX } from '../../shared/administratif/comptes.js';
import { formeAnnonce } from '../routes/annonces.js';
import { ID_RESERVES } from '../routes/admin.js';
import { MAX_COMPTES, MAX_ESPACES } from './collections.js';
import { FORMAT_STRUCTURE, VERSIONS_LISIBLES, PARAMETRES } from './sauvegarde-structure.js';

export const MOT_REPRISE = 'RESTAURER';
const MAX_ECRITURES = 5000; // par livre, comme routes/tresorerie.js
const MAX_ANNONCES = 100;

const NOMS_PARAMETRES = {
  'structure-identite': 'Identité de la structure',
  'structure-suivi': 'Suivi des obligations',
  'structure-comptes': 'Réglages du livre de l’association',
  'structure-comptes-societe': 'Réglages du livre de la société',
  'structure-veille': 'Veille légale',
};
const NOMS_COLLECTIONS = { ecritures: 'Écritures des livres des comptes', autorisations: 'Autorisations des mineurs', annonces: 'Annonces' };

const liste = (x) => (Array.isArray(x) ? x : []);
const estObjet = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const texteCourt = (x, max) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const horodatage = (x) => (typeof x === 'string' ? x.slice(0, 40) : '');
const idCompte = (x) => (typeof x === 'string' && MOTIFS.compte.test(x) ? x : '');
const sansId = ({ _id, ...reste }) => reste;

function jeuValide(j) {
  if (!estObjet(j) || typeof j._id !== 'string' || !MOTIFS.jeu.test(j._id) || !Object.hasOwn(MODELES, j.modele)) return null;
  // Un jeu du catalogue porte l'identifiant de son modèle ; un « Autre jeu » jamais celui d'un modèle ni d'une page.
  if (j.modele === ID_AUTRE ? Object.hasOwn(MODELES, j._id) || ID_RESERVES.has(j._id) : j._id !== j.modele) return null;
  const nom = texteCourt(j.nom, 40);
  if (j.modele === ID_AUTRE && nom.length < 2) return null;
  return {
    id: j._id,
    modele: j.modele,
    nom,
    court: texteCourt(j.court, 12),
    couleur: estCouleurJeu(j.couleur) ? j.couleur : '',
    actif: j.actif !== false,
    ordre: Number.isInteger(j.ordre) && j.ordre >= 0 && j.ordre <= 99 ? j.ordre : null,
  };
}

function reglagesLivre(d) {
  const v = valider(reglagesComptes, d);
  if (!v.ok) return null;
  const r = d.rapprochement;
  const rapprochement = estObjet(r) && valider(date({ requis: true }), r.date).ok && Number.isInteger(r.solde) && Math.abs(r.solde) <= MONTANT_MAX
    ? { date: r.date, solde: r.solde, le: horodatage(r.le), par: idCompte(r.par) } : null;
  const clotures = [...new Set(liste(d.clotures).filter((a) => Number.isInteger(a) && a >= 2000 && a <= 2100))].sort();
  return { ...v.valeur, clotures, rapprochement };
}

// Chaque document de paramètres revalidé ; null s'il est refusé.
const VALIDEURS_PARAMETRES = {
  'structure-identite': (d) => {
    const v = valider(schemaIdentite, sansId(d));
    return v.ok ? v.valeur : null;
  },
  'structure-suivi': (d) => {
    if (!estObjet(d.points)) return null;
    const points = {};
    for (const [cle, p] of Object.entries(d.points).slice(0, 500)) {
      const v = /^[a-z0-9_-]{1,40}\.[a-z0-9_-]{1,60}$/i.test(cle) ? valider(suiviPoint, p) : { ok: false };
      if (v.ok) points[cle] = { ...v.valeur, par: idCompte(p.par), modifieLe: horodatage(p.modifieLe) };
    }
    return { points };
  },
  'structure-comptes': reglagesLivre,
  'structure-comptes-societe': reglagesLivre,
  // shortcut: veille contrôlée sur sa forme seulement (texte jamais interprété en HTML), revalider chaque proposition si elle devient éditable à la main.
  'structure-veille': (d) => (estObjet(d.modifs) && Array.isArray(d.ajouts) && Array.isArray(d.propositions) && (d.couts === undefined || estObjet(d.couts))
    ? { ...sansId(d), couts: d.couts || {} } : null),
};

// Chaque fiche des collections revalidée ; null si elle est refusée. `jeux` : jeux connus après la reprise.
const VALIDEURS_COLLECTIONS = {
  ecritures: (d) => {
    const livre = d.livre === undefined ? 'association' : d.livre;
    if (!/^e-[a-z0-9]{10}$/.test(String(d._id)) || !livreValide(livre)) return null;
    const v = valider(schemaEcriture(livre), d);
    return v.ok ? { _id: d._id, livre, ...v.valeur, creeLe: horodatage(d.creeLe), creePar: idCompte(d.creePar) } : null;
  },
  autorisations: (d, jeux) => {
    if (!MOTIFS.jeu.test(String(d.jeu)) || !jeux.has(d.jeu) || !MOTIFS.membre.test(String(d.membreId)) || d._id !== `${d.jeu}:${d.membreId}`) return null;
    const v = valider(schemaAutorisation, d);
    return v.ok ? { _id: d._id, jeu: d.jeu, membreId: d.membreId, ...v.valeur, modifieLe: horodatage(d.modifieLe), par: idCompte(d.par) } : null;
  },
  annonces: (d, jeux) => {
    if (!MOTIFS.annonce.test(String(d._id))) return null;
    const v = valider(formeAnnonce, d);
    if (!v.ok) return null;
    const vises = [...new Set(v.valeur.jeux)].filter((j) => jeux.has(j));
    if (v.valeur.jeux.length && !vises.length) return null; // elle viserait tous les jeux
    return { _id: d._id, ...v.valeur, jeux: vises, creeLe: horodatage(d.creeLe), par: idCompte(d.par), lus: {} };
  },
};

// Plan de la reprise : ce qui sera créé ou ignoré, sans rien écrire. `resume` part au navigateur (aperçu),
// `actions` reste côté serveur.
export async function preparerReprise(s, sauvegarde) {
  if (!estObjet(sauvegarde) || sauvegarde.format !== FORMAT_STRUCTURE.format || !VERSIONS_LISIBLES.includes(sauvegarde.version)) {
    throw erreurs.requete(`Ce fichier n’est pas une sauvegarde de la structure (${FORMAT_STRUCTURE.format}, version ${VERSIONS_LISIBLES.join(' ou ')}).`);
  }
  const resume = { version: sauvegarde.version, exporteLe: horodatage(sauvegarde.exporteLe), jeux: [], comptes: [], donnees: [], invalides: 0, detailsInvalides: [] };
  const actions = { jeux: [], comptes: [], parametres: [], collections: {} };
  const invalide = (type, id) => {
    resume.invalides += 1;
    if (resume.detailsInvalides.length < 10) resume.detailsInvalides.push(`${type} ${String(id ?? '?').slice(0, 40)}`);
  };

  // Jeux
  const existants = new Set(s.registre.liste().map((d) => d._id));
  const jeux = new Set(existants);
  for (const brut of liste(sauvegarde.jeux)) {
    const j = jeuValide(brut);
    if (!j) {
      invalide('jeu', brut?._id);
      continue;
    }
    const nom = j.nom || MODELES[j.modele].nom;
    let raison = '';
    if (existants.has(j.id)) raison = 'existe déjà : gardé tel quel';
    else if (jeux.has(j.id)) raison = 'en double dans le fichier';
    else if (jeux.size >= MAX_ESPACES) raison = `${MAX_ESPACES} jeux au maximum`;
    resume.jeux.push({ id: j.id, nom, action: raison ? 'ignorer' : 'creer', raison });
    if (raison) continue;
    jeux.add(j.id);
    actions.jeux.push(j);
  }

  // Comptes
  const enBase = await s.global.lister('comptes');
  const ids = new Set(enBase.map((c) => c._id));
  const identifiants = new Set(enBase.map((c) => c.identifiant));
  for (const brut of liste(sauvegarde.comptes)) {
    const c = estObjet(brut) ? brut : {};
    const v = valider(creationCompte, { identifiant: c.identifiant, nomAffiche: c.nomAffiche, admin: c.admin, tresorier: c.tresorier, acces: c.acces });
    if (!v.ok || !idCompte(c._id) || (c.actif !== undefined && typeof c.actif !== 'boolean')) {
      invalide('compte', c.identifiant || c._id);
      continue;
    }
    const { identifiant, nomAffiche, admin, tresorier } = v.valeur;
    let raison = '';
    if (ids.has(c._id) || identifiants.has(identifiant)) raison = 'existe déjà : jamais modifié';
    else if (ids.size >= MAX_COMPTES) raison = `${MAX_COMPTES} comptes au maximum`;
    resume.comptes.push({ identifiant, nomAffiche, admin, action: raison ? 'ignorer' : 'creer', raison });
    if (raison) continue;
    ids.add(c._id);
    identifiants.add(identifiant);
    // Accès aux seuls jeux connus après la reprise ; le membre lié revient avec la restauration du jeu.
    const acces = Object.fromEntries(Object.entries(v.valeur.acces)
      .filter(([jeu]) => jeux.has(jeu))
      .map(([jeu, a]) => [jeu, { metiers: ordonnerMetiers([...new Set(a.metiers)].filter(estMetier)), membreId: a.membreId || '' }])
      .filter(([, a]) => a.metiers.length || a.membreId));
    actions.comptes.push({ _id: c._id, identifiant, nomAffiche, admin, tresorier, acces, actif: c.actif !== false });
  }

  // Paramètres de la structure : un document absent est créé, un présent est gardé.
  const parametres = estObjet(sauvegarde.parametres) ? sauvegarde.parametres : {};
  for (const id of PARAMETRES) {
    if (!estObjet(parametres[id])) continue;
    const valeur = VALIDEURS_PARAMETRES[id](parametres[id]);
    if (!valeur) {
      invalide('paramètres', id);
      continue;
    }
    const present = !!(await s.global.lire('parametres', id));
    resume.donnees.push({ nom: NOMS_PARAMETRES[id], nombre: 1, action: present ? 'ignorer' : 'creer', raison: present ? 'déjà présent : gardé' : '' });
    if (!present) actions.parametres.push({ _id: id, ...valeur });
  }

  // Collections : remises seulement dans une collection vide.
  for (const coll of Object.keys(VALIDEURS_COLLECTIONS)) {
    if (!Array.isArray(sauvegarde[coll])) continue;
    const valides = [];
    const vus = new Set();
    for (const brut of sauvegarde[coll]) {
      const doc = estObjet(brut) && !vus.has(brut._id) ? VALIDEURS_COLLECTIONS[coll](brut, jeux) : null;
      if (!doc) {
        invalide(coll, brut?._id);
        continue;
      }
      vus.add(doc._id);
      valides.push(doc);
    }
    const parLivre = (l) => valides.filter((d) => d.livre === l).length;
    if (coll === 'ecritures' && Math.max(parLivre('association'), parLivre('societe')) > MAX_ECRITURES) throw erreurs.requete(`Sauvegarde refusée : plus de ${MAX_ECRITURES} écritures dans un livre.`);
    if (coll === 'annonces' && valides.length > MAX_ANNONCES) throw erreurs.requete(`Sauvegarde refusée : plus de ${MAX_ANNONCES} annonces.`);
    if (!valides.length) continue;
    const deja = await s.global.compter(coll);
    resume.donnees.push({ nom: NOMS_COLLECTIONS[coll], nombre: valides.length, action: deja ? 'ignorer' : 'creer', raison: deja ? `${deja} déjà dans la base : gardées, rien d’ajouté` : '' });
    if (!deja) actions.collections[coll] = valides;
  }
  return { resume, actions };
}

// Applique le plan. Renvoie les mots de passe temporaires des comptes recréés : à montrer une seule fois.
export async function appliquerReprise(s, { resume, actions }, compte) {
  const bilan = { jeux: 0, comptes: 0, donnees: 0, echecs: [] };
  for (const j of actions.jeux) {
    try {
      await s.registre.creer({ modele: j.modele, id: j.id, nom: j.nom, court: j.court, compte });
      await s.registre.modifier(j.id, { actif: j.actif, ...(j.couleur && { couleur: j.couleur }), ...(j.ordre !== null && { ordre: j.ordre }) });
      bilan.jeux += 1;
    } catch (err) {
      bilan.echecs.push(`jeu ${j.id} : ${String(err?.message || err).slice(0, 120)}`);
    }
  }
  const motsDePasse = [];
  const quand = s.maintenant().toISOString();
  // Chaque écriture a son propre essai : une erreur passagère d'Atlas au milieu ne doit pas faire perdre les mots de
  // passe temporaires des comptes déjà recréés (ils ne sont montrés qu'une fois) ; l'échec est rendu dans le bilan.
  const echec = (quoi, err) => bilan.echecs.push(`${quoi} : ${String(err?.message || err).slice(0, 120)}`);
  for (const c of actions.comptes) {
    try {
      const acces = Object.fromEntries(Object.entries(c.acces).filter(([jeu]) => s.registre.obtenir(jeu)));
      const mdpTemporaire = genererMdpTemporaire();
      await s.global.ecrire('comptes', {
        ...c, acces, doitChangerMdp: true, hash: await hacherMdp(mdpTemporaire), creeLe: quand, creePar: compte._id, derniereConnexion: null,
      });
      motsDePasse.push({ identifiant: c.identifiant, nomAffiche: c.nomAffiche, mdpTemporaire });
      bilan.comptes += 1;
    } catch (err) {
      echec(`compte ${c.identifiant}`, err);
    }
  }
  for (const doc of actions.parametres) {
    try {
      await s.global.ecrire('parametres', doc);
      bilan.donnees += 1;
    } catch (err) {
      echec(`paramètres ${doc._id}`, err);
    }
  }
  for (const [coll, docs] of Object.entries(actions.collections)) {
    for (const doc of docs) {
      // L'autorisation d'un jeu dont la création a échoué n'a plus de jeu.
      if (coll === 'autorisations' && !s.registre.obtenir(doc.jeu)) continue;
      try {
        await s.global.ecrire(coll, doc);
        bilan.donnees += 1;
      } catch (err) {
        echec(`${coll} ${doc._id}`, err);
      }
    }
  }
  await s.historique.ecrire(compte, 'reprise après sinistre de la structure', resume.exporteLe,
    `${bilan.jeux} jeux, ${bilan.comptes} comptes, ${bilan.donnees} fiches créés ; ${resume.invalides} refusées`);
  return { bilan, motsDePasse };
}

// Une reprise à la fois : deux en même temps créeraient deux fois les mêmes comptes.
let enCours = false;

export async function reprendre(s, sauvegarde, compte, { apercu = false } = {}) {
  if (enCours) throw erreurs.conflit('Une reprise est déjà en cours : attends qu’elle se termine.');
  enCours = true;
  try {
    const plan = await preparerReprise(s, sauvegarde);
    if (apercu) return { resume: plan.resume };
    return { resume: plan.resume, ...(await appliquerReprise(s, plan, compte)) };
  } finally {
    enCours = false;
  }
}
