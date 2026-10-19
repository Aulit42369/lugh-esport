// Exports de fichiers : agenda (.ics, importable dans Google Agenda ou le téléphone) et tableaux CSV pour Excel.

import { joursDe, minutes } from './temps.js';
import { libelleDans, mot } from './jeux/definition.js';
import { MARQUE } from './marque.js';

// ——— Agenda iCalendar (RFC 5545) ———

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

function echapperIcs(t) {
  return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const octetsUtf8 = (car) => {
  const c = car.codePointAt(0);
  if (c < 0x80) return 1;
  if (c < 0x800) return 2;
  return c < 0x10000 ? 3 : 4;
};

// Plie les lignes à 75 octets UTF-8 (RFC 5545) sans jamais couper un caractère : les lignes de suite
// commencent par une espace, qui compte dans les 75 octets.
function plier(ligne) {
  const morceaux = [];
  let courant = '';
  let octets = 0;
  for (const car of ligne) {
    const n = octetsUtf8(car);
    if (octets + n > (morceaux.length ? 74 : 75)) {
      morceaux.push(courant);
      courant = '';
      octets = 0;
    }
    courant += car;
    octets += n;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

function dateLocale(iso, hhmmTexte) {
  const total = minutes(hhmmTexte);
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j) + Math.floor(total / 1440) * 86_400_000);
  const pad = (n) => String(n).padStart(2, '0');
  const reste = total % 1440;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(Math.floor(reste / 60))}${pad(reste % 60)}00`;
}

const dateIcs = (iso) => iso.replace(/-/g, '');
const lendemain = (iso) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
};

// Calendrier générique : evenements = [{ uid, date (AAAA-MM-JJ), debut (HH:MM), fin (HH:MM), titre, description }] ;
// sans debut, l'événement occupe la journée entière.
export function calendrierIcs({ nomCalendrier, evenements, maintenant = new Date() }) {
  const horodatage = maintenant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${MARQUE.nom}//Planning//FR`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapperIcs(nomCalendrier)}`, ...VTIMEZONE];
  for (const e of evenements) {
    lignes.push('BEGIN:VEVENT',
      `UID:${e.uid}@${MARQUE.id}`,
      `DTSTAMP:${horodatage}`,
      e.debut ? `DTSTART;TZID=Europe/Paris:${dateLocale(e.date, e.debut)}` : `DTSTART;VALUE=DATE:${dateIcs(e.date)}`,
      e.debut ? `DTEND;TZID=Europe/Paris:${dateLocale(e.date, e.fin)}` : `DTEND;VALUE=DATE:${dateIcs(lendemain(e.date))}`,
      `SUMMARY:${echapperIcs(e.titre)}`,
      e.description ? `DESCRIPTION:${echapperIcs(e.description)}` : null,
      'END:VEVENT');
  }
  lignes.push('END:VCALENDAR');
  return `${lignes.filter(Boolean).map(plier).join('\r\n')}\r\n`;
}

// Événement d'agenda tiré d'un bloc du planning d'un jeu.
export function evenementBloc({ def, semaine, bloc, nomMap = (id) => id, prefixeTitre = '' }) {
  const type = libelleDans(def.typesBlocTous, bloc.type);
  return {
    uid: `${def.espace}-${semaine}-${bloc.id}`,
    date: joursDe(semaine)[bloc.jour - 1].iso,
    debut: bloc.debut,
    fin: bloc.fin,
    titre: `${prefixeTitre}${bloc.titre || type}`,
    description: [type, bloc.map ? `${mot(def, 'carte', true) || 'Map'} : ${nomMap(bloc.map)}` : '', bloc.details].filter(Boolean).join('\n'),
  };
}

export function agendaIcs({ def, semaine, blocs, nomCalendrier, nomMap = (id) => id, maintenant = new Date() }) {
  return calendrierIcs({ nomCalendrier, maintenant, evenements: blocs.map((bloc) => evenementBloc({ def, semaine, bloc, nomMap })) });
}

// ——— CSV pour Excel en français : séparateur « ; », BOM UTF-8 pour les accents ———

// Un texte qui commence par = + - @ serait lu comme une formule par Excel : il est préfixé d'une apostrophe.
function cellule(v) {
  if (v === null || v === undefined) return '';
  let t = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function csv(entetes, lignes) {
  return `\uFEFF${[entetes, ...lignes].map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`;
}
