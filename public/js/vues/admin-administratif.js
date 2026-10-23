// Administration générale → Administratif : la gestion administrative de la structure, en cinq rubriques.
// Obligations (suivi et veille légale), Comptes (livre des comptes), Documents types, Mineurs (autorisations de
// chaque jeu) et Identité (nom de l'association, RNA, contact public, référent ; sauvegarde et reprise après sinistre).

import { h, bouton, toast, champ, saisie, liste, caseACocher, messageErreur } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import { puce } from '../composants/jetons.js';
import { chargement, erreurChargement } from './admin-commun.js';
import { rendreObligations } from './admin-obligations.js';
import { rendreDocuments } from './admin-documents.js';
import { rendreComptes } from './tresorerie.js';
import { ficheReprise } from './admin-reprise.js';
import { formatDate } from '/shared/temps.js';

const RUBRIQUES = [
  { id: 'obligations', titre: 'Obligations', icone: 'balance' },
  { id: 'comptes', titre: 'Comptes', icone: 'euro' },
  { id: 'documents', titre: 'Documents', icone: 'document' },
  { id: 'mineurs', titre: 'Mineurs', icone: 'securite' },
  { id: 'identite', titre: 'Identité', icone: 'structure' },
];

export function rendreAdministratif(zone, ctx, params = []) {
  const rubrique = RUBRIQUES.find((r) => r.id === params[0]) || RUBRIQUES[0];
  const corps = h('div', { class: 'admv-corps' });
  zone.replaceChildren(
    h('nav', { class: 'admv-sousnav sans-impression', 'aria-label': 'Rubriques administratives' },
      RUBRIQUES.map((r) => h('a', { href: `#/admin/administratif/${r.id}`, 'aria-current': r.id === rubrique.id ? 'page' : null }, icone(r.icone), r.titre))),
    corps);
  // Rien n'est rendu (pas de promesse) : la valeur de retour d'une vue sert de nettoyage au routeur.
  if (rubrique.id === 'comptes') {
    rendreComptes(corps);
    return null;
  }
  if (rubrique.id === 'documents') {
    rendreDocuments(corps, params[1]);
    return null;
  }
  corps.replaceChildren(chargement());
  const recharger = () => rendreAdministratif(zone, ctx, params);
  api('GET', '/api/admin/administratif')
    .then((d) => {
      if (rubrique.id === 'obligations') rendreObligations(corps, d, recharger);
      else if (rubrique.id === 'mineurs') corps.replaceChildren(...mineurs(d).filter(Boolean));
      else corps.replaceChildren(identite(d, recharger), formeJuridique(d, recharger), ficheReprise());
    })
    .catch((err) => corps.replaceChildren(erreurChargement(err, recharger)));
  return null;
}

function mineurs(d) {
  const tous = d.mineurs.flatMap((j) => j.membres.filter((m) => m.mineur).map((m) => ({ ...m, jeu: j })));
  const aRegler = tous.filter((m) => m.manques.length);
  const nonRenseignes = d.mineurs.reduce((n, j) => n + j.membres.filter((m) => !m.renseigne).length, 0);
  return [
    h('section', { class: 'tres-tuiles' },
      h('div', { class: 'tres-tuile' }, h('span', { class: 'texte-3 petit' }, 'Mineurs signalés'), h('strong', { class: 'tres-tuile__valeur' }, String(tous.length))),
      h('div', { class: ['tres-tuile', aRegler.length && 'tres-tuile--negatif'] }, h('span', { class: 'texte-3 petit' }, 'Autorisations manquantes'), h('strong', { class: 'tres-tuile__valeur' }, String(aRegler.length))),
      h('div', { class: 'tres-tuile' }, h('span', { class: 'texte-3 petit' }, 'Fiches jamais renseignées'), h('strong', { class: 'tres-tuile__valeur' }, String(nonRenseignes)))),
    aRegler.length ? h('div', { class: 'alerte alerte--urgent section' }, icone('alerte'),
      h('span', {}, h('strong', {}, 'Pas de diffusion pour ces joueurs'), ' tant que leur autorisation de droit à l’image n’est pas reçue : ni webcam, ni voix, ni photo en stream ou sur les réseaux.')) : null,
    h('p', { class: 'texte-2 petit section' }, 'Le Responsable de chaque jeu coche, sur la fiche de chaque joueur du roster : « mineur », la date de l’autorisation parentale et celle du droit à l’image. Aucun âge n’est enregistré ; les papiers signés restent chez le bureau.'),
    ...d.mineurs.map((j) => h('section', { class: 'fiche section pile-s' },
      h('div', { class: 'fiche__titre' }, h('h2', {}, j.nom), h('a', { href: `#/${encodeURIComponent(j.id)}/roster`, class: 'btn btn--petit btn--discret' }, 'Roster', icone('droite'))),
      j.membres.some((m) => m.mineur)
        ? h('ul', { class: 'liste-lignes' }, j.membres.filter((m) => m.mineur).map((m) => h('li', { class: 'rangee rangee--espace' },
          h('span', {}, h('strong', {}, m.pseudo || 'Sans pseudo'), h('span', { class: 'texte-3 petit' }, ` · ${m.type === 'staff' ? 'staff' : 'joueur'}`)),
          h('span', { class: 'rangee' },
            m.parentale ? puce(`Parents ✓ ${formatDate(m.parentale)}`, 'positif') : puce('Autorisation parentale manquante', 'attention'),
            m.image ? puce(`Image ✓ ${formatDate(m.image)}`, 'positif') : puce('Pas de diffusion', 'attention')))))
        : h('p', { class: 'texte-3 petit' }, `Aucun mineur signalé (${j.membres.filter((m) => m.renseigne).length} fiche${j.membres.filter((m) => m.renseigne).length > 1 ? 's' : ''} renseignée${j.membres.filter((m) => m.renseigne).length > 1 ? 's' : ''} sur ${j.membres.length}).`))),
  ];
}

// Forme juridique : association aujourd'hui, société (SAS) le jour du passage. Elle décide des sections
// d'obligations, des documents et des livres des comptes affichés. Rien n'est effacé en changeant de forme.
function formeJuridique(d, recharger) {
  const i = d.identite;
  const forme = liste([{ valeur: 'association', libelle: 'Association (loi 1901)' }, { valeur: 'societe', libelle: 'Société (SAS ou SASU) créée' }], { valeur: i.forme });
  const prevu = caseACocher('Passage en société prévu', { coche: i.passagePrevu });
  const seuil = saisie({ type: 'number', valeur: String(i.seuilPassage), min: 1, max: 1000000, step: 500, inputmode: 'numeric' });
  const maintenue = caseACocher('L’association continue à côté de la société', { coche: i.associationMaintenue });
  const nom = saisie({ valeur: i.societeNom, maxlength: 80, placeholder: 'ex. Lugh Esport SAS' });
  const sorte = liste([{ valeur: 'SAS', libelle: 'SAS (plusieurs associés)' }, { valeur: 'SASU', libelle: 'SASU (un seul associé)' }], { valeur: i.societeForme });
  const siren = saisie({ valeur: i.siren, maxlength: 11, inputmode: 'numeric', placeholder: '9 chiffres' });
  const date = saisie({ type: 'date', valeur: i.societeDate });
  const zoneAsso = h('div', { class: 'pile-s' }, prevu.element,
    champ('Seuil de passage (€ de recettes commerciales sur 12 mois)', seuil, { aide: 'Sponsors, ventes, billetterie : quand le livre des comptes de l’association s’en approche, Comptes le signale.' }));
  const zoneSociete = h('div', { class: 'pile-s' },
    h('div', { class: 'grille-champs' }, champ('Nom de la société', nom), champ('Forme', sorte), champ('SIREN', siren, { aide: 'Sur l’extrait Kbis.' }), champ('Date d’immatriculation', date)),
    maintenue.element);
  const majZones = () => {
    zoneAsso.hidden = forme.value !== 'association';
    zoneSociete.hidden = forme.value !== 'societe';
  };
  forme.addEventListener('change', majZones);
  majZones();
  const enregistrer = async (btn) => {
    const montant = Number(seuil.value);
    if (!seuil.value.trim() || !Number.isInteger(montant) || montant < 1) {
      toast('Seuil de passage : un nombre entier d’euros, au moins 1.', { type: 'erreur' });
      return;
    }
    btn.disabled = true;
    try {
      await api('PUT', '/api/admin/administratif/identite', {
        ...i, forme: forme.value, passagePrevu: prevu.input.checked, seuilPassage: montant, associationMaintenue: maintenue.input.checked,
        societeNom: nom.value.trim(), societeForme: sorte.value, siren: siren.value.replace(/\s/g, ''), societeDate: date.value,
      });
      toast(forme.value === 'societe' ? 'Société enregistrée : son livre des comptes et ses obligations sont ouverts.' : 'Forme juridique enregistrée.');
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
      btn.disabled = false;
    }
  };
  return h('section', { class: 'fiche pile section' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Forme juridique'), puce(d.contexte.societe ? `Société ${i.societeForme}` : 'Association', d.contexte.societe ? 'positif' : '')),
    h('p', { class: 'texte-3 petit' }, 'Elle décide des obligations, des documents types et des livres des comptes affichés. Changer de forme n’efface rien.'),
    champ('Forme actuelle', forme),
    zoneAsso,
    zoneSociete,
    h('div', {}, bouton('Enregistrer', { classe: 'btn--principal', onclick: (e) => enregistrer(e.currentTarget) })));
}

function identite(d, recharger) {
  const i = d.identite;
  const champs = {
    nom: saisie({ valeur: i.nom, maxlength: 80, placeholder: 'ex. Lugh Esport' }),
    sigle: saisie({ valeur: i.sigle, maxlength: 20 }),
    rna: saisie({ valeur: i.rna, maxlength: 10, placeholder: 'W123456789', autocapitalize: 'characters' }),
    siret: saisie({ valeur: i.siret, maxlength: 14, inputmode: 'numeric' }),
    dateCreation: saisie({ type: 'date', valeur: i.dateCreation }),
    contact: saisie({ valeur: i.contact, maxlength: 120, placeholder: 'contact@… ou https://…' }),
    referent: saisie({ valeur: i.referent, maxlength: 60, placeholder: 'pseudo ou fonction' }),
    assurance: saisie({ valeur: i.assurance, maxlength: 80, placeholder: 'assureur et n° de contrat' }),
  };
  const enregistrer = async (btn) => {
    btn.disabled = true;
    try {
      // Les réglages de la forme juridique (fiche suivante) sont repris tels quels.
      await api('PUT', '/api/admin/administratif/identite', { ...i, ...Object.fromEntries(Object.entries(champs).map(([k, el]) => [k, el.value.trim()])) });
      toast('Identité enregistrée : elle complète les documents types et la page « Données et confidentialité ».');
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
      btn.disabled = false;
    }
  };
  return h('section', { class: 'fiche pile' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Identité de l’association'), i.rna ? puce(`RNA ${i.rna}`, 'positif') : puce('Pas encore déclarée')),
    h('p', { class: 'texte-3 petit' }, 'Rien de personnel ici : pas d’adresse, pas de nom de dirigeant. Ces informations remplissent les documents types.'),
    h('div', { class: 'grille-champs' },
      champ('Nom de l’association', champs.nom),
      champ('Sigle (facultatif)', champs.sigle),
      champ('Numéro RNA', champs.rna, { aide: 'Sur le récépissé de déclaration : W suivi de 9 chiffres.' }),
      champ('SIRET (si besoin)', champs.siret, { aide: 'Seulement pour les subventions, des salariés ou la TVA.' }),
      champ('Date de déclaration', champs.dateCreation),
      champ('Assurance', champs.assurance)),
    h('div', { class: 'grille-champs' },
      champ('Contact public', champs.contact, { aide: 'Affiché sur « Données et confidentialité », visible sans connexion : une adresse de l’association, pas une adresse personnelle.' }),
      champ('Référent protection des mineurs', champs.referent, { aide: 'Repris dans la charte de protection des mineurs.' })),
    h('div', {}, bouton('Enregistrer', { classe: 'btn--principal', onclick: (e) => enregistrer(e.currentTarget) })));
}
