// Mots de passe : hachage scrypt avec sel, vérification en temps constant, politique, mots de passe temporaires.

import { scrypt as scryptRappel, randomBytes, timingSafeEqual, randomInt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptRappel);
const LONGUEUR = 64;
let cout = { N: 32768, r: 8, p: 1 };

// Réservé aux tests : un coût plus faible pour qu'ils restent rapides.
export function reglerCoutPourTests(N) {
  cout = { N, r: 8, p: 1 };
}

// Un calcul scrypt occupe 32 Mo et un fil du serveur : au plus 2 en même temps, 40 en attente. Au-delà, la requête
// est refusée (429) au lieu de saturer le serveur gratuit (protection contre une rafale de connexions).
const MAX_SIMULTANES = 2;
const FILE_MAX = 40;
let enCours = 0;
const attente = [];

async function prendre() {
  if (enCours < MAX_SIMULTANES) {
    enCours += 1;
    return;
  }
  if (attente.length >= FILE_MAX) throw Object.assign(new Error('Serveur très sollicité'), { sature: true });
  await new Promise((ok) => attente.push(ok));
}

function rendre() {
  const suivant = attente.shift();
  if (suivant) suivant();
  else enCours -= 1;
}

function maxmem({ N, r }) {
  return 256 * N * r;
}

export async function hacherMdp(mdp) {
  const sel = randomBytes(16);
  const { N, r, p } = cout;
  await prendre();
  let empreinte;
  try {
    empreinte = await scrypt(String(mdp).normalize('NFKC'), sel, LONGUEUR, { N, r, p, maxmem: maxmem(cout) });
  } finally {
    rendre();
  }
  return `scrypt$${N}$${r}$${p}$${sel.toString('base64')}$${empreinte.toString('base64')}`;
}

export async function verifierMdp(mdp, stocke) {
  await prendre();
  try {
    const [algo, N, r, p, sel, attendu] = String(stocke).split('$');
    if (algo !== 'scrypt') return false;
    const params = { N: Number(N), r: Number(r), p: Number(p) };
    const reference = Buffer.from(attendu, 'base64');
    const calcule = await scrypt(String(mdp).normalize('NFKC'), Buffer.from(sel, 'base64'), reference.length,
      { ...params, maxmem: maxmem(params) });
    return calcule.length === reference.length && timingSafeEqual(calcule, reference);
  } catch {
    return false;
  } finally {
    rendre();
  }
}

const TROP_SIMPLES = new Set([
  'motdepasse', 'motdepasse1', 'motdepasse123', 'azertyuiop', 'qwertyuiop', '1234567890', '0123456789',
  'valorant123', 'valorant1234', 'password123', 'azerty1234', 'jesuisjoueur', 'soleil1234',
  'lugh2026', 'lughesport', 'lugh12345', 'qgesport123', 'esport12345', 'fortnite123', 'leagueoflegends', 'rocketleague', 'counterstrike',
  'overwatch123', 'apexlegends', 'rainbowsix6', 'motdepasse2026',
]);

// Renvoie un message si le mot de passe est refusé, sinon null.
export function controlerMdp(mdp, identifiant = '') {
  if (typeof mdp !== 'string') return 'Mot de passe invalide.';
  if (mdp.length < 10) return 'Le mot de passe doit faire au moins 10 caractères.';
  if (mdp.length > 128) return 'Le mot de passe doit faire au plus 128 caractères.';
  const bas = mdp.toLowerCase();
  if (identifiant && bas.includes(identifiant.toLowerCase())) return 'Le mot de passe ne doit pas contenir ton identifiant.';
  if (TROP_SIMPLES.has(bas) || /^(.)\1+$/.test(mdp)) return 'Ce mot de passe est trop simple.';
  return null;
}

// Alphabet sans caractères ambigus (0/o, 1/l/i) : facile à dicter à un joueur.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function genererMdpTemporaire() {
  const groupes = [];
  for (let g = 0; g < 3; g += 1) {
    let groupe = '';
    for (let i = 0; i < 4; i += 1) groupe += ALPHABET[randomInt(ALPHABET.length)];
    groupes.push(groupe);
  }
  return groupes.join('-');
}

// Empreinte calculée une fois : compare le temps de réponse d'un identifiant inconnu à celui d'un vrai compte.
let empreinteFactice = null;
export async function empreinteLeurre() {
  if (!empreinteFactice) empreinteFactice = await hacherMdp(randomBytes(12).toString('hex'));
  return empreinteFactice;
}
