// Livres des comptes (association, puis société) : page « Comptes de la structure » (trésorier) et sous-onglet de
// l'Administration générale → Administratif. Soldes du jour, bilan de l'exercice (imprimable pour l'assemblée
// générale), rapprochement bancaire, liste des écritures, clôture d'exercice, export tableur, et pour l'association
// l'indicateur « Prêt pour la société ? ».

import { h, bouton, toast, confirmer, liste, onglets, etatVide, messageErreur } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { puce } from '../composants/jetons.js';
import { euros, nomCategorie, MOYENS } from '/shared/administratif/comptes.js';
import { formatDate, formatHorodatage, aujourdhui } from '/shared/temps.js';
import { chargement, erreurChargement } from './admin-commun.js';
import { fenetreEcriture, fenetreReglages, fenetreRapprochement } from './tresorerie-saisie.js';
import { indicateurSociete } from './tresorerie-indicateur.js';

let exerciceChoisi = null;
let livreChoisi = 'association';
const requete = (extra = {}) => `?${new URLSearchParams({ livre: livreChoisi, ...extra })}`;

// Page générale (#/tresorerie) pour un compte Trésorier.
export function rendre(page) {
  page.classList.add('adm-page', 'tres-page');
  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Comptes de la structure'),
      h('p', { class: 'entete-page__intro' }, 'Chaque recette et chaque dépense de la structure, avec le numéro de son justificatif.'))));
  const zone = h('div');
  page.append(zone);
  rendreComptes(zone);
  return null;
}

export function rendreComptes(zone) {
  const recharger = () => rendreComptes(zone);
  zone.replaceChildren(chargement());
  api('GET', `/api/tresorerie${requete(exerciceChoisi ? { exercice: exerciceChoisi } : {})}`)
    .then((d) => zone.replaceChildren(...contenu(d, recharger).filter(Boolean)))
    .catch((err) => {
      // Livre de la société plus disponible (forme repassée à « association ») : retour au livre de l'association.
      if (livreChoisi !== 'association' && err?.statut === 404) {
        livreChoisi = 'association';
        exerciceChoisi = null;
        recharger();
        return;
      }
      zone.replaceChildren(erreurChargement(err, recharger));
    });
}

const signe = (e) => (e.sens === 'recette' ? 1 : e.sens === 'depense' ? -1 : 0);
const nomMoyen = (id) => MOYENS.find((m) => m.id === id)?.nom.replace(' (espèces)', '') || id;

function contenu(d, recharger) {
  const ex = d.exercice;
  const choix = liste(d.exercices.map((a) => ({ valeur: String(a), libelle: `Exercice ${a === ex.annee ? ex.libelle : a}` })), { valeur: String(ex.annee), class: 'saisie saisie--compacte', 'aria-label': 'Exercice affiché' });
  choix.addEventListener('change', () => { exerciceChoisi = Number(choix.value); recharger(); });
  const ouvert = !ex.cloture && d.ecriturePossible;
  const premiereFois = !d.reglages.ouverture.date && !d.nombre;
  const choixLivre = d.livres.length > 1 ? onglets(d.livres.map((l) => ({ valeur: l.id, libelle: `Livre ${l.nom === 'Association' ? 'de l’association' : 'de la société'}` })), d.livre, (v) => {
    livreChoisi = v;
    exerciceChoisi = null;
    recharger();
  }, { libelle: 'Livre des comptes' }) : null;
  return [
    choixLivre ? h('div', { class: 'tres-livres sans-impression' }, choixLivre) : null,
    d.livre === 'societe' ? h('p', { class: 'texte-3 petit sans-impression' }, 'Livre de la société : suivi de la trésorerie, montants TTC. Les comptes annuels, la TVA et l’impôt sur les sociétés restent tenus par le comptable.') : null,
    !d.ecriturePossible ? h('div', { class: 'alerte alerte--info sans-impression' }, icone('info'), h('span', {}, 'La forme juridique est repassée à « association » : ce livre reste consultable, plus modifiable.')) : null,
    h('div', { class: 'barre-outils tres-barre' },
      h('div', { class: 'rangee' }, choix, ex.cloture ? puce('Exercice clôturé', 'attention') : puce(`du ${formatDate(ex.debut)} au ${formatDate(ex.fin)}`)),
      h('div', { class: 'rangee' },
        ouvert ? bouton('Nouvelle écriture', { icone: 'ajouter', classe: 'btn--principal', onclick: () => fenetreEcriture({ livre: d.livre, apres: recharger }) }) : null,
        h('a', { href: `/api/tresorerie/export${requete({ exercice: ex.annee })}`, class: 'btn', download: '' }, icone('telecharger'), 'Tableur'),
        bouton('Imprimer le bilan', { icone: 'imprimer', onclick: () => window.print() }),
        d.ecriturePossible ? bouton('Réglages', { icone: 'reglages', classe: 'btn--discret', onclick: () => fenetreReglages({ livre: d.livre, reglages: d.reglages, apres: recharger }) }) : null)),
    premiereFois ? h('div', { class: 'alerte alerte--info sans-impression' }, icone('info'),
      h('span', {}, 'Pour commencer : ', h('strong', {}, 'Réglages'), ', puis note le solde du compte bancaire et de la caisse le jour où tu ouvres le livre.')) : null,
    soldesDuJour(d),
    d.indicateur ? indicateurSociete(d.indicateur) : null,
    h('div', { class: 'grille-2 section' }, bilan(d.bilan), rapprochement(d, recharger)),
    ecritures(d, recharger),
    cloture(d, recharger),
  ];
}

function tuile(libelle, valeur, { ton = '', aide = '' } = {}) {
  return h('div', { class: ['tres-tuile', ton && `tres-tuile--${ton}`] },
    h('span', { class: 'texte-3 petit' }, libelle),
    h('strong', { class: 'tres-tuile__valeur' }, valeur),
    aide ? h('span', { class: 'texte-3 tres-petit' }, aide) : null);
}

function soldesDuJour(d) {
  const s = d.soldesDuJour;
  const b = d.bilan;
  return h('section', { class: 'tres-tuiles' },
    tuile('Banque aujourd’hui', euros(s.banque), { ton: s.banque < 0 ? 'negatif' : '' }),
    tuile('Caisse aujourd’hui', euros(s.caisse), { ton: s.caisse < 0 ? 'negatif' : '' }),
    tuile(`Recettes ${b.exercice.libelle}`, euros(b.totalRecettes)),
    tuile(`Dépenses ${b.exercice.libelle}`, euros(b.totalDepenses)),
    tuile('Résultat de l’exercice', euros(b.resultat), { ton: b.resultat < 0 ? 'negatif' : 'positif', aide: b.resultat < 0 ? 'déficit' : 'excédent' }));
}

function bilan(b) {
  const lignes = (titre, cats, total) => h('table', { class: 'tableau tres-bilan' },
    h('thead', {}, h('tr', {}, h('th', {}, titre), h('th', { class: 'num' }, 'Montant'))),
    h('tbody', {}, cats.length ? cats.map((c) => h('tr', {}, h('td', {}, c.nom), h('td', { class: 'num' }, euros(c.montant))))
      : h('tr', {}, h('td', { colspan: 2, class: 'texte-3' }, 'Rien pour l’instant'))),
    h('tfoot', {}, h('tr', {}, h('th', {}, 'Total'), h('th', { class: 'num' }, euros(total)))));
  return h('section', { class: 'fiche pile-s tres-bilan-fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, `Bilan de l’exercice ${b.exercice.libelle}`), h('span', { class: 'fiche__meta' }, `${b.nombre} écriture${b.nombre > 1 ? 's' : ''}`)),
    h('p', { class: 'texte-3 petit' }, `Du ${formatDate(b.exercice.debut)} au ${formatDate(b.exercice.fin)}. À présenter à l’assemblée générale.`),
    lignes('Recettes', b.recettes, b.totalRecettes),
    lignes('Dépenses', b.depenses, b.totalDepenses),
    h('dl', { class: 'details' },
      h('dt', {}, 'Résultat'), h('dd', {}, h('strong', {}, euros(b.resultat)), b.resultat < 0 ? ' (déficit)' : ' (excédent)'),
      ...(b.horsResultat?.length ? [h('dt', {}, 'Hors résultat'), h('dd', {}, b.horsResultat.map((c) => `${c.nom} ${c.sens === 'recette' ? '+' : '−'}${euros(c.montant)}`).join(' ; '))] : []),
      h('dt', {}, 'Trésorerie au début'), h('dd', {}, `${euros(b.soldeDebut.total)} (banque ${euros(b.soldeDebut.banque)}, caisse ${euros(b.soldeDebut.caisse)})`),
      h('dt', {}, 'Trésorerie à la fin'), h('dd', {}, `${euros(b.soldeFin.total)} (banque ${euros(b.soldeFin.banque)}, caisse ${euros(b.soldeFin.caisse)})`)));
}

function rapprochement(d, recharger) {
  const r = d.rapprochement;
  return h('section', { class: 'fiche pile-s sans-impression' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Rapprochement bancaire'),
      r ? (r.ecart === 0 ? puce('Conforme', 'positif') : puce(`Écart ${euros(r.ecart)}`, 'attention')) : puce('Jamais fait')),
    r ? h('dl', { class: 'details' },
      h('dt', {}, 'Relevé du'), h('dd', {}, formatDate(r.date)),
      h('dt', {}, 'Solde de la banque'), h('dd', {}, euros(r.solde)),
      h('dt', {}, 'Solde du livre'), h('dd', {}, euros(r.calcule)),
      h('dt', {}, 'Comparé le'), h('dd', {}, formatHorodatage(r.le)))
      : h('p', { class: 'texte-3 petit' }, 'Une fois par mois : compare le solde du relevé bancaire avec celui du livre.'),
    r && r.ecart !== 0 ? h('p', { class: 'petit compte-2fa__alerte' }, icone('alerte'), 'Le livre et la banque ne disent pas la même chose : cherche une écriture oubliée, en double, ou avec une mauvaise date.') : null,
    d.ecriturePossible ? h('div', {}, bouton('Comparer avec un relevé', { onclick: () => fenetreRapprochement({ livre: d.livre, apres: recharger }) })) : null);
}

function ecritures(d, recharger) {
  const ouvert = !d.exercice.cloture && d.ecriturePossible;
  if (!d.ecritures.length) return h('section', { class: 'section' }, h('h2', {}, 'Écritures'), etatVide('Aucune écriture dans cet exercice.'));
  return h('section', { class: 'section' },
    h('h2', {}, 'Écritures'),
    h('div', { class: 'defile' }, h('table', { class: 'tableau tres-ecritures' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Libellé'), h('th', {}, 'Catégorie'), h('th', {}, 'Moyen'), h('th', {}, 'Pièce'), h('th', { class: 'num' }, 'Montant'), ouvert ? h('th', { class: 'sans-impression' }, h('span', { class: 'visuellement-cache' }, 'Actions')) : null)),
      h('tbody', {}, d.ecritures.map((e) => h('tr', {},
        h('td', { class: 'tres-date' }, formatDate(e.date)),
        h('td', {}, h('strong', {}, e.libelle), e.tiers ? h('span', { class: 'texte-3 tres-petit tres-tiers' }, e.tiers) : null),
        h('td', {}, e.sens === 'transfert' ? h('span', { class: 'texte-3' }, 'Transfert') : nomCategorie(e.sens, e.categorie, d.livre)),
        h('td', {}, e.sens === 'transfert' ? `${nomMoyen(e.moyen)} → ${nomMoyen(e.vers)}` : nomMoyen(e.moyen)),
        h('td', { class: 'texte-3' }, e.piece || '—'),
        h('td', { class: ['num', 'tres-montant', signe(e) > 0 && 'tres-montant--recette', signe(e) < 0 && 'tres-montant--depense'] },
          `${signe(e) > 0 ? '+' : signe(e) < 0 ? '−' : ''}${euros(e.montant)}`),
        ouvert ? h('td', { class: 'sans-impression tres-actions' },
          bouton('', { icone: 'modifier', classe: 'btn--discret btn--icone btn--petit', 'aria-label': `Modifier ${e.libelle}`, onclick: () => fenetreEcriture({ livre: d.livre, ecriture: e, apres: recharger }) }),
          bouton('', {
            icone: 'supprimer', classe: 'btn--discret btn--icone btn--petit', 'aria-label': `Supprimer ${e.libelle}`,
            onclick: async () => {
              if (!(await confirmer(`Supprimer « ${e.libelle} » (${euros(e.montant)}) ?`, { titre: 'Supprimer l’écriture', libelle: 'Supprimer', danger: true }))) return;
              try {
                await api('DELETE', `/api/tresorerie/ecritures/${encodeURIComponent(e._id)}`);
                toast('Écriture supprimée.');
                recharger();
              } catch (err) {
                toast(messageErreur(err), { type: 'erreur' });
              }
            },
          })) : null))))));
}

function cloture(d, recharger) {
  const ex = d.exercice;
  const action = async (rouvrir) => {
    const ok = await confirmer(rouvrir
      ? `Rouvrir l’exercice ${ex.libelle} ? Ses écritures redeviennent modifiables.`
      : `Clôturer l’exercice ${ex.libelle} ? Ses écritures ne pourront plus être modifiées ni supprimées (l’Administrateur général peut le rouvrir). À faire après l’approbation des comptes en assemblée générale.`,
    { titre: rouvrir ? 'Rouvrir l’exercice' : 'Clôturer l’exercice', libelle: rouvrir ? 'Rouvrir' : 'Clôturer', danger: !rouvrir });
    if (!ok) return;
    try {
      await api('POST', `/api/tresorerie/cloture${requete()}`, { exercice: ex.annee, rouvrir });
      toast(rouvrir ? 'Exercice rouvert.' : 'Exercice clôturé.');
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    }
  };
  return h('section', { class: 'section sans-impression' },
    h('p', { class: 'texte-3 petit' }, `${d.nombre} écriture${d.nombre > 1 ? 's' : ''} au total (${d.max} au maximum). Justificatifs : à garder au moins 6 ans, 10 ans conseillés.`),
    !d.ecriturePossible ? null : ex.cloture
      ? (E.estAdmin() ? bouton(`Rouvrir l’exercice ${ex.libelle}`, { classe: 'btn--discret', onclick: () => action(true) }) : null)
      : ex.fin < aujourdhui()
        ? bouton(`Clôturer l’exercice ${ex.libelle}`, { classe: 'btn--discret', icone: 'cadenas', onclick: () => action(false) })
        : h('p', { class: 'texte-3 tres-petit' }, `Clôture possible après le ${formatDate(ex.fin)}, une fois les comptes approuvés.`));
}
