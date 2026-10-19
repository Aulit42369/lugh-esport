// Double authentification : morceaux communs à « Mon compte » et à l'activation obligatoire (écran plein) :
// QR code à scanner, clé à recopier, saisie d'un code (application ou secours), codes de secours à mettre à l'abri.

import { h, svg, vider, bouton, caseACocher, toast, messageErreur, idUnique } from '../ui.js';
import { api } from '../api.js';
import { telecharger } from '../composants/sorties.js';
import { MARQUE } from '/shared/marque.js';

export const APPLICATIONS_2FA = ['Google Authenticator', 'Aegis', 'Microsoft Authenticator'];
const ZONE_SILENCE = 4;

// QR code en SVG : une unité par module, zone de silence de 4 modules, noir sur fond blanc dans les deux thèmes.
export function dessinQr(lignes) {
  const cote = lignes.length + ZONE_SILENCE * 2;
  let d = '';
  lignes.forEach((ligne, y) => {
    for (let x = 0; x < ligne.length; x += 1) {
      if (ligne[x] !== '1') continue;
      let fin = x;
      while (ligne[fin + 1] === '1') fin += 1;
      d += `M${x + ZONE_SILENCE} ${y + ZONE_SILENCE}h${fin - x + 1}v1h-${fin - x + 1}z`;
      x = fin;
    }
  });
  return svg('svg', {
    class: 'qr-2fa', viewBox: `0 0 ${cote} ${cote}`, role: 'img', 'shape-rendering': 'crispEdges',
    'aria-label': 'QR code à scanner avec ton application d’authentification',
  }, svg('rect', { width: cote, height: cote, fill: '#ffffff' }), svg('path', { d, fill: '#000000' }));
}

async function copier(texte, succes) {
  try {
    await navigator.clipboard.writeText(texte);
    toast(succes);
  } catch {
    toast('Copie impossible dans ce navigateur : sélectionne le texte à la main.', { type: 'erreur' });
  }
}

// Champ d'un code : les 6 chiffres de l'application, ou (lien « Utiliser un code de secours ») un code abcd-efgh.
// surComplet : appelé dès que 6 chiffres sont saisis (validation sans clic).
export function champCode({ secoursPossible = true, surComplet = null } = {}) {
  let secours = false;
  const id = idUnique('code');
  const input = h('input', { id, class: 'saisie saisie--code', type: 'text', name: 'code', spellcheck: 'false', autocapitalize: 'none' });
  const etiquette = h('label', { class: 'champ__label', for: id });
  const aide = h('span', { class: 'champ__aide' });
  const bascule = secoursPossible ? h('button', { type: 'button', class: 'lien-bouton', onclick: () => regler(!secours, true) }) : null;

  function regler(versSecours, focus = false) {
    secours = versSecours;
    input.value = '';
    etiquette.textContent = secours ? 'Code de secours' : 'Code de ton application d’authentification';
    aide.textContent = secours
      ? 'Un des 10 codes reçus à l’activation, au format abcd-efgh. Chacun ne sert qu’une fois.'
      : '6 chiffres, renouvelés toutes les 30 secondes.';
    input.setAttribute('inputmode', secours ? 'text' : 'numeric');
    input.setAttribute('autocomplete', secours ? 'off' : 'one-time-code');
    input.maxLength = secours ? 9 : 7;
    input.placeholder = secours ? 'abcd-efgh' : '';
    input.classList.toggle('saisie--secours', secours);
    if (bascule) bascule.textContent = secours ? 'Utiliser le code de l’application' : 'Utiliser un code de secours';
    if (focus) input.focus();
  }
  regler(false);
  input.addEventListener('input', () => {
    if (!secours && surComplet && /^\d{6}$/.test(input.value.replace(/\s/g, ''))) surComplet();
  });

  // Code nettoyé, prêt à envoyer ; une erreur lisible si le format ne va pas.
  function lire() {
    const v = input.value.trim();
    if (secours) {
      const c = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (c.length !== 8) throw new Error('Un code de secours compte 8 caractères, au format abcd-efgh.');
      return `${c.slice(0, 4)}-${c.slice(4)}`;
    }
    const c = v.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) throw new Error('Le code de l’application compte 6 chiffres.');
    return c;
  }

  const element = h('div', { class: 'champ champ-code' }, etiquette, input, aide, bascule);
  return { element, input, lire, vider: () => { input.value = ''; }, estSecours: () => secours };
}

// Bouton d'envoi occupé pendant une requête.
export function occupe(bouton_, oui) {
  bouton_.disabled = oui;
  if (oui) bouton_.setAttribute('aria-busy', 'true');
  else bouton_.removeAttribute('aria-busy');
}

// Activation en trois étapes : une application, la clé (QR code ou texte), un premier code.
// surActive(reponse) reçoit { codesSecours, compte } du serveur.
export function activation2fa({ surActive }) {
  const racine = h('div', { class: 'activation-2fa' });
  async function preparer() {
    vider(racine).append(h('p', { class: 'texte-3', role: 'status' }, 'Création de ta clé…'));
    try {
      const r = await api('POST', '/api/auth/2fa/preparer');
      vider(racine).append(etapes(r, surActive, preparer));
      if (!matchMedia('(max-width: 899px)').matches) racine.querySelector('.saisie--code')?.focus();
    } catch (err) {
      vider(racine).append(h('p', { class: 'champ__erreur', role: 'alert' }, messageErreur(err)), bouton('Réessayer', { onclick: preparer }));
    }
  }
  preparer();
  return racine;
}

function etapes({ secret, qr, emetteur }, surActive, recommencer) {
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const envoi = h('button', { type: 'submit', class: 'btn btn--principal' }, 'Activer');
  const relance = bouton('Recommencer', { classe: 'btn--discret', hidden: true, onclick: recommencer });
  let enCours = false;
  const code = champCode({ secoursPossible: false, surComplet: () => formulaire.requestSubmit() });
  const formulaire = h('form', {
    class: 'formulaire activation-2fa__code',
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (enCours) return;
      erreur.textContent = '';
      let valeur;
      try {
        valeur = code.lire();
      } catch (err) {
        erreur.textContent = err.message;
        return;
      }
      enCours = true;
      occupe(envoi, true);
      try {
        surActive(await api('POST', '/api/auth/2fa/activer', { code: valeur }));
      } catch (err) {
        erreur.textContent = messageErreur(err);
        relance.hidden = err.statut !== 409;
        code.vider();
        code.input.focus();
      } finally {
        enCours = false;
        occupe(envoi, false);
      }
    },
  }, code.element, erreur, h('div', { class: 'rangee' }, envoi, relance));

  const cle = secret.replace(/\s/g, '');
  return h('ol', { class: 'etapes-2fa' },
    h('li', {},
      h('h3', {}, 'Installe une application d’authentification'),
      h('p', { class: 'texte-2 petit' }, `${APPLICATIONS_2FA.slice(0, -1).join(', ')} ou ${APPLICATIONS_2FA.at(-1)} : n’importe quelle application de codes à 6 chiffres convient.`)),
    h('li', {},
      h('h3', {}, 'Ajoute ton compte en scannant le QR code'),
      h('div', { class: 'cle-2fa' },
        dessinQr(qr),
        h('div', { class: 'pile-s cle-2fa__texte' },
          h('p', { class: 'texte-2 petit' }, 'Pas d’appareil photo ? Choisis « Saisir une clé » dans l’application et recopie :'),
          h('code', { class: 'cle-2fa__cle' }, secret),
          h('div', {}, bouton('Copier la clé', { icone: 'copier', classe: 'btn--petit', onclick: () => copier(cle, 'Clé copiée.') })),
          h('p', { class: 'texte-3 tres-petit' }, `Le compte apparaît sous le nom « ${(emetteur || MARQUE.nom).replace(/ /g, '\u00a0')} ». Clé valable 10 minutes.`)))),
    h('li', {},
      h('h3', {}, 'Saisis le code affiché par l’application'),
      formulaire));
}

function contenuFichier(codes, identifiant) {
  const le = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    `Codes de secours ${MARQUE.nom}${identifiant ? `, compte ${identifiant}` : ''}`,
    `Créés le ${le}. Chaque code ne sert qu’une fois, à la place du code de l’application.`,
    '',
    ...codes,
    '',
  ].join('\n');
}

// Les 10 codes de secours, montrés une seule fois. « surFin » n'est possible qu'une fois la case cochée.
export function blocCodesSecours(codes, { identifiant = '', libelleFin = 'Terminer', surFin }) {
  const fin = h('button', { type: 'button', class: 'btn btn--principal', disabled: true, onclick: () => surFin() }, libelleFin);
  const coche = caseACocher('J’ai mis ces codes à l’abri', { onchange: (e) => { fin.disabled = !e.target.checked; } });
  const nomFichier = `${MARQUE.id}-codes-de-secours${identifiant ? `-${identifiant}` : ''}.txt`;
  return h('div', { class: 'codes-2fa' },
    h('p', { class: 'texte-2' }, 'Si tu perds ton téléphone, chacun de ces codes remplace une fois le code de l’application. Ils ne seront plus jamais affichés : range-les hors du téléphone (gestionnaire de mots de passe, papier).'),
    h('ul', { class: 'codes-2fa__liste', 'aria-label': 'Codes de secours' }, codes.map((c) => h('li', {}, c))),
    h('div', { class: 'rangee' },
      bouton('Copier les codes', { icone: 'copier', onclick: () => copier(codes.join('\n'), 'Codes de secours copiés.') }),
      bouton('Télécharger (.txt)', { icone: 'telecharger', onclick: () => telecharger(nomFichier, contenuFichier(codes, identifiant), 'text/plain;charset=utf-8') })),
    h('div', { class: 'codes-2fa__fin' }, coche.element, fin));
}
