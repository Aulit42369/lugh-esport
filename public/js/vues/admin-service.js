// Administration générale, onglet Service : état du serveur (version, base, clé API Claude, réveil externe),
// une ligne par jeu (méta, vérification automatique, coût du mois, Discord) et le journal général de tous les jeux.

import { MARQUE } from '/shared/marque.js';
import { h, champ, liste, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import { api } from '../api.js';
import { puce } from '../composants/jetons.js';
import { ilYA, formatHorodatage } from '/shared/temps.js';
import { pastilleJeu, listeJournal, chargement, erreurChargement, dollars, moisCourant, tableauCouts } from './admin-commun.js';

let cache = null; // { etat, entrees, comptes, jeux }
const filtre = { jeu: '*', tout: false };

export function rendreService(zone, ctx) {
  let affiche = '';
  const dessiner = (d) => {
    affiche = JSON.stringify(d);
    zone.replaceChildren(...contenu(d));
  };
  if (cache) dessiner(cache);
  else zone.replaceChildren(chargement());
  Promise.all([api('GET', '/api/admin/etat'), api('GET', '/api/admin/journal'), api('GET', '/api/admin/comptes'), api('GET', '/api/admin/jeux')])
    .then(([etat, journal, comptes, jeux]) => {
      cache = { etat, entrees: journal.entrees, comptes: comptes.comptes, jeux: jeux.jeux };
      if (JSON.stringify(cache) !== affiche) dessiner(cache);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => rendreService(zone, ctx)));
    });
}

function contenu(d) {
  const { etat } = d;
  const mois = moisCourant();
  const coutMois = etat.jeux.reduce((s, j) => s + (j.couts?.[mois]?.usd || 0), 0);
  return [
    h('div', { class: 'grille-2 grille-service' },
      h('section', { class: 'fiche' },
        h('h2', {}, 'Serveur'),
        h('dl', { class: 'details' },
          h('dt', {}, 'Version'), h('dd', {}, etat.version),
          h('dt', {}, 'Base de données'), h('dd', {}, etat.stockage === 'mongo' ? 'MongoDB Atlas' : puce('Mémoire (simulation : rien n’est conservé)', 'attention')),
          h('dt', {}, 'Clé API Claude'), h('dd', {}, etat.cleClaude
            ? puce('Configurée', 'positif')
            : [puce('Absente', 'attention'), h('span', { class: 'petit texte-2' }, ' la méta s’importe à la main, jeu par jeu')]),
          etat.cleClaude ? [h('dt', {}, 'Modèle'), h('dd', {}, etat.modele)] : null,
          etat.espace?.mo !== null && etat.espace?.mo !== undefined ? [h('dt', {}, 'Espace utilisé'), h('dd', {},
            etat.espace.mo >= 400 ? puce(`${etat.espace.mo} Mo sur ${etat.espace.limiteMo} : à surveiller`, 'attention') : `${etat.espace.mo} Mo sur ${etat.espace.limiteMo} (offre gratuite d’Atlas)`)] : null,
          h('dt', {}, 'Réveil externe'), h('dd', {}, etat.cronConfigure ? puce('Secret configuré', 'positif') : h('span', { class: 'texte-2' }, 'Non configuré (facultatif)'))),
        etat.avertissements?.length
          ? h('ul', { class: 'pile-s adm-avertissements' }, etat.avertissements.map((a) => h('li', { class: 'alerte alerte--attention' }, icone('alerte'), h('span', {}, a))))
          : h('p', { class: 'texte-3 petit adm-ok' }, icone('ok', { classe: 'icone-texte' }), ' Aucun avertissement de configuration.')),
      h('section', { class: 'fiche' },
        h('h2', {}, 'Méta automatique'),
        h('dl', { class: 'details' },
          h('dt', {}, 'Rythme'), h('dd', {}, etat.cleClaude ? 'À la première visite d’un jeu après le lundi et le jeudi 7 h 45 (Paris)' : 'Aucun : import manuel depuis la page Méta de chaque jeu'),
          h('dt', {}, 'Ce mois-ci'), h('dd', {}, h('strong', {}, dollars(coutMois)), h('span', { class: 'texte-3' }, ` estimés, tous jeux confondus (${mois})`)),
          h('dt', {}, 'Jeux suivis'), h('dd', {}, `${etat.jeux.filter((j) => j.actif && j.metaAuto).length} sur ${etat.jeux.length} en vérification automatique`)),
        h('p', { class: 'texte-3 petit' }, 'Chaque Responsable coupe la vérification automatique de son jeu dans ses Réglages du jeu. Un jeu que personne n’ouvre ne coûte rien.'))),
    sectionJeux(d),
    sectionJournal(d),
  ];
}

function resultatMeta(m) {
  if (!m) return puce('Aucune méta', 'attention');
  if (m.statut === 'echec') return h('span', { class: 'pile-s' }, puce('Échec du dernier essai', 'negatif'), m.erreur ? h('span', { class: 'tres-petit texte-2' }, m.erreur) : null);
  if (m.statut === 'ok') return puce('À jour', 'positif');
  return h('span', { class: 'texte-3' }, m.statut || '—');
}

function cellule(libelle, ...enfants) {
  return h('td', { 'data-libelle': libelle }, ...enfants);
}

function sectionJeux(d) {
  const mois = moisCourant();
  const parId = new Map(d.jeux.map((j) => [j.id, j]));
  const avecCouts = d.etat.jeux.filter((j) => Object.keys(j.couts || {}).length);
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Jeux'), h('p', { class: 'section__aide' }, `Méta, Discord et coût estimé du mois (${mois}) pour chaque jeu créé.`)),
    d.etat.jeux.length ? h('table', { class: 'tableau adm-tableau-jeux' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Jeu'), h('th', {}, 'Patch'), h('th', {}, 'Dernière vérification'), h('th', {}, 'Résultat'),
        h('th', {}, 'Vérif. auto'), h('th', { class: 'num' }, 'Coût du mois'), h('th', {}, 'Discord'), h('th', {}, h('span', { class: 'visuellement-cache' }, 'Lien')))),
      h('tbody', {}, d.etat.jeux.map((j) => {
        const cout = j.couts?.[mois];
        return h('tr', { class: j.actif ? '' : 'adm-ligne--inactive' },
          cellule('Jeu', h('span', { class: 'adm-jeu-nom' }, pastilleJeu(parId.get(j.id) || j), h('strong', {}, j.nom), j.actif ? null : puce('désactivé', 'attention'))),
          cellule('Patch', j.meta?.patch || '—'),
          cellule('Dernière vérification', j.meta?.derniereVerif ? h('span', { title: formatHorodatage(j.meta.derniereVerif) }, ilYA(j.meta.derniereVerif)) : 'jamais'),
          cellule('Résultat', resultatMeta(j.meta)),
          cellule('Vérif. auto', j.metaAuto ? puce('Oui', 'info') : puce('Coupée')),
          h('td', { class: 'num', 'data-libelle': 'Coût du mois' }, dollars(cout?.usd || 0), cout?.passages ? h('span', { class: 'texte-3 tres-petit' }, ` · ${cout.passages} passage${cout.passages > 1 ? 's' : ''}`) : null),
          cellule('Discord', j.discord ? puce('Configuré', 'positif') : h('span', { class: 'texte-3' }, 'Non configuré')),
          cellule('Gestion', h('a', { href: `#/${encodeURIComponent(j.id)}/gestion`, class: 'btn btn--petit btn--discret', 'aria-label': `Gestion de ${j.nom}` }, 'Gestion', icone('droite'))));
      })))
      : h('p', { class: 'vide' }, 'Aucun jeu créé pour l’instant.'),
    avecCouts.length ? h('details', { class: 'referentiel adm-couts' },
      h('summary', {}, h('strong', {}, 'Coûts des derniers mois, par jeu')),
      h('div', { class: 'grille-2' }, avecCouts.map((j) => h('div', { class: 'pile-s' }, h('h3', {}, j.nom), tableauCouts(j.couts))))) : null);
}

function sectionJournal(d) {
  const noms = new Map(d.comptes.map((c) => [c._id, c.nomAffiche]));
  const jeux = new Map(d.jeux.map((j) => [j.id, j]));
  const nomPar = (id) => (!id || id === 'systeme' ? MARQUE.nom : noms.get(id) || 'Un ancien compte');
  const colonneJeu = (e) => (e.jeu
    ? h('span', { class: 'adm-journal__pastille', title: jeux.get(e.jeu)?.nom || e.jeu }, pastilleJeu(jeux.get(e.jeu) || { court: e.jeu }))
    : h('span', { class: 'puce-jeu adm-journal__general', title: 'Général, hors jeu (connexions, comptes, jeux)' }, 'GÉN'));
  const zoneListe = h('div');
  const bouton_ = h('button', { type: 'button', class: 'btn btn--discret btn--petit' });
  const dessiner = () => {
    const entrees = d.entrees.filter((e) => filtre.jeu === '*' || (e.jeu || '') === filtre.jeu);
    const max = filtre.tout ? 400 : 60;
    zoneListe.replaceChildren(listeJournal(entrees, { nomPar, colonneJeu, max }));
    bouton_.hidden = entrees.length <= 60;
    bouton_.textContent = filtre.tout ? 'Afficher moins' : `Afficher les ${entrees.length} entrées`;
  };
  bouton_.addEventListener('click', () => { filtre.tout = !filtre.tout; dessiner(); });
  const choix = liste([
    { valeur: '*', libelle: 'Tous les jeux et le général' },
    { valeur: '', libelle: 'Hors jeu (connexions, comptes, jeux)' },
    ...d.jeux.map((j) => ({ valeur: j.id, libelle: j.nom })),
  ], { valeur: filtre.jeu, class: 'saisie saisie--compacte', onchange: (e) => { filtre.jeu = e.target.value; dessiner(); } });
  dessiner();
  return h('section', { class: 'section fiche adm-journal-general' },
    h('div', { class: 'section__entete' },
      h('div', { class: 'pile-s' }, h('h2', {}, 'Journal'), h('p', { class: 'texte-3 petit' }, 'Connexions, comptes, jeux, réglages, restaurations et méta, dans tous les jeux. Conservé 90 jours.')),
      champ('Afficher', choix)),
    zoneListe,
    bouton_);
}
