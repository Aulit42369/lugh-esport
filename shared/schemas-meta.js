// Méta d'un jeu (réponse de l'actualisation, import manuel ou méta initiale du modèle) : forme et garde-fous.
// Même structure pour tous les jeux ; les maps et les personnages sont vides quand le jeu n'en a pas.

import { texte, entier, booleen, identifiant, lien, date, tableau, objet, dictionnaire, ouNul, valider, choix, MOTIFS } from './validation.js';
import { idsDe } from './jeux/definition.js';

const slug = (o) => identifiant(MOTIFS.slug, o);

function forme(def) {
  return objet({
    saison: texte({ max: 60, requis: true }),
    patch: texte({ max: 30, requis: true }),
    patchDate: date({ requis: true }),
    mapPool: tableau(slug({ requis: true }), { min: def.aPool ? 1 : 0, max: 15 }),
    maps: tableau(objet({
      id: slug({ requis: true }),
      nom: texte({ max: 30, requis: true }),
      enPool: booleen(),
      mode: texte({ max: 20 }),
      entreePatch: texte({ max: 30 }),
      sortiePatch: texte({ max: 30 }),
      noteMeta: texte({ max: 200 }),
    }), { max: 40 }),
    personnages: tableau(objet({
      id: slug({ requis: true }),
      nom: texte({ max: 30, requis: true }),
      role: choix(idsDe(def.roles)),
      camp: choix(idsDe(def.camps)),
      annee: entier({ min: 1990, max: 2100, defaut: null }),
      dernierChangement: ouNul(objet({
        patch: texte({ max: 30, requis: true }),
        type: choix(['buff', 'nerf', 'ajustement'], { requis: true }),
        resume: texte({ max: 200, requis: true }),
      })),
    }), { max: 250 }),
    compsPro: dictionnaire(MOTIFS.slug, tableau(objet({
      personnages: tableau(slug({ requis: true }), { min: 1, max: 12 }),
      usage: texte({ max: 160 }),
      evenement: texte({ max: 80 }),
      source: lien(),
    }), { max: 3 }), { max: 16 }),
    tendances: tableau(texte({ max: 220, requis: true }), { max: 6 }),
    incertitudes: tableau(texte({ max: 300, requis: true }), { max: 12 }),
    circuit: ouNul(objet({
      etape: texte({ max: 80 }),
      dates: texte({ max: 80 }),
      format: texte({ max: 200 }),
      notes: texte({ max: 300 }),
    })),
    sources: tableau(lien({ requis: true }), { max: 30 }),
  });
}

// Un rôle ou un camp inconnu (l'IA s'est trompée de mot) ne fait pas rejeter toute la méta : il est vidé et signalé.
function nettoyerPersonnages(def, brut, avertissements) {
  if (!brut || !Array.isArray(brut.personnages)) return brut;
  const roles = new Set(idsDe(def.roles));
  const camps = new Set(idsDe(def.camps));
  return {
    ...brut,
    personnages: brut.personnages.map((p) => {
      if (!p || typeof p !== 'object') return p;
      const q = { ...p };
      if (q.role && !roles.has(q.role)) {
        avertissements.push(`rôle inconnu ignoré pour ${q.nom || q.id} : ${String(q.role).slice(0, 20)}`);
        q.role = '';
      }
      if (q.camp && !camps.has(q.camp)) q.camp = '';
      return q;
    }),
  };
}

// Valide une méta et la rend cohérente. `avant` sert de garde-fou contre une réponse incomplète ou plus ancienne.
export function validerMeta(def, brut, avant = null) {
  const avertissements = [];
  const r = valider(forme(def), nettoyerPersonnages(def, brut, avertissements));
  const erreurs = [...(r.erreurs || [])];
  const m = r.valeur;

  const idsMaps = new Set();
  for (const carte of m.maps) {
    if (idsMaps.has(carte.id)) erreurs.push({ chemin: 'maps', message: `map en double : ${carte.id}` });
    idsMaps.add(carte.id);
  }
  m.mapPool = [...new Set(m.mapPool)];
  for (const id of m.mapPool) {
    if (!idsMaps.has(id)) erreurs.push({ chemin: 'mapPool', message: `map du pool absente de la liste : ${id}` });
  }
  for (const carte of m.maps) carte.enPool = m.mapPool.includes(carte.id);

  const idsPerso = new Set();
  for (const p of m.personnages) {
    if (idsPerso.has(p.id)) erreurs.push({ chemin: 'personnages', message: `personnage en double : ${p.id}` });
    idsPerso.add(p.id);
  }

  // Compos pro : par map du pool, ou « general » quand le jeu n'a pas de map pool.
  const cles = new Set(m.mapPool.length ? m.mapPool : ['general']);
  const comps = {};
  for (const [cle, liste] of Object.entries(m.compsPro)) {
    if (!cles.has(cle)) continue;
    comps[cle] = liste.filter((c) => {
      const valide = new Set(c.personnages).size === c.personnages.length && c.personnages.every((a) => idsPerso.has(a))
        && c.personnages.length <= def.equipe.titulaires;
      if (!valide) avertissements.push(`compo ignorée (${cle}) : personnages inconnus, en double ou trop nombreux`);
      return valide;
    });
    if (!comps[cle].length) delete comps[cle];
  }
  m.compsPro = comps;

  if (avant) {
    if (avant.patchDate && m.patchDate && m.patchDate < avant.patchDate) {
      erreurs.push({ chemin: 'patchDate', message: `patch du ${m.patchDate} plus ancien que celui enregistré (${avant.patchDate})` });
    }
    if (Array.isArray(avant.personnages) && m.personnages.length < avant.personnages.length - 3) {
      erreurs.push({ chemin: 'personnages', message: 'liste de personnages incomplète par rapport à la version précédente' });
    }
    if (Array.isArray(avant.maps) && m.maps.length < avant.maps.length - 2) {
      erreurs.push({ chemin: 'maps', message: 'liste de maps incomplète par rapport à la version précédente' });
    }
  }
  return erreurs.length ? { ok: false, erreurs, avertissements, valeur: m } : { ok: true, valeur: m, avertissements };
}
