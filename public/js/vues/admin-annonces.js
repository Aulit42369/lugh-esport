// Administration générale, onglet Annonces : messages affichés en tête de l'accueil de tous les jeux ou de certains.
// En cours d'abord, expirées repliées ; pour chacune, qui l'a lue (et quand) et qui ne l'a pas encore lue.

import { h, modale, confirmer, champ, saisie, zone as zoneTexte, caseACocher, bouton, toast, messageErreur, etatVide } from '../ui.js';
import { icone } from '../icones.js';
import { api } from '../api.js';
import { puce } from '../composants/jetons.js';
import { puceJeu } from '../navigation.js';
import { formatDate, formatHorodatage } from '/shared/temps.js';
import { chargement, erreurChargement } from './admin-commun.js';

let cache = null;

export function rendreAnnonces(zone, ctx) {
  let affiche = '';
  const dessiner = (d) => {
    affiche = JSON.stringify(d);
    zone.replaceChildren(...contenu(d, () => rendreAnnonces(zone, ctx)).filter(Boolean));
  };
  if (cache) dessiner(cache);
  else zone.replaceChildren(chargement());
  Promise.all([api('GET', '/api/admin/annonces'), api('GET', '/api/admin/jeux')])
    .then(([a, j]) => {
      cache = { ...a, jeux: j.jeux.map(({ id, nom, court, couleur, actif }) => ({ id, nom, court, couleur, actif })) };
      if (JSON.stringify(cache) !== affiche) dessiner(cache);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => rendreAnnonces(zone, ctx)));
    });
}

function contenu(d, recharger) {
  const enCours = d.annonces.filter((a) => a.enCours);
  const expirees = d.annonces.filter((a) => !a.enCours);
  const plein = d.annonces.length >= d.max;
  const carte = (a) => carteAnnonce(a, d, recharger);
  return [
    h('div', { class: 'barre-outils adm-barre' },
      h('p', { class: 'texte-2 petit' }, `${d.annonces.length} annonce${d.annonces.length > 1 ? 's' : ''} sur ${d.max} au plus`,
        plein ? ' : supprime les plus anciennes pour en publier une nouvelle.' : '.'),
      bouton('Nouvelle annonce', { icone: 'ajouter', classe: 'btn--principal', onclick: () => fenetreAnnonce(null, d, recharger) })),
    h('section', { class: 'pile-s', 'aria-label': 'Annonces en cours' },
      enCours.length ? enCours.map(carte) : etatVide('Aucune annonce en cours. Une annonce s’affiche en tête de l’accueil des jeux visés.')),
    expirees.length
      ? h('details', { class: 'fiche adm-repli' },
        h('summary', {}, `Annonces expirées (${expirees.length})`),
        h('div', { class: 'pile-s' }, expirees.map(carte)))
      : null,
  ];
}

function ciblage(a, d) {
  if (!a.jeux.length) return h('span', { class: 'adm-annonce__cible' }, icone('structure', { classe: 'icone-texte' }), ' Tous les jeux');
  return h('span', { class: 'adm-annonce__cible' }, a.jeux.map((id) => {
    const j = d.jeux.find((x) => x.id === id) || { id, nom: id, court: id };
    return h('span', { class: 'adm-annonce__jeu' }, puceJeu(j), j.nom);
  }));
}

function lectures(a) {
  const total = a.lus.length + a.nonLus.length;
  if (!total) return h('p', { class: 'texte-3 petit' }, 'Aucun compte concerné pour l’instant.');
  return h('details', { class: 'adm-lectures' },
    h('summary', {}, h('strong', {}, `Lu par ${a.lus.length} sur ${total}`),
      a.nonLus.length ? h('span', { class: 'texte-3' }, ` · ${a.nonLus.length} pas encore`) : h('span', { class: 'texte-positif' }, ' · lue par tous')),
    h('div', { class: 'adm-lectures__colonnes' },
      h('div', {}, h('h4', { class: 'adm-carte__titre' }, 'Lue'),
        a.lus.length
          ? h('ul', { class: 'adm-lectures__liste' }, [...a.lus].sort((x, y) => String(y.le).localeCompare(String(x.le)))
            .map((l) => h('li', {}, h('span', {}, l.nomAffiche), h('span', { class: 'texte-3 tres-petit' }, formatHorodatage(l.le)))))
          : h('p', { class: 'texte-3 petit' }, 'Personne pour l’instant.')),
      h('div', {}, h('h4', { class: 'adm-carte__titre' }, 'Pas encore lue'),
        a.nonLus.length
          ? h('ul', { class: 'adm-lectures__liste adm-lectures__noms' }, a.nonLus.map((n) => h('li', {}, n)))
          : h('p', { class: 'texte-3 petit' }, 'Tout le monde l’a lue.'))));
}

function carteAnnonce(a, d, recharger) {
  return h('article', { class: ['fiche adm-annonce', a.importante && 'adm-annonce--importante', !a.enCours && 'adm-annonce--expiree'] },
    h('header', { class: 'adm-annonce__tete' },
      h('h3', { class: 'adm-annonce__titre' }, a.importante ? icone('alerte', { classe: 'icone-texte' }) : icone('annonce', { classe: 'icone-texte' }), ' ', a.titre),
      a.importante ? puce('Importante', 'attention') : null,
      a.enCours ? null : puce('Expirée', '')),
    h('p', { class: 'adm-annonce__infos texte-3 petit' }, ciblage(a, d),
      h('span', {}, `Publiée le ${formatHorodatage(a.creeLe)}${a.auteur ? ` par ${a.auteur}` : ''}`),
      a.modifieLe ? h('span', {}, `modifiée le ${formatHorodatage(a.modifieLe)}`) : null,
      h('span', {}, a.expireLe ? `${a.enCours ? 'jusqu’au' : 'expirée le'} ${formatDate(a.expireLe)}` : 'sans date de fin')),
    h('p', { class: 'adm-annonce__texte' }, a.texte),
    lectures(a),
    h('div', { class: 'adm-actions' },
      bouton('Modifier', { icone: 'modifier', classe: 'btn--petit', onclick: () => fenetreAnnonce(a, d, recharger) }),
      bouton('Supprimer', { icone: 'supprimer', classe: 'btn--petit btn--discret', onclick: () => supprimer(a, recharger) })));
}

async function supprimer(a, recharger) {
  const ok = await confirmer(`Supprimer l’annonce « ${a.titre} » ? Elle disparaît de l’accueil de chacun, avec le suivi des lectures.`,
    { titre: 'Supprimer l’annonce', libelle: 'Supprimer', danger: true });
  if (!ok) return;
  try {
    await api('DELETE', `/api/admin/annonces/${encodeURIComponent(a._id)}`);
    toast('Annonce supprimée.');
    recharger();
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

function fenetreAnnonce(a, d, recharger) {
  const titre = saisie({ valeur: a?.titre || '', maxlength: 80, required: true, autocomplete: 'off' });
  const texte = zoneTexte({ valeur: a?.texte || '', maxlength: 1500, lignes: 6, required: true });
  const compteur = h('span', { class: 'texte-3 tres-petit', 'aria-live': 'polite' });
  const compter = () => { compteur.textContent = `${texte.value.length} / 1500`; };
  texte.addEventListener('input', compter);
  compter();
  const importante = caseACocher('Importante : mise en avant en tête de l’accueil', { coche: a?.importante });
  const expire = saisie({ type: 'date', valeur: a?.expireLe || '' });
  // Jeux actifs, plus ceux déjà visés s'ils ont été désactivés depuis.
  const jeux = d.jeux.filter((j) => j.actif || a?.jeux.includes(j.id));
  const cases = jeux.map((j) => ({ id: j.id, ...caseACocher([puceJeu(j), ' ', j.nom, j.actif ? '' : ' (désactivé)'], { coche: a?.jeux.includes(j.id) }) }));
  const relire = a ? caseACocher('Remettre les lectures à zéro (tout le monde la reverra comme nouvelle)') : null;
  // Nouvelle annonce seulement : reprise dans #annonces du serveur Discord (une annonce importante y mentionne @everyone).
  const surDiscord = !a && d.discord ? caseACocher('Publier aussi dans #annonces sur Discord (importante : @everyone)', { coche: true }) : null;

  modale({
    titre: a ? 'Modifier l’annonce' : 'Nouvelle annonce',
    large: true,
    contenu: [
      champ('Titre', titre, { aide: '80 caractères au plus.' }),
      champ('Texte', texte, { aide: 'Retours à la ligne gardés. 1500 caractères au plus.' }),
      compteur,
      importante.element,
      h('fieldset', { class: 'adm-cases' },
        h('legend', { class: 'champ__label' }, 'Jeux visés'),
        h('p', { class: 'champ__aide' }, 'Aucun coché : tous les jeux, y compris ceux ajoutés plus tard.'),
        h('div', { class: 'adm-cases__grille' }, cases.map((c) => c.element))),
      champ('Expire le (facultatif)', expire, { aide: 'Passé ce jour, l’annonce quitte l’accueil et rejoint les expirées.' }),
      relire ? relire.element : null,
      surDiscord ? surDiscord.element : null,
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: a ? 'Enregistrer' : 'Publier',
      classe: 'btn--principal',
      action: async () => {
        if (!titre.value.trim()) throw new Error('Indique un titre.');
        if (!texte.value.trim()) throw new Error('Écris le texte de l’annonce.');
        const corps = {
          titre: titre.value.trim(),
          texte: texte.value.trim(),
          importante: importante.input.checked,
          jeux: cases.filter((c) => c.input.checked).map((c) => c.id),
          expireLe: expire.value || '',
        };
        if (a) {
          if (relire.input.checked) corps.relire = true;
          await api('PUT', `/api/admin/annonces/${encodeURIComponent(a._id)}`, corps);
          toast('Annonce enregistrée.');
        } else {
          corps.discord = !!surDiscord?.input.checked;
          const r = await api('POST', '/api/admin/annonces', corps);
          if (r.discord === 'echec') toast('Annonce publiée dans Lugh, mais Discord l’a refusée : vérifie le webhook (Administration → Discord).', { type: 'erreur', duree: 8000 });
          else toast(r.discord === 'envoyee' ? 'Annonce publiée, ici et sur Discord.' : 'Annonce publiée.');
        }
        recharger();
      },
    }],
  });
}
