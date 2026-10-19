// Disponibilités : chacun coche ses créneaux de la semaine ; l’appli en déduit les créneaux communs des titulaires.

import { h, liste, champ, bouton, toast, messageErreur, saisie } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { navSemaine } from '../composants/grille.js';
import { JOURS, HEURES_DISPO } from '/shared/referentiel.js';
import { MOTIFS } from '/shared/validation.js';
import { dateCivile, semaineIso, decalerSemaine } from '/shared/temps.js';

let membreChoisi = null;

const cle = (j, heure) => `${j}-${heure}`;

function lireCreneaux(d) {
  const s = new Set();
  for (const [j, heures] of Object.entries(d?.creneaux || {})) for (const heure of heures) s.add(cle(j, heure));
  return s;
}

function versCreneaux(s) {
  const c = {};
  for (const k of s) {
    const [j, heure] = k.split('-');
    (c[j] ||= []).push(Number(heure));
  }
  for (const j of Object.keys(c)) c[j].sort((a, b) => a - b);
  return c;
}

function grilleSaisie(selection, surChangement) {
  let mode = null;
  let ignorerClic = false;
  const basculer = (bt, force = null) => {
    const k = bt.dataset.cle;
    const actif = force === null ? !selection.has(k) : force;
    if (actif) selection.add(k);
    else selection.delete(k);
    bt.setAttribute('aria-pressed', String(actif));
    return actif;
  };
  // Souris : cliquer-glisser pour peindre plusieurs cases. Tactile et clavier : un appui = une case.
  return h('div', {
    class: 'dispo-grille',
    role: 'group',
    'aria-label': 'Créneaux d’une heure, du lundi au dimanche',
    onpointerdown: (e) => {
      const bt = e.target.closest('button[data-cle]');
      if (!bt || e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      ignorerClic = true;
      mode = basculer(bt);
      surChangement();
      document.addEventListener('pointerup', () => { mode = null; }, { once: true });
    },
    onpointermove: (e) => {
      if (mode === null) return;
      const bt = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('button[data-cle]');
      if (bt && bt.getAttribute('aria-pressed') !== String(mode)) {
        basculer(bt, mode);
        surChangement();
      }
    },
    onclick: (e) => {
      const bt = e.target.closest('button[data-cle]');
      if (!bt) return;
      if (ignorerClic) {
        ignorerClic = false;
        return;
      }
      basculer(bt);
      surChangement();
    },
  },
  h('span', {}),
  JOURS.map((j) => h('span', { class: 'dispo-grille__jour' }, j.court)),
  HEURES_DISPO.map((heure) => [
    h('span', { class: 'dispo-grille__heure' }, `${heure}h`),
    JOURS.map((j) => h('button', {
      type: 'button',
      class: 'dispo-grille__case',
      'data-cle': cle(j.n, heure),
      'aria-pressed': String(selection.has(cle(j.n, heure))),
      'aria-label': `${j.nom} ${heure}h–${heure + 1}h`,
    })),
  ]));
}

function syntheseTitulaires(semaine) {
  const titulaires = E.joueurs().filter((m) => m.statut === 'titulaire');
  const remplis = titulaires.map((m) => ({ m, s: lireCreneaux(E.doc('dispos', `${semaine}_${m._id}`)) }));
  const total = titulaires.length;
  const compte = (j, heure) => remplis.filter((r) => r.s.has(cle(j, heure))).length;

  const carte = h('div', { class: 'dispo-grille dispo-grille--synthese', role: 'table', 'aria-label': 'Nombre de titulaires disponibles par créneau' },
    h('span', {}),
    JOURS.map((j) => h('span', { class: 'dispo-grille__jour' }, j.court)),
    HEURES_DISPO.map((heure) => [
      h('span', { class: 'dispo-grille__heure' }, `${heure}h`),
      JOURS.map((j) => {
        const n = compte(j.n, heure);
        return h('span', {
          class: ['dispo-grille__case', 'dispo-grille__case--synthese', total && n === total && 'dispo-grille__case--complet'],
          style: { '--part': total ? String(n / total) : '0' },
          title: `${j.nom} ${heure}h : ${n} sur ${total}`,
        }, n ? String(n) : '');
      }),
    ]));

  const fenetres = [];
  for (const j of JOURS) {
    let debut = null;
    for (const heure of [...HEURES_DISPO, 99]) {
      const ok = heure !== 99 && total > 0 && compte(j.n, heure) === total;
      if (ok && debut === null) debut = heure;
      if (!ok && debut !== null) {
        fenetres.push({ j, debut, fin: heure === 99 ? HEURES_DISPO.at(-1) + 1 : heure });
        debut = null;
      }
    }
  }
  return { carte, fenetres, total, remplis: remplis.filter((r) => r.s.size).length };
}

export function rendre(page, params, ctx) {
  const courante = semaineIso(dateCivile(new Date()));
  const semaine = MOTIFS.semaine.test(params[0] || '') ? params[0] : courante;
  const tous = E.peut('dispos.tous');
  const monId = E.monMembreId();
  const moi = monId ? E.doc('membres', monId) : null;
  const membres = E.membresActifs();
  if (!membres.some((m) => m._id === membreChoisi)) membreChoisi = null;
  const membreId = membreChoisi || (moi && E.peut('dispos.soi') ? moi._id : null) || (tous ? E.joueurs()[0]?._id : null);
  const peutEcrire = !!membreId && (tous || (moi?._id === membreId && E.peut('dispos.soi')));

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Disponibilités'),
      h('p', { class: 'entete-page__intro' }, 'Chacun coche les heures où il peut jouer. Les créneaux où tous les titulaires sont disponibles ressortent en or : c’est là qu’on place scrims et séances d’équipe.'))));
  page.append(h('div', { class: 'barre-outils' }, navSemaine(semaine, courante, (s) => ctx.aller(J.lien(`/dispos/${s}`)))));

  const grilles = h('div', { class: 'dispo-colonnes' });
  page.append(grilles);

  // Saisie
  const cleBrouillon = `dispos-${semaine}-${membreId || 'aucun'}`;
  const saisieZone = h('section', { class: 'fiche', dataset: { brouillon: cleBrouillon } });
  grilles.append(saisieZone);
  if (!membreId) {
    saisieZone.append(h('h2', {}, 'Mes disponibilités'),
      h('p', { class: 'texte-2' }, `Ton compte n’est lié à aucun membre du roster ${E.jeu().nom} : demande au Responsable du jeu de le relier à ton profil.`));
  } else {
    const membre = E.doc('membres', membreId);
    const fiche = E.doc('dispos', `${semaine}_${membreId}`);
    const selection = lireCreneaux(fiche);
    const note = saisie({ valeur: fiche?.note || '', maxlength: 200, placeholder: 'Ex. : absent samedi, dispo plus tard le vendredi' });
    const etat = h('span', { class: 'texte-3 petit', role: 'status' }, fiche ? '' : 'Pas encore rempli.');
    const marquer = () => {
      E.definirBrouillon(true, cleBrouillon);
      etat.textContent = 'Modifications non enregistrées.';
    };
    note.addEventListener('input', marquer);
    const enregistrer = bouton('Enregistrer', {
      classe: 'btn--principal',
      icone: 'ok',
      disabled: !peutEcrire,
      onclick: async () => {
        try {
          await E.appeler('PUT', `/dispos/${semaine}/${encodeURIComponent(membreId)}`, { valeur: { creneaux: versCreneaux(selection), note: note.value.trim() } }, 'dispos');
          etat.textContent = 'Enregistré.';
          toast('Disponibilités enregistrées.');
          E.definirBrouillon(false, cleBrouillon);
        } catch (err) {
          toast(messageErreur(err), { type: 'erreur' });
        }
      },
    });
    const copier = bouton('Reprendre la semaine précédente', {
      classe: 'btn--discret btn--petit',
      disabled: !peutEcrire,
      onclick: () => {
        const avant = lireCreneaux(E.doc('dispos', `${decalerSemaine(semaine, -1)}_${membreId}`));
        if (!avant.size) return toast('Rien de rempli la semaine précédente.', { type: 'erreur' });
        selection.clear();
        for (const k of avant) selection.add(k);
        for (const bt of grille.querySelectorAll('button[data-cle]')) bt.setAttribute('aria-pressed', String(selection.has(bt.dataset.cle)));
        marquer();
      },
    });
    const grille = grilleSaisie(selection, marquer);
    if (!peutEcrire) grille.inert = true;
    saisieZone.append(
      h('div', { class: 'fiche__titre' },
        h('h2', {}, membreId === moi?._id ? 'Mes disponibilités' : `Disponibilités de ${membre?.pseudo || 'ce membre'}`),
        tous ? liste(membres.map((m) => ({ valeur: m._id, libelle: m.pseudo || 'Poste à pourvoir' })), {
          valeur: membreId,
          'aria-label': 'Membre',
          class: 'saisie saisie--compacte',
          'data-pas-brouillon': '',
          onchange: (e) => { membreChoisi = e.target.value; E.definirBrouillon(false, cleBrouillon); ctx.rafraichir(); },
        }) : null),
      h('p', { class: 'texte-3 petit' }, 'Clique ou fais glisser sur les cases. Une case = une heure.'),
      grille,
      champ('Remarque', note),
      h('div', { class: 'rangee rangee--espace' }, copier, h('div', { class: 'rangee' }, etat, enregistrer)));
  }

  // Synthèse
  const { carte, fenetres, total, remplis } = syntheseTitulaires(semaine);
  grilles.append(h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Créneaux communs'), h('span', { class: 'fiche__meta' }, `${remplis} titulaire${remplis > 1 ? 's' : ''} sur ${total} ${remplis > 1 ? 'ont' : 'a'} rempli`)),
    total ? carte : h('p', { class: 'texte-3' }, 'Aucun titulaire dans le roster.'),
    h('h3', { class: 'sous-titre' }, 'Tous les titulaires disponibles'),
    fenetres.length
      ? h('ul', { class: 'liste-puces' }, fenetres.map((f) => h('li', {}, h('strong', {}, f.j.nom), ` de ${f.debut}h à ${f.fin}h`)))
      : h('p', { class: 'texte-3 petit' }, remplis < total ? 'En attente des disponibilités de tous les titulaires.' : 'Aucun créneau commun à tous les titulaires cette semaine.')));

  // Qui a rempli
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Qui a rempli')),
    h('div', { class: 'cases-membres' }, membres.map((m) => {
      const d = E.doc('dispos', `${semaine}_${m._id}`);
      const heures = lireCreneaux(d).size;
      return h('div', { class: ['membre-rempli', heures && 'membre-rempli--ok'] },
        icone(heures ? 'ok' : 'dispos'),
        h('span', {}, m.pseudo || 'Poste à pourvoir'),
        h('span', { class: 'texte-3 tres-petit' }, heures ? `${heures} h` : 'pas encore'),
        d?.note ? h('span', { class: 'texte-3 tres-petit membre-rempli__note' }, d.note) : null);
    }))));
}
