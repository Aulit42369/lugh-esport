// Gestion du jeu, comptes : les comptes qui ont accès à ce jeu, leurs métiers ici et leur fiche du roster.
// Un Responsable ne change le nom, le mot de passe ou l'activation d'un compte, et ne le supprime, que si ce compte
// n'a accès qu'à des jeux qu'il gère (« gerable », décidé par le serveur) ; sinon il retire seulement l'accès à ce jeu.

import { h, modale, confirmer, champ, saisie, liste, caseACocher, bouton, toast, messageErreur, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puce } from '../composants/jetons.js';
import { nomsMetiers } from '/shared/roles.js';
import { formatHorodatage } from '/shared/temps.js';
import { afficherMdp, choixMetiers, etatCompte, chargement, erreurChargement, actionsSensibles } from './admin-commun.js';

const cache = { jeu: '', comptes: null };
const ADMIN_SEUL = 'Seul l’Administrateur général modifie le compte d’un Administrateur général.';
const AUTRES_JEUX = 'Ce compte a aussi accès à d’autres jeux : seul l’Administrateur général peut changer son nom, réinitialiser son mot de passe, le désactiver ou le supprimer. Ici, tu règles ses métiers et sa fiche dans ce jeu, ou tu lui retires l’accès à ce jeu.';

export const comptesConnus = () => (cache.jeu === E.jeu()?.id ? cache.comptes || [] : []);

export function sectionComptes(zone, ctx) {
  const jeu = E.jeu().id;
  let affiche = '';
  const dessiner = (comptes) => {
    affiche = JSON.stringify(comptes);
    zone.replaceChildren(...contenu(comptes, ctx));
  };
  if (cache.jeu === jeu && cache.comptes) dessiner(cache.comptes);
  else zone.replaceChildren(chargement('Chargement des comptes…'));
  E.appeler('GET', '/comptes')
    .then((r) => {
      if (E.jeu()?.id !== jeu) return;
      Object.assign(cache, { jeu, comptes: r.comptes });
      if (JSON.stringify(r.comptes) !== affiche) dessiner(r.comptes);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => sectionComptes(zone, ctx)));
    });
}

function contenu(comptes, ctx) {
  const nomJeu = E.jeu().nom;
  const inactifs = comptes.filter((c) => !c.actif).length;
  return [
    h('div', { class: 'section__entete' },
      h('h2', {}, `Comptes de ${nomJeu} (${comptes.length})`),
      h('p', { class: 'section__aide' }, inactifs ? `${inactifs} désactivé${inactifs > 1 ? 's' : ''}` : 'Un compte par personne, ses métiers dans ce jeu.')),
    comptes.length
      ? h('div', { class: 'adm-comptes' }, comptes.map((c) => ligneCompte(c, ctx)))
      : etatVide('Aucun compte n’a encore accès à ce jeu.', bouton('Ajouter une personne', { icone: 'ajouter', onclick: () => creerCompte(ctx) })),
  ];
}

function ligneCompte(c, ctx) {
  const soi = c._id === E.compte()?._id;
  const membre = c.membreId ? E.doc('membres', c.membreId) : null;
  const verrouille = c.admin && !E.estAdmin();
  return h('article', { class: ['adm-compte', !c.actif && 'adm-compte--inactif', c.admin && 'adm-compte--admin'] },
    h('div', { class: 'adm-compte__qui' },
      h('span', { class: 'adm-compte__initiale', 'aria-hidden': 'true' }, (c.nomAffiche || c.identifiant).slice(0, 1).toUpperCase()),
      h('div', { class: 'adm-compte__noms' },
        h('strong', {}, c.nomAffiche),
        h('span', { class: 'texte-3 petit' }, `identifiant ${c.identifiant}`),
        h('span', { class: 'rangee' },
          c.admin ? puce('Administrateur général', 'accent') : null,
          soi ? puce('C’est toi') : null,
          c.deuxFacteurs ? puce('Double authentification', 'positif') : null,
          !c.gerable && !c.admin ? puce('Aussi dans d’autres jeux', 'info') : null))),
    h('div', { class: 'adm-compte__acces' },
      h('span', { class: 'rangee' }, nomsMetiers(c.metiers).map((n) => puce(n, n === 'Responsable du jeu' ? 'accent' : ''))),
      h('span', { class: 'texte-3 petit adm-compte__membre' }, icone('roster', { classe: 'icone-texte' }), ' ',
        membre ? h('a', { href: J.lien('/roster') }, E.nomMembre(membre)) : 'Aucune fiche du roster')),
    h('div', { class: 'adm-compte__etat' }, etatCompte(c)),
    h('div', { class: 'adm-compte__actions' }, verrouille
      ? h('span', { class: 'texte-3 tres-petit adm-compte__note' }, ADMIN_SEUL)
      : bouton('Modifier', { classe: 'btn--petit', icone: 'modifier', onclick: () => modifier(c, ctx), 'aria-label': `Modifier le compte ${c.identifiant}` })));
}

// Fiche du roster liée au compte : membres actifs pas déjà liés à un autre compte de ce jeu.
function choixMembre(actuel = '', saufCompte = null) {
  const pris = new Set(comptesConnus().filter((c) => c._id !== saufCompte && c.membreId).map((c) => c.membreId));
  const libres = E.membresActifs().filter((m) => !pris.has(m._id) || m._id === actuel);
  const options = (type, groupe) => {
    const opts = libres.filter((m) => m.type === type).map((m) => ({ valeur: m._id, libelle: E.nomMembre(m) }));
    return opts.length ? [{ groupe, options: opts }] : [];
  };
  const groupes = [...options('joueur', 'Joueurs'), ...options('staff', 'Staff')];
  if (actuel && !libres.some((m) => m._id === actuel)) groupes.unshift({ valeur: actuel, libelle: `${E.nomMembre(E.doc('membres', actuel))} (ancienne fiche)` });
  return liste(groupes, { valeur: actuel, vide: 'Aucune fiche' });
}

export function creerCompte(ctx) {
  const jeu = E.jeu();
  const existant = caseACocher(h('span', {}, h('strong', {}, 'Compte existant'), ' : cette personne a déjà un compte pour un autre jeu'));
  const identifiant = saisie({
    maxlength: 24, required: true, autocapitalize: 'none', spellcheck: 'false', autocomplete: 'off', placeholder: 'ex. kairo',
    oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); },
  });
  const nom = saisie({ maxlength: 32, required: true, autocomplete: 'off' });
  const champId = champ('Identifiant de connexion', identifiant, { aide: '3 à 24 caractères : minuscules, chiffres, point, tiret. Définitif.' });
  const champNom = champ('Nom affiché', nom, { aide: 'Souvent le pseudo.' });
  const aideExistant = h('p', { class: 'bandeau petit', hidden: true },
    `Saisis l’identifiant qu’elle utilise déjà : elle garde son mot de passe et ses autres jeux, et voit ${jeu.nom} dès sa prochaine connexion.`);
  existant.input.addEventListener('change', () => {
    champNom.hidden = existant.input.checked;
    aideExistant.hidden = !existant.input.checked;
  });
  const metiers = choixMetiers(['joueur'], { legende: `Métiers dans ${jeu.nom} (plusieurs possibles)` });
  const membre = choixMembre();
  let resultat = null;
  modale({
    titre: 'Ajouter une personne',
    large: true,
    contenu: [
      existant.element,
      aideExistant,
      h('div', { class: 'grille-champs grille-champs--3' }, champId, champNom,
        champ('Fiche du roster', membre, { aide: 'Relie le compte à sa fiche joueur ou staff dans ce jeu.' })),
      metiers.element,
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Ajouter',
      classe: 'btn--principal',
      action: async () => {
        const choisis = metiers.lire();
        if (!choisis.length) throw new Error('Coche au moins un métier.');
        const parExistant = existant.input.checked;
        // Le nom affiché reste obligatoire pour le serveur, même pour un compte existant (il garde alors le sien).
        resultat = await E.appeler('POST', '/comptes', {
          identifiant: identifiant.value,
          nomAffiche: parExistant ? (nom.value.trim() || identifiant.value) : nom.value.trim(),
          metiers: choisis,
          membreId: membre.value,
          existant: parExistant,
        });
        if (!resultat.mdpTemporaire) toast(`${resultat.compte.nomAffiche} a maintenant accès à ${jeu.nom}.`);
        await ctx.recharger();
      },
    }],
    surFermeture: () => { if (resultat?.mdpTemporaire) afficherMdp(resultat.compte, resultat.mdpTemporaire, 'Compte créé'); },
  });
}

function modifier(c, ctx) {
  const jeu = E.jeu();
  const soi = c._id === E.compte()?._id;
  const nomModifiable = c.gerable && !c.admin;
  const nom = saisie({ valeur: c.nomAffiche, maxlength: 32, required: true, autocomplete: 'off', disabled: !nomModifiable });
  const actif = caseACocher('Compte actif (décocher ferme ses sessions et bloque la connexion, sans rien effacer)', { coche: c.actif });
  // Un Administrateur général est Responsable partout ; un Responsable ne retire pas son propre rôle.
  const verrous = c.admin || (soi && !E.estAdmin()) ? ['responsable'] : [];
  const metiers = choixMetiers(c.metiers, {
    legende: `Métiers dans ${jeu.nom}`,
    verrouilles: verrous,
    aide: c.admin ? 'Administrateur général : Responsable de tous les jeux. Coche seulement ses autres métiers ici.'
      : (soi ? 'Tu ne peux pas retirer ton propre rôle de Responsable.' : ''),
  });
  const membre = choixMembre(c.membreId, c._id);
  let mdp = null;
  let fenetre = null;

  const gerable = c.gerable && !soi && !c.admin;
  const autres = actionsSensibles([
    gerable ? {
      titre: 'Nouveau mot de passe',
      aide: 'Un mot de passe temporaire, affiché une seule fois ; ses sessions ouvertes sont fermées.',
      libelle: 'Générer',
      executer: async () => {
        if (!(await confirmer(`Générer un nouveau mot de passe temporaire pour « ${c.identifiant} » ? Ses sessions ouvertes seront fermées.`, { titre: 'Nouveau mot de passe', libelle: 'Générer' }))) return false;
        mdp = await E.appeler('POST', `/comptes/${encodeURIComponent(c._id)}/mdp`);
        await ctx.recharger();
        return true;
      },
    } : null,
    !soi && !c.admin ? {
      titre: `Retirer l’accès à ${jeu.nom}`,
      aide: c.gerable ? 'Le compte reste, sans ce jeu ; ses notes et modifications restent.' : 'Le compte garde ses autres jeux ; ses notes et modifications restent.',
      libelle: 'Retirer l’accès',
      danger: true,
      executer: async () => {
        if (!(await confirmer(`Retirer à « ${c.identifiant} » l’accès à ${jeu.nom} ? Ses métiers et sa fiche dans ce jeu sont oubliés ; son compte et ses autres jeux restent.`,
          { titre: 'Retirer l’accès ?', libelle: 'Retirer l’accès', danger: true }))) return false;
        await E.appeler('DELETE', `/comptes/${encodeURIComponent(c._id)}/acces`);
        toast(`Accès à ${jeu.nom} retiré à ${c.nomAffiche}.`);
        await ctx.recharger();
        return true;
      },
    } : null,
    gerable ? {
      titre: 'Supprimer le compte',
      aide: 'Définitif, pour tous ses jeux. Ses notes et modifications restent, signées « un ancien compte ».',
      libelle: 'Supprimer',
      danger: true,
      executer: async () => {
        if (!(await confirmer(`Supprimer définitivement le compte « ${c.identifiant} » ? Pour une pause, désactive-le plutôt.`, { titre: 'Supprimer ce compte ?', libelle: 'Supprimer', danger: true }))) return false;
        await E.appeler('DELETE', `/comptes/${encodeURIComponent(c._id)}`);
        toast('Compte supprimé.');
        await ctx.recharger();
        return true;
      },
    } : null,
  ], () => fenetre);

  fenetre = modale({
    titre: `Compte « ${c.identifiant} »`,
    large: true,
    contenu: [
      !c.gerable && !c.admin ? h('div', { class: 'alerte alerte--info' }, icone('info'), h('span', {}, AUTRES_JEUX)) : null,
      c.admin ? h('div', { class: 'alerte alerte--info' }, icone('info'), h('span', {}, 'Compte d’Administrateur général : son nom, son mot de passe et son activation se gèrent dans l’Administration générale.'),
        E.estAdmin() ? h('a', { href: '#/admin/comptes', class: 'btn btn--petit btn--discret' }, 'Ouvrir') : null) : null,
      h('dl', { class: 'details' },
        h('dt', {}, 'Dernière connexion'), h('dd', {}, c.derniereConnexion ? formatHorodatage(c.derniereConnexion) : 'jamais'),
        h('dt', {}, 'Mot de passe'), h('dd', {}, c.doitChangerMdp ? puce('Temporaire, à choisir à la connexion', 'attention') : 'choisi par la personne')),
      h('div', { class: 'grille-champs' },
        champ('Nom affiché', nom, { aide: nomModifiable ? '' : 'Modifiable seulement par l’Administrateur général.' }),
        champ('Fiche du roster', membre, { aide: 'Sa fiche joueur ou staff dans ce jeu.' })),
      metiers.element,
      gerable ? actif.element : null,
      soi ? h('p', { class: 'texte-3 petit' }, 'C’est ton compte : ton mot de passe se change dans « Mon compte ».') : null,
      autres,
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const choisis = metiers.lire();
        if (!choisis.length) throw new Error('Coche au moins un métier (ou retire-lui l’accès à ce jeu).');
        const desactiver = gerable && c.actif && !actif.input.checked;
        if (desactiver && !(await confirmer(`Désactiver « ${c.identifiant} » ? Ses sessions sont fermées tout de suite et il ne peut plus se connecter. Rien n’est effacé.`,
          { titre: 'Désactiver ce compte ?', libelle: 'Désactiver', danger: true }))) return false;
        await E.appeler('PUT', `/comptes/${encodeURIComponent(c._id)}`, {
          metiers: choisis,
          membreId: membre.value,
          nomAffiche: nomModifiable ? nom.value.trim() : c.nomAffiche,
          actif: gerable ? actif.input.checked : c.actif,
        });
        toast('Compte enregistré.');
        await ctx.recharger();
        return true;
      },
    }],
    surFermeture: () => { if (mdp) afficherMdp(mdp.compte, mdp.mdpTemporaire, 'Mot de passe réinitialisé'); },
  });
}
