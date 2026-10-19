// Gestion du jeu, service : état de ce jeu (méta, clé API, Discord, coûts), notifications Discord, sauvegarde et
// restauration, journal du jeu. Le webhook Discord n'est jamais renvoyé au navigateur (seulement sa fin).

import { MARQUE } from '/shared/marque.js';
import { h, modale, champ, saisie, caseACocher, bouton, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puce } from '../composants/jetons.js';
import { EVENEMENTS_DISCORD } from '/shared/referentiel.js';
import { formatHorodatage, ilYA } from '/shared/temps.js';
import { listeJournal, chargement, erreurChargement, tableauCouts } from './admin-commun.js';

const DECLENCHEURS = { automatique: 'automatique', cron: 'réveil externe', manuel: 'bouton « Vérifier maintenant »', import: 'import manuel', initial: 'données d’installation' };
const cache = { jeu: '', d: null };

export function sectionsService(zone, ctx) {
  const jeu = E.jeu().id;
  let affiche = '';
  const dessiner = (d) => {
    affiche = JSON.stringify(d);
    zone.replaceChildren(
      h('div', { class: 'pile' }, ficheEtat(d.etat), E.peut('donnees.exporter') ? ficheSauvegarde(d.point) : null),
      h('div', { class: 'pile' }, d.reglages ? ficheDiscord(d.reglages, () => sectionsService(zone, ctx)) : null, ficheJournal(d.journal)));
  };
  if (cache.jeu === jeu && cache.d) dessiner(cache.d);
  else zone.replaceChildren(chargement());
  Promise.all([
    E.appeler('GET', '/etat'),
    E.appeler('GET', '/journal'),
    E.peut('reglages.gerer') ? E.appeler('GET', '/reglages') : null,
    E.peut('donnees.exporter') ? E.appeler('GET', '/restauration') : null,
  ])
    .then(([etat, journal, reglages, restauration]) => {
      if (E.jeu()?.id !== jeu) return;
      const d = { etat, journal: journal.entrees, reglages, point: restauration?.point || null };
      Object.assign(cache, { jeu, d });
      if (JSON.stringify(d) !== affiche) dessiner(d);
    })
    .catch((err) => {
      if (affiche) toast(messageErreur(err), { type: 'erreur' });
      else zone.replaceChildren(erreurChargement(err, () => sectionsService(zone, ctx)));
    });
}

function resultat(m) {
  if (!m) return puce('Aucune méta', 'attention');
  if (m.statut === 'echec') return [puce('Échec', 'negatif'), m.erreur ? h('span', { class: 'petit texte-2' }, ` ${m.erreur}`) : null];
  return puce('À jour', 'positif');
}

function ficheEtat(etat) {
  const m = etat.meta;
  return h('section', { class: 'fiche' },
    h('h2', {}, `État de ${E.jeu().nom}`),
    h('dl', { class: 'details' },
      h('dt', {}, 'Méta'), h('dd', {}, m
        ? [`Patch ${m.patch || '?'}, vérifiée ${m.derniereVerif ? ilYA(m.derniereVerif) : 'jamais'}`, m.declencheur ? h('span', { class: 'texte-3' }, ` (${DECLENCHEURS[m.declencheur] || m.declencheur})`) : null]
        : 'aucune'),
      h('dt', {}, 'Dernier essai'), h('dd', {}, resultat(m), etat.actualisationEnCours ? [' ', puce('Vérification en cours', 'info')] : null),
      h('dt', {}, 'Vérification auto'), h('dd', {}, etat.metaAuto
        ? (etat.cleClaude ? 'Lundi et jeudi, à la première visite après 7 h 45' : 'Activée, mais sans clé API : méta à importer à la main')
        : [puce('Coupée'), ' ', E.peut('jeu.regler') ? h('a', { href: J.lien('/reglages'), class: 'petit' }, 'Réglages du jeu') : null]),
      h('dt', {}, 'Clé API Claude'), h('dd', {}, etat.cleClaude ? puce('Configurée', 'positif') : [puce('Absente', 'attention'), h('a', { href: J.lien('/meta'), class: 'petit' }, ' import manuel (page Méta)')]),
      etat.cleClaude ? [h('dt', {}, 'Modèle'), h('dd', {}, etat.modele)] : null,
      h('dt', {}, 'Discord'), h('dd', {}, etat.discord ? puce('Webhook configuré', 'positif') : h('span', { class: 'texte-3' }, 'Non configuré')),
      h('dt', {}, 'Serveur'), h('dd', {}, `Version ${etat.version} · ${etat.stockage === 'mongo' ? 'MongoDB Atlas' : 'mémoire (simulation)'}`)),
    etat.cleClaude || Object.keys(etat.couts || {}).length
      ? [h('h3', { class: 'sous-titre' }, 'Coût estimé de la méta automatique'), tableauCouts(etat.couts)]
      : null);
}

function ficheDiscord(reglages, recharger) {
  const r = reglages.discord;
  const cle = 'gestion-discord';
  const webhook = saisie({
    type: 'url', autocomplete: 'off', spellcheck: 'false', maxlength: 200,
    placeholder: r.configure ? 'Laisse vide pour garder le webhook actuel' : 'https://discord.com/api/webhooks/…',
  });
  const cases = EVENEMENTS_DISCORD.map((e) => ({ id: e.id, ...caseACocher(e.nom, { coche: r.evenements?.[e.id] !== false }) }));
  const enregistrer = async (b, { supprimer = false } = {}) => {
    b.disabled = true;
    try {
      await E.appeler('PUT', '/reglages/discord', {
        webhook: supprimer ? '' : webhook.value.trim(), supprimer, evenements: Object.fromEntries(cases.map((c) => [c.id, c.input.checked])),
      });
      E.definirBrouillon(false, cle);
      toast(supprimer ? 'Webhook retiré : plus aucune notification.' : 'Réglages Discord enregistrés.');
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    } finally {
      b.disabled = false;
    }
  };
  return h('section', { class: 'fiche pile-s', dataset: { brouillon: cle } },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Notifications Discord'), r.configure ? puce(`Webhook …${r.apercu}`, 'positif') : puce('Non configuré')),
    h('p', { class: 'texte-2 petit' }, `${MARQUE.nom} poste dans un salon de ton serveur ce qui se passe dans ${E.jeu().nom}. Aucune mention @everyone, jamais.`),
    r.configure ? null : h('p', { class: 'texte-3 petit' }, r.retire
      ? 'Webhook retiré à la main : le bot Discord ne le rebranche pas. Colle une adresse pour réactiver les notifications.'
      : 'Avec le bot Discord de la structure, rien à faire : il crée le salon #lugh-notifs du jeu et branche ce webhook tout seul.'),
    h('details', { class: 'petit' }, h('summary', {}, 'Où trouver l’adresse du webhook ?'),
      h('ol', { class: 'liste-puces' },
        h('li', {}, 'Dans Discord, ouvre les paramètres du salon voulu (roue dentée).'),
        h('li', {}, 'Intégrations, puis Webhooks, puis Nouveau webhook.'),
        h('li', {}, 'Copier l’URL du webhook, puis colle-la ici. Elle reste secrète : elle n’est plus jamais affichée.'))),
    champ(r.configure ? 'Remplacer le webhook' : 'Adresse du webhook', webhook),
    h('fieldset', { class: 'compo-editeur' }, h('legend', {}, 'Événements envoyés'), h('div', { class: 'pile-s' }, cases.map((c) => c.element))),
    h('div', { class: 'rangee' },
      bouton('Enregistrer', { classe: 'btn--principal', onclick: (e) => enregistrer(e.currentTarget) }),
      r.configure ? bouton('Envoyer un test', {
        icone: 'discord',
        onclick: async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          try {
            await E.appeler('POST', '/discord/test', {});
            toast('Message de test envoyé : vérifie le salon.');
          } catch (err) {
            toast(messageErreur(err), { type: 'erreur' });
          } finally {
            b.disabled = false;
          }
        },
      }) : null,
      r.configure ? bouton('Retirer le webhook', { classe: 'btn--discret', onclick: (e) => enregistrer(e.currentTarget, { supprimer: true }) }) : null));
}

// Restauration : sauvegarde de CE jeu seulement, confirmation forte (taper RESTAURER), puis tout est rechargé.
function confirmerRestauration(sauvegarde, nomFichier) {
  const mot = saisie({ autocomplete: 'off', placeholder: 'RESTAURER', spellcheck: 'false' });
  const nb = Object.entries(sauvegarde).filter(([k, v]) => Array.isArray(v) && k !== 'comptes').reduce((n, [, v]) => n + v.length, 0);
  modale({
    titre: 'Restaurer une sauvegarde',
    contenu: [
      h('p', {}, `Fichier « ${nomFichier} »${sauvegarde.exporteLe ? `, exporté le ${formatHorodatage(sauvegarde.exporteLe)}` : ''} : ${nb} fiches de ${sauvegarde.nomJeu || E.jeu().nom}.`),
      h('div', { class: 'alerte alerte--urgent' }, icone('alerte'), h('span', {},
        `Toutes les données actuelles de ${E.jeu().nom} (roster, planning, strats, scrims, objectifs, Réglages du jeu…) seront remplacées par celles du fichier, y compris ce qui a été créé depuis. Les comptes, la méta et le webhook Discord ne changent pas. Exporte d’abord les données actuelles si tu as un doute.`)),
      champ('Pour confirmer, tape RESTAURER', mot),
    ],
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Restaurer',
      classe: 'btn--danger',
      action: async () => {
        if (mot.value.trim() !== 'RESTAURER') throw new Error('Tape RESTAURER en majuscules pour confirmer.');
        const bilan = await E.appeler('POST', '/restaurer', sauvegarde);
        await terminer('Sauvegarde restaurée', bilan);
      },
    }],
  });
}

// Après une restauration ou son annulation : tout est rechargé, puis le bilan et le nouveau point sont montrés.
async function terminer(titre, bilan) {
  if (bilan.point && cache.d && cache.jeu === E.jeu().id) cache.d = { ...cache.d, point: bilan.point };
  await E.rechargerTout();
  setTimeout(() => modale({
    titre,
    contenu: [
      h('p', {}, `${bilan.restaures} fiches restaurées, ${bilan.supprimes} retirées, ${bilan.ignores} ignorées.`),
      bilan.details?.length ? h('p', { class: 'texte-3 petit' }, `Fiches ignorées (invalides) : ${bilan.details.join(', ')}.`) : null,
      bilan.point ? h('p', { class: 'texte-3 petit' }, `Point de restauration : ${textePoint(bilan.point)}. « Annuler la dernière restauration » y revient.`) : null,
    ],
    actions: [{ libelle: 'Fermer', classe: 'btn--principal' }],
  }), 0);
}

const textePoint = (p) => `état d’avant ${p.source === 'annulation' ? 'l’annulation' : 'la restauration'} du ${formatHorodatage(p.le)}${p.par ? ` par ${p.par}` : ''}, ${p.fiches} fiche${p.fiches > 1 ? 's' : ''}`;

// Annuler la dernière restauration : le jeu revient au point gardé (confirmation forte : taper ANNULER).
function confirmerAnnulation(point) {
  const mot = saisie({ autocomplete: 'off', placeholder: 'ANNULER', spellcheck: 'false' });
  modale({
    titre: 'Annuler la dernière restauration',
    contenu: [
      h('p', {}, `Retour à l’${textePoint(point)}.`),
      h('div', { class: 'alerte alerte--urgent' }, icone('alerte'), h('span', {},
        `Toutes les données actuelles de ${E.jeu().nom} seront remplacées par cet état, y compris ce qui a été fait depuis. L’état actuel devient à son tour le point de restauration : tu pourras y revenir.`)),
      champ('Pour confirmer, tape ANNULER', mot),
    ],
    actions: [{ libelle: 'Garder l’état actuel' }, {
      libelle: 'Annuler la restauration',
      classe: 'btn--danger',
      action: async () => {
        if (mot.value.trim() !== 'ANNULER') throw new Error('Tape ANNULER en majuscules pour confirmer.');
        const bilan = await E.appeler('POST', '/restauration/annuler', {});
        await terminer('Restauration annulée', bilan);
      },
    }],
  });
}

function ficheSauvegarde(point) {
  const jeu = E.jeu();
  const fichier = h('input', { type: 'file', accept: '.json,application/json', class: 'visuellement-cache', id: 'fichier-sauvegarde', tabindex: '-1' });
  fichier.addEventListener('change', async () => {
    const f = fichier.files?.[0];
    fichier.value = '';
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast('Fichier trop lourd (15 Mo au maximum).', { type: 'erreur' });
      return;
    }
    try {
      const sauvegarde = JSON.parse(await f.text());
      if (sauvegarde?.format !== MARQUE.id || sauvegarde.version !== 2) throw new Error(`Ce fichier n’est pas une sauvegarde de ${MARQUE.nom}.`);
      if (sauvegarde.espace !== jeu.id) throw new Error(`Cette sauvegarde vient d’un autre jeu (${String(sauvegarde.nomJeu || sauvegarde.espace || '?').slice(0, 40)}) : elle ne se restaure que dans son propre jeu.`);
      confirmerRestauration(sauvegarde, f.name);
    } catch (err) {
      toast(err instanceof SyntaxError ? 'Fichier illisible : ce n’est pas un JSON valide.' : messageErreur(err), { type: 'erreur' });
    }
  });
  return h('section', { class: 'fiche pile-s' },
    h('h2', {}, 'Sauvegarde'),
    h('p', { class: 'texte-2 petit' }, `Exporte les données de ${jeu.nom} une fois par mois et garde le fichier en lieu sûr. Il contient tout ce jeu (Réglages du jeu compris), sans aucun mot de passe ni webhook.`),
    h('div', { class: 'rangee' },
      h('a', { href: E.chemin('/export'), class: 'btn', download: '' }, icone('telecharger'), 'Exporter les données'),
      h('label', {
        for: 'fichier-sauvegarde', class: 'btn btn--discret', tabindex: '0', role: 'button',
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fichier.click(); } },
      }, icone('actualiser'), 'Restaurer une sauvegarde'),
      fichier),
    h('p', { class: 'texte-3 tres-petit' }, 'Une sauvegarde ne se restaure que dans le jeu d’où elle vient.'),
    point ? h('div', { class: 'adm-restauration' },
      h('p', { class: 'petit' }, h('strong', {}, 'Point de restauration'), ` : ${textePoint(point).replace(/^é/, 'É')}.`),
      point.interrompue ? h('p', { class: 'alerte alerte--attention', role: 'alert' }, icone('alerte'),
        h('span', {}, 'La dernière restauration a été interrompue (redémarrage du serveur) : le jeu est peut-être à moitié restauré. Relance la restauration, ou annule-la avec le bouton ci-dessous.')) : null,
      h('p', { class: 'texte-3 tres-petit' }, 'Un seul point, gardé jusqu’à la prochaine restauration ; annuler crée à son tour un point.'),
      h('div', {}, bouton('Annuler la dernière restauration', { icone: 'actualiser', classe: 'btn--petit', onclick: () => confirmerAnnulation(point) }))) : null);
}

function ficheJournal(entrees) {
  // « l’appli (automatique) » et « un ancien compte » prennent une majuscule en début de ligne ; un nom affiché reste tel quel.
  const nomPar = (id) => {
    const n = E.nomCompte(id);
    if (!id || id === 'systeme') return MARQUE.nom;
    return n === 'un ancien compte' ? 'Un ancien compte' : n;
  };
  return h('section', { class: 'fiche' },
    h('h2', {}, 'Journal du jeu'),
    h('p', { class: 'texte-3 petit' }, 'Comptes, suppressions, réglages, exports, restaurations et méta de ce jeu. Conservé 90 jours.'),
    listeJournal(entrees, { nomPar, max: 120 }));
}
