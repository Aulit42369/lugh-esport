// Blocage après des échecs de connexion répétés, par identifiant et par adresse IP.
// En mémoire : un redémarrage remet les compteurs à zéro (acceptable, documenté dans PIEGES.md).

export function creerLimiteurConnexion({
  seuils = { id: 5, ip: 20 },
  fenetreMs = 15 * 60_000,
  blocageMs = 15 * 60_000,
  maintenant = () => Date.now(),
} = {}) {
  const etats = new Map();

  function seuil(cle) {
    return cle.startsWith('ip:') ? seuils.ip : seuils.id;
  }

  const nettoyage = setInterval(() => {
    const t = maintenant();
    for (const [cle, e] of etats) {
      if (t - e.debut > fenetreMs && (!e.jusqua || e.jusqua < t)) etats.delete(cle);
    }
  }, fenetreMs);
  nettoyage.unref?.();

  return {
    // Millisecondes d'attente restantes (0 si aucune clé n'est bloquée).
    attente(cles) {
      const t = maintenant();
      let max = 0;
      for (const cle of cles) {
        const e = etats.get(cle);
        if (e?.jusqua && e.jusqua > t) max = Math.max(max, e.jusqua - t);
      }
      return max;
    },
    echec(cles) {
      const t = maintenant();
      for (const cle of cles) {
        let e = etats.get(cle);
        if (!e || t - e.debut > fenetreMs) {
          e = { debut: t, n: 0, jusqua: 0 };
          etats.set(cle, e);
        }
        e.n += 1;
        if (e.n >= seuil(cle)) e.jusqua = t + blocageMs;
      }
    },
    reussite(cles) {
      for (const cle of cles) etats.delete(cle);
    },
    arreter() {
      clearInterval(nettoyage);
    },
  };
}
