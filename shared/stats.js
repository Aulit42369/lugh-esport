// Statistiques de scrims et de matchs, pour les trois types de score : manches (avec mi-temps et camps),
// score simple (buts, parties, maps) et classement (battle royale). Fonctions pures, testées sans navigateur.
// En manches, les prolongations sont comptées avec la deuxième mi-temps.

export function taux(part, total) {
  return total ? Math.round((part / total) * 100) : null;
}

export const estClassement = (s) => typeof s?.place === 'number';

// V = victoire, D = défaite, N = nul. En classement : V = top 1, D = moitié basse du lobby, N = entre les deux.
export function resultat(s) {
  if (estClassement(s)) {
    if (s.place === 1) return 'V';
    return s.place > Math.ceil((s.equipes || 20) / 2) ? 'D' : 'N';
  }
  if (s.scoreNous > s.scoreEux) return 'V';
  if (s.scoreNous < s.scoreEux) return 'D';
  return 'N';
}

// Points d'une partie classée : ceux saisis, sinon calculés avec le barème officiel du jeu (place + éliminations).
export function pointsClassement(s, score = null) {
  if (typeof s.points === 'number') return s.points;
  const b = score?.bareme;
  if (!b || !estClassement(s)) return null;
  return (b.places[s.place - 1] || 0) + (s.eliminations || 0) * (b.elimination || 0);
}

function cleTri(s) {
  return `${s.date || ''}T${s.heure || '00:00'}`;
}

export function trierParDate(scrims, sens = 1) {
  return [...scrims].sort((a, b) => sens * cleTri(a).localeCompare(cleTri(b)));
}

// Manches gagnées et perdues dans chaque camp, si le score de mi-temps et le camp de départ sont connus.
export function manchesParCamp(s, camps = []) {
  if (camps.length !== 2 || !s.campDepart) return null;
  if (s.mtNous === null || s.mtNous === undefined || s.mtEux === null || s.mtEux === undefined) return null;
  const premiere = { gagnes: s.mtNous, perdus: s.mtEux };
  const seconde = { gagnes: s.scoreNous - s.mtNous, perdus: s.scoreEux - s.mtEux };
  const autre = camps.find((c) => c !== s.campDepart);
  return { [s.campDepart]: premiere, [autre]: seconde };
}

const moyenne = (v) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

export function statsScrims(scrims, def = null) {
  const tries = trierParDate(scrims);
  const camps = (def?.camps || []).map((c) => c.id);
  const bilan = { victoires: 0, defaites: 0, nuls: 0 };
  const parMap = {};
  const cotes = Object.fromEntries(camps.map((c) => [c, { gagnes: 0, perdus: 0 }]));
  const pistols = { gagnes: 0, joues: 0 };
  const classement = { places: [], eliminations: [], points: [], top1: 0 };
  let roundsPour = 0;
  let roundsContre = 0;

  for (const s of tries) {
    const r = resultat(s);
    if (r === 'V') bilan.victoires += 1;
    else if (r === 'D') bilan.defaites += 1;
    else bilan.nuls += 1;

    const cle = s.map || '';
    const pm = parMap[cle] || (parMap[cle] = { map: cle, joues: 0, victoires: 0, defaites: 0, roundsPour: 0, roundsContre: 0, places: [] });
    pm.joues += 1;
    if (r === 'V') pm.victoires += 1;
    if (r === 'D') pm.defaites += 1;

    if (estClassement(s)) {
      classement.places.push(s.place);
      pm.places.push(s.place);
      if (s.place === 1) classement.top1 += 1;
      if (typeof s.eliminations === 'number') classement.eliminations.push(s.eliminations);
      const p = pointsClassement(s, def?.score);
      if (typeof p === 'number') classement.points.push(p);
      continue;
    }
    pm.roundsPour += s.scoreNous;
    pm.roundsContre += s.scoreEux;
    roundsPour += s.scoreNous;
    roundsContre += s.scoreEux;

    const mc = manchesParCamp(s, camps);
    if (mc) {
      for (const c of camps) {
        cotes[c].gagnes += mc[c].gagnes;
        cotes[c].perdus += mc[c].perdus;
      }
    }
    for (const p of Object.values(s.pistols || {})) {
      pistols.joues += 1;
      if (p === 'gagne') pistols.gagnes += 1;
    }
  }

  for (const pm of Object.values(parMap)) {
    pm.winrate = taux(pm.victoires, pm.joues);
    pm.placeMoyenne = moyenne(pm.places);
  }
  for (const c of camps) cotes[c].taux = taux(cotes[c].gagnes, cotes[c].gagnes + cotes[c].perdus);

  const tendance = tries.slice(-10).map(resultat);
  let serie = null;
  for (let i = tries.length - 1; i >= 0; i -= 1) {
    const r = resultat(tries[i]);
    if (!serie) serie = { type: r, longueur: 1 };
    else if (serie.type === r) serie.longueur += 1;
    else break;
  }

  return {
    total: tries.length,
    ...bilan,
    winrate: taux(bilan.victoires, tries.length),
    roundsPour,
    roundsContre,
    parMap,
    cotes,
    pistols: { ...pistols, taux: taux(pistols.gagnes, pistols.joues) },
    classement: {
      parties: classement.places.length,
      top1: classement.top1,
      placeMoyenne: moyenne(classement.places),
      eliminationsMoyennes: moyenne(classement.eliminations),
      pointsMoyens: moyenne(classement.points),
      pointsTotal: classement.points.reduce((a, b) => a + b, 0),
    },
    tendance,
    serie,
  };
}

// Score lisible d'un résultat : « 13–9 », « 2–1 » ou « 3e / 20 · 7 élim. ».
export function scoreLisible(s) {
  if (estClassement(s)) return `${s.place}${s.place === 1 ? 're' : 'e'} / ${s.equipes || 20}${typeof s.eliminations === 'number' ? ` · ${s.eliminations} élim.` : ''}`;
  return `${s.scoreNous}–${s.scoreEux}`;
}
