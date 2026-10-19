// Partenaires de scrim : le carnet des équipes avec qui l'on scrimme. Créneaux, contact, statut et notes ; fiabilité
// calculée toute seule (scrims saisis avec ce partenaire face aux annulations et absences notées) ; journal des incidents.
// Écriture avec la permission scrims.modifier, lecture pour tout le monde.

import { h, modale, confirmer, champ, saisie, zone, liste, bouton, toast, etatVide, onglets, lienExterne } from '../ui.js';
import * as E from '../etat.js';
import { puce, signature } from '../composants/jetons.js';
import { nouveauScrim, partenairesTries } from './scrims-saisie.js';
import { journalIncidents } from './partenaires-journal.js';
import { fiabilitePartenaire } from '/shared/organisation.js';
import { estClassement } from '/shared/stats.js';
import { STATUTS_PARTENAIRE, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { formatDate } from '/shared/temps.js';

const TONS = { actif: 'positif', essai: 'info', pause: '', eviter: 'negatif' };
let filtre = '';

const norme = (t) => String(t || '').trim().toLowerCase();
const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;
const initiales = (nom) => nom.split(/\s+/).filter(Boolean).map((m) => m[0]).join('').slice(0, 3).toUpperCase() || '?';
function site(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'lien';
  }
}

// ——— Fiche : ajout, modification, suppression ———

function editeur(p = null, prerempli = {}) {
  const nouveau = !p;
  const d = p || { statut: 'actif', ...prerempli };
  const nom = saisie({ valeur: d.nom || '', maxlength: 40, required: true });
  const tag = saisie({ valeur: d.tag || '', maxlength: 6, placeholder: 'Ex. : NBL' });
  const niveau = saisie({ valeur: d.niveau || '', maxlength: 40, placeholder: 'Ex. : même niveau, un cran au-dessus' });
  const creneaux = saisie({ valeur: d.creneaux || '', maxlength: 120, placeholder: 'Ex. : mardi et jeudi, 20 h' });
  const contact = saisie({ valeur: d.contact || '', maxlength: 80, placeholder: 'Ex. : pseudo Discord du manager' });
  const lien = saisie({ type: 'url', valeur: d.lien || '', maxlength: 500, placeholder: 'https://…' });
  const statut = liste(STATUTS_PARTENAIRE.map((s) => ({ valeur: s.id, libelle: s.nom })), { valeur: d.statut || 'actif' });
  const notes = zone({ valeur: d.notes || '', lignes: 3, maxlength: 600 });
  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer(`Retirer « ${p.nom} » du carnet ? Ses scrims restent dans Scrims et matchs, sans lien vers la fiche.`, { libelle: 'Retirer', danger: true }))) return false;
        await E.supprimer('partenaires', p._id);
        toast(`${p.nom} retiré du carnet.`);
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Ajouter au carnet' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const n = nom.value.trim();
      if (!n) throw new Error('Indique le nom de l’équipe.');
      if (E.liste('partenaires').some((x) => x._id !== p?._id && norme(x.nom) === norme(n))) throw new Error(`« ${n} » est déjà dans le carnet.`);
      if (lien.value.trim() && !/^https:\/\//i.test(lien.value.trim())) throw new Error('Le lien doit commencer par https://.');
      const actuel = p ? E.doc('partenaires', p._id) || p : null;
      await E.enregistrer('partenaires', p?._id || nouvelId('e'), {
        nom: n, tag: tag.value.trim().toUpperCase(), niveau: niveau.value.trim(), creneaux: creneaux.value.trim(), contact: contact.value.trim(),
        lien: lien.value.trim(), statut: statut.value, notes: notes.value.trim(), incidents: actuel?.incidents || [],
      }, { revBase: nouveau ? 0 : actuel.rev });
      toast(nouveau ? `${n} ajouté au carnet.` : 'Fiche enregistrée.');
    },
  });
  modale({
    titre: nouveau ? 'Nouveau partenaire de scrim' : `Modifier : ${p.nom}`,
    large: true,
    contenu: h('div', { class: 'grille-champs grille-champs--3 saisie-scrim' },
      champ('Nom de l’équipe', nom, { large: true }),
      champ('Tag', tag), champ('Niveau', niveau), champ('Statut', statut),
      champ('Créneaux habituels', creneaux, { large: true }),
      champ('Contact', contact, { aide: 'Un pseudo (Discord…), jamais d’adresse e-mail ni de nom réel.' }),
      champ('Lien', lien, { aide: 'Site, réseau ou serveur Discord, en https.' }),
      champ('Notes', notes, { large: true })),
    actions,
  });
}

// ——— Fiabilité : en texte, la couleur de la barre ne fait que confirmer ———

function blocFiabilite(f) {
  const details = [
    pluriel(f.joues, 'scrim joué', 'scrims joués'),
    f.annules ? pluriel(f.annules, 'annulé par eux', 'annulés par eux') : null,
    f.absents ? pluriel(f.absents, 'absence') : null,
    f.retards ? pluriel(f.retards, 'retard') : null,
    f.annulesNous ? pluriel(f.annulesNous, 'annulé par nous', 'annulés par nous') : null,
  ].filter(Boolean).join(' · ');
  const dernier = f.dernier ? `Dernier scrim le ${formatDate(f.dernier)}.` : '';
  if (f.taux === null) {
    return h('div', { class: 'fiabilite fiabilite--vide' },
      h('p', { class: 'texte-3 petit' }, f.joues || f.retards || f.annulesNous ? `${details}. ${dernier}` : 'Pas encore de scrim saisi avec eux : la fiabilité se calcule dès le premier.'));
  }
  const niveau = f.taux >= 80 ? 'bonne' : f.taux >= 50 ? 'moyenne' : 'faible';
  return h('div', { class: ['fiabilite', `fiabilite--${niveau}`] },
    h('p', { class: 'fiabilite__titre' }, h('strong', { class: 'chiffre fiabilite__taux' }, `${f.taux} %`), h('span', {}, ' des scrims prévus tenus')),
    h('div', { class: 'jauge__piste', 'aria-hidden': 'true' }, h('div', { class: 'jauge__barre fiabilite__barre', style: { width: `${f.taux}%` } })),
    h('p', { class: 'texte-3 petit' }, `${details}.${dernier ? ` ${dernier}` : ''}`));
}

function carte(p, { editable, scrims, cible }) {
  const f = fiabilitePartenaire(p, scrims);
  return h('article', { class: ['fiche carte-partenaire', `carte-partenaire--${p.statut}`, cible && 'carte-partenaire--cible'], id: `partenaire-${p._id}` },
    h('header', { class: 'carte-partenaire__tete' },
      h('span', { class: 'carte-partenaire__tag', 'aria-hidden': 'true' }, p.tag || initiales(p.nom)),
      h('div', { class: 'carte-partenaire__nom' },
        h('h2', {}, p.nom),
        h('div', { class: 'rangee' }, puce(libelle(STATUTS_PARTENAIRE, p.statut), TONS[p.statut] || ''),
          p.niveau ? h('span', { class: 'texte-3 petit' }, p.niveau) : null))),
    p.creneaux || p.contact || p.lien ? h('dl', { class: 'details carte-partenaire__infos' },
      p.creneaux ? [h('dt', {}, 'Créneaux'), h('dd', {}, p.creneaux)] : null,
      p.contact ? [h('dt', {}, 'Contact'), h('dd', {}, p.contact)] : null,
      p.lien ? [h('dt', {}, 'Lien'), h('dd', {}, lienExterne(p.lien, site(p.lien)))] : null) : null,
    blocFiabilite(f),
    p.notes ? h('p', { class: 'texte-multi petit carte-partenaire__notes' }, p.notes) : null,
    journalIncidents(p, editable),
    h('footer', { class: 'carte-partenaire__pied' },
      signature(p),
      editable ? h('div', { class: 'rangee' },
        bouton('Saisir un scrim', { icone: 'scrims', classe: 'btn--petit', onclick: () => nouveauScrim({ partenaire: p._id, adversaire: p.nom }) }),
        bouton('Modifier', { icone: 'modifier', classe: 'btn--petit btn--discret', onclick: () => editeur(E.doc('partenaires', p._id) || p) })) : null));
}

// Équipes déjà affrontées en scrim (hors classement) qui ne sont pas encore dans le carnet, les plus fréquentes d'abord.
function suggestions(partenaires, scrims) {
  const connus = new Set(partenaires.map((p) => norme(p.nom)));
  const compte = new Map();
  for (const s of scrims) {
    const nom = s.adversaire?.trim();
    if (!nom || s.partenaire || estClassement(s) || connus.has(norme(nom))) continue;
    const cle = norme(nom);
    compte.set(cle, { nom: compte.get(cle)?.nom || nom, n: (compte.get(cle)?.n || 0) + 1 });
  }
  const liste_ = [...compte.values()].sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom, 'fr')).slice(0, 8);
  if (!liste_.length) return null;
  return h('div', { class: 'suggestions-partenaires' },
    h('p', { class: 'petit texte-2' }, 'Déjà affrontées en scrim, pas encore dans le carnet :'),
    h('div', { class: 'rangee' }, liste_.map((x) => bouton(`${x.nom} (${x.n})`, {
      icone: 'ajouter', classe: 'btn--petit', 'aria-label': `Ajouter ${x.nom} au carnet`, onclick: () => editeur(null, { nom: x.nom }),
    }))));
}

export function rendre(page, params, ctx) {
  const editable = E.peut('scrims.modifier');
  const scrims = E.liste('scrims');
  const tous = partenairesTries();
  const ajouter = (classe = 'btn--principal') => bouton('Ajouter un partenaire', { icone: 'ajouter', classe, onclick: () => editeur() });

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Partenaires de scrim'),
      h('p', { class: 'entete-page__intro' }, 'Le carnet des équipes avec qui vous scrimmez : créneaux, contact et fiabilité. Un scrim saisi avec son partenaire compte tout seul ; notez ici les annulations, absences et retards.')),
    editable && tous.length ? h('div', { class: 'entete-page__actions' }, ajouter()) : null));

  if (!tous.length) {
    page.append(etatVide(editable
      ? 'Le carnet est vide. Ajoute les équipes avec qui vous scrimmez : leurs créneaux, un contact et, au fil des scrims, leur fiabilité.'
      : 'Le staff n’a pas encore rempli le carnet des partenaires de scrim.', editable ? ajouter() : null));
    if (editable) {
      const s = suggestions(tous, scrims);
      if (s) page.append(h('section', { class: 'section' }, s));
    }
    return;
  }

  const presents = STATUTS_PARTENAIRE.filter((st) => tous.some((p) => p.statut === st.id));
  if (filtre && !presents.some((st) => st.id === filtre)) filtre = '';
  if (presents.length > 1) {
    page.append(h('div', { class: 'barre-outils' },
      onglets([{ valeur: '', libelle: `Tous (${tous.length})` }, ...presents.map((st) => ({ valeur: st.id, libelle: `${st.nom} (${tous.filter((p) => p.statut === st.id).length})` }))],
        filtre, (v) => { filtre = v; ctx.rafraichir(); }, { libelle: 'Filtrer par statut' })));
  }
  page.append(h('div', { class: 'grille-partenaires' },
    tous.filter((p) => !filtre || p.statut === filtre).map((p) => carte(p, { editable, scrims, cible: params[0] === p._id }))));
  if (editable) {
    const s = suggestions(tous, scrims);
    if (s) page.append(h('section', { class: 'section' }, s));
  }

  // Lien direct vers une fiche (depuis un résultat de scrim) : elle est mise en avant et amenée à l'écran.
  if (params[0]) {
    setTimeout(() => {
      const el = document.getElementById(`partenaire-${params[0]}`);
      if (el && window.scrollY < 10) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  }
}
