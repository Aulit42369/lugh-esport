// Outils de validation communs au serveur et au navigateur.
// Chaque validateur reçoit (valeur, chemin, erreurs) et renvoie la valeur normalisée.
// Les champs inconnus sont ignorés : seule la forme déclarée est conservée.

const CARACTERES_CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function signaler(erreurs, chemin, message) {
  erreurs.push({ chemin: chemin || '(racine)', message });
}

export function texte({ max = 200, requis = false, multi = false, motif = null, message = null } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null) val = '';
    if (typeof val !== 'string') {
      signaler(erreurs, chemin, 'doit être un texte');
      return '';
    }
    let t = val.replace(CARACTERES_CONTROLE, '');
    t = multi ? t.replace(/\r\n?/g, '\n').trim() : t.replace(/\s+/g, ' ').trim();
    if (requis && !t) {
      signaler(erreurs, chemin, 'obligatoire');
      return t;
    }
    if (t.length > max) {
      signaler(erreurs, chemin, `${max} caractères maximum`);
      return t.slice(0, max);
    }
    if (t && motif && !motif.test(t)) signaler(erreurs, chemin, message || 'format invalide');
    return t;
  };
}

// Un nombre écrit en texte doit l'être en clair : pas d'espaces seuls, pas de 0x10 ni de 1e1.
const TEXTE_ENTIER = /^-?\d{1,15}$/;
const TEXTE_DECIMAL = /^-?\d{1,15}(?:[.,]\d{1,10})?$/;

export function entier({ min = 0, max = 1_000_000, requis = false, defaut = null } = {}) {
  return (val, chemin, erreurs) => {
    if (typeof val === 'string') val = val.trim();
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return defaut;
    }
    const n = typeof val === 'string' ? (TEXTE_ENTIER.test(val) ? Number(val) : NaN) : val;
    if (typeof n !== 'number' || !Number.isInteger(n)) {
      signaler(erreurs, chemin, 'doit être un nombre entier');
      return defaut;
    }
    if (n < min || n > max) {
      signaler(erreurs, chemin, `entre ${min} et ${max}`);
      return Math.min(max, Math.max(min, n));
    }
    return n;
  };
}

// Nombre décimal arrondi (ex. K/D 1,24 ; HS 21,5 %). Accepte la virgule française dans un texte.
export function decimal({ min = 0, max = 1_000_000, decimales = 2, requis = false, defaut = null } = {}) {
  return (val, chemin, erreurs) => {
    if (typeof val === 'string') val = val.trim();
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return defaut;
    }
    const n = typeof val === 'string' ? (TEXTE_DECIMAL.test(val) ? Number(val.replace(',', '.')) : NaN) : val;
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      signaler(erreurs, chemin, 'doit être un nombre');
      return defaut;
    }
    if (n < min || n > max) {
      signaler(erreurs, chemin, `entre ${min} et ${max}`);
      return Math.min(max, Math.max(min, n));
    }
    const f = 10 ** decimales;
    return Math.round(n * f) / f;
  };
}

export function booleen({ defaut = false } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null) return defaut;
    if (typeof val !== 'boolean') {
      signaler(erreurs, chemin, 'doit être vrai ou faux');
      return defaut;
    }
    return val;
  };
}

// Valeur parmi une liste d'identifiants ; '' accepté quand le champ n'est pas obligatoire.
export function choix(ids, { requis = false, defaut = '' } = {}) {
  const permis = new Set(ids);
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return defaut;
    }
    if (typeof val !== 'string' || !permis.has(val)) {
      signaler(erreurs, chemin, 'valeur non reconnue');
      return defaut;
    }
    return val;
  };
}

// Identifiant au format imposé ; '' accepté quand le champ n'est pas obligatoire.
export function identifiant(motif, { requis = false } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return '';
    }
    if (typeof val !== 'string' || !motif.test(val)) {
      signaler(erreurs, chemin, 'identifiant invalide');
      return '';
    }
    return val;
  };
}

// Lien web : https uniquement (aucun javascript:, data:, http:).
export function lien({ requis = false, max = 500 } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return '';
    }
    if (typeof val !== 'string' || val.length > max) {
      signaler(erreurs, chemin, 'lien invalide');
      return '';
    }
    let url;
    try {
      url = new URL(val.trim());
    } catch {
      signaler(erreurs, chemin, 'lien invalide');
      return '';
    }
    if (url.protocol !== 'https:') {
      signaler(erreurs, chemin, 'le lien doit commencer par https://');
      return '';
    }
    return url.href;
  };
}

// Date civile AAAA-MM-JJ.
export function date({ requis = false } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return '';
    }
    const m = typeof val === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (!m) {
      signaler(erreurs, chemin, 'date attendue au format AAAA-MM-JJ');
      return '';
    }
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
      signaler(erreurs, chemin, "cette date n'existe pas");
      return '';
    }
    return val;
  };
}

// Heure HH:MM (00:00 à 24:00).
export function heure({ requis = false } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null || val === '') {
      if (requis) signaler(erreurs, chemin, 'obligatoire');
      return '';
    }
    const m = typeof val === 'string' && /^(\d{2}):(\d{2})$/.exec(val);
    if (!m || +m[1] > 24 || +m[2] > 59 || (+m[1] === 24 && +m[2] !== 0)) {
      signaler(erreurs, chemin, 'heure attendue au format HH:MM');
      return '';
    }
    return val;
  };
}

export function tableau(element, { max = 50, min = 0 } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null) val = [];
    if (!Array.isArray(val)) {
      signaler(erreurs, chemin, 'doit être une liste');
      return [];
    }
    if (val.length > max) signaler(erreurs, chemin, `${max} éléments maximum`);
    if (val.length < min) signaler(erreurs, chemin, `${min} éléments minimum`);
    return val.slice(0, max).map((e, i) => element(e, `${chemin}[${i}]`, erreurs));
  };
}

export function objet(forme) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null) val = {};
    if (typeof val !== 'object' || Array.isArray(val)) {
      signaler(erreurs, chemin, 'doit être un objet');
      val = {};
    }
    const sortie = {};
    for (const [cle, valideur] of Object.entries(forme)) {
      sortie[cle] = valideur(val[cle], chemin ? `${chemin}.${cle}` : cle, erreurs);
    }
    return sortie;
  };
}

// Objet à clés libres (ex. membreId → texte) : clés filtrées par motif, nombre limité.
export function dictionnaire(motifCle, valeur, { max = 50 } = {}) {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null) return {};
    if (typeof val !== 'object' || Array.isArray(val)) {
      signaler(erreurs, chemin, 'doit être un objet');
      return {};
    }
    const sortie = {};
    const cles = Object.keys(val);
    if (cles.length > max) signaler(erreurs, chemin, `${max} entrées maximum`);
    for (const cle of cles.slice(0, max)) {
      if (!motifCle.test(cle)) {
        signaler(erreurs, `${chemin}.${cle}`, 'clé non reconnue');
        continue;
      }
      sortie[cle] = valeur(val[cle], `${chemin}.${cle}`, erreurs);
    }
    return sortie;
  };
}

// Valeur facultative : null (ou absente) reste null, sinon validée normalement.
export function ouNul(validateur) {
  return (val, chemin, erreurs) => (val === null || val === undefined ? null : validateur(val, chemin, erreurs));
}

// Ajoute un contrôle entre champs après la validation de la forme.
export function avecControle(validateur, controle) {
  return (val, chemin, erreurs) => {
    const v = validateur(val, chemin, erreurs);
    controle(v, (message) => erreurs.push({ chemin: chemin || '(racine)', message }));
    return v;
  };
}

// Chaîne Twitch : accepte « pseudo », « twitch.tv/pseudo » ou l'adresse complète ; garde seulement le nom de chaîne.
const MOTIF_TWITCH = /^[a-zA-Z0-9_]{4,25}$/;
export function chaineTwitch() {
  return (val, chemin, erreurs) => {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val !== 'string') {
      signaler(erreurs, chemin, 'doit être un texte');
      return '';
    }
    const t = val.trim().replace(/^https?:\/\//i, '').replace(/^(www\.|m\.)?twitch\.tv\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '');
    if (!t) return '';
    if (!MOTIF_TWITCH.test(t)) {
      signaler(erreurs, chemin, 'nom de chaîne Twitch invalide (4 à 25 lettres, chiffres ou _)');
      return '';
    }
    return t.toLowerCase();
  };
}

export function lienTwitch(chaine) {
  return MOTIF_TWITCH.test(String(chaine || '')) ? `https://www.twitch.tv/${chaine}` : null;
}

export function valider(schema, donnees) {
  const erreurs = [];
  const valeur = schema(donnees, '', erreurs);
  return erreurs.length ? { ok: false, erreurs, valeur } : { ok: true, valeur };
}

// Formats d'identifiants partagés.
export const MOTIFS = {
  slug: /^[a-z0-9]{2,20}$/,
  compte: /^c-[a-z0-9]{10}$/,
  membre: /^m-[a-z0-9]{10}$/,
  strat: /^s-[a-z0-9]{10}$/,
  scrim: /^x-[a-z0-9]{10}$/,
  vod: /^v-[a-z0-9]{10}$/,
  note: /^n-[a-z0-9]{10}$/,
  bloc: /^b-[a-z0-9]{10}$/,
  objectifPerso: /^p-[a-z0-9]{10}$/,
  objectif: /^[a-z]{3,6}-[1-6]-[1-9]$/,
  suggestion: /^g-[a-z0-9-]{3,80}$/,
  absence: /^a-[a-z0-9]{10}$/,
  adversaire: /^d-[a-z0-9]{10}$/,
  biblio: /^l-[a-z0-9]{10}$/,
  candidat: /^k-[a-z0-9]{10}$/,
  vote: /^k-[a-z0-9]{10}_c-[a-z0-9]{10}$/,
  presence: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])_b-[a-z0-9]{10}$/,
  seance: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])_b-[a-z0-9]{10}$/,
  tournoi: /^t-[a-z0-9]{10}$/,
  partenaire: /^e-[a-z0-9]{10}$/,
  annonce: /^an-[a-z0-9]{10}$/,
  mesure: /^m-[a-z0-9]{10}_\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/,
  semaine: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/,
  identifiantConnexion: /^[a-z0-9._-]{3,24}$/,
  jeu: /^[a-z0-9]{2,20}$/,
  ebauche: /^[a-z0-9-]{2,30}$/,
};

const ALPHABET_ID = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function nouvelId(prefixe) {
  const octets = new Uint8Array(10);
  globalThis.crypto.getRandomValues(octets);
  let id = '';
  for (const o of octets) id += ALPHABET_ID[o % 36];
  return `${prefixe}-${id}`;
}
