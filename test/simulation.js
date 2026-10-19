// Serveur de simulation pour les tests : stockage en mémoire (une base globale et une base par jeu), horloge
// pilotable, fausse API Claude, faux Discord, client HTTP avec cookie et en-tête X-Lugh. Jamais de vrais services.

import { createServer, request as requeteHttp } from 'node:http';
import { creerApp } from '../src/app.js';
import { creerFabriqueMemoire } from '../src/stockage/memoire.js';
import { lireConfig } from '../src/config.js';
import { reglerCoutPourTests, hacherMdp } from '../src/auth/mdp.js';
import { amorcer } from '../src/domaine/amorcage.js';
import { nouvelId } from '../shared/validation.js';
import { MODELES } from '../shared/jeux/index.js';

reglerCoutPourTests(1024);

export const silencieux = { log() {}, warn() {}, error() {} };
export const MDP_ADMIN = 'mot-de-passe-de-lugh-1';
export const MDP_ADMIN_NOUVEAU = 'Quartz-Lagune-2026';
export const MDP = 'Mistral-Basalte-77'; // mot de passe des comptes créés par les tests
export const SECRET_CRON = 's'.repeat(32);
export const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABCDEF-123456';
export const DEPART = '2026-10-21T10:00:00.000Z'; // mercredi 21 octobre 2026, semaine 2026-W43

export const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Attend qu'une condition (éventuellement asynchrone) devienne vraie : tâches de fond, notifications.
export async function attendreQue(condition, { delai = 3000, pas = 10, message = 'condition jamais remplie' } = {}) {
  const fin = Date.now() + delai;
  for (;;) {
    if (await condition()) return;
    if (Date.now() > fin) throw new Error(`délai dépassé : ${message}`);
    await pause(pas);
  }
}

// ——— Horloge pilotable (sessions, blocages, visites, créneaux de la méta, limite de débit) ———

export function horloge(depart = DEPART) {
  let t = new Date(depart).getTime();
  const maintenant = () => new Date(t);
  maintenant.regler = (quand) => { t = new Date(quand).getTime(); };
  maintenant.avancer = (ms) => { t += ms; };
  return maintenant;
}

// ——— Fausse API Claude : enregistre chaque appel ; la réponse se règle avec `repondre` ———

export function fauxClaude() {
  const appels = [];
  const f = async (params) => {
    appels.push(params);
    if (!f.repondre) throw new Error('fausse API Claude : aucune réponse prévue');
    return f.repondre(params, appels.length);
  };
  f.appels = appels;
  f.repondre = null;
  return f;
}

export function reponseClaude(meta, { texteAvant = 'Voici la base complète.', usage = { entree: 50_000, sortie: 4_000, recherches: 6 } } = {}) {
  return { texte: `${texteAvant}\n\`\`\`json\n${JSON.stringify(meta)}\n\`\`\``, usage: { ...usage }, stopReason: 'end_turn' };
}

// Méta initiale d'un modèle, à modifier pour simuler une actualisation.
export function metaDe(modele) {
  return structuredClone(MODELES[modele].initiale);
}

// ——— Faux Discord : enregistre chaque message ; `statut` règle la réponse ———

export function fauxDiscord() {
  const envois = [];
  const f = async (url, init) => {
    envois.push({ url, corps: JSON.parse(init.body), methode: init.method });
    return { ok: f.statut < 300, status: f.statut };
  };
  f.envois = envois;
  f.statut = 204;
  return f;
}

// ——— Serveur ———

export async function demarrer({
  env = {}, automatismes = false, maintenant = horloge(), delaiPlanningMs = 40, jeux = [], journal = silencieux,
} = {}) {
  const config = lireConfig({
    LUGH_MODE: 'simulation',
    LUGH_ADMIN_ID: 'chef',
    LUGH_ADMIN_MDP: MDP_ADMIN,
    LUGH_SECRET_CRON: SECRET_CRON,
    ANTHROPIC_API_KEY: 'cle-de-test',
    LUGH_PROXY: '1', // comme sur Render : l'adresse vient de X-Forwarded-For (chaque client de test a la sienne)
    ...env,
  });
  if (config.erreurs.length) throw new Error(`configuration refusée : ${config.erreurs.join(' ; ')}`);
  const fabrique = creerFabriqueMemoire();
  await fabrique.init();
  const claude = fauxClaude();
  const discord = fauxDiscord();
  const app = await creerApp({
    config, fabrique, maintenant, interrogerClaude: claude, fetchDiscord: discord, journal, automatismes, delaiPlanningMs,
  });
  await amorcer({ ...app.services, journal: silencieux });
  const serveur = createServer((req, res) => app.traiter(req, res));
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));

  const sim = {
    base: `http://127.0.0.1:${serveur.address().port}`,
    app,
    config,
    fabrique,
    claude,
    discord,
    maintenant,
    services: app.services,
    global: app.services.global,
    registre: app.services.registre,
    mdpAdmin: null,
    espace: (id) => app.services.registre.obtenir(id),
    // Création directe d'un espace par le registre (comme à l'activation, sans passer par l'API).
    creerJeu: (modele, { id = modele, nom = '', court = '' } = {}) => app.services.registre.creer({ modele, id, nom, court, compte: null }),
    membres: (jeu, filtre = {}) => app.services.registre.obtenir(jeu).stockage.lister('membres', filtre),
    async joueurs(jeu) {
      const liste = await sim.membres(jeu, { type: 'joueur' });
      const ordre = { titulaire: 0, remplacant: 1, essai: 2 };
      return liste.sort((a, b) => (ordre[a.statut] ?? 3) - (ordre[b.statut] ?? 3));
    },
    async arreter() {
      app.arreter();
      serveur.closeAllConnections?.();
      await new Promise((ok) => serveur.close(ok));
    },
  };
  for (const j of jeux) {
    if (typeof j === 'string') await sim.creerJeu(j);
    else await sim.creerJeu(j.modele, j);
  }
  return sim;
}

// ——— Client HTTP : cookie de session, en-tête X-Lugh, une adresse IP par requête (sauf adresse fixée) ———

let compteurIp = 0;
function ipSuivante() {
  compteurIp += 1;
  return `10.${(compteurIp >> 16) & 255}.${(compteurIp >> 8) & 255}.${compteurIp & 255}`;
}

export function client(base, { ip = null } = {}) {
  let cookie = '';
  async function appel(methode, chemin, corps, { entetes = {}, sansQg = false } = {}) {
    const h = { 'X-Forwarded-For': ip || ipSuivante(), ...entetes };
    if (!sansQg) h['X-Lugh'] = '1';
    if (cookie && !Object.keys(entetes).some((k) => k.toLowerCase() === 'cookie')) h.Cookie = cookie;
    if (corps !== undefined && !Object.keys(h).some((k) => k.toLowerCase() === 'content-type')) h['Content-Type'] = 'application/json';
    const rep = await fetch(base + chemin, {
      method: methode,
      headers: h,
      body: corps === undefined ? undefined : (typeof corps === 'string' ? corps : JSON.stringify(corps)),
    });
    const setCookie = rep.headers.get('set-cookie');
    if (setCookie) {
      const premier = setCookie.split(';')[0];
      cookie = premier.endsWith('=') ? '' : premier;
    }
    const texte = await rep.text();
    let json = null;
    try {
      json = JSON.parse(texte);
    } catch {
      json = null;
    }
    return { statut: rep.status, json, texte, entetes: rep.headers, setCookie };
  }
  return {
    appel,
    get: (chemin, options) => appel('GET', chemin, undefined, options),
    post: (chemin, corps, options) => appel('POST', chemin, corps, options),
    put: (chemin, corps, options) => appel('PUT', chemin, corps, options),
    del: (chemin, options) => appel('DELETE', chemin, undefined, options),
    get cookie() {
      return cookie;
    },
    oublier() {
      cookie = '';
    },
  };
}

// Requête brute (sans décompression automatique) : en-têtes et octets tels que le serveur les envoie.
export function requeteBrute(base, chemin, { methode = 'GET', entetes = {} } = {}) {
  return new Promise((ok, ko) => {
    const req = requeteHttp(base + chemin, { method: methode, headers: { 'X-Forwarded-For': ipSuivante(), ...entetes } }, (rep) => {
      const morceaux = [];
      rep.on('data', (m) => morceaux.push(m));
      rep.on('end', () => ok({ statut: rep.statusCode, entetes: rep.headers, corps: Buffer.concat(morceaux) }));
      rep.on('error', ko);
    });
    req.on('error', ko);
    req.end();
  });
}

// ——— Comptes ———

// Accès d'un compte : { valorant: 'joueur' } ou { valorant: ['coach'] } ou { valorant: { metiers, membreId } }.
export function normaliserAcces(acces = {}) {
  return Object.fromEntries(Object.entries(acces).map(([jeu, a]) => {
    if (typeof a === 'string') return [jeu, { metiers: [a], membreId: '' }];
    if (Array.isArray(a)) return [jeu, { metiers: [...a], membreId: '' }];
    return [jeu, { metiers: [...(a.metiers || [])], membreId: a.membreId || '' }];
  }));
}

// Compte écrit directement dans la base globale, prêt à l'emploi (pas de changement de mot de passe obligatoire).
export async function creerCompte(sim, {
  identifiant, mdp = MDP, acces = {}, admin = false, nomAffiche = identifiant, actif = true, doitChangerMdp = false,
}) {
  const compte = {
    _id: nouvelId('c'),
    identifiant,
    nomAffiche,
    admin,
    acces: normaliserAcces(acces),
    actif,
    doitChangerMdp,
    hash: await hacherMdp(mdp),
    creeLe: sim.maintenant().toISOString(),
    creePar: 'test',
    derniereConnexion: null,
  };
  await sim.global.ecrire('comptes', compte);
  return compte;
}

export async function compteGlobal(sim, identifiant) {
  const [c] = await sim.global.lister('comptes', { identifiant });
  return c || null;
}

export async function connecter(sim, identifiant, mdp = MDP, options = {}) {
  const c = client(sim.base, options);
  const r = await c.post('/api/auth/connexion', { identifiant, mdp });
  if (r.statut !== 200) throw new Error(`connexion de ${identifiant} impossible : ${r.statut} ${r.texte}`);
  c.compte = r.json.compte;
  c.id = r.json.compte._id;
  return c;
}

// Connexion avec un mot de passe temporaire, puis changement obligatoire du mot de passe.
export async function connecterEtChanger(sim, identifiant, temporaire, nouveau = MDP) {
  const c = await connecter(sim, identifiant, temporaire);
  const r = await c.post('/api/auth/mdp', { ancien: temporaire, nouveau });
  if (r.statut !== 200) throw new Error(`changement du mot de passe de ${identifiant} impossible : ${r.statut} ${r.texte}`);
  c.compte = r.json.compte;
  return c;
}

// Crée un compte et le connecte.
export async function compteConnecte(sim, options) {
  await creerCompte(sim, options);
  return connecter(sim, options.identifiant, options.mdp || MDP);
}

// L'Administrateur général créé au premier démarrage : première connexion et mot de passe définitif.
export async function adminPret(sim) {
  if (sim.mdpAdmin) return connecter(sim, 'chef', sim.mdpAdmin);
  const c = await connecterEtChanger(sim, 'chef', MDP_ADMIN, MDP_ADMIN_NOUVEAU);
  sim.mdpAdmin = MDP_ADMIN_NOUVEAU;
  return c;
}

// Active un jeu par l'API, comme l'Administrateur général depuis l'écran « Jeux » (201 à la création, 200 à la réactivation).
export async function activerJeu(admin, modele, extra = {}) {
  const r = await admin.post('/api/admin/jeux', { modele, ...extra });
  if (r.statut !== 201 && r.statut !== 200) throw new Error(`activation de ${modele} impossible : ${r.statut} ${r.texte}`);
  return r.json.jeu;
}

// ——— Exemples valides de chaque collection modifiable (jeu Valorant) ———

export function exemplesValorant() {
  const bloc = nouvelId('b');
  return {
    equipe: ['profil', { nom: 'Test', tag: 'TST' }],
    membres: [nouvelId('m'), { type: 'joueur', statut: 'titulaire', pseudo: 'Essai' }],
    mapsEquipe: ['haven', { statut: 'pick', preparation: 50 }],
    strats: [nouvelId('s'), { map: 'haven', camp: 'att', type: 'default', nom: 'Default test' }],
    planning: ['2026-W44', { blocs: [], note: '', ebauche: '' }],
    objectifs: [nouvelId('m'), { palier: 'debutant' }],
    scrims: [nouvelId('x'), { date: '2026-10-15', adversaire: 'Adv', map: 'haven', campDepart: 'att', scoreNous: 13, scoreEux: 8 }],
    vods: [nouvelId('v'), { titre: 'VOD test', lien: 'https://example.com/v' }],
    adversaires: [nouvelId('d'), { nom: 'Adversaire test' }],
    presences: [`2026-W43_${bloc}`, { semaine: '2026-W43', blocId: bloc, jour: 2, debut: '20:00', titre: 'Scrim', statuts: {}, note: '' }],
    bibliotheque: [nouvelId('l'), { type: 'ressource', titre: 'Guide', lien: 'https://example.com/g', categorie: 'guide' }],
    candidats: [nouvelId('k'), { pseudo: 'Candidat' }],
    seances: [`2026-W43_${nouvelId('b')}`, { semaine: '2026-W43', blocId: bloc, jour: 2, debut: '20:00', type: 'scrim', titre: 'Scrim', travaille: 'Retakes B' }],
    tournois: [nouvelId('t'), { nom: 'Coupe de test', statut: 'envisage' }],
    partenaires: [nouvelId('e'), { nom: 'Kraken eSport', tag: 'KRK' }],
  };
}

// Une strat valide pour un jeu donné (la map est obligatoire dans les jeux à map pool).
export function stratPour(jeu, nom = 'Strat de test') {
  const exemples = {
    valorant: { map: 'haven', camp: 'att', type: 'default', nom },
    cs2: { map: 'mirage', camp: 'att', type: 'default', nom },
    lol: { type: 'debut', nom },
    apex: { map: 'stormpoint', type: 'rotation', nom },
    rl: { type: 'kickoff', nom },
  };
  return exemples[jeu];
}
