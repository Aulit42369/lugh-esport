// Assistant de veto (jeux à veto de maps) : propose un ordre de bans et de picks en croisant notre pool et les
// habitudes adverses. Fonction pure : le résultat est une suggestion, le staff garde la décision.

const POIDS_STATUT = { pick: 3, confort: 2, travail: 1, ban: 0 };

export function notreScore(fiche) {
  if (!fiche) return 1;
  return (POIDS_STATUT[fiche.statut] ?? 1) + (fiche.preparation || 0) / 100;
}

export function leurScore(map, adv) {
  if (adv?.fortes?.includes(map)) return 2;
  if (adv?.faibles?.includes(map)) return -2;
  if (adv?.bans?.includes(map)) return -1;
  return 0;
}

function meilleur(liste, note) {
  return [...liste].sort((a, b) => note(b) - note(a))[0];
}

// formats : formats du jeu avec leurs étapes ; pool : identifiants des maps ; notre : { map: { statut, preparation } } ;
// adv : fiche adversaire (fortes, faibles, bans).
export function proposerVeto({ formats = [], format = 'bo3', nousCommencons = true, pool = [], notre = {}, adv = {}, nomMap = (id) => id }) {
  const def = formats.find((f) => f.id === format) || formats[1] || formats[0];
  if (!def?.etapes?.length) return [];
  let restantes = [...pool];
  const etapes = [];
  const prep = (m) => `${notre[m]?.preparation ?? 0} %`;

  def.etapes.forEach(([lettre, action], i) => {
    if (!restantes.length) return;
    const qui = lettre === null ? null : ((lettre === 'A') === nousCommencons ? 'nous' : 'eux');
    let map;
    let raison;
    if (action === 'decisive') {
      [map] = restantes;
      raison = restantes.length === 1 ? 'map restante' : 'map décisive';
    } else if (qui === 'nous' && action === 'ban') {
      // Les maps marquées « Ban » par l'équipe passent en premier, puis le point fort adverse ou notre map la moins prête.
      const nosBans = restantes.filter((m) => notre[m]?.statut === 'ban');
      map = nosBans.length
        ? meilleur(nosBans, (m) => -(notre[m]?.preparation || 0))
        : meilleur(restantes, (m) => leurScore(m, adv) - notreScore(notre[m]) * 1.5);
      if (notre[map]?.statut === 'ban') raison = `notre ban prioritaire (${prep(map)})`;
      else if (adv?.fortes?.includes(map)) raison = 'map forte de l’adversaire';
      else raison = `notre map la moins prête (${prep(map)})`;
    } else if (qui === 'nous' && action === 'pick') {
      map = meilleur(restantes, (m) => notreScore(notre[m]) - leurScore(m, adv) * 0.5);
      raison = adv?.faibles?.includes(map)
        ? `notre map (${prep(map)}) et point faible adverse`
        : `notre meilleure map disponible (${prep(map)})`;
    } else if (qui === 'eux' && action === 'ban') {
      const habituel = (adv?.bans || []).find((m) => restantes.includes(m));
      map = habituel || meilleur(restantes, (m) => -leurScore(m, adv) + notreScore(notre[m]) * 0.5);
      raison = habituel ? 'ban habituel de l’adversaire' : 'probable : leur map la plus faible ou notre point fort';
    } else {
      const forte = (adv?.fortes || []).find((m) => restantes.includes(m));
      map = forte || meilleur(restantes, (m) => leurScore(m, adv) - notreScore(notre[m]));
      raison = forte ? 'probable : leur map forte' : 'probable : notre map la plus fragile';
    }
    restantes = restantes.filter((m) => m !== map);
    etapes.push({ numero: i + 1, qui, action, map, nom: nomMap(map), raison });
  });
  return etapes;
}
