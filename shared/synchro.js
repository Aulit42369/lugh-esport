// Fusion d'une réponse de synchronisation (/sync) dans les données locales du navigateur, sans dépendance au
// navigateur (testée sous Node). donnees : { collection: Map(id → fiche) }, modifiées sur place.

// Renvoie vrai si quelque chose a changé. Une suppression n'efface la fiche locale que si elle est plus récente
// qu'elle : une fiche supprimée puis recréée avec le même identifiant entre deux synchronisations reste affichée.
export function fusionnerSynchro(donnees, { docs = {}, suppressions = [] } = {}) {
  let change = false;
  for (const [coll, liste] of Object.entries(docs)) {
    for (const d of liste) {
      const actuel = donnees[coll]?.get(d._id);
      if (!actuel || actuel.rev !== d.rev) {
        donnees[coll]?.set(d._id, d);
        change = true;
      }
    }
  }
  for (const s of suppressions) {
    const actuel = donnees[s.coll]?.get(s.id);
    if (actuel && !(actuel.rev > s.rev)) {
      donnees[s.coll].delete(s.id);
      change = true;
    }
  }
  return change;
}
