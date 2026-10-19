// Recrutement : candidats proposés, avis du staff (pour, neutre, contre) avec commentaire, passage à l'essai.
// Rôles, rangs et personnages viennent du jeu affiché ; la chaîne Twitch d'un candidat se réduit à son nom.

import { h, vider, modale, confirmer, champ, saisie, zone, liste, bouton, toast, etatVide, messageErreur } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jetonRole, puce, signature } from '../composants/jetons.js';
import { lienProfil, lienTwitch } from '../composants/profil.js';
import { STATUTS_CANDIDAT, AVIS, libelle } from '/shared/referentiel.js';
import { nouvelId, chaineTwitch } from '/shared/validation.js';
import { champIdJeu, optionsListe } from './roster.js';

const TONS_AVIS = { pour: 'positif', neutre: 'info', contre: 'negatif' };

function decompte(cible) {
  const votes = E.votesDe(cible).filter((v) => v.avis);
  return Object.fromEntries(AVIS.map((a) => [a.id, votes.filter((v) => v.avis === a.id).length]));
}

function puceAvis(a, n) {
  return puce(`${n} ${a.nom.toLowerCase()}${a.id === 'neutre' && n > 1 ? 's' : ''}`, TONS_AVIS[a.id]);
}

// Chaîne Twitch : un nom de chaîne, ou une adresse twitch.tv réduite à son nom (même règle que le serveur).
function lireTwitch(texte) {
  const erreurs = [];
  const chaine = chaineTwitch()(texte, 'twitch', erreurs);
  return { chaine, valide: !erreurs.length };
}

function champTwitch(valeur) {
  const input = saisie({ valeur, maxlength: 100, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none', placeholder: 'nom_de_chaine ou twitch.tv/…' });
  const apercu = h('span', { class: 'champ__aide' });
  const maj = () => {
    vider(apercu);
    const { chaine, valide } = lireTwitch(input.value);
    if (valide) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
    if (!valide) apercu.append('Nom de chaîne non reconnu : 4 à 25 lettres, chiffres ou _.');
    else if (chaine) apercu.append('Lien : ', lienTwitch(chaine));
  };
  input.addEventListener('input', maj);
  maj();
  const element = champ('Chaîne Twitch', input, { aide: 'Facultatif. Le nom de la chaîne ou son adresse : seul le nom est gardé.' });
  element.append(apercu);
  return { element, input };
}

function editeur(c = null) {
  const nouveau = !c;
  const d = c || J.schemas().documentParDefaut('candidats', { pseudo: '' });
  const exemples = (E.meta()?.personnages || []).slice(0, 3).map((p) => p.nom).join(', ');
  const pseudo = saisie({ valeur: d.pseudo, maxlength: 24, required: true });
  const idJeu = champIdJeu(d.idJeu);
  const role = liste(optionsListe(J.roles(), J.roles(true), d.roleJeu), { valeur: d.roleJeu, vide: 'À définir' });
  const rang = liste(optionsListe(J.rangs(), J.rangs(true), d.rang), { valeur: d.rang, vide: 'Inconnu' });
  const personnages = J.aPersonnages() ? saisie({ valeur: d.personnages, maxlength: 120, placeholder: exemples ? `Ex. : ${exemples}` : '' }) : null;
  const twitch = champTwitch(d.twitch);
  const dispos = saisie({ valeur: d.disponibilites, maxlength: 200 });
  const source = saisie({ valeur: d.source, maxlength: 120, placeholder: 'Discord, recommandation, tryout…' });
  const notes = zone({ valeur: d.notes, lignes: 3, maxlength: 1000 });
  const statut = liste(STATUTS_CANDIDAT.map((s) => ({ valeur: s.id, libelle: s.nom })), { valeur: d.statut });
  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer(`Supprimer la candidature de ${d.pseudo} et les avis donnés ?`, { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('candidats', c._id);
        toast('Candidature supprimée.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Proposer' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const t = lireTwitch(twitch.input.value);
      if (!t.valide) throw new Error('Chaîne Twitch : 4 à 25 lettres, chiffres ou _, ou une adresse twitch.tv.');
      await E.enregistrer('candidats', c?._id || nouvelId('k'), {
        pseudo: pseudo.value.trim(), idJeu: idJeu.input.value.trim(), roleJeu: role.value, rang: rang.value,
        personnages: personnages ? personnages.value.trim() : d.personnages || '', twitch: t.chaine,
        disponibilites: dispos.value.trim(), source: source.value.trim(), notes: notes.value.trim(), statut: statut.value, membreId: d.membreId || '',
      }, { revBase: nouveau ? 0 : c.rev });
      toast(nouveau ? `Candidature de ${pseudo.value.trim()} proposée au staff.` : 'Candidature enregistrée.');
    },
  });
  modale({
    titre: nouveau ? 'Proposer un candidat' : d.pseudo,
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--3 champs-alignes' }, champ('Pseudo', pseudo), champ('Statut', statut), champ('Rôle', role), champ('Rang', rang),
        personnages ? champ(J.v('personnages', true), personnages, { aide: 'Ceux qu’il joue le plus.' }) : null),
      h('div', { class: 'grille-champs champs-alignes' }, idJeu.element, twitch.element),
      h('div', { class: 'grille-champs champs-alignes' }, champ('Disponibilités', dispos), champ('Source', source),
        champ('Notes', notes, { large: true, aide: 'Aucun nom réel ni âge : uniquement le jeu.' })),
    ],
    actions,
  });
}

async function voter(cible, avis, commentaire) {
  await E.appeler('PUT', `/votes/${encodeURIComponent(cible)}`, { valeur: { avis, commentaire } }, 'votes');
  toast('Avis enregistré.');
}

async function retirerAvis(cible) {
  await E.appeler('DELETE', `/votes/${encodeURIComponent(cible)}`);
  E.supprimerLocal('votes', `${cible}_${E.compte()._id}`);
  toast('Avis retiré.');
}

async function changerStatut(c, statut, message) {
  await E.enregistrer('candidats', c._id, { ...E.sansMeta(c), statut }, { revBase: c.rev });
  toast(message);
}

function detail(c) {
  const votes = E.votesDe(c._id).filter((v) => v.avis);
  const mien = E.monVote(c._id);
  const peutVoter = E.peut('recrutement.voter');
  const gerer = E.peut('recrutement.modifier');
  let fenetre = null;
  let avis = mien?.avis || 'pour';
  const commentaire = saisie({ valeur: mien?.commentaire || '', maxlength: 300, placeholder: 'Pourquoi ? (facultatif)', 'aria-label': 'Commentaire de mon avis' });
  const choixAvis = h('div', { class: 'onglets avis-choix', role: 'group', 'aria-label': 'Mon avis' }, AVIS.map((a) => h('button', {
    type: 'button', 'aria-pressed': String(avis === a.id),
    onclick: (e) => { avis = a.id; for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); },
  }, a.nom)));
  const retrait = mien ? bouton('Retirer mon avis', {
    classe: 'btn--discret btn--petit',
    onclick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        await retirerAvis(c._id);
        fenetre?.fermer();
      } catch (err) {
        fenetre?.signalerErreur(messageErreur(err));
        b.disabled = false;
      }
    },
  }) : null;

  const actions = [];
  if (gerer && c.statut === 'propose') {
    actions.push({
      libelle: 'Passer à l’essai',
      action: async () => {
        await E.appeler('POST', `/candidats/${encodeURIComponent(c._id)}/essai`, undefined, 'candidats');
        E.synchroniser();
        toast(`${c.pseudo} est à l’essai et apparaît dans le roster.`);
      },
    });
  }
  if (gerer && c.statut !== 'accepte') actions.push({ libelle: 'Accepter', action: () => changerStatut(c, 'accepte', `Candidature de ${c.pseudo} acceptée.`) });
  if (gerer && c.statut !== 'refuse') actions.push({ libelle: 'Refuser', action: () => changerStatut(c, 'refuse', `Candidature de ${c.pseudo} refusée.`) });
  if (gerer) actions.push({ libelle: 'Modifier', action: () => { setTimeout(() => editeur(E.doc('candidats', c._id) || c), 0); } });
  if (peutVoter) actions.push({ libelle: mien ? 'Changer mon avis' : 'Donner mon avis', classe: 'btn--principal', action: () => voter(c._id, avis, commentaire.value.trim()) });
  else actions.push({ libelle: 'Fermer', classe: 'btn--principal' });

  const infos = [
    c.idJeu ? [h('dt', {}, 'Identifiant en jeu'), h('dd', { class: 'rangee' }, h('span', {}, c.idJeu), lienProfil(c.idJeu))] : null,
    c.twitch ? [h('dt', {}, 'Twitch'), h('dd', {}, lienTwitch(c.twitch) || c.twitch)] : null,
    J.aPersonnages() && c.personnages ? [h('dt', {}, J.v('personnages', true)), h('dd', {}, c.personnages)] : null,
    c.disponibilites ? [h('dt', {}, 'Disponibilités'), h('dd', {}, c.disponibilites)] : null,
    c.source ? [h('dt', {}, 'Source'), h('dd', {}, c.source)] : null,
  ].filter(Boolean);
  const membre = c.membreId ? E.doc('membres', c.membreId) : null;

  fenetre = modale({
    titre: c.pseudo,
    large: true,
    contenu: [
      h('div', { class: 'rangee' }, jetonRole(c.roleJeu), c.rang ? puce(J.nomRang(c.rang), 'plein') : null, puce(libelle(STATUTS_CANDIDAT, c.statut), 'accent')),
      infos.length ? h('dl', { class: 'details' }, infos) : null,
      c.notes ? h('p', { class: 'texte-multi' }, c.notes) : null,
      membre ? h('p', { class: 'petit' }, `Au roster : ${membre.pseudo || 'poste à pourvoir'}. `, h('a', { href: J.lien('/roster') }, 'Voir le roster')) : null,
      h('div', { class: 'pile-s' }, h('h3', {}, `Avis du staff (${votes.length})`),
        votes.length ? h('ul', { class: 'liste-avis' }, votes.map((v) => h('li', {},
          puce(libelle(AVIS, v.avis), TONS_AVIS[v.avis]),
          h('strong', {}, E.nomCompte(v.compteId)),
          v.commentaire ? h('span', { class: 'texte-2 petit' }, v.commentaire) : null)))
          : h('p', { class: 'texte-3 petit' }, 'Aucun avis pour l’instant.')),
      peutVoter ? h('div', { class: 'pile-s' },
        h('div', { class: 'rangee rangee--espace' }, h('h3', {}, 'Mon avis'), retrait),
        choixAvis, commentaire) : null,
      signature(c),
    ],
    actions,
  });
}

function carteCandidat(c, colonne) {
  const n = decompte(c._id);
  const twitch = c.twitch ? lienTwitch(c.twitch) : null;
  const manque = colonne === 'propose' && E.peut('recrutement.voter') && !E.monVote(c._id);
  return h('article', { class: 'fiche fiche--serree candidat' },
    h('button', { type: 'button', class: 'candidat__ouvrir', 'aria-haspopup': 'dialog', onclick: () => detail(c) }, c.pseudo),
    h('div', { class: 'rangee' }, jetonRole(c.roleJeu, { court: true }), c.rang ? h('span', { class: 'texte-3 tres-petit' }, J.nomRang(c.rang)) : null),
    twitch ? h('div', { class: 'candidat__lien' }, twitch) : null,
    AVIS.some((a) => n[a.id]) || manque ? h('div', { class: 'rangee' },
      AVIS.map((a) => (n[a.id] ? puceAvis(a, n[a.id]) : null)),
      manque ? puce('Ton avis manque', 'attention') : null) : null);
}

export function rendre(page) {
  const candidats = E.liste('candidats');
  const gerer = E.peut('recrutement.modifier');
  const proposer = () => bouton('Proposer un candidat', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeur() });
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Recrutement'),
      h('p', { class: 'entete-page__intro' }, 'Chaque candidat est proposé, le staff donne son avis, puis le head coach ou le Responsable décide : essai, accepté ou refusé. Un candidat à l’essai rejoint le roster.')),
    gerer && candidats.length ? h('div', { class: 'entete-page__actions' }, proposer()) : null));
  if (!candidats.length) {
    page.append(etatVide('Aucun candidat pour l’instant.', gerer ? proposer() : null));
    return;
  }
  page.append(h('div', { class: 'colonnes-recrutement' }, STATUTS_CANDIDAT.map((s) => {
    const groupe = candidats.filter((c) => c.statut === s.id).sort((a, b) => (b.maj?.le || '').localeCompare(a.maj?.le || ''));
    return h('section', { class: 'pile-s recrutement-colonne' },
      h('h2', { class: 'recrutement-colonne__titre' }, s.nom, h('span', { class: 'texte-3' }, ` ${groupe.length}`)),
      groupe.length ? groupe.map((c) => carteCandidat(c, s.id)) : h('p', { class: 'texte-3 petit' }, 'Aucun.'));
  })));
}
