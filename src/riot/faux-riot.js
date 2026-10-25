// Faux serveur Riot (même forme de réponses que l'API) : tests automatiques et mode démo de la simulation
// (captures pour la demande de clé). Jamais branché en production : config.js n'active la démo qu'en simulation.
// C'est une fonction « fetch » : aucune connexion réseau.

import { RIOT } from './client.js';

const CARTES = [
  ['Ascent', '/Game/Maps/Ascent/Ascent'], ['Bind', '/Game/Maps/Duality/Duality'], ['Haven', '/Game/Maps/Triad/Triad'],
  ['Lotus', '/Game/Maps/Jam/Jam'], ['Sunset', '/Game/Maps/Juliett/Juliett'], ['Split', '/Game/Maps/Bonsai/Bonsai'],
  ['Pearl', '/Game/Maps/Pitt/Pitt'],
];
const AGENTS = [
  ['Jett', 'add6443a-41bd-e414-f6ad-e58d267f4e95'], ['Sova', '320b2a48-4d9b-a075-30f1-1f93a9b638fa'],
  ['Omen', '8e253930-4c05-31dd-1b6c-968525494517'], ['Killjoy', '1e58de9c-4950-5125-93e9-a0aee9f98746'],
  ['Raze', 'f94c3b30-42be-e959-889c-5aa313dba261'], ['Skye', '6f2a04ca-43e0-be17-7f36-b3908627744d'],
  ['Viper', '707eab51-4836-f488-046a-cda6bf494859'], ['Breach', '5f8d3a7f-467b-97f3-062c-13acf203c006'],
];
const PARTIES = 16;
const DEPART_MS = Date.UTC(2026, 8, 23, 19, 0); // 23 septembre 2026, une partie tous les deux jours

// Nombre pseudo-aléatoire stable (mêmes données à chaque lancement).
function graine(texte) {
  let x = 2166136261;
  for (const ch of texte) x = Math.imul(x ^ ch.charCodeAt(0), 16777619) >>> 0;
  return x;
}
const tirer = (texte, max) => graine(texte) % max;

export function creerFauxRiot() {
  const jetons = new Map(); // jeton d'accès → code d'origine
  const comptes = new Map(); // code → compte Riot
  const appels = [];
  let n = 0;

  const json = (statut, corps, entetes = {}) => new Response(corps === null ? null : JSON.stringify(corps), {
    status: statut, headers: { 'Content-Type': 'application/json', ...entetes },
  });

  function compteDuCode(code) {
    if (!comptes.has(code)) {
      const nom = String(code).replace(/^demo-/, '') || 'joueur';
      comptes.set(code, f.comptes[code] || { puuid: `puuid-${nom}`, gameName: nom, tagLine: 'LUGH' });
    }
    return comptes.get(code);
  }
  const joue = (puuid, i) => (graine(puuid) + i) % 4 !== 0;

  function partie(i) {
    const relies = [...comptes.values()].map((c) => c.puuid).filter((p) => joue(p, i));
    const joueurs = [];
    const ajouter = (puuid, teamId, k) => {
      const manches = 22;
      joueurs.push({
        puuid, gameName: puuid.replace(/^puuid-/, ''), tagLine: 'LUGH', teamId,
        characterId: AGENTS[tirer(`${puuid}${i}${k}`, AGENTS.length)][1],
        stats: { score: 3000 + tirer(`s${puuid}${i}`, 4500), roundsPlayed: manches, kills: 8 + tirer(`k${puuid}${i}`, 18), deaths: 9 + tirer(`d${puuid}${i}`, 12), assists: 2 + tirer(`a${puuid}${i}`, 9) },
      });
    };
    relies.slice(0, 5).forEach((p, k) => ajouter(p, 'Blue', k));
    for (let k = joueurs.length; k < 5; k += 1) ajouter(`puuid-equipier-${i}-${k}`, 'Blue', k);
    for (let k = 0; k < 5; k += 1) ajouter(`puuid-adversaire-${i}-${k}`, 'Red', k);
    const gagne = tirer(`v${i}`, 100) < 58;
    const perdant = 5 + tirer(`p${i}`, 7);
    return {
      matchInfo: {
        matchId: `demo-partie-${i}`, mapId: CARTES[tirer(`c${i}`, CARTES.length)][1], gameStartMillis: DEPART_MS + i * 2 * 86_400_000,
        gameLengthMillis: (32 + tirer(`l${i}`, 14)) * 60_000, queueId: i % 5 === 0 ? 'custom' : 'competitive', isRanked: i % 5 !== 0,
      },
      players: joueurs,
      teams: [
        { teamId: 'Blue', won: gagne, roundsPlayed: 13 + perdant, roundsWon: gagne ? 13 : perdant },
        { teamId: 'Red', won: !gagne, roundsPlayed: 13 + perdant, roundsWon: gagne ? perdant : 13 },
      ],
    };
  }

  async function f(url, init = {}) {
    const u = new URL(url);
    const entetes = init.headers || {};
    appels.push({ url: String(url), methode: init.method || 'GET', entetes, corps: init.body || '' });
    if (f.forcer429 > 0) {
      f.forcer429 -= 1;
      return json(429, { status: { message: 'Rate limit exceeded', status_code: 429 } }, { 'Retry-After': f.retryAfter });
    }
    if (u.origin === RIOT.auth && u.pathname === '/token') {
      if (!String(entetes.Authorization || '').startsWith('Basic ')) return json(401, { error: 'invalid_client' });
      const p = new URLSearchParams(init.body);
      let code;
      if (p.get('grant_type') === 'authorization_code') code = p.get('code');
      else if (p.get('grant_type') === 'refresh_token' && !f.refusRafraichissement) code = String(p.get('refresh_token')).replace(/^rafr-/, '');
      if (!code) return json(400, { error: 'invalid_grant' });
      n += 1;
      const acces = `acces-${code}-${n}`;
      jetons.set(acces, code);
      return json(200, { access_token: acces, refresh_token: `rafr-${code}`, id_token: 'id', token_type: 'Bearer', expires_in: f.dureeJeton, scope: 'openid offline_access' });
    }
    if (u.origin === RIOT.auth && u.pathname === '/token/revoke') {
      f.revocations.push(new URLSearchParams(init.body).get('token'));
      return json(200, {});
    }
    if (u.origin === RIOT.compte && u.pathname === '/riot/account/v1/accounts/me') {
      const code = jetons.get(String(entetes.Authorization || '').replace(/^Bearer /, ''));
      return code ? json(200, compteDuCode(code)) : json(401, { status: { message: 'Unauthorized' } });
    }
    if (u.origin !== RIOT.val) return json(404, null);
    if (!entetes['X-Riot-Token']) return json(401, { status: { message: 'Unauthorized' } });
    if (u.pathname === '/val/content/v1/contents') {
      return json(200, {
        version: 'demo', characters: AGENTS.map(([name, id]) => ({ name, id: id.toUpperCase() })),
        maps: CARTES.map(([name, assetPath]) => ({ name, assetPath })),
      });
    }
    const liste = u.pathname.match(/^\/val\/match\/v1\/matchlists\/by-puuid\/(.+)$/);
    if (liste) {
      const puuid = decodeURIComponent(liste[1]);
      const history = Array.from({ length: PARTIES }, (_, i) => i).filter((i) => joue(puuid, i))
        .map((i) => ({ matchId: `demo-partie-${i}`, gameStartTimeMillis: DEPART_MS + i * 2 * 86_400_000, queueId: 'competitive' }));
      return json(200, { puuid, history });
    }
    const m = u.pathname.match(/^\/val\/match\/v1\/matches\/demo-partie-(\d+)$/);
    if (m && Number(m[1]) < PARTIES) return json(200, partie(Number(m[1])));
    return json(404, null);
  }
  f.appels = appels;
  f.comptes = {}; // code → compte Riot imposé (tests)
  f.revocations = [];
  f.forcer429 = 0;
  f.retryAfter = '1';
  f.refusRafraichissement = false;
  f.dureeJeton = 3600;
  return f;
}
