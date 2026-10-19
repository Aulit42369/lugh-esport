// Réglages du jeu (permission jeu.regler) : adapter le modèle du jeu à l'équipe sans code. Chaque section vaut null
// tant qu'elle suit le modèle ; « Revenir au modèle » la remet à null. Un élément d'une liste du modèle ne disparaît
// jamais : il se masque. Ici : page, brouillon, enregistrement, Identité, Vocabulaire, Effectif, Charge d'entraînement.
// Le score est dans reglages-score.js, les listes dans reglages-listes.js, les textes (objectifs, routines, profil,
// méta) dans reglages-textes.js.

import { h, bouton, toast, messageErreur, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { validerReglagesJeu } from '/shared/jeux/reglages-jeu.js';
import { cloner, section, texteReglage, nombreReglage, trouverChamp, ouvrirJusqua } from './reglages-outils.js';
import { sectionScore } from './reglages-score.js';
import { sectionListes } from './reglages-listes.js';
import { sectionObjectifs, sectionRoutines, sectionProfil, sectionMeta, nettoyerRoutines } from './reglages-textes.js';
import { chargement, erreurChargement } from './admin-commun.js';

const CLE = 'reglages-jeu';
const MOTS = ['personnage', 'personnages', 'carte', 'cartes', 'manche', 'manches', 'astuce', 'astuces'];

export function rendre(page, params, ctx) {
  page.classList.add('rgl-page');
  if (!E.peut('jeu.regler')) {
    page.append(h('h1', {}, 'Réglages du jeu'), etatVide('Cette page est réservée au Responsable du jeu.'));
    return null;
  }
  const zone = h('div', {}, chargement('Chargement des réglages…'));
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Réglages du jeu'),
      h('p', { class: 'entete-page__intro' }, `Adapte ${E.jeu().nom} à ton équipe sans toucher au code : noms, listes, textes, score. Rien ne s’efface : un élément du modèle se masque, et chaque section peut revenir au modèle.`))),
  zone);
  const jeu = E.jeu().id;
  E.appeler('GET', '/reglages-jeu')
    .then((d) => { if (E.jeu()?.id === jeu) monter(zone, d, ctx); })
    .catch((err) => zone.replaceChildren(erreurChargement(err, () => ctx.rafraichir())));
  return null;
}

function monter(zone, d, ctx) {
  const S = {
    modele: d.modele,
    reglages: cloner(d.reglages),
    rev: d.rev,
    scrims: d.scrims,
    nom: d.nom,
    court: d.court,
    origine: '',
    erreursLocales: new Map(),
    sections: [],
    modifie: () => {},
  };
  const instantane = () => JSON.stringify([S.reglages, S.nom.trim(), S.court.trim()]);
  S.origine = instantane();

  const etatBarre = h('p', { class: 'rgl-barre__etat', 'aria-live': 'polite' });
  const enregistrer = bouton(h('span', {}, 'Enregistrer', h('span', { class: 'rgl-long' }, ' les réglages')), { classe: 'btn--principal', icone: 'ok' });
  const annuler = bouton(h('span', {}, 'Annuler', h('span', { class: 'rgl-long' }, ' les changements')), { classe: 'btn--discret' });
  const erreurs = h('div', { class: 'rgl-erreurs', role: 'alert', hidden: true });
  const parcours = h('div', { class: 'rgl-parcours', dataset: { brouillon: CLE } });

  const majBarre = () => {
    const modifie = instantane() !== S.origine;
    const perso = S.sections.filter((s) => s.element.classList.contains('rgl-poste--perso')).length;
    etatBarre.replaceChildren(...(modifie
      ? [h('span', { class: 'rgl-barre__point', 'aria-hidden': 'true' }), 'Modifications non enregistrées']
      : [`Tout est enregistré · ${perso} section${perso > 1 ? 's' : ''} personnalisée${perso > 1 ? 's' : ''} sur ${S.sections.length}`]));
    enregistrer.disabled = !modifie;
    annuler.disabled = !modifie;
    barre.classList.toggle('rgl-barre--modifie', modifie);
  };
  S.modifie = () => {
    E.definirBrouillon(true, CLE);
    for (const s of S.sections) s.majEntete();
    majBarre();
  };

  const construire = () => {
    S.sections = [
      sectionIdentite(S, 1),
      sectionVocabulaire(S, 2),
      sectionEffectif(S, 3),
      sectionCharge(S, 4),
      sectionScore(S, 5),
      sectionListes(S, 6),
      sectionObjectifs(S, 7),
      sectionRoutines(S, 8),
      sectionProfil(S, 9),
      sectionMeta(S, 10),
    ];
    parcours.replaceChildren(...S.sections.map((s) => s.element));
  };
  construire();

  annuler.addEventListener('click', () => {
    S.reglages = cloner(d.reglages);
    S.nom = d.nom;
    S.court = d.court;
    S.erreursLocales.clear();
    erreurs.hidden = true;
    construire();
    E.definirBrouillon(false, CLE);
    majBarre();
    toast('Changements annulés.');
  });
  enregistrer.addEventListener('click', () => sauver(S, { d, parcours, erreurs, bouton: enregistrer, ctx }));

  const barre = h('div', { class: 'rgl-barre' }, etatBarre, h('div', { class: 'rgl-barre__boutons' }, annuler, enregistrer));
  zone.replaceChildren(
    h('p', { class: 'rgl-modele petit' }, icone('info', { classe: 'icone-texte' }),
      ` Modèle : ${d.modele.nom}${d.modele.editeur ? ` (${d.modele.editeur})` : ''}. Les changements valent pour tout l’espace de ce jeu dès l’enregistrement.`),
    parcours, erreurs, barre);
  majBarre();
}

// ——— Enregistrement ———

function controlesLocaux(S) {
  const sortie = [];
  if (S.nom.trim().length < 2) sortie.push({ chemin: 'nom', message: '2 caractères au moins' });
  if (!S.court.trim()) sortie.push({ chemin: 'court', message: 'obligatoire' });
  const v = S.reglages.vocabulaire;
  if (v) {
    for (const [a, b] of [['personnage', 'personnages'], ['carte', 'cartes']]) {
      if (!!v[a]?.trim() !== !!v[b]?.trim()) sortie.push({ chemin: `vocabulaire.${v[a]?.trim() ? b : a}`, message: 'remplis le singulier et le pluriel, ou laisse les deux vides' });
    }
  }
  return sortie;
}

function libelleErreur(parcours, e) {
  if (e.chemin === '(réglages)') {
    const [cle] = /^[A-Za-z]+/.exec(e.message) || [''];
    const t = trouverChamp(parcours, cle === 'profil' || cle === 'objectifs' ? cle : `listes.${cle}`);
    return { cible: t?.el || null, texte: t ? `${t.el.dataset.libelle} : ${e.message.replace(/^[A-Za-z]+ : /, '')}` : e.message };
  }
  const t = e.chemin ? trouverChamp(parcours, e.chemin) : null;
  if (!t) return { cible: null, texte: e.chemin ? `${e.chemin} : ${e.message}` : e.message };
  const ligne = /^\[(\d+)\]/.exec(t.reste);
  return { cible: t.el, texte: `${t.el.dataset.libelle || e.chemin}${ligne ? `, ligne ${Number(ligne[1]) + 1}` : ''} : ${e.libelleLocal || e.message}` };
}

function afficherErreurs(S, parcours, zoneErreurs, liste) {
  for (const el of parcours.querySelectorAll('[aria-invalid="true"]')) el.removeAttribute('aria-invalid');
  const lignes = liste.slice(0, 12).map((e) => {
    const { cible, texte } = libelleErreur(parcours, e);
    if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) cible.setAttribute('aria-invalid', 'true');
    return h('li', {}, cible
      ? h('button', {
        type: 'button', class: 'rgl-erreurs__lien',
        onclick: () => {
          ouvrirJusqua(cible);
          cible.scrollIntoView({ block: 'center' });
          (cible.matches('input, textarea, select') ? cible : cible.querySelector('input, textarea, select, button'))?.focus({ preventScroll: true });
        },
      }, texte)
      : texte);
  });
  zoneErreurs.replaceChildren(...[
    h('p', { class: 'rgl-erreurs__titre' }, icone('alerte'), `${liste.length} point${liste.length > 1 ? 's' : ''} à corriger avant d’enregistrer`),
    h('ul', { class: 'rgl-erreurs__liste' }, lignes),
    liste.length > 12 ? h('p', { class: 'texte-3 tres-petit' }, `… et ${liste.length - 12} autre(s).`) : null,
  ].filter(Boolean));
  zoneErreurs.hidden = false;
  zoneErreurs.scrollIntoView({ block: 'nearest' });
}

async function sauver(S, { parcours, erreurs, bouton: b, ctx }) {
  if (nettoyerRoutines(S)) S.sections.find((s) => s.cle === 'routines')?.redessiner();
  const valeur = cloner(S.reglages);
  // Une saisie invalide dont le champ a disparu (retour au modèle, élément retiré) ne bloque plus rien.
  for (const [cle, e] of S.erreursLocales) if (!e.ctrl?.isConnected) S.erreursLocales.delete(cle);
  const liste = [...S.erreursLocales.values(), ...controlesLocaux(S)];
  if (!liste.length) {
    const v = validerReglagesJeu(S.modele, valeur);
    if (!v.ok) liste.push(...v.erreurs);
  }
  if (liste.length) {
    afficherErreurs(S, parcours, erreurs, liste);
    return;
  }
  erreurs.hidden = true;
  b.disabled = true;
  b.setAttribute('aria-busy', 'true');
  const identite = S.nom.trim() !== E.jeu().nom || S.court.trim() !== E.jeu().court;
  try {
    await E.appeler('PUT', '/reglages-jeu', { valeur, revBase: S.rev, nom: S.nom.trim(), court: S.court.trim() });
    E.definirBrouillon(false, CLE);
    toast('Réglages du jeu enregistrés : tout l’espace de ce jeu les suit maintenant.');
    if (identite) await E.chargerSession();
    await E.rechargerTout();
  } catch (err) {
    b.disabled = false;
    b.removeAttribute('aria-busy');
    if (err.statut === 409 && err.details?.actuelle) {
      erreurs.replaceChildren(
        h('p', { class: 'rgl-erreurs__titre' }, icone('alerte'), 'Quelqu’un a modifié ces réglages pendant ton édition.'),
        h('p', { class: 'petit' }, 'Recharge la page pour partir de leur version : tes changements non enregistrés seront perdus (note-les avant si besoin).'),
        bouton('Recharger les réglages', { icone: 'actualiser', onclick: () => { E.definirBrouillon(false, CLE); ctx.rafraichir(); } }));
      erreurs.hidden = false;
      erreurs.scrollIntoView({ block: 'nearest' });
    } else if (Array.isArray(err.details) && err.details.length) {
      afficherErreurs(S, parcours, erreurs, err.details);
    } else {
      afficherErreurs(S, parcours, erreurs, [{ chemin: '', message: messageErreur(err) }]);
    }
  }
}

// ——— 1. Identité ———

function sectionIdentite(S, numero) {
  const m = S.modele;
  const autre = m.id === 'autre';
  return section(S, {
    cle: 'identite',
    numero,
    titre: 'Identité',
    intro: 'Le nom du jeu dans son espace et la navigation. L’identifiant de l’espace (son adresse) ne change jamais.',
    resume: () => `${S.nom.trim() || '—'} · ${S.court.trim() || '—'}`,
    personnalise: () => S.nom.trim() !== m.nom || S.court.trim() !== m.court,
    revenir: autre ? null : () => { S.nom = m.nom; S.court = m.court; },
    corps: () => h('div', { class: 'grille-champs' },
      texteReglage({ libelle: 'Nom du jeu', valeur: S.nom, max: 40, chemin: 'nom', contexte: 'Identité · nom du jeu', ecrire: (v) => { S.nom = v; S.modifie(); } }),
      texteReglage({ libelle: 'Nom court', valeur: S.court, max: 12, chemin: 'court', contexte: 'Identité · nom court', aide: 'Ses 4 premiers caractères forment la pastille du jeu.', ecrire: (v) => { S.court = v; S.modifie(); } }),
      h('p', { class: 'texte-3 petit champ--large' }, `Adresse : #/${E.jeu().id} · modèle ${m.nom}`)),
  });
}

// ——— 2. Vocabulaire ———

function vocabulaireModele(S) {
  return Object.fromEntries(MOTS.map((k) => [k, S.modele.vocabulaire?.[k] || '']));
}

function sectionVocabulaire(S, numero) {
  const lire = () => S.reglages.vocabulaire || vocabulaireModele(S);
  const paire = (v, a, b) => (v[a]?.trim() && v[b]?.trim() ? `${v[a].trim()} / ${v[b].trim()}` : null);
  return section(S, {
    cle: 'vocabulaire',
    numero,
    titre: 'Vocabulaire',
    intro: 'Les mots du jeu dans tout son espace. Laisse le singulier et le pluriel vides si le jeu n’a ni personnages ni maps : les pages et les champs liés disparaissent, les fiches existantes gardent leurs données.',
    resume: () => {
      const v = lire();
      return [paire(v, 'personnage', 'personnages') || 'sans personnages', paire(v, 'carte', 'cartes') || 'sans maps',
        v.manches?.trim() || 'manches', v.astuces?.trim() || 'astuces'].join(' · ');
    },
    personnalise: () => !!S.reglages.vocabulaire,
    revenir: () => { S.reglages.vocabulaire = null; },
    corps: () => {
      // Le brouillon lui-même s'il existe ; sinon une copie du modèle, qui devient le brouillon à la première saisie.
      const v = S.reglages.vocabulaire || vocabulaireModele(S);
      const ecrire = (k, val) => {
        if (!S.reglages.vocabulaire) S.reglages.vocabulaire = v;
        v[k] = val;
        S.modifie();
      };
      const ligne = (titre, a, b, aide, exemple) => h('fieldset', { class: 'rgl-paire' },
        h('legend', {}, titre),
        texteReglage({ libelle: 'Singulier', valeur: v[a], max: 20, chemin: `vocabulaire.${a}`, contexte: `Vocabulaire · ${titre.toLowerCase()} (singulier)`, placeholder: exemple[0], ecrire: (x) => ecrire(a, x) }),
        texteReglage({ libelle: 'Pluriel', valeur: v[b], max: 20, chemin: `vocabulaire.${b}`, contexte: `Vocabulaire · ${titre.toLowerCase()} (pluriel)`, placeholder: exemple[1], ecrire: (x) => ecrire(b, x) }),
        h('p', { class: 'texte-3 tres-petit rgl-paire__aide' }, aide));
      return h('div', { class: 'rgl-paires' },
        ligne('Personnages', 'personnage', 'personnages', 'Agents, champions, héros, légendes… Vide : le jeu n’a pas de personnages.', ['agent', 'agents']),
        ligne('Maps', 'carte', 'cartes', 'Maps, cartes, arènes… Vide : le jeu n’a pas de maps (ni pool, ni veto de maps).', ['map', 'maps']),
        ligne('Manches', 'manche', 'manches', 'Rounds, parties, buts… Vide : « manche ».', ['round', 'rounds']),
        ligne('Astuces', 'astuce', 'astuces', 'Lineups, astuces… dans la bibliothèque. Vide : « astuce ».', ['lineup', 'lineups']));
    },
  });
}

// ——— 3. Effectif ———

function sectionEffectif(S, numero) {
  const lire = () => S.reglages.equipe || { titulaires: S.modele.equipe.titulaires, remplacants: S.modele.equipe.remplacants };
  return section(S, {
    cle: 'equipe',
    numero,
    titre: 'Effectif',
    intro: 'Le nombre de titulaires fixe les places d’une compo et des scrims ; les remplaçants servent de repère au roster.',
    resume: () => `${lire().titulaires} titulaires, ${lire().remplacants} remplaçants`,
    personnalise: () => !!S.reglages.equipe,
    revenir: () => { S.reglages.equipe = null; },
    corps: () => {
      const e = S.reglages.equipe || { titulaires: S.modele.equipe.titulaires, remplacants: S.modele.equipe.remplacants };
      const ecrire = (k, val) => {
        if (!S.reglages.equipe) S.reglages.equipe = e;
        e[k] = val;
        S.modifie();
      };
      return h('div', { class: 'grille-champs rgl-etroit' },
        nombreReglage(S, { libelle: 'Titulaires', valeur: e.titulaires, min: 1, max: 12, chemin: 'equipe.titulaires', contexte: 'Effectif · titulaires', ecrire: (x) => ecrire('titulaires', x) }),
        nombreReglage(S, { libelle: 'Remplaçants', valeur: e.remplacants, min: 0, max: 10, chemin: 'equipe.remplacants', contexte: 'Effectif · remplaçants', ecrire: (x) => ecrire('remplacants', x) }));
    },
  });
}

// ——— 4. Charge d'entraînement (moniteur de santé) ———

function sectionCharge(S, numero) {
  const modele = () => ({ heuresMax: S.modele.charge?.heuresMax ?? 20, joursOffMin: S.modele.charge?.joursOffMin ?? 1 });
  const lire = () => S.reglages.charge || modele();
  return section(S, {
    cle: 'charge',
    numero,
    titre: 'Charge d’entraînement',
    intro: 'Le moniteur de santé prévient quand un joueur a plus d’heures planifiées dans la semaine que ce plafond, ou moins de jours sans séance que ce minimum.',
    resume: () => `${lire().heuresMax} h par semaine au plus, ${lire().joursOffMin} jour${lire().joursOffMin > 1 ? 's' : ''} off au moins`,
    personnalise: () => !!S.reglages.charge,
    revenir: () => { S.reglages.charge = null; },
    corps: () => {
      const c = S.reglages.charge || modele();
      const ecrire = (k, val) => {
        if (!S.reglages.charge) S.reglages.charge = c;
        c[k] = val;
        S.modifie();
      };
      return h('div', { class: 'grille-champs rgl-etroit' },
        nombreReglage(S, { libelle: 'Heures planifiées par semaine, au plus', valeur: c.heuresMax, min: 1, max: 80, chemin: 'charge.heuresMax', contexte: 'Charge · heures par semaine', ecrire: (x) => ecrire('heuresMax', x) }),
        nombreReglage(S, { libelle: 'Jours sans séance, au moins', valeur: c.joursOffMin, min: 0, max: 7, chemin: 'charge.joursOffMin', contexte: 'Charge · jours off', ecrire: (x) => ecrire('joursOffMin', x) }));
    },
  });
}
