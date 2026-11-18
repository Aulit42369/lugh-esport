// Liste officielle des agents et cartes de Valorant par valorant-api.com (non officiel, sans clé, gratuit).
// Seuls des NOMS sont lus : aucune image n'est reprise (voir PIEGES.md, règles de Riot pour les projets de fans).
const BASE = 'https://valorant-api.com/v1';

async function lire(fetchImpl, chemin) {
  const rep = await fetchImpl(`${BASE}/${chemin}`, { signal: AbortSignal.timeout(10_000) });
  if (!rep.ok) throw new Error(`valorant-api.com a répondu ${rep.status}`);
  const corps = await rep.json();
  if (!Array.isArray(corps?.data)) throw new Error('réponse de valorant-api.com inattendue');
  return corps.data;
}

export async function listesOfficielles(fetchImpl = globalThis.fetch) {
  const [agents, cartes] = await Promise.all([
    lire(fetchImpl, 'agents?isPlayableCharacter=true&language=fr-FR'),
    lire(fetchImpl, 'maps?language=fr-FR'),
  ]);
  const sortie = {
    agents: agents.map((a) => a.displayName).filter(Boolean),
    // Cartes de partie classique seulement (celles qui ont un plan « site A / site B ») : ni Entraînement, ni modes spéciaux.
    cartes: cartes.filter((c) => c.tacticalDescription).map((c) => c.displayName).filter(Boolean),
  };
  // Garde-fou : une réponse vide ou tronquée ne doit jamais faire croire que tous les agents ont disparu.
  if (sortie.agents.length < 10 || sortie.cartes.length < 5) throw new Error('listes de valorant-api.com trop courtes, ignorées');
  return sortie;
}
