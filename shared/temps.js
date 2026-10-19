// Dates civiles et semaines ISO, communes au serveur (fuseau Europe/Paris) et au navigateur (heure locale).
// Les calculs se font sur des dates civiles { a, m, j } pour éviter les pièges de fuseau et d'heure d'été.

const JOUR_MS = 86_400_000;
const formats = new Map();

function format(cle, options) {
  if (!formats.has(cle)) formats.set(cle, new Intl.DateTimeFormat('fr-FR', options));
  return formats.get(cle);
}

function versUtc({ a, m, j }) {
  return Date.UTC(a, m - 1, j);
}

function depuisUtc(ms) {
  const d = new Date(ms);
  return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, j: d.getUTCDate() };
}

// Date civile d'un instant, dans un fuseau donné (ou l'heure locale si absent).
export function dateCivile(instant = new Date(), fuseau) {
  if (!fuseau) return { a: instant.getFullYear(), m: instant.getMonth() + 1, j: instant.getDate() };
  const cle = `civ:${fuseau}`;
  if (!formats.has(cle)) {
    formats.set(cle, new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }));
  }
  const [a, m, j] = formats.get(cle).format(instant).split('-').map(Number);
  return { a, m, j };
}

export function isoCivile({ a, m, j }) {
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

export function civileDepuisIso(iso) {
  const [a, m, j] = String(iso).split('-').map(Number);
  return { a, m, j };
}

export function aujourdhui(fuseau) {
  return isoCivile(dateCivile(new Date(), fuseau));
}

export function ajouterJours(civ, n) {
  return depuisUtc(versUtc(civ) + n * JOUR_MS);
}

// 1 = lundi … 7 = dimanche.
export function jourSemaine(civ) {
  const d = new Date(versUtc(civ)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function semaineIso(civ) {
  const jeudi = ajouterJours(civ, 4 - jourSemaine(civ));
  const debutAnnee = Date.UTC(jeudi.a, 0, 1);
  const n = Math.ceil(((versUtc(jeudi) - debutAnnee) / JOUR_MS + 1) / 7);
  return `${jeudi.a}-W${String(n).padStart(2, '0')}`;
}

export function semaineCourante(fuseau) {
  return semaineIso(dateCivile(new Date(), fuseau));
}

export function lundiDe(semaine) {
  const [a, w] = semaine.split('-W').map(Number);
  const quatreJanvier = { a, m: 1, j: 4 };
  const lundiS1 = ajouterJours(quatreJanvier, 1 - jourSemaine(quatreJanvier));
  return ajouterJours(lundiS1, (w - 1) * 7);
}

export function decalerSemaine(semaine, n) {
  return semaineIso(ajouterJours(lundiDe(semaine), 7 * n));
}

export function joursDe(semaine) {
  const lundi = lundiDe(semaine);
  return [1, 2, 3, 4, 5, 6, 7].map((n) => {
    const civ = ajouterJours(lundi, n - 1);
    return { n, civ, iso: isoCivile(civ) };
  });
}

export function numeroSemaine(semaine) {
  return Number(semaine.split('-W')[1]);
}

// « lun. 19 oct. »
export function formatJour(civ) {
  return format('jour', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(versUtc(civ)));
}

// « 19 oct. 2026 »
export function formatDate(iso) {
  if (!iso) return '';
  return format('date', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(versUtc(civileDepuisIso(iso))));
}

// « 19 oct. » (sans année)
export function formatDateCourte(iso) {
  if (!iso) return '';
  return format('dateCourte', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(versUtc(civileDepuisIso(iso))));
}

// « 19 oct. 2026, 07:45 » pour un horodatage complet.
export function formatHorodatage(horodatage, fuseau) {
  if (!horodatage) return '';
  const cle = `horo:${fuseau || 'local'}`;
  const options = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  if (fuseau) options.timeZone = fuseau;
  return format(cle, options).format(new Date(horodatage));
}

export function ilYA(horodatage, maintenant = new Date()) {
  if (!horodatage) return 'jamais';
  const s = Math.round((maintenant - new Date(horodatage)) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86_400)} j`;
}

export function joursDepuis(horodatage, maintenant = new Date()) {
  if (!horodatage) return Infinity;
  return (maintenant - new Date(horodatage)) / JOUR_MS;
}

export function minutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

export function hhmm(total) {
  const t = Math.max(0, Math.min(24 * 60, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function dureeLisible(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}
