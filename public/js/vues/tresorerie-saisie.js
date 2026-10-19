// Livre des comptes, fenêtres de saisie : écriture (recette, dépense, transfert), réglages (début d'exercice,
// soldes d'ouverture), rapprochement avec le relevé bancaire. Les montants se tapent en euros (« 12,50 »).

import { h, modale, champ, saisie, liste, zone, onglets, toast } from '../ui.js';
import { api } from '../api.js';
import { categoriesDe, MOYENS, SENS, lireMontant, euros } from '/shared/administratif/comptes.js';
import { aujourdhui } from '/shared/temps.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const enEuros = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');

function montantSigne(texte) {
  const t = String(texte || '').trim();
  if (!t || /^[-−]?0+([.,]0{1,2})?$/.test(t.replace(/[\s €]/g, ''))) return 0;
  const negatif = /^[-−]/.test(t);
  const c = lireMontant(t.replace(/^[-−]/, ''));
  return c === null ? null : (negatif ? -c : c);
}

export function fenetreEcriture({ livre = 'association', ecriture = null, apres }) {
  const categories = categoriesDe(livre);
  const e = ecriture || { sens: 'depense', date: aujourdhui(), moyen: 'banque' };
  let sens = e.sens;
  const date = saisie({ type: 'date', valeur: e.date, required: true });
  const libelle = saisie({ valeur: e.libelle || '', maxlength: 120, required: true, placeholder: 'ex. Inscription à la Coupe de France' });
  const montant = saisie({ valeur: enEuros(e.montant), inputmode: 'decimal', placeholder: '0,00', required: true, autocomplete: 'off' });
  const moyen = liste(MOYENS.map((m) => ({ valeur: m.id, libelle: m.nom })), { valeur: e.moyen });
  const vers = liste(MOYENS.map((m) => ({ valeur: m.id, libelle: m.nom })), { valeur: e.vers || (e.moyen === 'caisse' ? 'banque' : 'caisse') });
  const piece = saisie({ valeur: e.piece || '', maxlength: 30, placeholder: 'ex. F-2026-014', autocomplete: 'off' });
  const tiers = saisie({ valeur: e.tiers || '', maxlength: 60, placeholder: 'ex. le sponsor, le magasin, la ligue' });
  const note = zone({ valeur: e.note || '', lignes: 2, maxlength: 300 });
  const zoneCategorie = h('div');
  const zoneMoyens = h('div', { class: 'grille-champs' });
  let categorie = null;

  function dessiner() {
    const transfert = sens === 'transfert';
    categorie = transfert ? null : liste(categories[sens].map((c) => ({ valeur: c.id, libelle: c.nom })), { valeur: e.sens === sens ? e.categorie : '', vide: 'Choisir…' });
    zoneCategorie.replaceChildren(transfert ? h('p', { class: 'texte-3 petit' }, 'Un transfert déplace de l’argent entre la banque et la caisse : il ne change pas le résultat.') : champ('Catégorie', categorie));
    zoneMoyens.replaceChildren(champ(transfert ? 'De' : (sens === 'recette' ? 'Reçu sur' : 'Payé par'), moyen), ...(transfert ? [champ('Vers', vers)] : []));
    selecteur.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(SENS[i].id === sens)));
  }
  const selecteur = onglets(SENS.map((s) => ({ valeur: s.id, libelle: s.nom })), sens, (v) => { sens = v; dessiner(); }, { libelle: 'Type d’écriture' });
  dessiner();

  modale({
    titre: `${ecriture ? 'Modifier l’écriture' : 'Nouvelle écriture'}${livre === 'societe' ? ' (société)' : ''}`,
    large: true,
    contenu: [
      selecteur,
      h('div', { class: 'grille-champs' }, champ('Date', date), champ('Montant (€)', montant, { aide: 'ex. 12,50' })),
      champ('Libellé', libelle),
      zoneCategorie,
      zoneMoyens,
      h('div', { class: 'grille-champs' }, champ('N° de pièce (facture, reçu)', piece), champ('Tiers (facultatif)', tiers)),
      champ('Note (facultatif)', note),
      h('p', { class: 'texte-3 tres-petit' }, 'Range le justificatif (photo ou PDF) dans le dossier de la trésorerie, sous ce numéro de pièce.'),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const c = lireMontant(montant.value);
        if (c === null) throw new Error('Montant : un nombre positif, par exemple 12,50.');
        const corps = {
          date: date.value, sens, libelle: libelle.value.trim(), montant: c, moyen: moyen.value,
          categorie: categorie?.value || '', vers: sens === 'transfert' ? vers.value : '', piece: piece.value.trim(), tiers: tiers.value.trim(), note: note.value.trim(),
        };
        if (sens !== 'transfert' && !corps.categorie) throw new Error('Choisis une catégorie.');
        if (ecriture) await api('PUT', `/api/tresorerie/ecritures/${encodeURIComponent(ecriture._id)}`, corps);
        else await api('POST', `/api/tresorerie/ecritures?livre=${livre}`, corps);
        toast(ecriture ? 'Écriture modifiée.' : `Écriture ajoutée : ${euros(c)}.`);
        await apres();
      },
    }],
  });
}

export function fenetreReglages({ livre = 'association', reglages, apres }) {
  const fige = reglages.clotures.length > 0;
  const debut = liste(MOIS.map((m, i) => ({ valeur: String(i + 1), libelle: m })), { valeur: String(reglages.debutExercice), disabled: fige });
  const date = saisie({ type: 'date', valeur: reglages.ouverture.date || aujourdhui(), disabled: fige });
  const banque = saisie({ valeur: enEuros(reglages.ouverture.banque).replace(/^$/, '0'), inputmode: 'decimal', disabled: fige });
  const caisse = saisie({ valeur: enEuros(reglages.ouverture.caisse).replace(/^$/, '0'), inputmode: 'decimal', disabled: fige });
  modale({
    titre: `Réglages du livre des comptes${livre === 'societe' ? ' de la société' : ''}`,
    contenu: [
      fige ? h('p', { class: 'alerte alerte--attention' }, 'Un exercice est clôturé : ces réglages ne changent plus.') : null,
      champ('Début de l’exercice comptable', debut, { aide: 'Janvier pour une année civile, septembre pour une saison.' }),
      h('p', { class: 'texte-2 petit' }, 'Ouverture des comptes : ce qu’il y avait sur le compte et dans la caisse le jour où tu commences le livre.'),
      h('div', { class: 'grille-champs' }, champ('Date d’ouverture', date), champ('Banque (€)', banque), champ('Caisse (€)', caisse)),
    ],
    actions: fige ? [{ libelle: 'Fermer' }] : [{ libelle: 'Annuler' }, {
      libelle: 'Enregistrer',
      classe: 'btn--principal',
      action: async () => {
        const b = montantSigne(banque.value);
        const c = montantSigne(caisse.value);
        if (b === null || c === null) throw new Error('Soldes : des montants comme 150 ou 150,25 (un signe moins pour un découvert).');
        await api('PUT', `/api/tresorerie/reglages?livre=${livre}`, { debutExercice: Number(debut.value), ouverture: { date: date.value, banque: b, caisse: c } });
        toast('Réglages enregistrés.');
        await apres();
      },
    }],
  });
}

export function fenetreRapprochement({ livre = 'association', apres }) {
  const date = saisie({ type: 'date', valeur: aujourdhui(), required: true });
  const solde = saisie({ inputmode: 'decimal', placeholder: '0,00', required: true });
  modale({
    titre: 'Rapprocher avec le relevé bancaire',
    contenu: [
      h('p', { class: 'texte-2 petit' }, 'Recopie le solde affiché par la banque à une date. Lugh le compare au solde du livre à la même date : un écart signale une écriture oubliée ou en double.'),
      h('div', { class: 'grille-champs' }, champ('Date du relevé', date), champ('Solde du relevé (€)', solde)),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Comparer',
      classe: 'btn--principal',
      action: async () => {
        const s = montantSigne(solde.value);
        if (s === null || !solde.value.trim()) throw new Error('Solde : un montant comme 1 250,40.');
        await api('POST', `/api/tresorerie/rapprochement?livre=${livre}`, { date: date.value, solde: s });
        await apres();
      },
    }],
  });
}
