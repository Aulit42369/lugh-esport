// Réglages du jeu : ce qu'un Responsable peut personnaliser sans code. Chaque section vaut null tant qu'elle suit
// le modèle. Un élément d'une liste du modèle ne disparaît jamais : il est archivé (masqué, toujours valide).

import {
  texte, entier, decimal, booleen, choix, identifiant, tableau, objet, dictionnaire, ouNul, valider,
} from '../validation.js';
import { MOTIF_ID, TYPES_BLOC_COMMUNS, TYPES_SCORE, completerModele } from './commun.js';

const id = () => identifiant(MOTIF_ID, { requis: true });
const mot = () => texte({ max: 20 });
const archive = () => booleen();

const roles = tableau(objet({
  id: id(), nom: texte({ max: 24, requis: true }), court: texte({ max: 4, motif: /^[A-Z0-9]{2,4}$/, message: '2 à 4 majuscules' }),
  resume: texte({ max: 160 }), exercices: tableau(texte({ max: 200 }), { max: 3 }), archive: archive(),
}), { max: 12 });

const LISTES = {
  roles,
  camps: tableau(objet({ id: id(), nom: texte({ max: 24, requis: true }), archive: archive() }), { max: 2 }),
  typesStrat: tableau(objet({
    id: id(), nom: texte({ max: 40, requis: true }), camps: tableau(id(), { max: 2 }), resume: texte({ max: 160 }), archive: archive(),
  }), { max: 20 }),
  typesBloc: tableau(objet({ id: id(), nom: texte({ max: 40, requis: true }), duree: entier({ min: 0, max: 600, defaut: 60 }), archive: archive() }), { max: 10 }),
  rangs: tableau(objet({ id: id(), nom: texte({ max: 40, requis: true }), archive: archive() }), { max: 60 }),
  chiffres: tableau(objet({
    id: id(), nom: texte({ max: 40, requis: true }), unite: texte({ max: 6 }),
    min: decimal({ min: -100000, max: 100000, decimales: 2, defaut: 0 }), max: decimal({ min: -100000, max: 100000, decimales: 2, defaut: 100 }),
    decimales: entier({ min: 0, max: 2, defaut: 0 }), aide: texte({ max: 160 }), archive: archive(),
    repere: ouNul(objet({ valeur: decimal({ min: -100000, max: 100000, decimales: 2, defaut: 0 }), libelle: texte({ max: 30 }) })),
  }), { max: 8 }),
  checklistMatch: tableau(objet({ id: id(), nom: texte({ max: 80, requis: true }), archive: archive() }), { max: 12 }),
  domaines: tableau(objet({ id: identifiant(/^[a-z]{3,6}$/, { requis: true }), nom: texte({ max: 40, requis: true }), resume: texte({ max: 120 }) }), { max: 6 }),
};

// Le nom du jeu n'en fait pas partie : il vit dans la liste des jeux (collection « espaces »), source unique.
const forme = objet({
  vocabulaire: ouNul(objet({
    personnage: mot(), personnages: mot(), carte: mot(), cartes: mot(), manche: mot(), manches: mot(), astuce: mot(), astuces: mot(),
  })),
  equipe: ouNul(objet({ titulaires: entier({ min: 1, max: 12, defaut: 5 }), remplacants: entier({ min: 0, max: 10, defaut: 2 }) })),
  score: ouNul(objet({
    type: choix(TYPES_SCORE.map((t) => t.id), { requis: true }),
    gagnant: entier({ min: 1, max: 50, defaut: 13 }),
    miTemps: entier({ min: 1, max: 50, defaut: 12 }),
    pistols: booleen(),
    equipes: entier({ min: 2, max: 150, defaut: 20 }),
    bareme: ouNul(objet({ places: tableau(entier({ min: 0, max: 100, requis: true }), { max: 100 }), elimination: decimal({ min: 0, max: 10, decimales: 1, defaut: 1 }) })),
  })),
  listes: objet(Object.fromEntries(Object.entries(LISTES).map(([cle, v]) => [cle, ouNul(v)]))),
  objectifs: dictionnaire(/^[a-z]{3,6}-[1-6]-[1-9]$/, objet({ texte: texte({ max: 120 }), critere: texte({ max: 240 }) }), { max: 200 }),
  routines: dictionnaire(/^[1-6]$/, objet({
    echauffement: tableau(objet({ duree: entier({ min: 0, max: 120, defaut: 10 }), texte: texte({ max: 160, requis: true }) }), { max: 6 }),
    hebdo: tableau(texte({ max: 160, requis: true }), { max: 6 }),
    conseil: texte({ max: 240 }),
  }), { max: 6 }),
  profil: ouNul(objet({
    actif: booleen({ defaut: true }), site: texte({ max: 40 }), modele: texte({ max: 200 }), format: texte({ max: 120 }), aide: texte({ max: 160 }),
  })),
  meta: objet({
    sources: ouNul(tableau(texte({ max: 80, requis: true }), { max: 20 })),
    consigne: texte({ max: 2000, multi: true }),
    auto: booleen({ defaut: true }),
  }),
  // Seuils de la charge d'entraînement (moniteur de santé) : heures planifiées par semaine, jours sans séance.
  charge: ouNul(objet({
    heuresMax: entier({ min: 1, max: 80, defaut: 20 }),
    joursOffMin: entier({ min: 0, max: 7, defaut: 1 }),
  })),
});

// Contrôles qui dépendent du modèle : ses éléments restent présents, les références restent cohérentes.
function controler(modele, v, erreur) {
  const m = completerModele(modele);
  for (const cle of Object.keys(LISTES)) {
    const liste = v.listes[cle];
    if (!liste) continue;
    const ids = liste.map((x) => x.id);
    if (new Set(ids).size !== ids.length) erreur(`${cle} : deux éléments ont le même identifiant`);
    for (const ancien of m[cle]) if (!ids.includes(ancien.id)) erreur(`${cle} : « ${ancien.nom} » vient du modèle ; masque-le au lieu de le supprimer`);
  }
  const l = v.listes;
  if (l.domaines && (l.domaines.length !== m.domaines.length || l.domaines.some((d) => !m.domaines.some((x) => x.id === d.id)))) {
    erreur('domaines : seuls les noms et les résumés se modifient');
  }
  if (l.roles && !l.roles.some((r) => !r.archive)) erreur('roles : au moins un rôle actif');
  if (l.camps && ![0, 2].includes(l.camps.filter((c) => !c.archive).length)) erreur('camps : zéro ou deux camps actifs');
  if (l.typesBloc?.some((t) => TYPES_BLOC_COMMUNS.some((c) => c.id === t.id))) erreur('typesBloc : identifiant déjà pris par un bloc commun');
  const camps = (l.camps || m.camps).map((c) => c.id);
  if (l.typesStrat?.some((t) => t.camps.some((c) => !camps.includes(c)))) erreur('typesStrat : camp inconnu');
  if (l.chiffres?.some((c) => c.min >= c.max)) erreur('chiffres : le minimum doit être inférieur au maximum');
  const objectifs = new Set([...m.objectifs, ...m.collectifs].map((o) => o.id));
  for (const cle of Object.keys(v.objectifs)) if (!objectifs.has(cle)) erreur(`objectifs : ${cle} n'existe pas dans le modèle`);
  if (v.profil?.actif) {
    if (!/^https:\/\/[^\s]*\{id\}[^\s]*$/.test(v.profil.modele)) erreur('profil : adresse en https:// contenant {id}');
    try {
      if (v.profil.format) new RegExp(v.profil.format);
    } catch {
      erreur('profil : format invalide');
    }
    // Un groupe répété qui contient lui-même une répétition ou une alternative, comme (a+)+ ou (a|aa)+, peut figer le navigateur de toute l'équipe : refusé.
    if (v.profil.format && /\([^)]*[+*}|][^)]*\)\s*[+*{]/.test(v.profil.format)) erreur('profil : format trop complexe (quantificateurs imbriqués)');
  }
}

export function validerReglagesJeu(modele, brut) {
  const r = valider(forme, brut);
  const erreurs = [...(r.erreurs || [])];
  controler(modele, r.valeur, (message) => erreurs.push({ chemin: '(réglages)', message }));
  return erreurs.length ? { ok: false, erreurs, valeur: r.valeur } : { ok: true, valeur: r.valeur };
}

export function reglagesVides() {
  return valider(forme, {}).valeur;
}
