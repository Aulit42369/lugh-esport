// Livres des comptes de la structure (association, puis société) : écritures (recettes, dépenses, transferts banque ↔ caisse), exercices,
// soldes, bilan de l'exercice pour l'assemblée générale, rapprochement bancaire et export tableur. Tout en centimes
// (entiers), jamais en nombres à virgule. Fonctions pures, partagées par le serveur et l'interface.

import { objet, texte, entier, choix, date, avecControle } from '../validation.js';

export const MOYENS = [
  { id: 'banque', nom: 'Banque' },
  { id: 'caisse', nom: 'Caisse (espèces)' },
];

export const SENS = [
  { id: 'recette', nom: 'Recette' },
  { id: 'depense', nom: 'Dépense' },
  { id: 'transfert', nom: 'Transfert banque ↔ caisse' },
];

// Deux livres : celui de l'association, puis celui de la société le jour du passage. Une société est une nouvelle
// personne juridique : ses comptes ne prolongent pas ceux de l'association, chacun a ses catégories et ses réglages.
export const LIVRES = [
  { id: 'association', nom: 'Association' },
  { id: 'societe', nom: 'Société' },
];
export const livreValide = (id) => LIVRES.some((l) => l.id === id);

// Catégories de l'association. « commerciale » : recette commerciale accessoire, comptée pour la franchise des impôts
// commerciaux et l'indicateur « Prêt pour la société ? ».
export const CATEGORIES = {
  recette: [
    { id: 'cotisations', nom: 'Cotisations' },
    { id: 'sponsors', nom: 'Partenaires et sponsors', commerciale: true },
    { id: 'subventions', nom: 'Subventions' },
    { id: 'dons', nom: 'Dons' },
    { id: 'gains', nom: 'Gains de tournois' },
    { id: 'evenements', nom: 'Inscriptions et billetterie d’événements', commerciale: true },
    { id: 'ventes', nom: 'Ventes (maillots, goodies…)', commerciale: true },
    { id: 'autres_recettes', nom: 'Autres recettes' },
  ],
  depense: [
    { id: 'inscriptions', nom: 'Inscriptions à des tournois' },
    { id: 'materiel', nom: 'Matériel' },
    { id: 'logiciels', nom: 'Logiciels, abonnements, serveurs' },
    { id: 'deplacements', nom: 'Déplacements et hébergement' },
    { id: 'recompenses', nom: 'Récompenses et lots' },
    { id: 'communication', nom: 'Communication, graphisme, impressions' },
    { id: 'assurance', nom: 'Assurance' },
    { id: 'frais_bancaires', nom: 'Frais bancaires' },
    { id: 'evenements_dep', nom: 'Organisation d’événements' },
    { id: 'autres_depenses', nom: 'Autres dépenses' },
  ],
};

// Catégories de la société. « horsResultat » : argent qui entre ou sort sans être un produit ni une charge (capital,
// emprunt) ; il compte dans la trésorerie, pas dans le résultat. Montants TTC : la TVA reste l'affaire du comptable.
export const CATEGORIES_SOCIETE = {
  recette: [
    { id: 'sponsors', nom: 'Sponsoring et partenariats' },
    { id: 'prestations', nom: 'Prestations (coaching, contenus, événements)' },
    { id: 'ventes', nom: 'Ventes (maillots, goodies…)' },
    { id: 'gains', nom: 'Gains de tournois' },
    { id: 'subventions', nom: 'Subventions et aides' },
    { id: 'apports', nom: 'Apports en capital et en compte courant', horsResultat: true },
    { id: 'emprunts', nom: 'Emprunts reçus', horsResultat: true },
    { id: 'autres_recettes', nom: 'Autres recettes' },
  ],
  depense: [
    { id: 'salaires', nom: 'Salaires (joueurs, staff)' },
    { id: 'cotisations_sociales', nom: 'Cotisations sociales' },
    { id: 'inscriptions', nom: 'Inscriptions à des tournois' },
    { id: 'materiel', nom: 'Matériel' },
    { id: 'logiciels', nom: 'Logiciels, abonnements, serveurs' },
    { id: 'deplacements', nom: 'Déplacements et hébergement' },
    { id: 'communication', nom: 'Communication et publicité' },
    { id: 'honoraires', nom: 'Comptable et honoraires' },
    { id: 'assurance', nom: 'Assurance' },
    { id: 'frais_bancaires', nom: 'Frais bancaires' },
    { id: 'impots', nom: 'Impôts et taxes' },
    { id: 'remboursements', nom: 'Remboursements d’emprunt (capital ; intérêts en frais bancaires)', horsResultat: true },
    { id: 'dividendes', nom: 'Dividendes versés', horsResultat: true },
    { id: 'autres_depenses', nom: 'Autres dépenses' },
  ],
};

export const categoriesDe = (livre = 'association') => (livre === 'societe' ? CATEGORIES_SOCIETE : CATEGORIES);
const categorie = (livre, sens, id) => (categoriesDe(livre)[sens] || []).find((c) => c.id === id);

export const MONTANT_MAX = 100_000_000; // 1 000 000 € en centimes

const formeEcriture = objet({
  date: date({ requis: true }),
  sens: choix(SENS.map((s) => s.id), { requis: true }),
  libelle: texte({ max: 120, requis: true }),
  montant: entier({ min: 1, max: MONTANT_MAX, requis: true }),
  categorie: texte({ max: 30 }),
  moyen: choix(MOYENS.map((m) => m.id), { requis: true }),
  vers: choix(MOYENS.map((m) => m.id)),
  piece: texte({ max: 30 }),
  tiers: texte({ max: 60 }),
  note: texte({ max: 300, multi: true }),
});

// Écriture d'un livre : la catégorie doit exister dans ce livre-là.
export const schemaEcriture = (livre = 'association') => avecControle(formeEcriture, (v, erreur) => {
  if (v.sens === 'transfert') {
    if (!v.vers || v.vers === v.moyen) erreur('un transfert va de la banque vers la caisse, ou l’inverse');
  } else if (!categorie(livre, v.sens, v.categorie)) {
    erreur('catégorie inconnue pour ce type d’écriture');
  }
});
export const ecriture = schemaEcriture('association');

export const reglagesComptes = objet({
  debutExercice: entier({ min: 1, max: 12, defaut: 1 }), // mois de début de l'exercice
  ouverture: objet({
    date: date(),
    banque: entier({ min: -MONTANT_MAX, max: MONTANT_MAX, defaut: 0 }),
    caisse: entier({ min: -MONTANT_MAX, max: MONTANT_MAX, defaut: 0 }),
  }),
});

const deux = (n) => String(n).padStart(2, '0');

// Exercice qui commence l'année « annee » : { annee, debut, fin, libelle } (dates AAAA-MM-JJ incluses).
export function bornesExercice(annee, debutMois = 1) {
  const debut = `${annee}-${deux(debutMois)}-01`;
  const finAnnee = debutMois === 1 ? annee : annee + 1;
  const finMois = debutMois === 1 ? 12 : debutMois - 1;
  const dernierJour = new Date(Date.UTC(finAnnee, finMois, 0)).getUTCDate();
  return { annee, debut, fin: `${finAnnee}-${deux(finMois)}-${deux(dernierJour)}`, libelle: debutMois === 1 ? String(annee) : `${annee}-${annee + 1}` };
}

// Exercice qui contient une date.
export function exerciceDe(jour, debutMois = 1) {
  const [a, m] = jour.split('-').map(Number);
  return bornesExercice(m >= debutMois ? a : a - 1, debutMois);
}

export const nomCategorie = (sens, id, livre = 'association') => categorie(livre, sens, id)?.nom || id || '—';

// Effet d'une écriture sur la banque et la caisse.
export function effet(e) {
  if (e.sens === 'recette') return { [e.moyen]: e.montant };
  if (e.sens === 'depense') return { [e.moyen]: -e.montant };
  return { [e.moyen]: -e.montant, [e.vers]: e.montant };
}

// Soldes à la fin d'une journée (incluse), depuis l'ouverture.
export function soldes(ecritures, ouverture = {}, jusqua = '9999-12-31') {
  const s = { banque: ouverture.banque || 0, caisse: ouverture.caisse || 0 };
  for (const e of ecritures) {
    if (e.date > jusqua || (ouverture.date && e.date < ouverture.date)) continue;
    for (const [moyen, montant] of Object.entries(effet(e))) s[moyen] += montant;
  }
  return { ...s, total: s.banque + s.caisse };
}

const veille = (jour) => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Bilan d'un exercice : totaux par catégorie, résultat, soldes de début et de fin. Les catégories « hors résultat »
// (capital, emprunts, dividendes) sont à part : elles changent la trésorerie, pas le résultat.
export function bilanExercice(ecritures, bornes, ouverture = {}, livre = 'association') {
  // Mêmes écritures que les soldes : rien d'avant l'ouverture, sinon résultat et soldes ne concordent plus.
  const dans = ecritures.filter((e) => e.date >= bornes.debut && e.date <= bornes.fin && !(ouverture.date && e.date < ouverture.date));
  const totaux = (sens) => {
    const parCat = {};
    for (const e of dans.filter((x) => x.sens === sens)) parCat[e.categorie] = (parCat[e.categorie] || 0) + e.montant;
    return categoriesDe(livre)[sens].filter((c) => parCat[c.id]).map((c) => ({ id: c.id, nom: c.nom, montant: parCat[c.id], horsResultat: !!c.horsResultat }));
  };
  const toutesRecettes = totaux('recette');
  const toutesDepenses = totaux('depense');
  const recettes = toutesRecettes.filter((c) => !c.horsResultat);
  const depenses = toutesDepenses.filter((c) => !c.horsResultat);
  const horsResultat = [
    ...toutesRecettes.filter((c) => c.horsResultat).map((c) => ({ ...c, sens: 'recette' })),
    ...toutesDepenses.filter((c) => c.horsResultat).map((c) => ({ ...c, sens: 'depense' })),
  ];
  const totalRecettes = recettes.reduce((t, c) => t + c.montant, 0);
  const totalDepenses = depenses.reduce((t, c) => t + c.montant, 0);
  return {
    exercice: bornes,
    nombre: dans.length,
    recettes,
    depenses,
    totalRecettes,
    totalDepenses,
    resultat: totalRecettes - totalDepenses,
    horsResultat,
    soldeDebut: soldes(ecritures, ouverture, veille(bornes.debut)),
    soldeFin: soldes(ecritures, ouverture, bornes.fin),
  };
}

// Montants : « 1 234,56 € » à l'affichage ; « 12,5 » ou « 12.50 » saisis → 1250 centimes (null si illisible).
export function euros(centimes) {
  const signe = centimes < 0 ? '−' : '';
  const a = Math.abs(centimes);
  const entiers = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${signe}${entiers},${deux(a % 100)} €`;
}

export function lireMontant(saisie) {
  const t = String(saisie || '').replace(/[\s €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [e, d = ''] = t.split('.');
  const c = Number(e) * 100 + Number((d + '00').slice(0, 2));
  return c > 0 && c <= MONTANT_MAX ? c : null;
}

// Export tableur (Excel en français : point-virgule, virgule décimale, BOM UTF-8).
const cellule = (v) => {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // jamais de formule exécutée par le tableur
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const tableur = (lignes) => `﻿${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`;

// Une écriture en une ligne lisible (historique des modifications, à l'écran et dans le tableur).
export function resumeEcriture(e, livre = 'association') {
  if (!e) return '';
  const type = SENS.find((x) => x.id === e.sens)?.nom || e.sens;
  const moyen = e.sens === 'transfert' ? `${e.moyen} → ${e.vers}` : e.moyen;
  return [e.date, `${type} ${euros(e.montant)}`, e.libelle, e.sens === 'transfert' ? '' : nomCategorie(e.sens, e.categorie, livre), moyen,
    e.piece && `pièce ${e.piece}`, e.tiers, e.note].filter(Boolean).join(' · ');
}

// Historique des écritures modifiées ou supprimées : qui, quand, la version d'avant et celle d'après.
export function csvHistorique(entrees, livre = 'association', nomPar = (id) => id) {
  const lignes = [['Le', 'Par', 'Action', 'Avant', 'Après']];
  for (const x of entrees) lignes.push([x.le, nomPar(x.par), x.action === 'suppression' ? 'Supprimée' : 'Modifiée', resumeEcriture(x.avant, livre), resumeEcriture(x.apres, livre)]);
  return tableur(lignes);
}

export function csvEcritures(ecritures, livre = 'association') {
  const montant = (c) => (c / 100).toFixed(2).replace('.', ',');
  const lignes = [['Date', 'Type', 'Catégorie', 'Libellé', 'Tiers', 'N° de pièce', 'Moyen', 'Recette', 'Dépense', 'Note']];
  for (const e of [...ecritures].sort((a, b) => a.date.localeCompare(b.date))) {
    const type = SENS.find((s) => s.id === e.sens)?.nom || e.sens;
    const moyen = e.sens === 'transfert' ? `${e.moyen} → ${e.vers}` : e.moyen;
    lignes.push([e.date, type, e.sens === 'transfert' ? '' : nomCategorie(e.sens, e.categorie, livre), e.libelle, e.tiers || '', e.piece || '', moyen,
      e.sens === 'recette' ? montant(e.montant) : '', e.sens === 'depense' ? montant(e.montant) : '', e.note || '']);
  }
  return tableur(lignes);
}

// Recettes commerciales de l'association sur 12 mois glissants jusqu'à « jusqua » inclus (centimes) : sponsors,
// ventes, billetterie. Ce que regardent la franchise des impôts commerciaux et l'indicateur « Prêt pour la société ? ».
export function recettesCommerciales(ecritures, jusqua) {
  const d = new Date(`${jusqua}T00:00:00Z`);
  const mois = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  if (d.getUTCMonth() !== mois) d.setUTCDate(0); // 29 février → 28 février de l'année d'avant
  const depuis = d.toISOString().slice(0, 10); // exclu
  return ecritures
    .filter((e) => e.sens === 'recette' && e.date > depuis && e.date <= jusqua && categorie('association', 'recette', e.categorie)?.commerciale)
    .reduce((t, e) => t + e.montant, 0);
}
