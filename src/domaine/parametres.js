// Paramètres de la structure, communs à tous les jeux (base générale, document « structure ») : aujourd'hui,
// l'obligation de double authentification pour l'Administrateur général et les Responsables.

const DEFAUT = { exiger2fa: false };
const DUREE_CACHE_MS = 30_000;

export function creerParametres({ global, maintenant = () => new Date() }) {
  let cache = null;
  let luA = 0;
  return {
    async lire() {
      if (cache && Date.now() - luA < DUREE_CACHE_MS) return cache;
      const doc = await global.lire('parametres', 'structure');
      cache = { exiger2fa: doc ? !!doc.exiger2fa : DEFAUT.exiger2fa };
      luA = Date.now();
      return cache;
    },
    async ecrire(champs, compte) {
      const actuel = await this.lire();
      const suivant = { ...actuel, ...champs };
      await global.ecrire('parametres', { _id: 'structure', ...suivant, majLe: maintenant().toISOString(), majPar: compte?._id || 'systeme' });
      cache = suivant;
      luA = Date.now();
      return cache;
    },
  };
}

// Comptes concernés par l'obligation : l'Administrateur général, le Trésorier et tout Responsable d'au moins un jeu.
export function soumisA2fa(compte) {
  return !!compte?.admin || !!compte?.tresorier || Object.values(compte?.acces || {}).some((a) => a?.metiers?.includes('responsable'));
}
