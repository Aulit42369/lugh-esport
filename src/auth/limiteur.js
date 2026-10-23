// Blocage après des échecs de connexion répétés, par identifiant et par adresse IP.
// En mémoire : un redémarrage remet les compteurs à zéro (acceptable, documenté dans PIEGES.md).

export function creerLimiteurConnexion({
  seuils = { id: 5, ip: 20 },
  fenetreMs = 15 * 60_000,
  blocageMs = 15 * 60_000,
  maintenant = () => Date.now(),
} = {}) {
  const etats = new Map();
  const files = new Map(); // clé → fin de la dernière tentative en file

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
    // Une tentative à la fois par clé (identifiant, compte) : sans cela, une rafale de requêtes simultanées passait
    // toute entière le contrôle attente() avant que le premier échec ne soit compté (≈ 40 essais au lieu de 5).
    async exclusif(cle, fn) {
      const avant = files.get(cle) || Promise.resolve();
      let fin;
      const ici = new Promise((ok) => { fin = ok; });
      files.set(cle, ici);
      await avant;
      try {
        return await fn();
      } finally {
        fin();
        if (files.get(cle) === ici) files.delete(cle);
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
