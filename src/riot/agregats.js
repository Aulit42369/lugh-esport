// Calculs « Valorant · Stats de l'équipe » : résumé d'une partie pour UN joueur relié (jamais les autres joueurs),
// puis chiffres d'un joueur et de l'équipe. Aucun MMR, aucun adversaire, rien en temps réel.

const FORME = 10; // parties prises en compte pour la forme récente

// Nom lisible depuis le contenu Riot (/val/content/v1/contents), sinon depuis le chemin (« /Game/Maps/Ascent/Ascent »).
export function nomsContenu(contenu) {
  const agents = new Map((contenu?.characters || []).map((c) => [String(c.id).toLowerCase(), c.name]));
  const cartes = new Map((contenu?.maps || []).map((m) => [m.assetPath, m.name]));
  return {
    agent: (id) => agents.get(String(id || '').toLowerCase()) || 'Agent inconnu',
    carte: (chemin) => cartes.get(chemin) || String(chemin || '').split('/').filter(Boolean).pop() || 'Carte inconnue',
  };
}

// Résumé d'une partie pour le joueur puuid : seules ses propres stats et le score des deux équipes sont gardés.
export function resumerPartie(partie, puuid, noms) {
  const info = partie?.matchInfo;
  const moi = (partie?.players || []).find((p) => p.puuid === puuid);
  if (!info || !moi) return null;
  const st = moi.stats || {};
  const equipes = partie.teams || [];
  const nous = equipes.find((t) => t.teamId === moi.teamId);
  const eux = equipes.find((t) => t.teamId !== moi.teamId);
  const manches = Number(st.roundsPlayed) || 0;
  return {
    matchId: info.matchId,
    debut: new Date(Number(info.gameStartMillis) || 0).toISOString(),
    dureeMin: Math.round((Number(info.gameLengthMillis) || 0) / 60000),
    file: info.queueId || 'custom',
    carte: noms.carte(info.mapId),
    agent: noms.agent(moi.characterId),
    k: Number(st.kills) || 0,
    d: Number(st.deaths) || 0,
    a: Number(st.assists) || 0,
    manches,
    // ACS (score de combat moyen) = score de combat / manches jouées.
    acs: manches ? Math.round((Number(st.score) || 0) / manches) : null,
    victoire: nous && eux ? !!nous.won : null,
    scoreNous: nous ? Number(nous.roundsWon) || 0 : null,
    scoreEux: eux ? Number(eux.roundsWon) || 0 : null,
  };
}

const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const kda = (k, d, a) => arrondi((k + a) / Math.max(1, d));
const taux = (v, n) => (n ? Math.round((v / n) * 100) : null);

// Chiffres d'un joueur sur ses parties (les plus récentes d'abord).
export function statsJoueur(parties) {
  const n = parties.length;
  const somme = (cle) => parties.reduce((t, p) => t + (p[cle] || 0), 0);
  const avecAcs = parties.filter((p) => p.acs !== null);
  const decidees = parties.filter((p) => p.victoire !== null);
  const agents = new Map();
  for (const p of parties) agents.set(p.agent, (agents.get(p.agent) || 0) + 1);
  return {
    parties: n,
    kda: n ? kda(somme('k'), somme('d'), somme('a')) : null,
    acs: avecAcs.length ? Math.round(avecAcs.reduce((t, p) => t + p.acs, 0) / avecAcs.length) : null,
    victoires: taux(decidees.filter((p) => p.victoire).length, decidees.length),
    agents: [...agents].map(([nom, nb]) => ({ nom, parties: nb })).sort((a, b) => b.parties - a.parties || a.nom.localeCompare(b.nom)),
    forme: decidees.slice(0, FORME).map((p) => (p.victoire ? 'V' : 'D')),
  };
}

// Tableau « Équipe » : seulement les joueurs reliés (joueurs = [{ nom, parties }]).
// Une même partie jouée ensemble ne compte qu'une fois par carte.
export function statsEquipe(joueurs) {
  const cartes = new Map();
  const vues = new Set();
  for (const j of joueurs) {
    for (const p of j.parties) {
      if (vues.has(p.matchId)) continue;
      vues.add(p.matchId);
      const c = cartes.get(p.carte) || { carte: p.carte, parties: 0, victoires: 0, decidees: 0 };
      c.parties += 1;
      if (p.victoire !== null) {
        c.decidees += 1;
        if (p.victoire) c.victoires += 1;
      }
      cartes.set(p.carte, c);
    }
  }
  return {
    cartes: [...cartes.values()]
      .map(({ carte, parties, victoires, decidees }) => ({ carte, parties, victoires: taux(victoires, decidees) }))
      .sort((a, b) => b.parties - a.parties || a.carte.localeCompare(b.carte)),
    joueurs: joueurs.map((j) => ({ nom: j.nom, nomRiot: j.nomRiot, ...statsJoueur(j.parties) })),
  };
}
