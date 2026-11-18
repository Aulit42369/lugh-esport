// Écart entre la liste officielle des agents et des cartes (valorant-api.com) et celles de la méta de l'équipe.
// Fonction pure, testée sans réseau. Ne modifie rien : elle ne sert qu'à prévenir.

const cle = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function ecart(officiel, connus) {
  const off = new Set(officiel.map(cle));
  const tous = new Set(connus.flatMap((x) => [cle(x.id), cle(x.nom)]));
  return {
    manquants: officiel.filter((n) => !tous.has(cle(n))),
    enTrop: connus.filter((x) => !off.has(cle(x.id)) && !off.has(cle(x.nom))).map((x) => x.nom || x.id),
  };
}

// officiel : { agents: ['Jett', …], cartes: ['Ascent', …] } ; meta : { personnages, maps } de la méta courante.
export function ecartListesOfficielles(officiel, meta) {
  const agents = ecart(officiel.agents, meta?.personnages || []);
  const cartes = ecart(officiel.cartes, meta?.maps || []);
  return { agents, cartes, vide: !agents.manquants.length && !agents.enTrop.length && !cartes.manquants.length && !cartes.enTrop.length };
}
