// Bibliothèque : astuces de l'équipe (lineups dans un FPS tactique), par map, par personnage et par camp quand le jeu
// en a, reliées aux strats ; ressources utiles (guides, vidéos, outils). Vocabulaire et listes du jeu affiché.

import { h, modale, confirmer, champ, saisie, zone, liste, onglets, bouton, toast, etatVide, lienExterne } from '../ui.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jetonPersonnage, nomMap, nomPersonnage, optionsPersonnages, puce, signature } from '../composants/jetons.js';
import { CATEGORIES_RESSOURCE, libelle } from '/shared/referentiel.js';
import { nouvelId } from '/shared/validation.js';
import { filtresDuJeu, optionsAvec, optionsCartes, optionsCamps, etiquetteCamp, accord, guillemets, pluriel } from './maps-outils.js';

const DEFAUTS = { map: '', personnage: '', camp: '', texte: '' };
const filtres = { jeu: '', ...DEFAUTS };

const tous = (mot) => accord(mot, 'Tous', 'Toutes');

function editeur(item = null, type = 'astuce') {
  const nouveau = !item;
  const d = item || {
    type, titre: '', lien: '', map: filtres.map, personnage: filtres.personnage, camp: filtres.camp, site: '', categorie: 'guide', description: '',
  };
  const astuce = J.v('astuce', true);
  const choixType = liste([{ valeur: 'astuce', libelle: astuce }, { valeur: 'ressource', libelle: 'Ressource' }], { valeur: d.type });
  const titre = saisie({ valeur: d.titre, maxlength: 80, required: true });
  const lien = saisie({ type: 'url', valeur: d.lien, placeholder: 'https://… (vidéo, image, article)', maxlength: 500 });
  const map = J.aCartes()
    ? liste(optionsAvec(optionsCartes(), d.map, nomMap(d.map)), { valeur: d.map, vide: J.aPool() ? 'Choisir' : accord(J.v('carte'), 'Aucun', 'Aucune') })
    : null;
  const camp = J.camps().length ? liste(optionsAvec(optionsCamps(), d.camp, J.nomCamp(d.camp)), { valeur: d.camp, vide: 'Les deux' }) : null;
  const personnage = J.aPersonnages() ? h('select', { class: 'saisie' }) : null;
  // Personnages du camp choisi (Rainbow Six : opérateurs d'attaque ou de défense) ; la valeur enregistrée reste proposée.
  const majPersonnages = () => {
    if (!personnage) return;
    const actuel = personnage.value || d.personnage;
    const options = optionsAvec(optionsPersonnages({ camp: camp?.value || '' }), d.personnage, nomPersonnage(d.personnage));
    const opt = (o) => h('option', { value: o.valeur }, o.libelle);
    personnage.replaceChildren(h('option', { value: '' }, 'Choisir'),
      ...options.map((o) => (o.groupe ? h('optgroup', { label: o.groupe }, o.options.map(opt)) : opt(o))));
    personnage.value = actuel;
    if (personnage.value !== actuel) personnage.value = '';
  };
  camp?.addEventListener('change', majPersonnages);
  majPersonnages();
  const site = saisie({ valeur: d.site, maxlength: 20, placeholder: 'Zone, site, position…' });
  const categorie = liste(CATEGORIES_RESSOURCE.map((c) => ({ valeur: c.id, libelle: c.nom })), { valeur: d.categorie || 'guide' });
  const description = zone({ valeur: d.description, lignes: 3, maxlength: 500 });
  const zoneAstuce = h('div', { class: 'grille-champs grille-champs--haut' },
    map ? champ(J.v('carte', true), map) : null,
    camp ? champ('Camp', camp) : null,
    personnage ? champ(J.v('personnage', true), personnage) : null,
    champ('Site ou zone', site));
  const zoneRessource = champ('Catégorie', categorie);
  const majType = () => {
    zoneAstuce.hidden = choixType.value !== 'astuce';
    zoneRessource.hidden = choixType.value !== 'ressource';
  };
  choixType.addEventListener('change', majType);
  majType();

  const actions = [];
  if (!nouveau) {
    actions.push({
      libelle: 'Supprimer',
      classe: 'btn--danger',
      action: async () => {
        if (!(await confirmer(`Supprimer ${guillemets(d.titre)} ?`, { libelle: 'Supprimer', danger: true }))) return false;
        await E.supprimer('bibliotheque', item._id);
        toast('Supprimé de la bibliothèque.');
      },
    });
  }
  actions.push({ libelle: 'Annuler' }, {
    libelle: nouveau ? 'Ajouter' : 'Enregistrer',
    classe: 'btn--principal',
    action: async () => {
      const estAstuce = choixType.value === 'astuce';
      const valeur = {
        type: choixType.value, titre: titre.value.trim(), lien: lien.value.trim(), description: description.value.trim(),
        map: estAstuce && map ? map.value : '', personnage: estAstuce && personnage ? personnage.value : '',
        camp: estAstuce && camp ? camp.value : '', site: estAstuce ? site.value.trim() : '', categorie: estAstuce ? '' : categorie.value,
      };
      if (!valeur.titre) throw new Error('Donne un titre.');
      if (estAstuce && J.aPool() && !valeur.map) throw new Error(`${J.v('carte', true)} obligatoire.`);
      if (!estAstuce && !valeur.lien) throw new Error('Une ressource a besoin d’un lien https.');
      await E.enregistrer('bibliotheque', item?._id || nouvelId('l'), valeur, { revBase: nouveau ? 0 : item.rev });
      toast(nouveau ? 'Ajouté à la bibliothèque.' : 'Enregistré.');
    },
  });
  modale({
    titre: nouveau ? 'Ajouter à la bibliothèque' : d.titre,
    contenu: [
      h('div', { class: 'grille-champs grille-champs--haut' }, champ('Type', choixType), champ('Titre', titre)),
      champ('Lien', lien), zoneAstuce, zoneRessource, champ('Description', description)],
    actions,
  });
}

function carte(item, editable) {
  const strats = E.liste('strats').filter((s) => (s.lineups || []).includes(item._id));
  const lienStrats = J.aPool() && strats[0]?.map ? `/strats/${strats[0].map}` : '/strats';
  return h('article', { class: 'fiche fiche--serree carte-biblio' },
    h('div', { class: 'rangee rangee--espace rangee--haut' },
      h('strong', { class: 'carte-biblio__titre' }, item.titre),
      editable ? bouton('Modifier', { classe: 'btn--discret btn--petit', onclick: () => editeur(item) }) : null),
    item.type === 'astuce'
      ? h('div', { class: 'rangee' },
        item.map ? puce(nomMap(item.map), 'plein') : null,
        item.personnage ? jetonPersonnage(item.personnage) : null,
        item.camp ? etiquetteCamp(item.camp, { classe: 'puce' }) : null,
        item.site ? puce(item.site) : null)
      : h('div', { class: 'rangee' }, puce(libelle(CATEGORIES_RESSOURCE, item.categorie, 'Ressource'), 'info')),
    item.description ? h('p', { class: 'petit texte-2 texte-multi' }, item.description) : null,
    h('div', { class: 'rangee rangee--espace' },
      item.lien ? lienExterne(item.lien, 'Ouvrir le lien', { classe: 'petit' }) : h('span', { class: 'texte-3 tres-petit' }, 'Pas de lien'),
      strats.length ? h('a', { href: J.lien(lienStrats), class: 'tres-petit' }, `Dans ${pluriel(strats.length, 'strat')}`) : null),
    signature(item));
}

export function rendre(page, params, ctx) {
  filtresDuJeu(filtres, DEFAUTS);
  const onglet = params[0] === 'ressources' ? 'ressource' : 'astuce';
  const editable = E.peut('bibliotheque.modifier');
  const toute = E.liste('bibliotheque');
  const astuces = J.v('astuces');
  const duType = toute.filter((b) => b.type === onglet);
  const texte = filtres.texte.toLowerCase();
  const garde = (b) => onglet !== 'astuce' || ((!filtres.map || b.map === filtres.map)
    && (!filtres.personnage || b.personnage === filtres.personnage)
    && (!filtres.camp || !b.camp || b.camp === filtres.camp));
  const visibles = duType.filter((b) => garde(b) && (!texte || `${b.titre} ${b.description}`.toLowerCase().includes(texte)))
    .sort((a, b) => nomMap(a.map).localeCompare(nomMap(b.map), 'fr') || a.titre.localeCompare(b.titre, 'fr'));
  const par = [J.aCartes() ? `par ${J.v('carte')}` : '', J.aPersonnages() ? `par ${J.v('personnage')}` : ''].filter(Boolean).join(' et ');

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Bibliothèque'),
      h('p', { class: 'entete-page__intro' },
        `Les ${astuces} de l’équipe${par ? `, ${par}` : ''}, et les ressources utiles. Chacun peut y ajouter ce qu’il trouve ; les ${astuces} se relient ensuite aux strats.`)),
    editable ? h('div', { class: 'entete-page__actions' }, bouton('Ajouter', { icone: 'ajouter', classe: 'btn--principal', onclick: () => editeur(null, onglet) })) : null));

  const compte = (type) => toute.filter((b) => b.type === type).length;
  page.append(h('div', { class: 'barre-outils' },
    onglets([{ valeur: 'astuce', libelle: `${J.v('astuces', true)} (${compte('astuce')})` }, { valeur: 'ressource', libelle: `Ressources (${compte('ressource')})` }],
      onglet, (v) => ctx.aller(J.lien(v === 'ressource' ? '/bibliotheque/ressources' : '/bibliotheque')), { libelle: 'Type' })));

  const recherche = saisie({ type: 'search', valeur: filtres.texte, placeholder: 'Titre ou description' });
  recherche.addEventListener('change', () => { filtres.texte = recherche.value; ctx.rafraichir(); });
  const filtrer = (cle) => (e) => { filtres[cle] = e.target.value; ctx.rafraichir(); };
  page.append(h('div', { class: 'filtres' },
    onglet === 'astuce' ? [
      J.aCartes() ? champ(J.v('carte', true), liste(optionsCartes(), { valeur: filtres.map, vide: tous(J.v('cartes')), onchange: filtrer('map') })) : null,
      J.camps().length ? champ('Camp', liste(optionsCamps(), { valeur: filtres.camp, vide: 'Tous', onchange: filtrer('camp') })) : null,
      J.aPersonnages() ? champ(J.v('personnage', true), liste(optionsAvec(optionsPersonnages({ camp: filtres.camp }), filtres.personnage, nomPersonnage(filtres.personnage)),
        { valeur: filtres.personnage, vide: tous(J.v('personnages')), onchange: filtrer('personnage') })) : null,
    ] : null,
    champ('Rechercher', recherche)));

  if (!visibles.length) {
    page.append(etatVide(duType.length ? 'Rien ne correspond à ces filtres.'
      : (onglet === 'astuce' ? 'Rien ici pour l’instant. Ajoute ce que l’équipe utilise déjà, avec un lien vidéo ou image.' : 'Aucune ressource pour l’instant.'),
    editable ? bouton('Ajouter', { classe: 'btn--principal', onclick: () => editeur(null, onglet) }) : null));
    return;
  }
  page.append(h('div', { class: 'grille-biblio' }, visibles.map((b) => carte(b, editable))));
}
