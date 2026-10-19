// Planning : semaine type (ébauches du jeu à adapter) et une fiche par semaine, bloc par bloc.
// Types de blocs, ébauches et maps viennent du jeu affiché.

import { h, modale, confirmer, champ, saisie, zone, liste, caseACocher, onglets, bouton, toast, etatVide, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { agenda, navSemaine, libelleSemaine, dureeBloc, publicDuBloc, titreBloc, legendeBlocs, idSeance, SANS_COMPTE_RENDU } from '../composants/grille.js';
import { optionsMaps, nomMap, signature } from '../composants/jetons.js';
import { copierTexte, telecharger } from '../composants/sorties.js';
import { conflitsDe, oublierConflits, encadreConflits, marqueConflit, ouvrirCompteRendu, lireCompteRendu } from './planning-suivi.js';
import { texteSemaine } from '/shared/discord.js';
import { agendaIcs } from '/shared/exports.js';
import { ebaucheParId, blocsDepuisEbauche, ebauchePourPalier } from '/shared/jeux/contenus.js';
import { JOURS, PUBLICS_BLOC } from '/shared/referentiel.js';
import { MOTIFS, nouvelId } from '/shared/validation.js';
import { MARQUE } from '/shared/marque.js';
import { dateCivile, semaineIso, aujourdhui, joursDe, minutes, hhmm, dureeLisible, ilYA } from '/shared/temps.js';

const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

// Résumé de la semaine, valable pour tous les jeux : blocs communs (scrim, match, VOD) et temps de travail.
function resume(blocs) {
  const collectifs = blocs.filter((b) => b.pour !== 'individuel' && b.type !== 'repos');
  const seul = blocs.filter((b) => b.pour === 'individuel' && b.type !== 'repos');
  const total = (l) => l.reduce((s, b) => s + dureeBloc(b), 0);
  const compte = (type) => blocs.filter((b) => b.type === type).length;
  return [
    `${dureeLisible(total(collectifs))} en collectif`,
    seul.length ? `${dureeLisible(total(seul))} chacun de son côté` : null,
    pluriel(compte('scrim'), 'scrim'),
    compte('match') ? pluriel(compte('match'), 'match officiel', 'matchs officiels') : null,
    compte('vod') ? pluriel(compte('vod'), 'VOD review', 'VOD reviews') : null,
  ].filter(Boolean).join(', ');
}

// Types proposés : ceux du jeu (sans les masqués), plus le type actuel du bloc s'il a été masqué depuis.
function optionsTypes(actuel) {
  const actifs = J.typesBloc();
  const ancien = actuel && !actifs.some((t) => t.id === actuel) ? J.typesBloc(true).find((t) => t.id === actuel) : null;
  return [...actifs, ...(ancien ? [ancien] : [])].map((t) => ({ valeur: t.id, libelle: t.nom }));
}

function typeParDefaut() {
  const actifs = J.typesBloc();
  return (actifs.find((t) => t.id === 'scrim') || actifs[0])?.id || 'autre';
}

// Signature de la fiche : une semaine écrite par le serveur vient de la semaine type (ou de l'ébauche d'activation).
function signaturePlanning(fiche, modeModele) {
  if (fiche?.maj?.par !== 'systeme') return signature(fiche);
  return h('span', { class: 'signature' }, modeModele
    ? `Ébauche chargée à l’activation du jeu, ${ilYA(fiche.maj.le)}`
    : `Créée automatiquement depuis la semaine type, ${ilYA(fiche.maj.le)}`);
}

export function rendre(page, params, ctx) {
  const def = J.def();
  const courante = semaineIso(dateCivile(new Date()));
  const modeModele = params[0] === 'modele';
  const semaine = !modeModele && MOTIFS.semaine.test(params[0] || '') ? params[0] : courante;
  const id = modeModele ? 'modele' : semaine;
  const fiche = E.doc('planning', id);
  const blocs = fiche?.blocs || [];
  const editable = E.peut('planning.modifier');
  const ebauches = def.ebauches || [];
  const carte = J.v('carte');

  async function sauver(nouveaux, extra = {}) {
    const actuel = E.doc('planning', id);
    await E.enregistrer('planning', id, { note: '', ebauche: '', ...E.sansMeta(actuel), blocs: nouveaux, ...extra }, { revBase: actuel?.rev ?? 0 });
    if (!modeModele) oublierConflits(semaine);
  }

  function editeurBloc(bloc = null) {
    const nouveau = !bloc;
    const b = bloc || { id: nouvelId('b'), jour: 2, debut: '20:00', fin: '21:30', type: typeParDefaut(), titre: '', details: '', pour: 'equipe', membres: [], map: '' };
    const jour = liste(JOURS.map((j) => ({ valeur: String(j.n), libelle: j.nom })), { valeur: String(b.jour) });
    const debut = saisie({ type: 'time', valeur: b.debut, step: 300, required: true });
    const fin = saisie({ type: 'time', valeur: b.fin, step: 300, required: true });
    const type = liste(optionsTypes(b.type), { valeur: b.type });
    const titre = saisie({ valeur: b.titre, maxlength: 60, placeholder: J.nomTypeBloc(b.type) });
    const details = zone({ valeur: b.details, lignes: 3, maxlength: 500 });
    const pour = liste(PUBLICS_BLOC.map((p) => ({ valeur: p.id, libelle: p.nom })), { valeur: b.pour });
    // Map du bloc : seulement pour un jeu à map pool ; une map sortie du pool depuis reste proposée.
    const pool = (E.meta()?.mapPool || []);
    const map = J.aPool()
      ? liste(optionsMaps({ horsPool: !!b.map && !pool.includes(b.map) }), { valeur: b.map || '', vide: `Aucune ${carte} en particulier` })
      : null;
    const cases = E.membresActifs().map((m) => ({ m, ...caseACocher(m.pseudo || 'Poste à pourvoir', { coche: (b.membres || []).includes(m._id) }) }));
    const blocMembres = h('div', { class: 'champ champ--large' }, h('span', { class: 'champ__label' }, 'Membres concernés'), h('div', { class: 'cases' }, cases.map((c) => c.element)));
    const majMembres = () => { blocMembres.hidden = pour.value !== 'choix'; };
    pour.addEventListener('change', majMembres);
    majMembres();
    type.addEventListener('change', () => {
      titre.placeholder = J.nomTypeBloc(type.value);
      const duree = J.typesBloc(true).find((t) => t.id === type.value)?.duree || 60;
      fin.value = hhmm(Math.min(minutes(debut.value || '20:00') + duree, 1440));
    });

    const actions = [];
    if (!nouveau) {
      actions.push({
        libelle: 'Supprimer',
        classe: 'btn--danger',
        action: async () => {
          await sauver(blocs.filter((x) => x.id !== b.id));
          toast('Bloc supprimé.');
        },
      });
    }
    actions.push({ libelle: 'Annuler' }, {
      libelle: nouveau ? 'Ajouter le bloc' : 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const finMin = fin.value === '00:00' ? 1440 : minutes(fin.value);
        if (!debut.value || !fin.value || finMin <= minutes(debut.value)) throw new Error('L’heure de fin doit être après l’heure de début.');
        const valeur = {
          id: b.id,
          jour: Number(jour.value),
          debut: debut.value,
          fin: fin.value === '00:00' ? '24:00' : fin.value,
          type: type.value,
          titre: titre.value.trim(),
          details: details.value.trim(),
          pour: pour.value,
          membres: pour.value === 'choix' ? cases.filter((c) => c.input.checked).map((c) => c.m._id) : [],
          map: map ? map.value : (b.map || ''),
        };
        await sauver(nouveau ? [...blocs, valeur] : blocs.map((x) => (x.id === b.id ? valeur : x)));
        toast(nouveau ? 'Bloc ajouté.' : 'Bloc enregistré.');
      },
    });

    modale({
      titre: nouveau ? 'Nouveau bloc' : 'Modifier le bloc',
      contenu: h('div', { class: 'grille-champs' },
        champ('Jour', jour), champ('Type', type),
        champ('Début', debut), champ('Fin', fin),
        champ('Titre', titre, { aide: 'Facultatif : le type sert de titre par défaut.' }), champ('Pour qui', pour),
        blocMembres,
        map ? champ(J.v('carte', true), map) : null,
        champ('Détails', details, { large: true, aide: 'Contenu de la séance, consignes, liens utiles.' })),
      actions,
    });
  }

  function detailBloc(b) {
    modale({
      titre: titreBloc(b),
      contenu: h('dl', { class: 'details' },
        h('dt', {}, 'Quand'), h('dd', {}, `${JOURS[b.jour - 1].nom}, ${b.debut}–${b.fin} (${dureeLisible(dureeBloc(b))})`),
        h('dt', {}, 'Type'), h('dd', {}, J.nomTypeBloc(b.type)),
        h('dt', {}, 'Pour qui'), h('dd', {}, publicDuBloc(b)),
        b.map && J.aCartes() ? [h('dt', {}, J.v('carte', true)), h('dd', {}, nomMap(b.map))] : null,
        b.details ? [h('dt', {}, 'Détails'), h('dd', { class: 'texte-multi' }, b.details)] : null),
      actions: [{ libelle: 'Fermer', classe: 'btn--principal' }],
    });
  }

  // Ébauche proposée : celle déjà chargée, sinon celle du palier visé par l'équipe.
  function ebaucheConseillee() {
    if (fiche?.ebauche && ebaucheParId(def, fiche.ebauche)) return fiche.ebauche;
    return ebauchePourPalier(def, J.palier(E.equipe().palierVise)?.n || 3);
  }

  function choisirEbauche() {
    let choix = ebaucheConseillee();
    const cartes = h('div', { class: 'ebauches', role: 'radiogroup', 'aria-label': 'Ébauches' }, ebauches.map((e) => {
      const radio = h('input', { type: 'radio', name: 'ebauche', value: e.id, checked: e.id === choix, onchange: () => { choix = e.id; } });
      return h('label', { class: 'ebauche' }, radio,
        h('span', { class: 'ebauche__nom' }, e.nom),
        h('span', { class: 'texte-3 petit' }, [e.pour, e.volume?.toLowerCase()].filter(Boolean).join(', ')),
        e.resume ? h('span', { class: 'petit' }, e.resume) : null);
    }));
    modale({
      titre: `Charger une ébauche ${def.nom}`,
      large: true,
      contenu: [h('p', { class: 'texte-2' }, 'L’ébauche remplace les blocs actuels. Tu l’adaptes ensuite bloc par bloc à vos créneaux.'), cartes],
      actions: [{ libelle: 'Annuler' }, {
        libelle: 'Charger',
        classe: 'btn--principal',
        action: async () => {
          await sauver(blocsDepuisEbauche(def, choix), { ebauche: choix });
          toast(`Ébauche « ${ebaucheParId(def, choix)?.nom || choix} » chargée.`);
        },
      }],
    });
  }

  async function copierModele() {
    const modele = E.doc('planning', 'modele');
    if (!modele?.blocs?.length) return toast('La semaine type est vide.', { type: 'erreur' });
    if (blocs.length && !(await confirmer('Les blocs de cette semaine seront remplacés par ceux de la semaine type.', { libelle: 'Remplacer' }))) return;
    try {
      await sauver(modele.blocs.map((b) => ({ ...b, id: nouvelId('b') })), { ebauche: modele.ebauche || '' });
      toast('Semaine type copiée.');
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    }
  }

  function modifierNote() {
    const note = zone({ valeur: fiche?.note || '', lignes: 4, maxlength: 500 });
    modale({
      titre: 'Note de la semaine',
      contenu: champ('Note visible par toute l’équipe', note),
      actions: [{ libelle: 'Annuler' }, { libelle: 'Enregistrer', classe: 'btn--principal', action: () => sauver(blocs, { note: note.value.trim() }) }],
    });
  }

  // Séances qui concernent la personne connectée ; un compte sans fiche membre (staff, administration) reçoit toute la semaine.
  function meConcerne(b, moi) {
    if (b.type === 'repos') return false;
    if (!moi) return true;
    if (b.pour === 'choix') return (b.membres || []).includes(moi._id);
    if (moi.type === 'staff') return b.pour !== 'individuel';
    if (b.pour === 'staff') return false;
    return b.pour !== 'titulaires' || moi.statut === 'titulaire';
  }

  function exporterAgenda() {
    const moi = E.monMembre();
    const miens = blocs.filter((b) => meConcerne(b, moi));
    if (!miens.length) {
      toast('Aucune séance ne te concerne cette semaine.', { type: 'erreur' });
      return;
    }
    const nomCalendrier = `${E.equipe().tag || MARQUE.nom} ${E.jeu().court}, semaine ${semaine.slice(-2)}`;
    telecharger(`${MARQUE.id}-${E.jeu().id}-${semaine}.ics`, agendaIcs({ def, semaine, blocs: miens, nomCalendrier, nomMap }), 'text/calendar;charset=utf-8');
    toast('Fichier agenda téléchargé : ouvre-le pour l’ajouter à ton agenda.');
  }

  function copierDiscord() {
    const titre = `${E.jeu().nom} · ${modeModele ? 'Semaine type' : libelleSemaine(semaine)}`;
    copierTexte(texteSemaine({ def, titre, blocs, nomMap }));
  }

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Planning'),
      h('p', { class: 'entete-page__intro' }, 'La semaine type sert de base : chaque lundi, la semaine se crée toute seule à partir d’elle, puis le staff l’ajuste selon les scrims et les matchs. Les blocs « chacun de son côté » renvoient au programme individuel.')),
    h('div', { class: 'entete-page__actions' },
      editable ? bouton('Ajouter un bloc', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeurBloc() }) : null,
      editable && ebauches.length ? bouton('Charger une ébauche', { onclick: choisirEbauche }) : null,
      editable && !modeModele ? bouton('Copier la semaine type', { onclick: copierModele }) : null,
      blocs.length ? bouton('Copier pour Discord', { icone: 'discord', onclick: copierDiscord }) : null,
      blocs.length && !modeModele ? bouton('Ajouter à mon agenda', { icone: 'agenda', onclick: exporterAgenda }) : null)));

  page.append(h('div', { class: 'barre-outils' },
    onglets([{ valeur: 'semaine', libelle: 'Semaines' }, { valeur: 'modele', libelle: 'Semaine type' }], modeModele ? 'modele' : 'semaine',
      (v) => ctx.aller(J.lien(v === 'modele' ? '/planning/modele' : '/planning')), { libelle: 'Affichage' }),
    modeModele ? null : navSemaine(semaine, courante, (s) => ctx.aller(J.lien(`/planning/${s}`)))));

  const ebaucheFiche = fiche?.ebauche ? ebaucheParId(def, fiche.ebauche)?.nom || fiche.ebauche : '';
  const sousTitre = modeModele
    ? `Semaine type${ebaucheFiche ? `, d’après l’ébauche « ${ebaucheFiche} »` : ''}`
    : libelleSemaine(semaine);
  page.append(h('div', { class: 'rangee rangee--espace planning-resume' },
    h('div', {}, h('strong', {}, sousTitre), h('p', { class: 'texte-3 petit' }, blocs.length ? resume(blocs) : 'Aucun bloc.')),
    signaturePlanning(fiche, modeModele)));

  if (fiche?.note || editable) {
    page.append(h('div', { class: 'note-semaine' },
      h('p', { class: fiche?.note ? 'texte-multi' : 'texte-3' }, fiche?.note || 'Aucune note pour cette semaine.'),
      editable ? bouton('Modifier la note', { classe: 'btn--discret btn--petit', icone: 'modifier', onclick: modifierNote }) : null));
  }

  if (!blocs.length) {
    page.append(etatVide(modeModele ? 'La semaine type est vide : charge une ébauche pour démarrer.' : 'Rien de prévu cette semaine pour l’instant.',
      editable ? h('div', { class: 'rangee' },
        modeModele ? null : bouton('Copier la semaine type', { classe: 'btn--principal', onclick: copierModele }),
        ebauches.length ? bouton('Charger une ébauche', { onclick: choisirEbauche }) : null) : null));
    return;
  }

  // Semaine datée : conflits avec les autres jeux et comptes rendus des séances passées ou du jour.
  const auj = aujourdhui();
  const dates = modeModele ? null : joursDe(semaine);
  const conflits = modeModele ? null : conflitsDe(semaine, { page, ctx });
  const peutRendreCompte = E.peut('presences.modifier');
  function decorer(b) {
    if (modeModele) return {};
    const siens = (conflits || []).filter((c) => c.blocId === b.id);
    const cr = E.doc('seances', idSeance(semaine, b.id));
    let action = null;
    if (cr) {
      action = h('button', { type: 'button', class: 'bloc__action bloc__action--fait', 'aria-label': `Lire le compte rendu de « ${titreBloc(b)} »`, onclick: () => lireCompteRendu({ semaine, bloc: b }) },
        icone('compteRendu'), 'Compte rendu');
    } else if (peutRendreCompte && !SANS_COMPTE_RENDU.has(b.type) && dates[b.jour - 1].iso <= auj) {
      action = h('button', { type: 'button', class: 'bloc__action', 'aria-label': `Écrire le compte rendu de « ${titreBloc(b)} »`, onclick: () => ouvrirCompteRendu({ semaine, bloc: b }) },
        icone('ajouter'), 'Compte rendu');
    }
    return { haut: siens.length ? [marqueConflit(siens)] : [], bas: [action], classes: [siens.length && 'bloc--conflit'] };
  }
  const encadre = conflits ? encadreConflits(conflits, blocs) : null;
  if (encadre) page.append(encadre);
  page.append(agenda(blocs, { semaine: modeModele ? null : semaine, aujourdhui: auj, surClic: editable ? editeurBloc : detailBloc, decorer }));
  const legende = legendeBlocs(blocs);
  if (legende) page.append(legende);
}
