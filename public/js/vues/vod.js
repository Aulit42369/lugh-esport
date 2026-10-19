// VOD review : file des VOD à revoir, notes horodatées par joueur et actions à retenir.
// La map n'est proposée que si le jeu a des maps ; les catégories de notes sont communes à tous les jeux.

import { h, modale, confirmer, champ, saisie, zone, liste, bouton, toast, etatVide, messageErreur, lienExterne } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jour } from '../navigation.js';
import { nomMap, optionsMaps, puce, signature } from '../composants/jetons.js';
import { copierTexte } from '../composants/sorties.js';
import { titreScrim } from './scrims-saisie.js';
import { texteActionsVod } from '/shared/discord.js';
import { STATUTS_VOD, CATEGORIES_NOTE, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { formatDate } from '/shared/temps.js';

const TONS_VOD = { arevoir: 'attention', encours: 'info', revue: 'positif' };
let filtreMembre = '';

function secondes(t) {
  if (!t) return Infinity;
  return t.split(':').map(Number).reduce((s, n) => s * 60 + n, 0);
}

const nomDe = (membreId) => (membreId ? E.nomMembre(E.doc('membres', membreId)) : 'Équipe');

function editeurVod(v = null) {
  const nouvelle = !v;
  const d = v || { titre: '', lien: '', date: jour(), map: '', statut: 'arevoir', consigne: '' };
  const titre = saisie({ valeur: d.titre, maxlength: 80, required: true });
  const lien = saisie({ type: 'url', valeur: d.lien, placeholder: 'https://…', maxlength: 500 });
  const date = saisie({ type: 'date', valeur: d.date });
  let options = J.aCartes() ? optionsMaps({ horsPool: true }) : [];
  if (d.map && !options.flatMap((o) => o.options || [o]).some((o) => o.valeur === d.map)) options = [...options, { valeur: d.map, libelle: nomMap(d.map) }];
  const map = J.aCartes() ? liste(options, { valeur: d.map, vide: 'Aucune' }) : null;
  const statut = liste(STATUTS_VOD.map((s) => ({ valeur: s.id, libelle: s.nom })), { valeur: d.statut });
  const consigne = zone({ valeur: d.consigne, lignes: 3, maxlength: 500 });
  const actions = [];
  if (!nouvelle) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer('Supprimer cette VOD et toutes ses notes ?', { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('vods', v._id);
        window.location.hash = J.lien('/vod');
        toast('VOD supprimée.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouvelle ? 'Ajouter la VOD' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      if (!titre.value.trim()) throw new Error('Donne un titre à la VOD.');
      const id = v?._id || nouvelId('v');
      await E.enregistrer('vods', id, {
        titre: titre.value.trim(), lien: lien.value.trim(), date: date.value, map: map ? map.value : (d.map || ''), statut: statut.value,
        consigne: consigne.value.trim(), scrimId: d.scrimId || '',
      }, { revBase: nouvelle ? 0 : v.rev });
      if (nouvelle) window.location.hash = J.lien(`/vod/${id}`);
    },
  });
  modale({
    titre: nouvelle ? 'Nouvelle VOD' : 'Modifier la VOD',
    contenu: h('div', { class: 'grille-champs' },
      champ('Titre', titre, { large: true }), champ('Lien', lien, { large: true, aide: 'YouTube, Twitch, Medal… en https.' }),
      champ('Date', date), map ? champ(J.v('carte', true), map) : null, champ('Statut', statut),
      champ('Ce qu’on cherche', consigne, { large: true, aide: 'Consigne de visionnage pour l’équipe.' })),
    actions,
  });
}

function formulaireNote(vodId, note = null) {
  const temps = saisie({ valeur: note?.temps || '', placeholder: '12:34', maxlength: 8, inputmode: 'numeric', pattern: '(\\d{1,2}:)?\\d{1,2}:\\d{2}' });
  const membres = E.membresActifs();
  const choix = membres.map((m) => ({ valeur: m._id, libelle: E.nomMembre(m) }));
  if (note?.membre && !membres.some((m) => m._id === note.membre)) choix.push({ valeur: note.membre, libelle: nomDe(note.membre) });
  const membre = liste(choix, { valeur: note?.membre || '', vide: 'Toute l’équipe' });
  const categorie = liste(CATEGORIES_NOTE.map((c) => ({ valeur: c.id, libelle: c.nom })), { valeur: note?.categorie || 'decision' });
  const texte = zone({ valeur: note?.texte || '', lignes: 3, maxlength: 500, required: true });
  const action = saisie({ valeur: note?.action || '', maxlength: 200, placeholder: 'Ce qu’on change concrètement' });
  return {
    contenu: h('div', { class: 'grille-champs grille-champs--3' },
      champ('Moment', temps, { aide: 'mm:ss dans la vidéo' }), champ('Concerne', membre), champ('Catégorie', categorie),
      champ('Observation', texte, { large: true }), champ('Action', action, { large: true, aide: 'Facultatif : reprise dans « Actions à retenir ».' })),
    lire() {
      if (!texte.value.trim()) throw new Error('Écris l’observation.');
      if (temps.value.trim() && !/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(temps.value.trim())) throw new Error('Moment au format mm:ss, par exemple 12:34.');
      return { vodId, temps: temps.value.trim(), membre: membre.value, categorie: categorie.value, texte: texte.value.trim(), action: action.value.trim() };
    },
  };
}

function ajouterNote(vodId) {
  const f = formulaireNote(vodId);
  modale({
    titre: 'Nouvelle note',
    contenu: f.contenu,
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Ajouter',
      classe: 'btn--principal',
      action: async () => {
        await E.appeler('POST', '/vod-notes', { valeur: f.lire() }, 'vodNotes');
        toast('Note ajoutée.');
      },
    }],
  });
}

function modifierNote(n) {
  const f = formulaireNote(n.vodId, n);
  modale({
    titre: 'Modifier la note',
    contenu: f.contenu,
    actions: [
      {
        libelle: 'Supprimer',
        classe: 'btn--danger',
        action: async () => {
          if (!(await confirmer('Supprimer cette note ?', { libelle: 'Supprimer', danger: true }))) return false;
          await E.appeler('DELETE', `/vod-notes/${encodeURIComponent(n._id)}`);
          E.supprimerLocal('vodNotes', n._id);
          toast('Note supprimée.');
        },
      },
      { libelle: 'Annuler' },
      {
        libelle: 'Enregistrer',
        classe: 'btn--principal',
        action: async () => {
          await E.appeler('PUT', `/vod-notes/${encodeURIComponent(n._id)}`, { valeur: f.lire() }, 'vodNotes');
          toast('Note enregistrée.');
        },
      },
    ],
  });
}

function vueFile(page) {
  const vods = E.liste('vods').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const notes = E.liste('vodNotes');
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'VOD review'),
      h('p', { class: 'entete-page__intro' }, 'Chacun note ce qu’il voit, au moment précis de la vidéo. Le staff transforme les notes en actions pour la semaine.')),
    E.peut('vod.modifier') ? h('div', { class: 'entete-page__actions' }, bouton('Ajouter une VOD', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeurVod() })) : null));
  if (!vods.length) {
    page.append(etatVide('Aucune VOD dans la file. Ajoute la vidéo d’un scrim depuis la page Scrims et matchs, ou ici.'));
    return;
  }
  page.append(h('div', { class: 'colonnes-vod' }, STATUTS_VOD.map((s) => {
    const groupe = vods.filter((v) => v.statut === s.id);
    return h('section', { class: ['pile-s colonne-vod', `colonne-vod--${s.id}`] },
      h('h2', { class: 'colonne-vod__titre' }, s.nom, h('span', { class: 'texte-3' }, ` ${groupe.length}`)),
      groupe.length ? groupe.map((v) => {
        const n = notes.filter((x) => x.vodId === v._id);
        const actions = n.filter((x) => x.action).length;
        return h('a', { href: J.lien(`/vod/${v._id}`), class: 'fiche fiche--serree carte-vod' },
          h('strong', {}, v.titre),
          h('span', { class: 'texte-3 petit' }, [v.map ? nomMap(v.map) : null, v.date ? formatDate(v.date) : null,
            `${n.length} note${n.length > 1 ? 's' : ''}`, actions ? `${actions} action${actions > 1 ? 's' : ''}` : null].filter(Boolean).join(', ')));
      }) : h('p', { class: 'texte-3 petit' }, 'Aucune.'));
  })));
}

function vueDetail(page, id, ctx) {
  const v = E.doc('vods', id);
  page.append(h('a', { href: J.lien('/vod'), class: 'retour' }, icone('gauche'), 'File des VOD'));
  if (!v) {
    page.append(etatVide('Cette VOD n’existe plus.'));
    return;
  }
  const moi = E.compte();
  const toutes = E.liste('vodNotes').filter((n) => n.vodId === id).sort((a, b) => secondes(a.temps) - secondes(b.temps));
  const notes = toutes.filter((n) => !filtreMembre || n.membre === filtreMembre || (filtreMembre === 'equipe' && !n.membre));
  const scrim = v.scrimId ? E.doc('scrims', v.scrimId) : null;
  const actions = toutes.filter((n) => n.action);

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, v.titre),
      h('div', { class: 'rangee' }, puce(libelle(STATUTS_VOD, v.statut), TONS_VOD[v.statut]), v.map ? puce(nomMap(v.map), 'plein') : null,
        v.date ? puce(formatDate(v.date)) : null, scrim ? puce(`Résultat : ${titreScrim(scrim)}`) : null),
      v.consigne ? h('p', { class: 'entete-page__intro' }, v.consigne) : null),
    h('div', { class: 'entete-page__actions' },
      v.lien ? lienExterne(v.lien, 'Ouvrir la vidéo', { classe: 'btn btn--principal' }) : null,
      E.peut('vod.noter') ? bouton('Ajouter une note', { icone: 'ajouter', onclick: () => ajouterNote(id) }) : null,
      E.peut('vod.modifier') ? bouton('Modifier', { icone: 'modifier', classe: 'btn--discret', onclick: () => editeurVod(v) }) : null)));

  const membres = [...new Set(toutes.map((n) => n.membre).filter(Boolean))];
  page.append(h('div', { class: 'barre-outils' },
    liste([{ valeur: 'equipe', libelle: 'Toute l’équipe' }, ...membres.map((m) => ({ valeur: m, libelle: nomDe(m) }))],
      { valeur: filtreMembre, vide: 'Toutes les notes', 'aria-label': 'Filtrer les notes', class: 'saisie saisie--compacte', onchange: (e) => { filtreMembre = e.target.value; ctx.rafraichir(); } }),
    signature(v)));

  page.append(h('div', { class: 'grille-vod' },
    h('section', {},
      h('h2', { class: 'section__entete' }, 'Notes'),
      notes.length ? h('ol', { class: 'chronologie' }, notes.map((n) => {
        const modifiable = n.auteur === moi?._id || E.peut('vod.modifier');
        return h('li', { class: 'chronologie__note' },
          h('span', { class: 'chronologie__temps' }, n.temps || '—'),
          h('div', { class: 'pile-s' },
            h('div', { class: 'rangee' }, puce(libelle(CATEGORIES_NOTE, n.categorie), n.categorie === 'positif' ? 'positif' : ''), h('strong', { class: 'petit' }, nomDe(n.membre))),
            h('p', { class: 'texte-multi' }, n.texte),
            n.action ? h('p', { class: 'chronologie__action' }, icone('droite'), n.action) : null,
            h('span', { class: 'signature' }, `Par ${E.nomCompte(n.auteur)}`)),
          modifiable ? h('button', { type: 'button', class: 'btn btn--discret btn--icone', 'aria-label': 'Modifier la note', onclick: () => modifierNote(n) }, icone('modifier')) : null);
      })) : h('p', { class: 'texte-3' }, toutes.length ? 'Aucune note pour ce filtre.' : 'Pas encore de note. Lance la vidéo et note les moments clés.')),
    h('aside', { class: 'fiche' },
      h('h2', {}, 'Actions à retenir'),
      actions.length ? h('ul', { class: 'liste-puces' }, actions.map((n) => h('li', {}, h('strong', {}, `${nomDe(n.membre)} : `), n.action))) : h('p', { class: 'texte-3 petit' }, 'Aucune action pour l’instant.'),
      actions.length ? bouton('Copier pour Discord', { icone: 'discord', classe: 'btn--petit', onclick: () => copierTexte(texteActionsVod(v, toutes, nomDe)) }) : null,
      E.peut('vod.modifier') && v.statut !== 'revue' ? bouton('Marquer comme revue', {
        icone: 'ok',
        onclick: async () => {
          try {
            await E.enregistrer('vods', v._id, { ...E.sansMeta(v), statut: 'revue' }, { revBase: v.rev });
            toast('VOD marquée comme revue.');
          } catch (err) {
            toast(messageErreur(err), { type: 'erreur' });
          }
        },
      }) : null)));
}

export function rendre(page, params, ctx) {
  if (params[0]) vueDetail(page, params[0], ctx);
  else vueFile(page);
}
