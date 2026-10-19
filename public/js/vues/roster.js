// Roster : profil de l'équipe, titulaires, remplaçants, staff et anciens ; rôle en jeu, identifiant en jeu et
// personnages de chacun. Tout ce qui dépend du jeu (rôles, personnages, maps, profil public) vient de sa définition.

import { h, vider, modale, confirmer, champ, saisie, zone, liste, caseACocher, bouton, toast, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jetonRole, jetonPersonnage, nomPersonnage, pucePalier, puce, optionsPersonnages, nomMap, signature } from '../composants/jetons.js';
import { lienProfil, aideIdentifiant } from '../composants/profil.js';
import { STATUTS_MEMBRE, TYPES_MEMBRE, FONCTIONS_STAFF, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { nomsMetiers } from '/shared/roles.js';

const SANS_PERSONNAGES = { principaux: [], secondaires: [], parMap: {} };
const shotcall = () => !!J.def()?.shotcall;

// ——— Aides de formulaire (reprises par le recrutement) ———

// Choix proposés : la liste active du jeu, plus la valeur actuelle si elle a été masquée depuis dans les Réglages du jeu.
export function optionsListe(actifs, tous, actuelle) {
  const options = actifs.map((x) => ({ valeur: x.id, libelle: x.nom }));
  const masque = actuelle && !actifs.some((x) => x.id === actuelle) ? tous.find((x) => x.id === actuelle) : null;
  if (masque) options.push({ valeur: masque.id, libelle: `${masque.nom} (masqué)` });
  return options;
}

// Champ « identifiant en jeu » : ce que le jeu attend (Riot ID, SteamID64, pseudo Epic…) et le lien vers le profil public.
export function champIdJeu(valeur) {
  const input = saisie({ valeur, maxlength: 60, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none' });
  const apercu = h('span', { class: 'champ__aide' });
  const site = J.def()?.profil?.site;
  const maj = () => {
    vider(apercu);
    const v = input.value.trim();
    if (!v || !site) return;
    const lien = lienProfil(v);
    apercu.append(...(lien ? ['Profil public : ', lien] : [`Format non reconnu : pas de lien vers ${site}.`]));
  };
  input.addEventListener('input', maj);
  maj();
  const element = champ('Identifiant en jeu', input, { aide: aideIdentifiant() });
  element.append(apercu);
  return { element, input };
}

// Menu d'un personnage : groupé par rôle, avec la valeur actuelle même si elle n'est plus dans la méta.
function menuPersonnage(options, valeur) {
  const connu = !valeur || options.flatMap((o) => o.options || [o]).some((o) => o.valeur === valeur);
  return liste(connu ? options : [...options, { valeur, libelle: nomPersonnage(valeur) }], { valeur, vide: '—' });
}

// ——— Profil de l'équipe ———

function editeurEquipe() {
  const eq = E.equipe();
  const nom = saisie({ valeur: eq.nom, maxlength: 40 });
  const tag = saisie({ valeur: eq.tag, maxlength: 5, placeholder: 'ABC', oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } });
  const devise = saisie({ valeur: eq.devise, maxlength: 120 });
  const palier = liste(J.paliers().map((p) => ({ valeur: p.id, libelle: `${p.n}. ${p.nom}` })), { valeur: eq.palierVise });
  const circuit = saisie({ valeur: eq.circuit, maxlength: 80, placeholder: 'Ligue, circuit, tournois communautaires…' });
  const creneaux = saisie({ valeur: eq.creneaux, maxlength: 120, placeholder: 'Ex. : du lundi au vendredi, 20 h à 23 h' });
  const objectif = zone({ valeur: eq.objectifSaison, lignes: 3, maxlength: 400 });
  modale({
    titre: 'Profil de l’équipe',
    contenu: h('div', { class: 'grille-champs champs-alignes' },
      champ('Nom de l’équipe', nom), champ('Tag', tag, { aide: '2 à 5 lettres majuscules ou chiffres.' }),
      champ('Devise', devise, { large: true }),
      champ('Palier visé cette saison', palier), champ('Circuit', circuit),
      champ('Créneaux habituels', creneaux, { large: true }),
      champ('Objectif de saison', objectif, { large: true })),
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        await E.enregistrer('equipe', 'profil', {
          nom: nom.value.trim(), tag: tag.value.trim(), devise: devise.value.trim(), palierVise: palier.value,
          circuit: circuit.value.trim(), creneaux: creneaux.value.trim(), objectifSaison: objectif.value.trim(),
        }, { revBase: E.doc('equipe', 'profil')?.rev ?? 0 });
        toast('Profil de l’équipe enregistré.');
      },
    }],
  });
}

// ——— Fiche d'un membre ———

function editeurMembre(m = null) {
  const nouveau = !m;
  const d = m || J.schemas().documentParDefaut('membres', { type: 'joueur', statut: 'titulaire' });
  const p = d.personnages || SANS_PERSONNAGES;
  const type = liste(TYPES_MEMBRE.map((t) => ({ valeur: t.id, libelle: t.nom })), { valeur: d.type });
  const statut = liste([], {});
  const pseudo = saisie({ valeur: d.pseudo, maxlength: 24, required: true });
  const idJeu = champIdJeu(d.idJeu);
  const roleJeu = liste(optionsListe(J.roles(), J.roles(true), d.roleJeu), { valeur: d.roleJeu, vide: 'À définir' });
  // Case IGL seulement si le jeu a un shotcaller attitré (ni Rocket League ni EA FC).
  const igl = shotcall() ? caseACocher('IGL (shotcaller en match)', { coche: d.igl }) : null;
  const fonction = liste(FONCTIONS_STAFF.map((f) => ({ valeur: f.id, libelle: f.nom })), { valeur: d.fonction, vide: 'À définir' });
  const forces = zone({ valeur: d.forces, lignes: 3, maxlength: 500 });
  const axes = zone({ valeur: d.axes, lignes: 3, maxlength: 500 });

  // Personnages : seulement si le jeu en a ; un par map du pool seulement si le jeu a un map pool.
  const avecPersonnages = J.aPersonnages();
  const opt = avecPersonnages ? optionsPersonnages() : [];
  const principaux = avecPersonnages ? [0, 1, 2].map((i) => menuPersonnage(opt, p.principaux?.[i] || '')) : [];
  const secondaires = avecPersonnages ? [0, 1, 2, 3].map((i) => menuPersonnage(opt, p.secondaires?.[i] || '')) : [];
  const pool = avecPersonnages && J.aPool() ? E.meta()?.mapPool || [] : [];
  const parMap = pool.map((id) => ({ id, el: menuPersonnage(opt, p.parMap?.[id] || '') }));

  const zoneJoueur = h('div', { class: 'pile' },
    h('div', { class: 'grille-champs' }, champ('Rôle en jeu', roleJeu), igl ? h('div', { class: 'champ' }, h('span', { class: 'champ__label' }, 'Shotcall'), igl.element) : null),
    avecPersonnages ? h('fieldset', { class: 'compo-editeur' }, h('legend', {}, J.v('personnages', true)),
      h('div', { class: 'grille-champs grille-champs--3' }, principaux.map((x, i) => champ(`Principal ${i + 1}`, x))),
      h('div', { class: 'grille-champs grille-champs--3' }, secondaires.map((x, i) => champ(`Secondaire ${i + 1}`, x)))) : null,
    parMap.length ? h('fieldset', { class: 'compo-editeur' }, h('legend', {}, `${J.v('personnage', true)} par ${J.v('carte')}`),
      h('div', { class: 'grille-champs grille-champs--3' }, parMap.map((x) => champ(nomMap(x.id), x.el)))) : null);
  const zoneStaff = champ('Fonction', fonction);
  const majType = () => {
    const actuel = statut.value || d.statut;
    statut.replaceChildren(...STATUTS_MEMBRE.filter((s) => s.pour === 'tous' || s.pour === type.value).map((s) => h('option', { value: s.id }, s.nom)));
    statut.value = [...statut.options].some((o) => o.value === actuel) ? actuel : statut.options[0].value;
    zoneJoueur.hidden = type.value !== 'joueur';
    zoneStaff.hidden = type.value !== 'staff';
  };
  type.addEventListener('change', majType);
  majType();

  const lire = (els) => [...new Set(els.map((e) => e.value).filter(Boolean))];
  function personnages(joueur) {
    if (!joueur) return SANS_PERSONNAGES;
    if (!avecPersonnages) return { ...SANS_PERSONNAGES, ...p };
    return {
      principaux: lire(principaux),
      secondaires: lire(secondaires),
      parMap: J.aPool() ? Object.fromEntries(parMap.filter((x) => x.el.value).map((x) => [x.id, x.el.value])) : (p.parMap || {}),
    };
  }

  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        const ok = await confirmer('Supprimer ce membre efface aussi ses objectifs, ses chiffres, ses absences et ses disponibilités. Pour garder l’historique, passe-le plutôt en statut « Ancien ».', { libelle: 'Supprimer quand même', danger: true });
        if (!ok) return false;
        await E.supprimer('membres', m._id);
        toast('Membre supprimé.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Ajouter' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const joueur = type.value === 'joueur';
      await E.enregistrer('membres', m?._id || nouvelId('m'), {
        type: type.value, statut: statut.value, pseudo: pseudo.value.trim(), idJeu: idJeu.input.value.trim(),
        roleJeu: joueur ? roleJeu.value : '', igl: joueur && (igl ? igl.input.checked : !!d.igl), fonction: joueur ? '' : fonction.value,
        personnages: personnages(joueur), forces: forces.value.trim(), axes: axes.value.trim(),
      }, { revBase: nouveau ? 0 : m.rev });
      toast(nouveau ? 'Membre ajouté.' : 'Membre enregistré.');
    },
  });

  modale({
    titre: nouveau ? 'Nouveau membre' : (d.pseudo || 'Poste à pourvoir'),
    large: true,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--3' }, champ('Type', type), champ('Statut', statut), champ('Pseudo', pseudo)),
      h('div', { class: 'grille-champs champs-alignes' }, idJeu.element, zoneStaff),
      zoneJoueur,
      h('div', { class: 'grille-champs' }, champ('Points forts', forces), champ('Axes de progrès', axes)),
      h('p', { class: 'texte-3 petit' }, 'Aucun nom réel ni âge : uniquement ce qui sert au jeu.'),
    ],
    actions,
  });
}

function detailMembre(m) {
  const compte = E.compteDuMembre(m._id);
  const editable = E.peut('roster.modifier');
  const joueur = m.type === 'joueur';
  const p = m.personnages || SANS_PERSONNAGES;
  const persos = joueur && J.aPersonnages();
  const parMap = persos && J.aPool() ? Object.entries(p.parMap || {}).filter(([, x]) => x) : [];
  const profil = m.idJeu ? lienProfil(m.idJeu) : null;
  const actions = editable
    ? [{ libelle: 'Fermer' }, { libelle: 'Modifier', classe: 'btn--principal', action: () => { setTimeout(() => editeurMembre(E.doc('membres', m._id) || m), 0); } }]
    : [{ libelle: 'Fermer', classe: 'btn--principal' }];
  const ligne = (titre, ids) => (ids?.length ? [h('dt', {}, titre), h('dd', { class: 'rangee' }, ids.map(jetonPersonnage))] : null);
  modale({
    titre: m.pseudo || 'Poste à pourvoir',
    contenu: [
      h('div', { class: 'rangee' },
        joueur ? jetonRole(m.roleJeu) : puce(libelle(FONCTIONS_STAFF, m.fonction, 'Staff')),
        puce(libelle(STATUTS_MEMBRE, m.statut)),
        m.igl && shotcall() ? puce('IGL', 'accent') : null,
        joueur ? pucePalier(E.palierDe(m._id)) : null),
      m.idJeu ? h('dl', { class: 'details' }, h('dt', {}, 'Identifiant en jeu'), h('dd', { class: 'rangee' }, h('span', {}, m.idJeu), profil)) : null,
      joueur && m.statut !== 'ancien' ? h('p', { class: 'rangee petit' },
        h('a', { href: J.lien(`/progression/${m._id}`) }, 'Progression et chiffres'),
        h('a', { href: J.lien(`/programme/${m._id}`) }, 'Programme individuel')) : null,
      persos && (p.principaux?.length || p.secondaires?.length) ? h('div', { class: 'pile-s' },
        h('h3', {}, J.v('personnages', true)),
        h('dl', { class: 'details details--jetons' }, ligne('Principaux', p.principaux), ligne('Secondaires', p.secondaires))) : null,
      parMap.length ? h('div', { class: 'pile-s' },
        h('h3', {}, `${J.v('personnage', true)} par ${J.v('carte')}`),
        h('dl', { class: 'details details--jetons' }, parMap.map(([map, x]) => [h('dt', {}, nomMap(map)), h('dd', {}, jetonPersonnage(x))]))) : null,
      m.forces ? h('div', { class: 'pile-s' }, h('h3', {}, 'Points forts'), h('p', { class: 'texte-multi' }, m.forces)) : null,
      m.axes ? h('div', { class: 'pile-s' }, h('h3', {}, 'Axes de progrès'), h('p', { class: 'texte-multi' }, m.axes)) : null,
      h('p', { class: 'texte-3 petit' }, compte
        ? `Compte : ${compte.nomAffiche} (${nomsMetiers(compte.metiers).join(', ') || 'aucun métier'})`
        : 'Aucun compte relié à ce profil.'),
      signature(m),
    ],
    actions,
  });
}

function carteMembre(m) {
  const compte = E.compteDuMembre(m._id);
  const joueur = m.type === 'joueur';
  const persos = joueur && J.aPersonnages() ? m.personnages?.principaux || [] : [];
  return h('button', {
    type: 'button',
    class: ['fiche', 'fiche--liseret', 'carte-membre', !m.pseudo && 'carte-membre--vide', joueur && m.roleJeu && J.classeRole(m.roleJeu)],
    'aria-haspopup': 'dialog',
    onclick: () => detailMembre(m),
  },
  h('span', { class: 'carte-membre__pseudo' }, m.pseudo || 'Poste à pourvoir'),
  joueur
    ? h('span', { class: 'rangee' }, jetonRole(m.roleJeu), m.igl && shotcall() ? puce('IGL', 'accent') : null, m.statut === 'essai' ? puce('À l’essai', 'attention') : null)
    : h('span', { class: 'texte-2 petit' }, libelle(FONCTIONS_STAFF, m.fonction, 'Fonction à définir')),
  persos.length ? h('span', { class: 'rangee' }, persos.map(jetonPersonnage)) : null,
  h('span', { class: 'rangee' },
    joueur ? pucePalier(E.palierDe(m._id)) : null,
    compte ? puce(compte.nomAffiche, 'info') : puce('Sans compte')),
  m.idJeu ? h('span', { class: 'texte-3 tres-petit carte-membre__id' }, m.idJeu) : null);
}

// Rôles des titulaires : ceux qui manquent quand il y a assez de places pour tous (le rôle « flex » comble les autres),
// sinon ceux qui sont tenus (battle royale : plus de rôles que de places).
function couverture(titulaires) {
  const places = J.def().equipe?.titulaires || titulaires.length;
  const requis = J.roles().filter((r) => r.id !== 'flex');
  const tenus = new Set(titulaires.map((t) => t.roleJeu).filter(Boolean));
  if (!requis.length) return '';
  if (requis.length > places) {
    const noms = J.roles(true).filter((r) => tenus.has(r.id)).map((r) => r.nom);
    return noms.length ? `Rôles tenus : ${noms.join(', ')}.` : 'Aucun rôle attribué.';
  }
  const manquants = requis.filter((r) => !tenus.has(r.id)).map((r) => r.nom);
  if (!manquants.length) return 'Tous les rôles sont couverts.';
  return `Rôle${manquants.length > 1 ? 's' : ''} non couvert${manquants.length > 1 ? 's' : ''} : ${manquants.join(', ')}.`;
}

export function rendre(page) {
  const eq = E.equipe();
  const joueurs = E.joueurs();
  const titulaires = joueurs.filter((j) => j.statut === 'titulaire');
  const autres = joueurs.filter((j) => j.statut !== 'titulaire');
  const staff = E.membresActifs('staff');
  const anciens = E.liste('membres').filter((m) => m.statut === 'ancien').sort((a, b) => (a.pseudo || '~').localeCompare(b.pseudo || '~', 'fr'));
  const places = J.def().equipe?.titulaires || 0;

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Roster'),
      h('p', { class: 'entete-page__intro' },
        `Joueurs et staff, rôle en jeu${J.aPersonnages() ? ` et ${J.v('personnages')} de chacun` : ''}. Les comptes de connexion se gèrent à part, dans Gestion du jeu.`)),
    h('div', { class: 'entete-page__actions' },
      E.peut('roster.modifier') ? bouton('Ajouter un membre', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeurMembre() }) : null,
      E.peut('equipe.profil') ? bouton('Profil de l’équipe', { icone: 'modifier', onclick: editeurEquipe }) : null)));

  page.append(h('section', { class: 'identite-equipe' },
    h('span', { class: 'identite-equipe__tag' }, eq.tag || '?'),
    h('div', { class: 'pile-s' },
      h('h2', {}, eq.nom || 'Équipe sans nom'),
      eq.devise ? h('p', { class: 'texte-2' }, eq.devise) : null,
      h('div', { class: 'rangee' },
        eq.palierVise ? puce(`Vise : ${J.nomPalier(eq.palierVise)}`, 'accent') : null,
        eq.circuit ? puce(eq.circuit) : null,
        eq.creneaux ? puce(eq.creneaux) : null),
      eq.objectifSaison ? h('p', { class: 'petit' }, eq.objectifSaison) : null)));

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, `Titulaires (${titulaires.length}${places ? `/${places}` : ''})`),
      h('span', { class: 'section__aide' }, couverture(titulaires))),
    titulaires.length ? h('div', { class: 'grille-membres' }, titulaires.map(carteMembre)) : etatVide('Aucun titulaire.')));

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, `Remplaçants et essais (${autres.length})`)),
    autres.length ? h('div', { class: 'grille-membres' }, autres.map(carteMembre)) : h('p', { class: 'texte-3' }, 'Aucun remplaçant.')));

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, `Staff (${staff.length})`)),
    staff.length ? h('div', { class: 'grille-membres' }, staff.map(carteMembre)) : h('p', { class: 'texte-3' }, 'Aucun membre du staff.')));

  if (anciens.length) {
    page.append(h('details', { class: 'section referentiel' },
      h('summary', {}, h('strong', {}, `Anciens (${anciens.length})`)),
      h('div', { class: 'grille-membres' }, anciens.map(carteMembre))));
  }
  page.append(h('p', { class: 'texte-3 petit section' }, icone('info', { classe: 'icone-texte' }),
    ' Le palier de chaque joueur se règle dans ', h('a', { href: J.lien('/progression') }, 'Progression'), '.'));
}
