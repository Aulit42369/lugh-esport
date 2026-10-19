// Méta, suite : import manuel (sans clé API), map pool, personnages groupés par rôle avec leur dernier changement,
// compos pro par map (ou « general »). Vocabulaire, rôles et camps du jeu affiché.

import { h, bouton, toast, onglets, lienExterne, messageErreur, zone } from '../ui.js';
import { symboleRole } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { jetonPersonnage, puce } from '../composants/jetons.js';
import { copierTexte } from '../composants/sorties.js';
import { nomMode, pluriel } from './maps-outils.js';

const TONS_CHANGEMENT = { buff: 'positif', nerf: 'negatif', ajustement: 'info' };
const NOMS_CHANGEMENT = { buff: 'Buff', nerf: 'Nerf', ajustement: 'Ajustement' };

// ——— Import manuel : la consigne part dans une conversation avec Claude (recherche web), la réponse revient ici ———

export function sectionImport(auto) {
  const reponse = zone({ lignes: 6, maxlength: 400_000, placeholder: 'Colle ici la réponse complète de Claude (le bloc JSON suffit).', 'aria-label': 'Réponse de Claude' });
  const importer = bouton('Importer', { classe: 'btn--principal' });
  importer.addEventListener('click', async () => {
    if (!reponse.value.trim()) {
      toast('Colle d’abord la réponse de Claude.', { type: 'erreur' });
      return;
    }
    importer.disabled = true;
    try {
      const r = await E.appeler('POST', '/meta/importer', { texte: reponse.value });
      reponse.value = '';
      E.definirBrouillon(false, 'import-meta');
      await E.synchroniser();
      toast(r.vide ? 'Méta importée : aucun changement depuis la dernière vérification.'
        : 'Méta importée : ce qui a changé est résumé sur cette page, avec les suggestions pour l’équipe.', { duree: 7000 });
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur', duree: 9000 });
    } finally {
      importer.disabled = false;
    }
  });
  return h('details', { class: 'section fiche import-meta', open: !auto, dataset: { brouillon: 'import-meta' } },
    h('summary', {}, h('strong', {}, 'Mise à jour manuelle'),
      h('span', { class: 'texte-3 petit' }, auto ? ' En secours, si la vérification automatique échoue.' : ' Sans vérification automatique : la méta se met à jour en deux copier-coller.')),
    h('ol', { class: 'etapes' },
      h('li', {}, 'Copie la consigne, préparée pour ce jeu : ', bouton('Copier la consigne', {
        icone: 'copier',
        classe: 'btn--petit',
        onclick: async () => {
          try {
            const { texte } = await E.appeler('GET', '/meta/consigne');
            await copierTexte(texte, { titre: 'Consigne pour Claude', succes: 'Consigne copiée.' });
          } catch (err) {
            toast(messageErreur(err), { type: 'erreur' });
          }
        },
      })),
      h('li', {}, 'Ouvre une nouvelle conversation sur claude.ai, active la recherche web, colle la consigne et envoie.'),
      h('li', {}, 'Quand Claude a fini (quelques minutes), copie toute sa réponse et colle-la ci-dessous. Chaque champ est vérifié avant d’être accepté.')),
    reponse,
    h('div', { class: 'rangee' }, importer));
}

// ——— Map pool ———

export function sectionPool(m) {
  const maps = m.maps || [];
  const pool = J.aPool() ? maps.filter((x) => (m.mapPool || []).includes(x.id)) : maps;
  const hors = J.aPool() ? maps.filter((x) => !(m.mapPool || []).includes(x.id)) : [];
  const cartes = J.v('cartes');
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, J.aPool() ? (J.v('carte') === 'map' ? 'Map pool compétitif' : `Pool de ${cartes}`) : `${J.v('cartes', true)} du jeu`),
      h('span', { class: 'section__aide' }, pluriel(pool.length, J.v('carte'), cartes))),
    pool.length ? h('div', { class: 'liste-lignes' }, pool.map((x) => {
      const comps = (m.compsPro?.[x.id] || []).length;
      return h('a', { href: J.lien(`/maps/${x.id}`), class: 'ligne' },
        h('div', { class: 'ligne__principal' }, h('div', { class: 'ligne__titre' }, x.nom), x.noteMeta ? h('div', { class: 'ligne__sous' }, x.noteMeta) : null),
        x.mode ? puce(nomMode(x.mode)) : null,
        x.entreePatch ? puce(`Entrée en ${x.entreePatch}`, 'info') : null,
        comps && J.aPersonnages() ? puce(`${comps} compo${comps > 1 ? 's' : ''} pro`) : null);
    })) : h('p', { class: 'texte-3' }, 'La méta ne donne pas encore de pool.'),
    hors.length ? h('p', { class: 'texte-3 petit marge-haut' },
      `Hors pool : ${hors.map((x) => `${x.nom}${x.sortiePatch ? ` (sortie en ${x.sortiePatch})` : ''}`).join(', ')}.`) : null);
}

// ——— Personnages groupés par rôle ———

function carteChangement(p, avecCamp) {
  const c = p.dernierChangement;
  return h('div', { class: `perso-meta ${J.classeRole(p.role)}` },
    h('div', { class: 'rangee rangee--espace' },
      h('strong', {}, p.nom),
      puce(NOMS_CHANGEMENT[c.type] || c.type, TONS_CHANGEMENT[c.type] || '')),
    h('span', { class: 'texte-3 tres-petit' }, [`${c.patch}`, avecCamp && p.camp ? J.nomCamp(p.camp, p.camp) : ''].filter(Boolean).join(' · ')),
    h('p', { class: 'tres-petit texte-2' }, c.resume));
}

export function sectionPersonnages(m, filtres, rafraichir) {
  const tous = m.personnages || [];
  const avecCamp = J.parCamp();
  const roles = J.roles(true);
  const connus = new Set(roles.map((r) => r.id));
  const groupes = [
    ...roles.map((r) => ({ id: r.id, nom: r.nom, liste: tous.filter((p) => p.role === r.id) })),
    { id: '', nom: 'Autres', liste: tous.filter((p) => !p.role || !connus.has(p.role)) },
  ].filter((g) => g.liste.length && (!filtres.role || g.id === filtres.role));
  const modifies = tous.filter((p) => p.dernierChangement).length;
  const titre = `${J.v('personnages', true)} (${tous.length})`;
  const choixRoles = [{ valeur: '', libelle: 'Tous les rôles' }, ...J.roles().filter((r) => tous.some((p) => p.role === r.id)).map((r) => ({ valeur: r.id, libelle: r.nom }))];

  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, titre),
      h('div', { class: 'rangee' },
        onglets(choixRoles, filtres.role, (v) => { filtres.role = v; rafraichir(); }, { libelle: 'Rôle' }),
        bouton(filtres.modifies ? 'Tout afficher' : `Changements récents (${modifies})`, {
          classe: 'btn--petit',
          disabled: !modifies && !filtres.modifies,
          'aria-pressed': String(filtres.modifies),
          onclick: () => { filtres.modifies = !filtres.modifies; rafraichir(); },
        }))),
    groupes.length ? h('div', { class: 'pile' }, groupes.map((g) => {
      const tries = [...g.liste].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const changes = tries.filter((p) => p.dernierChangement);
      const stables = tries.filter((p) => !p.dernierChangement);
      if (filtres.modifies && !changes.length) return null;
      return h('div', { class: `groupe-role ${J.classeRole(g.id)}` },
        h('h3', { class: 'groupe-role__titre' }, symboleRole(J.indexRole(g.id)), g.nom, h('span', { class: 'texte-3 tres-petit' }, String(g.liste.length))),
        changes.length ? h('div', { class: 'grille-persos' }, changes.map((p) => carteChangement(p, avecCamp))) : null,
        // Noms insécables, séparés par un point médian qui reste accroché au nom précédent (jamais en début de ligne).
        !filtres.modifies && stables.length ? h('p', { class: 'persos-stables' },
          h('span', { class: 'texte-3 tres-petit' }, changes.length ? 'Sans changement récent : ' : 'Aucun changement récent : '),
          stables.map((p, i) => [h('span', { class: 'persos-stables__nom', title: avecCamp && p.camp ? J.nomCamp(p.camp, p.camp) : null },
            p.nom, i < stables.length - 1 ? h('span', { class: 'persos-stables__sep', 'aria-hidden': 'true' }, ' ·') : null), ' '])) : null);
    }).filter(Boolean)) : null,
    filtres.modifies && !modifies ? h('p', { class: 'texte-3' }, 'Aucun changement d’équilibrage relevé sur les derniers patchs.') : null);
}

// ——— Compos pro ———

function compoPro(c) {
  return h('div', { class: 'compo-pro' },
    h('div', { class: 'compo-pro__agents' }, c.personnages.map((p) => jetonPersonnage(p))),
    h('p', { class: 'tres-petit texte-2' }, c.usage || '', c.evenement ? h('span', { class: 'texte-3' }, `${c.usage ? ' · ' : ''}${c.evenement}`) : null,
      c.source ? [' ', lienExterne(c.source, 'source')] : null));
}

export function sectionComposPro(m) {
  const comps = m.compsPro || {};
  if (!J.aPool()) {
    const liste = comps.general || [];
    return h('section', { class: 'section' },
      h('div', { class: 'section__entete' }, h('h2', {}, 'Compos pro les plus jouées'), h('a', { href: J.lien('/maps'), class: 'petit' }, 'Notre compo')),
      liste.length ? h('div', { class: 'fiche pile' }, liste.map(compoPro)) : h('p', { class: 'texte-3' }, 'Aucune compo pro relevée pour ce patch.'));
  }
  const pool = (m.maps || []).filter((x) => (m.mapPool || []).includes(x.id));
  const avec = pool.filter((x) => (comps[x.id] || []).length);
  const sans = pool.filter((x) => !(comps[x.id] || []).length);
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Compos pro les plus jouées')),
    avec.length ? h('div', { class: 'grille-2' }, avec.map((x) => h('div', { class: 'fiche fiche--serree' },
      h('div', { class: 'fiche__titre' }, h('h3', {}, x.nom), h('a', { href: J.lien(`/maps/${x.id}`), class: 'petit' }, 'Notre compo')),
      h('div', { class: 'pile' }, comps[x.id].map(compoPro))))) : h('p', { class: 'texte-3' }, 'Aucune compo pro relevée pour ce patch.'),
    avec.length && sans.length ? h('p', { class: 'texte-3 petit marge-haut' }, `Pas de compo relevée : ${sans.map((x) => x.nom).join(', ')}.`) : null);
}
