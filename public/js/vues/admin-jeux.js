// Administration générale, onglet Jeux : chaque modèle du catalogue s'active d'un interrupteur (l'espace du jeu est
// créé la première fois, puis simplement réactivé) ; désactiver masque le jeu à tous sauf à l'Administrateur général,
// sans rien effacer. « Autre jeu » se crée avec un nom et un identifiant définitif (il nomme la base du jeu).

import { h, modale, confirmer, champ, saisie, bouton, toast, messageErreur, idUnique } from '../ui.js';
import { icone } from '../icones.js';
import { api } from '../api.js';
import * as E from '../etat.js';
import { puce, jauge } from '../composants/jetons.js';
import { topo } from '../composants/topo.js';
import { VUES, PAGES, styleCouleurJeu } from '../navigation.js';
import { GENRES } from '/shared/jeux/commun.js';
import { COULEURS_JEU } from '/shared/couleurs.js';
import { MARQUE } from '/shared/marque.js';
import { idDepuisNom, pastilleJeu, interrupteur, chargement, erreurChargement } from './admin-commun.js';

const ID_AUTRE = 'autre';
const MOTIF_ID = /^[a-z0-9]{2,20}$/;
// Un jeu nommé comme une page de l’appli (#/admin, #/planning…) serait inatteignable par son adresse.
const RESERVES = new Set([...Object.keys(PAGES), ...Object.keys(VUES), 'api', 'shared']);

let cache = null; // dernière réponse de /api/admin/jeux : affichée tout de suite au rendu suivant
const brouillonAutre = { nom: '', id: '', idModifie: false };

const nomGenre = (id) => GENRES.find((g) => g.id === id)?.nom || 'Autre genre';

// Même graine que la page « Mes jeux » : chaque jeu garde son relief et son poste d'une page à l'autre.
function graine(texte) {
  let n = 2166136261;
  for (const c of String(texte)) {
    n ^= c.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

export function rendreJeux(zone, ctx) {
  let affiche = '';
  const dessiner = (d) => {
    affiche = JSON.stringify(d);
    zone.replaceChildren(bilan(d), catalogue(d, ctx), sectionAutre(d, ctx));
  };
  if (cache) dessiner(cache);
  else zone.replaceChildren(chargement());
  api('GET', '/api/admin/jeux')
    .then((d) => {
      cache = d;
      if (JSON.stringify(d) !== affiche) dessiner(d);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => rendreJeux(zone, ctx)));
    });
}

function bilan(d) {
  const actifs = d.jeux.filter((j) => j.actif).length;
  const inactifs = d.jeux.length - actifs;
  const restants = Math.max(0, d.max - d.jeux.length);
  return h('section', { class: 'fiche adm-bilan' },
    h('div', { class: 'adm-bilan__chiffres' },
      h('div', {}, h('span', { class: 'chiffre chiffre--l' }, String(actifs)), h('span', { class: 'texte-3 petit' }, actifs > 1 ? 'jeux actifs' : 'jeu actif')),
      h('div', {}, h('span', { class: 'chiffre chiffre--l' }, String(inactifs)), h('span', { class: 'texte-3 petit' }, `${inactifs > 1 ? 'jeux désactivés' : 'jeu désactivé'}, données gardées`)),
      h('div', {}, h('span', { class: 'chiffre chiffre--l' }, String(restants)), h('span', { class: 'texte-3 petit' }, restants > 1 ? 'places libres' : 'place libre'))),
    h('div', { class: 'adm-bilan__jauge' },
      jauge(Math.round((d.jeux.length / d.max) * 100), { legende: 'Jeux créés', droite: `${d.jeux.length} sur ${d.max}`, couleur: restants ? null : 'var(--brique)' }),
      h('p', { class: 'texte-3 tres-petit' }, `Chaque jeu créé a sa propre base de données : ${d.max} jeux au maximum avec MongoDB Atlas gratuit. Un jeu désactivé compte toujours. Le nombre de comptes d’un jeu n’inclut pas l’Administrateur général, présent partout.`)));
}

function catalogue(d, ctx) {
  const modeles = d.catalogue.filter((m) => m.id !== ID_AUTRE);
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, 'Catalogue'),
      h('p', { class: 'section__aide' }, 'Activer crée l’espace du jeu la première fois (roster à compléter, méta, semaine type), puis le rouvre tel quel.')),
    h('div', { class: 'adm-catalogue' }, modeles.map((m) => carteModele(m, d.jeux.find((j) => j.id === m.id) || null, d, ctx))));
}

function statut(j) {
  if (!j) return puce('Pas encore créé');
  return j.actif ? puce('Actif', 'positif') : puce('Désactivé, données gardées', 'attention');
}

function liensJeu(j, ctx) {
  return h('div', { class: 'adm-actions' },
    bouton('Nom et couleur', { classe: 'btn--petit btn--discret', onclick: () => renommer(j, ctx), 'aria-label': `Nom et couleur de ${j.nom}` }),
    h('a', { href: `#/${encodeURIComponent(j.id)}/reglages`, class: 'btn btn--petit btn--discret', 'aria-label': `Réglages du jeu ${j.nom}` }, 'Réglages'),
    h('a', { href: `#/${encodeURIComponent(j.id)}`, class: 'btn btn--petit adm-actions__ouvrir', 'aria-label': `Ouvrir ${j.nom}` }, 'Ouvrir', icone('droite')),
    j.actif ? null : bouton('Supprimer…', { classe: 'btn--petit btn--discret adm-actions__supprimer', onclick: () => supprimerJeu(j, ctx), 'aria-label': `Supprimer définitivement ${j.nom}` }));
}

// Suppression définitive (jeu désactivé seulement) : export proposé d'abord, puis le nom du jeu à taper.
function supprimerJeu(j, ctx) {
  const confirmation = saisie({ maxlength: 40, autocomplete: 'off', spellcheck: 'false', placeholder: j.nom });
  modale({
    titre: `Supprimer ${j.nom} définitivement ?`,
    contenu: [
      h('div', { class: 'alerte alerte--urgent' }, icone('alerte'),
        h('span', {}, 'Irréversible : toutes les données de ce jeu sont effacées (roster, planning, stratbook, scrims, VOD, méta…). Seul un export permet de les retrouver.')),
      h('ul', { class: 'liste-puces petit' },
        h('li', {}, `Les ${j.comptes} compte${j.comptes > 1 ? 's' : ''} qui y ont accès le perdent (les comptes eux-mêmes restent).`),
        h('li', {}, 'Sa place se libère ; tu pourras le recréer de zéro plus tard.'),
        h('li', {}, 'Sur Discord, rien n’est supprimé : retire à la main sa catégorie et son rôle.')),
      h('p', {}, h('a', { href: `/api/e/${encodeURIComponent(j.id)}/export`, class: 'btn', download: '' }, icone('telecharger'), `Exporter ${j.nom} d’abord`)),
      champ(`Pour confirmer, tape le nom du jeu : ${j.nom}`, confirmation),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Supprimer définitivement',
      classe: 'btn--danger',
      action: async () => {
        if (confirmation.value.trim().toLocaleLowerCase('fr-FR') !== j.nom.toLocaleLowerCase('fr-FR')) throw new Error(`Tape exactement « ${j.nom} ».`);
        const r = await api('POST', `/api/admin/jeux/${encodeURIComponent(j.id)}/supprimer`, { confirmation: confirmation.value });
        if (cache && r?.jeux) cache = { ...cache, jeux: r.jeux };
        const b = r.bilan || {};
        toast(`${j.nom} supprimé définitivement${b.acces ? ` · ${b.acces} accès retiré${b.acces > 1 ? 's' : ''}` : ''}${b.sansJeu ? ` · ${b.sansJeu} compte${b.sansJeu > 1 ? 's' : ''} sans aucun jeu` : ''}.`, { duree: 8000 });
        await ctx.recharger();
      },
    }],
  });
}

function carteModele(m, j, d, ctx) {
  const etat = !j ? 'absent' : (j.actif ? 'actif' : 'inactif');
  const plein = !j && d.jeux.length >= d.max;
  const nom = j?.nom || m.nom;
  const g = graine(m.id);
  return h('article', { class: ['adm-modele', `adm-modele--${etat}`] },
    h('div', { class: 'adm-modele__terrain' },
      topo({ largeur: 480, hauteur: 120, graine: `jeu-${m.id}`, colonnes: 40, niveaux: 8, bosses: 6, classe: 'topo adm-modele__fond' }),
      j ? h('span', { class: 'adm-modele__poste', 'aria-hidden': 'true', style: { left: `${56 + (g % 27)}%`, top: `${30 + ((g >>> 8) % 30)}%` } }) : null,
      h('span', { class: 'puce-jeu adm-modele__code', style: j ? styleCouleurJeu(j.couleur) : null }, j?.court || m.court)),
    h('div', { class: 'adm-modele__corps' },
      h('div', {},
        h('h3', { class: 'adm-modele__nom' }, nom),
        h('p', { class: 'adm-modele__genre' }, [nomGenre(m.genre), m.editeur].filter(Boolean).join(' · '),
          j && j.nom !== m.nom ? ` · modèle ${m.nom}` : '')),
      h('dl', { class: 'adm-faits' },
        h('div', {}, h('dt', {}, 'Équipe'), h('dd', {}, `${m.titulaires} titulaires`)),
        h('div', {}, h('dt', {}, 'Comptes'), h('dd', {}, j ? String(j.comptes) : '—')),
        h('div', { class: 'adm-faits__large' }, h('dt', {}, 'Patch à la livraison'), h('dd', {}, m.patch || '—'))),
      h('div', { class: 'adm-modele__pied' },
        interrupteur({ coche: etat === 'actif', nom, desactive: plein, surChange: (input, remettre) => basculer(input, remettre, { modele: m.id, jeu: j, nom }, ctx) }),
        statut(j)),
      plein ? h('p', { class: 'texte-3 tres-petit' }, `Limite de ${d.max} jeux atteinte : un jeu désactivé occupe toujours sa place.`) : null,
      j ? liensJeu(j, ctx) : null));
}

async function basculer(input, remettre, { modele, jeu, nom }, ctx) {
  const voulu = input.checked;
  if (!voulu) {
    remettre(true);
    const ok = await confirmer(`${nom} disparaîtra pour tous les comptes, sauf pour l’Administrateur général. Ses données sont conservées : elles reviennent telles quelles à la réactivation.`,
      { titre: `Désactiver ${nom} ?`, libelle: 'Désactiver', danger: true });
    if (!ok) return;
    remettre(false);
  }
  const bloc = input.closest('.adm-modele, .adm-autre__jeu');
  input.disabled = true;
  bloc?.setAttribute('aria-busy', 'true');
  try {
    let r;
    if (!voulu) r = await api('PUT', `/api/admin/jeux/${encodeURIComponent(jeu.id)}`, { actif: false });
    else if (jeu?.modele === ID_AUTRE) r = await api('PUT', `/api/admin/jeux/${encodeURIComponent(jeu.id)}`, { actif: true });
    else r = await api('POST', '/api/admin/jeux', { modele });
    if (cache && r?.jeux) cache = { ...cache, jeux: r.jeux };
    if (!voulu) toast(`${nom} désactivé. Ses données sont conservées.`);
    else toast(jeu ? `${nom} réactivé : ses données sont revenues.` : `${nom} activé : son espace est prêt.`);
    await ctx.recharger();
  } catch (err) {
    remettre(!voulu);
    toast(messageErreur(err), { type: 'erreur' });
  } finally {
    input.disabled = false;
    bloc?.removeAttribute('aria-busy');
  }
}

// Couleur du jeu : palette fermée (shared/couleurs.js), son nom écrit à côté de chaque teinte.
function choixCouleur(j) {
  const prises = new Map((cache?.jeux || []).filter((x) => x.id !== j.id && x.couleur).map((x) => [x.couleur, x.nom]));
  const groupe = idUnique('couleur-jeu');
  const element = h('fieldset', { class: 'adm-couleurs' },
    h('legend', {}, 'Couleur du jeu'),
    h('p', { class: 'texte-3 tres-petit' }, 'Elle teinte la pastille, le rail et l’en-tête quand ce jeu est ouvert : on voit d’un coup d’œil dans quel jeu on saisit.'),
    h('div', { class: 'adm-couleurs__grille' }, COULEURS_JEU.map((c) => h('label', { class: 'adm-couleur' },
      h('input', { type: 'radio', name: groupe, value: c.id, checked: c.id === j.couleur }),
      h('span', { class: 'adm-couleur__pastille', 'aria-hidden': 'true', style: styleCouleurJeu(c.id) }),
      h('span', { class: 'adm-couleur__nom' }, c.nom, prises.has(c.id) ? h('small', {}, prises.get(c.id)) : null)))));
  return { element, lire: () => element.querySelector('input:checked')?.value || '' };
}

function renommer(j, ctx) {
  const nom = saisie({ valeur: j.nom, maxlength: 40, required: true, autocomplete: 'off' });
  const court = saisie({ valeur: j.court, maxlength: 12, required: true, autocomplete: 'off' });
  const couleur = choixCouleur(j);
  modale({
    titre: `Nom et couleur de ${j.nom}`,
    contenu: [
      h('div', { class: 'grille-champs' },
        champ('Nom du jeu', nom, { aide: 'Affiché partout dans l’espace du jeu et la navigation.' }),
        champ('Nom court', court, { aide: 'Sur la pastille du jeu (5 caractères au plus, sinon ses initiales).' })),
      couleur.element,
      h('p', { class: 'texte-3 petit' }, `Identifiant (définitif) : ${j.id} · adresse #/${j.id}`),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const n = nom.value.trim().replace(/\s+/g, ' ');
        if (n.length < 2) throw new Error('Nom du jeu : 2 caractères au moins.');
        if (!court.value.trim()) throw new Error('Indique un nom court (ex. VAL, LoL).');
        const corps = { nom: n, court: court.value.trim() };
        if (couleur.lire()) corps.couleur = couleur.lire();
        const r = await api('PUT', `/api/admin/jeux/${encodeURIComponent(j.id)}`, corps);
        if (cache && r?.jeux) cache = { ...cache, jeux: r.jeux };
        toast('Jeu enregistré.');
        await ctx.recharger();
      },
    }],
  });
}

// ——— Autre jeu ———

function sectionAutre(d, ctx) {
  const autres = d.jeux.filter((j) => j.modele === ID_AUTRE);
  const modele = d.catalogue.find((m) => m.id === ID_AUTRE);
  return h('section', { class: 'section adm-autre' },
    h('div', { class: 'section__entete' },
      h('h2', {}, 'Autre jeu'),
      h('p', { class: 'section__aide' }, 'Pour un jeu sans modèle dédié : un modèle neutre, à adapter ensuite dans ses Réglages du jeu (vocabulaire, rôles, rangs, score…).')),
    h('div', { class: 'adm-autre__grille' },
      formulaireAutre(d, ctx),
      h('div', { class: 'pile-s' },
        h('h3', { class: 'adm-autre__titre' }, autres.length ? `Jeux créés avec ce modèle (${autres.length})` : 'Aucun jeu créé avec ce modèle'),
        autres.map((j) => ligneAutre(j, ctx)),
        modele ? h('p', { class: 'texte-3 tres-petit' }, `Équipe de départ : ${modele.titulaires} titulaires · score simple · ni maps ni personnages (à régler).`) : null)));
}

function problemeId(id, d) {
  if (!id) return 'Choisis un identifiant.';
  if (!MOTIF_ID.test(id)) return 'Identifiant : 2 à 20 lettres minuscules sans accent ou chiffres.';
  const modele = d.catalogue.find((m) => m.id === id);
  if (modele) return `« ${id} » est réservé au modèle ${modele.nom} : active plutôt ce modèle, ou choisis un autre identifiant.`;
  if (d.jeux.some((j) => j.id === id)) return 'Un jeu existe déjà avec cet identifiant.';
  if (RESERVES.has(id)) return `« ${id} » est déjà l’adresse d’une page : choisis un autre identifiant.`;
  return '';
}

function formulaireAutre(d, ctx) {
  const plein = d.jeux.length >= d.max;
  const nom = saisie({ valeur: brouillonAutre.nom, maxlength: 40, placeholder: 'ex. Marvel Rivals', autocomplete: 'off', disabled: plein });
  const id = saisie({ valeur: brouillonAutre.id, maxlength: 20, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', disabled: plein });
  const apercu = h('p', { class: 'adm-autre__apercu', 'aria-live': 'polite' });
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const controler = () => {
    const p = id.value ? problemeId(id.value, d) : '';
    id.setAttribute('aria-invalid', p ? 'true' : 'false');
    apercu.replaceChildren(...(id.value
      ? [h('span', {}, 'Adresse '), h('code', {}, `#/${id.value}`), h('span', {}, ' · base '), h('code', {}, `${MARQUE.id}_${id.value}`)]
      : [h('span', {}, 'L’identifiant se propose à partir du nom.')]));
    erreur.textContent = p;
  };
  nom.addEventListener('input', () => {
    brouillonAutre.nom = nom.value;
    if (!brouillonAutre.idModifie) {
      id.value = idDepuisNom(nom.value);
      brouillonAutre.id = id.value;
    }
    controler();
  });
  id.addEventListener('input', () => {
    id.value = id.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    brouillonAutre.id = id.value;
    brouillonAutre.idModifie = !!id.value && id.value !== idDepuisNom(nom.value);
    controler();
  });
  controler();

  const creer = bouton('Créer le jeu', { classe: 'btn--principal', icone: 'ajouter', type: 'submit', disabled: plein });
  return h('form', {
    class: 'fiche adm-autre__formulaire',
    dataset: { brouillon: 'admin-autre-jeu' },
    onsubmit: async (e) => {
      e.preventDefault();
      const n = nom.value.trim().replace(/\s+/g, ' ');
      const p = n.length < 2 ? 'Nom du jeu : 2 caractères au moins.' : problemeId(id.value, d);
      erreur.textContent = p;
      if (p) return;
      const ok = await confirmer(`Créer « ${n} » avec l’identifiant « ${id.value} » ? Cet identifiant ne pourra plus jamais changer : il nomme la base de données du jeu (${MARQUE.id}_${id.value}) et ses adresses (#/${id.value}). Le nom, lui, restera modifiable.`,
        { titre: 'Créer ce jeu ?', libelle: 'Créer le jeu' });
      if (!ok) return;
      creer.disabled = true;
      creer.setAttribute('aria-busy', 'true');
      try {
        const r = await api('POST', '/api/admin/jeux', { modele: ID_AUTRE, nom: n, id: id.value });
        if (cache && r?.jeux) cache = { ...cache, jeux: r.jeux };
        Object.assign(brouillonAutre, { nom: '', id: '', idModifie: false });
        E.definirBrouillon(false, 'admin-autre-jeu');
        toast(`${n} créé. Adapte-le maintenant dans ses Réglages du jeu.`);
        await ctx.recharger();
      } catch (err) {
        erreur.textContent = messageErreur(err);
      } finally {
        creer.disabled = false;
        creer.removeAttribute('aria-busy');
      }
    },
  },
  h('h3', {}, 'Créer un jeu'),
  champ('Nom du jeu', nom),
  champ('Identifiant', id, { aide: '2 à 20 lettres minuscules sans accent ou chiffres. Proposé depuis le nom, modifiable avant la création.' }),
  apercu,
  h('div', { class: 'alerte alerte--attention' }, icone('alerte'),
    h('span', {}, 'L’identifiant est définitif : il nomme la base de données du jeu et ses adresses. Seul le nom pourra changer ensuite.')),
  erreur,
  plein ? h('p', { class: 'texte-3 petit' }, `Limite de ${d.max} jeux atteinte.`) : null,
  h('div', {}, creer));
}

function ligneAutre(j, ctx) {
  return h('div', { class: ['adm-autre__jeu', !j.actif && 'adm-autre__jeu--inactif'] },
    pastilleJeu(j),
    h('div', { class: 'adm-autre__texte' },
      h('strong', {}, j.nom),
      h('span', { class: 'texte-3 tres-petit' }, `#/${j.id} · ${j.comptes} compte${j.comptes > 1 ? 's' : ''}`)),
    interrupteur({ coche: j.actif, nom: j.nom, surChange: (input, remettre) => basculer(input, remettre, { modele: ID_AUTRE, jeu: j, nom: j.nom }, ctx) }),
    liensJeu(j, ctx));
}
