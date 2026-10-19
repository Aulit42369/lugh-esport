// Administration générale, onglet Comptes : tous les comptes, leurs accès par jeu (métiers), le rôle
// d'Administrateur général. PUT remplace « acces » en entier : le membre lié de chaque jeu est toujours renvoyé tel quel.

import { h, modale, confirmer, champ, saisie, liste, caseACocher, bouton, toast, messageErreur, etatVide } from '../ui.js';
import { api } from '../api.js';
import * as E from '../etat.js';
import { puce } from '../composants/jetons.js';
import { nomsMetiers } from '/shared/roles.js';
import { formatHorodatage, ilYA } from '/shared/temps.js';
import { afficherMdp, choixMetiers, etatCompte, pastilleJeu, chargement, erreurChargement, actionsSensibles, interrupteur } from './admin-commun.js';

let cache = null; // { comptes, jeux, parametres } : affiché tout de suite au rendu suivant
const filtre = { vue: '', texte: '' };

export function rendreComptes(zone, ctx) {
  let affiche = '';
  const dessiner = (d) => {
    affiche = JSON.stringify(d);
    zone.replaceChildren(...contenu(d, ctx));
  };
  if (cache) dessiner(cache);
  else zone.replaceChildren(chargement());
  Promise.all([api('GET', '/api/admin/comptes'), api('GET', '/api/admin/jeux'), api('GET', '/api/admin/parametres').catch(() => null)])
    .then(([c, j, parametres]) => {
      cache = { comptes: c.comptes, jeux: j.jeux, parametres };
      if (JSON.stringify(cache) !== affiche) dessiner(cache);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => rendreComptes(zone, ctx)));
    });
}

function correspond(c, d) {
  const t = filtre.texte.trim().toLowerCase();
  if (t && !`${c.identifiant} ${c.nomAffiche}`.toLowerCase().includes(t)) return false;
  if (filtre.vue === 'admin') return c.admin;
  if (filtre.vue === 'inactifs') return !c.actif;
  if (filtre.vue === 'sans') return !c.admin && !Object.values(c.acces || {}).some((a) => a.metiers?.length);
  if (filtre.vue.startsWith('jeu:')) return c.admin || !!c.acces?.[filtre.vue.slice(4)]?.metiers?.length;
  return true;
}

function contenu(d, ctx) {
  const liste_ = h('div', { class: 'adm-comptes' });
  const compteur = h('p', { class: 'texte-3 petit', 'aria-live': 'polite' });
  const dessinerListe = () => {
    const visibles = d.comptes.filter((c) => correspond(c, d));
    compteur.textContent = `${visibles.length} compte${visibles.length > 1 ? 's' : ''} affiché${visibles.length > 1 ? 's' : ''} sur ${d.comptes.length}`;
    liste_.replaceChildren(...(visibles.length ? visibles.map((c) => ligneCompte(c, d, ctx)) : [etatVide('Aucun compte ne correspond à ce filtre.')]));
  };
  const vue = liste([
    { valeur: '', libelle: 'Tous les comptes' },
    { valeur: 'admin', libelle: 'Administrateurs généraux' },
    { valeur: 'inactifs', libelle: 'Comptes désactivés' },
    { valeur: 'sans', libelle: 'Sans accès à un jeu' },
    ...(d.jeux.length ? [{ groupe: 'Avec accès à', options: d.jeux.map((j) => ({ valeur: `jeu:${j.id}`, libelle: j.nom })) }] : []),
  ], { valeur: filtre.vue, class: 'saisie saisie--compacte', onchange: (e) => { filtre.vue = e.target.value; dessinerListe(); } });
  const recherche = saisie({ type: 'search', valeur: filtre.texte, placeholder: 'Identifiant ou nom', class: 'saisie saisie--compacte', autocomplete: 'off' });
  recherche.addEventListener('input', () => { filtre.texte = recherche.value; dessinerListe(); });
  dessinerListe();
  const admins = d.comptes.filter((c) => c.admin && c.actif).length;
  return [
    ficheDeuxFacteurs(d, ctx),
    h('div', { class: 'barre-outils adm-barre' },
      h('div', { class: 'adm-filtres' }, champ('Afficher', vue), champ('Rechercher', recherche)),
      bouton('Créer un compte', { icone: 'ajouter', classe: 'btn--principal', onclick: () => creer(d, ctx) })),
    h('div', { class: 'rangee rangee--espace adm-compteur' }, compteur,
      h('p', { class: 'texte-3 petit' }, `${admins} Administrateur${admins > 1 ? 's' : ''} général${admins > 1 ? 'aux' : ''} actif${admins > 1 ? 's' : ''} : il en faut toujours au moins un.`)),
    liste_,
  ];
}

// Double authentification exigée ou non pour l'Administrateur général et les Responsables (paramètre de la structure).
function ficheDeuxFacteurs(d, ctx) {
  const p = d.parametres;
  if (!p) return null;
  const sans = p.sansDeuxFacteurs || [];
  const basculer = async (input, remettre) => {
    const voulu = input.checked;
    if (voulu && sans.length) {
      remettre(false);
      const ok = await confirmer(`${sans.length} compte${sans.length > 1 ? 's' : ''} concerné${sans.length > 1 ? 's' : ''} ne l’${sans.length > 1 ? 'ont' : 'a'} pas encore : ${sans.map((c) => c.nomAffiche).join(', ')}. ${sans.length > 1 ? 'Ils devront' : 'Il devra'} l’activer à la prochaine connexion.`,
        { titre: 'Exiger la double authentification ?', libelle: 'Exiger' });
      if (!ok) return;
      remettre(true);
    }
    input.disabled = true;
    try {
      await api('PUT', '/api/admin/parametres', { exiger2fa: voulu });
      toast(voulu ? 'Double authentification exigée pour l’Administrateur général et les Responsables.' : 'Double authentification facultative.');
      await ctx.recharger();
    } catch (err) {
      remettre(!voulu);
      toast(messageErreur(err), { type: 'erreur' });
    } finally {
      input.disabled = false;
    }
  };
  return h('section', { class: 'fiche adm-2fa' },
    h('div', { class: 'adm-2fa__texte' },
      h('h2', {}, 'Double authentification'),
      h('p', { class: 'texte-2 petit' }, 'Un code à usage unique en plus du mot de passe. Exigée, elle s’impose à l’Administrateur général, au Trésorier et aux Responsables de jeu ; les autres comptes la choisissent dans « Mon compte ».'),
      h('p', { class: ['petit', !sans.length && 'texte-positif'] }, sans.length
        ? `Pas encore activée par : ${sans.map((c) => `${c.nomAffiche}${c.admin ? ' (Administrateur général)' : ''}`).join(', ')}.`
        : 'Tous les comptes concernés l’ont activée.')),
    interrupteur({ coche: p.exiger2fa, nom: 'Double authentification', textes: ['Exigée', 'Facultative'], surChange: basculer }));
}

function puceAcces(j, a) {
  const metiers = nomsMetiers(a.metiers || []);
  return h('span', { class: ['adm-acces', j && !j.actif && 'adm-acces--inactif'], title: j && !j.actif ? `${j.nom} est désactivé` : null },
    pastilleJeu(j || { court: '?' }),
    h('span', {}, metiers.length ? metiers.join(', ') : 'membre lié'));
}

function ligneCompte(c, d, ctx) {
  const soi = c._id === E.compte()?._id;
  const acces = Object.entries(c.acces || {}).filter(([, a]) => a.metiers?.length || a.membreId);
  return h('article', { class: ['adm-compte', !c.actif && 'adm-compte--inactif', c.admin && 'adm-compte--admin'] },
    h('div', { class: 'adm-compte__qui' },
      h('span', { class: 'adm-compte__initiale', 'aria-hidden': 'true' }, (c.nomAffiche || c.identifiant).slice(0, 1).toUpperCase()),
      h('div', { class: 'adm-compte__noms' },
        h('strong', {}, c.nomAffiche),
        h('span', { class: 'texte-3 petit' }, `identifiant ${c.identifiant}`),
        c.admin || c.tresorier || soi || c.deuxFacteurs?.actif ? h('span', { class: 'rangee' }, c.admin ? puce('Administrateur général', 'accent') : null,
          c.tresorier ? puce('Trésorier') : null,
          c.deuxFacteurs?.actif ? puce('Double authentification', 'positif') : null, soi ? puce('C’est toi') : null) : null)),
    h('div', { class: 'adm-compte__acces' },
      c.admin ? h('span', { class: 'adm-acces adm-acces--tous' }, h('span', { class: 'puce-jeu', 'aria-hidden': 'true' }, 'TOUS'), h('span', {}, 'Responsable de tous les jeux')) : null,
      acces.map(([id, a]) => puceAcces(d.jeux.find((j) => j.id === id), a)),
      !c.admin && !acces.length ? h('span', { class: 'texte-3 petit' }, c.tresorier ? 'Aucun jeu : comptes de la structure seulement' : 'Aucun accès : ne voit aucun jeu') : null),
    h('div', { class: 'adm-compte__etat' }, etatCompte(c)),
    h('div', { class: 'adm-compte__actions' }, bouton('Modifier', { classe: 'btn--petit', icone: 'modifier', onclick: () => modifier(c, d, ctx), 'aria-label': `Modifier le compte ${c.identifiant}` })));
}

// Accès par jeu : une case par métier pour chaque jeu créé. L'Administrateur général est Responsable partout :
// sa case « Responsable du jeu » est cochée d'office et n'est pas enregistrée.
function blocAcces(jeux, acces = {}, admin = false) {
  const lignes = jeux.map((j) => {
    const a = acces[j.id] || { metiers: [], membreId: '' };
    const choix = choixMetiers(a.metiers, {
      compact: true,
      verrouilles: admin ? ['responsable'] : [],
      legende: [pastilleJeu(j), ' ', j.nom, j.actif ? null : h('span', { class: 'puce puce--attention' }, 'désactivé'),
        a.membreId ? h('span', { class: 'texte-3 tres-petit' }, ' · membre lié dans ce jeu') : null],
    });
    return { j, a, choix };
  });
  const note = h('p', { class: 'texte-3 petit' });
  const majNote = (estAdmin) => {
    note.textContent = estAdmin
      ? 'Administrateur général : Responsable de tous les jeux. Coche seulement ses autres métiers (joueur, coach…).'
      : 'Sans aucun métier dans un jeu, la personne n’y a pas accès. Le Responsable de chaque jeu relie ensuite le compte à sa fiche du roster.';
  };
  majNote(admin);
  return {
    element: h('div', { class: 'adm-acces-jeux' },
      h('h3', { class: 'sous-titre' }, 'Accès par jeu'),
      note,
      jeux.length ? lignes.map((l) => l.choix.element) : h('p', { class: 'texte-3 petit' }, 'Aucun jeu créé : active d’abord un jeu dans l’onglet Jeux.')),
    admin(estAdmin) {
      majNote(estAdmin);
      for (const l of lignes) {
        const c = l.choix.cases.find((x) => x.id === 'responsable');
        c.input.disabled = estAdmin;
        c.input.checked = estAdmin || l.a.metiers.includes('responsable');
      }
    },
    lire(estAdmin) {
      const sortie = {};
      for (const l of lignes) {
        const metiers = l.choix.lire().filter((m) => !estAdmin || m !== 'responsable');
        // Une entrée sans métier garde seulement le lien vers la fiche (Administrateur général qui joue aussi, ou lien
        // déjà sans métier) ; décocher le dernier métier d'un compte ordinaire retire l'accès et libère sa fiche.
        const lienSeul = l.a.membreId && (estAdmin || !l.a.metiers.length);
        if (metiers.length || lienSeul) sortie[l.j.id] = { metiers, membreId: l.a.membreId || '' };
      }
      return sortie;
    },
  };
}

function creer(d, ctx) {
  const identifiant = saisie({
    maxlength: 24, required: true, autocapitalize: 'none', spellcheck: 'false', autocomplete: 'off', placeholder: 'ex. kairo',
    oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); },
  });
  const nom = saisie({ maxlength: 32, required: true, autocomplete: 'off' });
  const admin = caseACocher(h('span', {}, h('strong', {}, 'Administrateur général'), ' : tous les jeux, tous les comptes et cette administration'));
  const tresorier = caseACocher(h('span', {}, h('strong', {}, 'Trésorier'), ' : tient le livre des comptes de l’association (même sans aucun jeu)'));
  const acces = blocAcces(d.jeux, {}, false);
  admin.input.addEventListener('change', () => acces.admin(admin.input.checked));
  let cree = null;
  modale({
    titre: 'Nouveau compte',
    large: true,
    contenu: [
      h('div', { class: 'grille-champs' },
        champ('Identifiant de connexion', identifiant, { aide: '3 à 24 caractères : minuscules, chiffres, point, tiret. Définitif.' }),
        champ('Nom affiché', nom, { aide: 'Souvent le pseudo.' })),
      admin.element,
      tresorier.element,
      acces.element,
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Créer le compte',
      classe: 'btn--principal',
      action: async () => {
        const corps = { identifiant: identifiant.value, nomAffiche: nom.value.trim(), admin: admin.input.checked, tresorier: tresorier.input.checked, acces: acces.lire(admin.input.checked) };
        if (!corps.admin && !corps.tresorier && !Object.keys(corps.acces).length) throw new Error('Coche au moins un métier dans un jeu (ou Trésorier), sinon ce compte ne verra rien.');
        cree = await api('POST', '/api/admin/comptes', corps);
        await ctx.recharger();
      },
    }],
    surFermeture: () => { if (cree) afficherMdp(cree.compte, cree.mdpTemporaire, 'Compte créé'); },
  });
}

function modifier(c, d, ctx) {
  const soi = c._id === E.compte()?._id;
  const nom = saisie({ valeur: c.nomAffiche, maxlength: 32, required: true, autocomplete: 'off' });
  const admin = caseACocher(h('span', {}, h('strong', {}, 'Administrateur général'), ' : tous les jeux, tous les comptes et cette administration'), { coche: c.admin, disabled: soi });
  const actif = caseACocher('Compte actif (décocher ferme ses sessions et bloque la connexion, sans rien effacer)', { coche: c.actif, disabled: soi });
  const tresorier = caseACocher(h('span', {}, h('strong', {}, 'Trésorier'), ' : tient le livre des comptes de l’association'), { coche: c.tresorier });
  const acces = blocAcces(d.jeux, c.acces || {}, c.admin);
  admin.input.addEventListener('change', () => acces.admin(admin.input.checked));
  let mdp = null;
  let fenetre = null;
  const deuxFa = c.deuxFacteurs?.actif ? {
    titre: 'Réinitialiser la double authentification',
    aide: 'Téléphone perdu sans codes de secours : elle est retirée, la personne la réactive depuis « Mon compte ».',
    libelle: 'Réinitialiser',
    danger: true,
    executer: async () => {
      const ok = await confirmer(`Retirer la double authentification de « ${c.identifiant} » ? ${soi ? 'Tu' : 'La personne'} se connectera avec le mot de passe seul jusqu’à la réactiver.`,
        { titre: 'Réinitialiser la double authentification ?', libelle: 'Réinitialiser', danger: true });
      if (!ok) return false;
      await api('POST', `/api/admin/comptes/${encodeURIComponent(c._id)}/2fa/reinitialiser`);
      toast('Double authentification réinitialisée.');
      await ctx.recharger();
      return true;
    },
  } : null;
  const autres = soi ? actionsSensibles([deuxFa], () => fenetre) : actionsSensibles([
    deuxFa,
    {
      titre: 'Nouveau mot de passe',
      aide: 'Un mot de passe temporaire, affiché une seule fois ; ses sessions ouvertes sont fermées.',
      libelle: 'Générer',
      executer: async () => {
        const ok = await confirmer(`Générer un nouveau mot de passe temporaire pour « ${c.identifiant} » ? Ses sessions ouvertes seront fermées.`, { titre: 'Nouveau mot de passe', libelle: 'Générer' });
        if (!ok) return false;
        mdp = await api('POST', `/api/admin/comptes/${encodeURIComponent(c._id)}/mdp`);
        await ctx.recharger();
        return true;
      },
    },
    {
      titre: 'Supprimer le compte',
      aide: 'Définitif. Ses notes et modifications restent, signées « un ancien compte ». Pour une pause, désactive-le plutôt.',
      libelle: 'Supprimer',
      danger: true,
      executer: async () => {
        const ok = await confirmer(`Supprimer définitivement le compte « ${c.identifiant} » ? Ses notes et modifications restent dans les jeux, signées « un ancien compte ».`,
          { titre: 'Supprimer ce compte ?', libelle: 'Supprimer', danger: true });
        if (!ok) return false;
        await api('DELETE', `/api/admin/comptes/${encodeURIComponent(c._id)}`);
        toast('Compte supprimé.');
        await ctx.recharger();
        return true;
      },
    },
  ], () => fenetre);
  fenetre = modale({
    titre: `Compte « ${c.identifiant} »`,
    large: true,
    contenu: [
      h('dl', { class: 'details' },
        h('dt', {}, 'Créé'), h('dd', {}, c.creeLe ? formatHorodatage(c.creeLe) : '—'),
        h('dt', {}, 'Dernière connexion'), h('dd', {}, c.derniereConnexion ? `${formatHorodatage(c.derniereConnexion)} (${ilYA(c.derniereConnexion)})` : 'jamais'),
        h('dt', {}, 'Mot de passe'), h('dd', {}, c.doitChangerMdp ? puce('Temporaire, à choisir à la connexion', 'attention') : 'choisi par la personne'),
        h('dt', {}, 'Double authentification'), h('dd', {}, c.deuxFacteurs?.actif
          ? `active depuis ${c.deuxFacteurs.depuis ? formatHorodatage(c.deuxFacteurs.depuis) : '?'}, ${c.deuxFacteurs.codesRestants} code${c.deuxFacteurs.codesRestants > 1 ? 's' : ''} de secours`
          : 'non activée')),
      champ('Nom affiché', nom),
      h('div', { class: 'pile-s' }, admin.element, tresorier.element, actif.element,
        soi ? h('p', { class: 'texte-3 petit' }, 'C’est ton compte : tu ne peux ni le désactiver ni retirer ton rôle d’Administrateur général. Ton mot de passe se change dans « Mon compte ».') : null),
      acces.element,
      autres,
    ],
    actions: [
      { libelle: 'Annuler' },
      {
        libelle: 'Enregistrer',
        classe: 'btn--principal',
        action: async () => {
          const corps = {
            nomAffiche: nom.value.trim(),
            actif: soi ? true : actif.input.checked,
            admin: soi ? true : admin.input.checked,
            tresorier: tresorier.input.checked,
            acces: acces.lire(soi || admin.input.checked),
          };
          if (c.actif && !corps.actif) {
            const ok = await confirmer(`Désactiver « ${c.identifiant} » ? Ses sessions sont fermées tout de suite et il ne peut plus se connecter. Rien n’est effacé : tu pourras le réactiver.`,
              { titre: 'Désactiver ce compte ?', libelle: 'Désactiver', danger: true });
            if (!ok) return false;
          }
          if (c.admin && !corps.admin) {
            const ok = await confirmer(`Retirer à « ${c.identifiant} » le rôle d’Administrateur général ? Il ne gardera que les métiers cochés dans chaque jeu.`,
              { titre: 'Retirer ce rôle ?', libelle: 'Retirer le rôle', danger: true });
            if (!ok) return false;
          }
          await api('PUT', `/api/admin/comptes/${encodeURIComponent(c._id)}`, corps);
          toast('Compte enregistré.');
          await ctx.recharger();
          return true;
        },
      },
    ],
    surFermeture: () => { if (mdp) afficherMdp(mdp.compte, mdp.mdpTemporaire, 'Mot de passe réinitialisé'); },
  });
}
