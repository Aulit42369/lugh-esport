// Création d'un espace de jeu : profil d'équipe vide, postes à pourvoir, méta initiale du modèle, fiches de maps,
// semaine type pré-remplie. Chaque étape ne s'exécute que si la donnée manque : réactiver un jeu ne touche à rien.

import { nouvelId } from '../../shared/validation.js';
import { validerMeta } from '../../shared/schemas-meta.js';
import { schemasPour } from '../../shared/schemas.js';
import { actifs } from '../../shared/jeux/definition.js';
import { blocsDepuisEbauche, ebauchePourPalier, ebaucheParId } from '../../shared/jeux/contenus.js';

export function metaInitiale(def, modele, maintenant = new Date()) {
  const brut = modele.initiale || {};
  const v = validerMeta(def, brut);
  if (!v.ok) throw new Error(`méta initiale de ${modele.id} invalide : ${v.erreurs.slice(0, 3).map((e) => `${e.chemin} ${e.message}`).join(' ; ')}`);
  const verifie = /^\d{4}-\d{2}-\d{2}/.test(brut.verifieLe || '') ? new Date(brut.verifieLe).toISOString() : maintenant.toISOString();
  return {
    ...v.valeur,
    schema: 2,
    statut: 'ok',
    erreur: null,
    avertissements: v.avertissements,
    derniereVerif: verifie,
    derniereTentative: verifie,
    declencheur: 'initial',
    couts: {},
    dernierEcart: null,
  };
}

// Postes à pourvoir : un titulaire par place (rôles du jeu dans l'ordre), les remplaçants, un head coach, un analyste.
function postes(def) {
  const roles = actifs(def.roles).map((r) => r.id);
  const flex = roles.includes('flex') ? 'flex' : '';
  return [
    ...Array.from({ length: def.equipe.titulaires }, (_, i) => ({ type: 'joueur', statut: 'titulaire', roleJeu: roles.length ? roles[i % roles.length] : '' })),
    ...Array.from({ length: Math.min(def.equipe.remplacants, 3) }, () => ({ type: 'joueur', statut: 'remplacant', roleJeu: flex })),
    { type: 'staff', statut: 'actif', fonction: 'headcoach' },
    { type: 'staff', statut: 'actif', fonction: 'analyste' },
  ];
}

export async function amorcerJeu({ depot, stockage, def, modele, maintenant = () => new Date() }) {
  const { documentParDefaut } = schemasPour(def);

  if (!(await stockage.lire('equipe', 'profil'))) {
    await depot.enregistrer('equipe', 'profil', documentParDefaut('equipe'), null);
  }

  const membres = await stockage.lister('membres');
  if (!membres.some((m) => m.type === 'joueur')) {
    for (const poste of postes(def)) {
      if (poste.type === 'staff' && membres.some((m) => m.fonction === poste.fonction)) continue;
      await depot.enregistrer('membres', nouvelId('m'), documentParDefaut('membres', poste), null);
    }
  }

  let meta = await stockage.lire('meta', 'courante');
  if (!meta) meta = await depot.enregistrer('meta', 'courante', metaInitiale(def, modele, maintenant()), null);

  const fiches = def.aPool ? meta.mapPool : (def.aPersonnages ? ['general'] : []);
  for (const id of fiches) {
    if (!(await stockage.lire('mapsEquipe', id))) await depot.enregistrer('mapsEquipe', id, documentParDefaut('mapsEquipe'), null);
  }

  if (!(await stockage.lire('planning', 'modele'))) {
    const ebauche = ebaucheParId(def, 'progression') ? 'progression' : ebauchePourPalier(def, 3);
    if (ebauche) {
      await depot.enregistrer('planning', 'modele', {
        blocs: blocsDepuisEbauche(def, ebauche),
        note: `Ébauche « ${ebaucheParId(def, ebauche).nom} » chargée à la création : adapte les créneaux à ceux de l’équipe.`,
        ebauche,
      }, null);
    }
  }
}
