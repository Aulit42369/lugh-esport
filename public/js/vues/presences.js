// Présences : l'appel de chaque séance collective, les absences prévues, la charge planifiée de chacun, les comptes
// rendus de séance et le taux de présence. Les séances viennent du planning du jeu affiché.

import { h, modale, champ, saisie, liste, bouton, toast, etatVide, messageErreur, pourcentage } from '../ui.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { navSemaine, libelleSemaine, titreBloc, contenuCompteRendu } from '../composants/grille.js';
import { jauge, signature } from '../composants/jetons.js';
import { telecharger } from '../composants/sorties.js';
import { seancesAppel, statsPresences } from '/shared/suivi.js';
import { chargeSemaine } from '/shared/charge.js';
import { STATUTS_PRESENCE, JOURS, libelle } from '/shared/referentiel.js';
import { MOTIFS } from '/shared/validation.js';
import { dateCivile, semaineIso, joursDe, formatDate, aujourdhui, minutes, joursDepuis, dureeLisible } from '/shared/temps.js';
import { csv } from '/shared/exports.js';

const TONS = { present: 'positif', retard: 'attention', excuse: 'info', absent: 'negatif' };
const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

// Qui a fait l'appel : un compte, jamais le serveur (données importées ou de démonstration).
const auteurAppel = (fiche) => (fiche.maj?.par && fiche.maj.par !== 'systeme' ? `Appel fait par ${E.nomCompte(fiche.maj.par)}` : 'Appel fait');

// Membres attendus à une séance (les postes encore à pourvoir n'ont pas d'appel).
function attendus(bloc) {
  const joueurs = E.joueurs().filter((j) => j.pseudo && ['titulaire', 'remplacant', 'essai'].includes(j.statut));
  if (bloc.pour === 'choix') return E.membresActifs().filter((m) => m.pseudo && (bloc.membres || []).includes(m._id));
  if (bloc.pour === 'titulaires') return joueurs.filter((j) => j.statut === 'titulaire');
  return joueurs;
}

function absencePour(membreId, iso, bloc) {
  return E.liste('absences').find((a) => a.membreId === membreId && a.date === iso
    && (!a.debut || !a.fin || (minutes(a.debut) < minutes(bloc.fin) && minutes(a.fin) > minutes(bloc.debut))));
}

function declarerAbsence() {
  const monId = E.monMembreId();
  const tous = E.peut('dispos.tous');
  const membres = E.membresActifs().filter((m) => m.pseudo);
  const membre = liste(membres.map((m) => ({ valeur: m._id, libelle: m.pseudo })), { valeur: membres.some((m) => m._id === monId) ? monId : membres[0]?._id || '' });
  const date = saisie({ type: 'date', valeur: aujourdhui(), required: true });
  const debut = saisie({ type: 'time', step: 300 });
  const fin = saisie({ type: 'time', step: 300 });
  const raison = saisie({ maxlength: 120, placeholder: 'Ex. : examen, déplacement, malade' });
  modale({
    titre: 'Déclarer une absence',
    contenu: h('div', { class: 'grille-champs' },
      tous ? champ('Membre', membre) : null,
      champ('Date', date), champ('De', debut, { aide: 'Vide = toute la journée.' }), champ('À', fin),
      champ('Raison', raison, { large: true, aide: 'Visible par toute l’équipe : reste général.' })),
    actions: [{ libelle: 'Annuler' }, {
      libelle: 'Déclarer',
      classe: 'btn--principal',
      action: async () => {
        const qui = tous ? membre.value : monId;
        if (!qui) throw new Error('Choisis le membre absent.');
        if (!date.value) throw new Error('Choisis la date de l’absence.');
        // Une absence qui finit à minuit : le champ horaire renvoie 00:00, l’appli l'enregistre en 24:00.
        const finSaisie = fin.value === '00:00' && debut.value ? '24:00' : fin.value;
        await E.appeler('POST', '/absences', { valeur: { membreId: qui, date: date.value, debut: debut.value, fin: finSaisie, raison: raison.value.trim() } }, 'absences');
        toast('Absence déclarée : le staff la voit dans l’appel.');
      },
    }],
  });
}

async function retirerAbsence(a) {
  try {
    await E.appeler('DELETE', `/absences/${encodeURIComponent(a._id)}`);
    E.supprimerLocal('absences', a._id);
    toast('Absence retirée.');
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}

function enteteSeance(bloc, droite) {
  return h('div', { class: 'fiche__titre' },
    h('div', {}, h('strong', {}, titreBloc(bloc)), h('span', { class: 'texte-3 petit' }, ` ${JOURS[bloc.jour - 1].nom} ${bloc.debut}–${bloc.fin}`)),
    h('span', { class: 'fiche__meta' }, droite));
}

// Séance pas encore commencée : seulement les absences prévues, l'appel viendra au début de la séance.
function seanceAVenir(bloc, iso) {
  const absents = attendus(bloc).filter((m) => absencePour(m._id, iso, bloc));
  return h('section', { class: 'fiche fiche--serree appel appel--avenir' },
    enteteSeance(bloc, 'À venir'),
    h('p', { class: absents.length ? 'petit texte-2' : 'petit texte-3' }, absents.length ? `Absence prévue : ${absents.map((m) => m.pseudo).join(', ')}.` : 'Aucune absence prévue.'));
}

function appel(semaine, bloc, iso, editable) {
  const id = `${semaine}_${bloc.id}`;
  const fiche = E.doc('presences', id);
  if (!fiche && new Date(`${iso}T${bloc.debut}:00`) > new Date()) return seanceAVenir(bloc, iso);
  const statuts = { ...(fiche?.statuts || {}) };
  const membres = attendus(bloc);
  const boutons = {};
  const etat = h('span', { class: 'texte-3 tres-petit', role: 'status' });
  const cle = `appel-${id}`;
  let revActuelle = fiche?.rev ?? 0;
  // Chaque carte d'appel a son propre brouillon : enregistrer l'une ne fait pas perdre les autres.
  const modifie = () => {
    E.definirBrouillon(true, cle);
    etat.textContent = 'Non enregistré';
  };
  const peindre = (membreId) => {
    for (const [statut, b] of Object.entries(boutons[membreId] || {})) {
      const choisi = statuts[membreId] === statut;
      b.setAttribute('aria-pressed', String(choisi));
      b.className = choisi ? `choix--${statut}` : '';
    }
  };
  const enregistrer = bouton('Enregistrer l’appel', {
    classe: 'btn--principal btn--petit',
    onclick: async () => {
      try {
        const doc = await E.enregistrer('presences', id, { semaine, blocId: bloc.id, jour: bloc.jour, debut: bloc.debut, titre: titreBloc(bloc), statuts, note: fiche?.note || '' }, { revBase: revActuelle });
        revActuelle = doc.rev;
        etat.textContent = 'Enregistré';
        toast('Appel enregistré.');
        E.definirBrouillon(false, cle);
      } catch (err) {
        toast(messageErreur(err), { type: 'erreur' });
      }
    },
  });
  const lignes = membres.map((m) => {
    const prevue = absencePour(m._id, iso, bloc);
    const actuel = statuts[m._id] || '';
    let controle;
    if (editable) {
      boutons[m._id] = {};
      controle = h('div', { class: 'onglets onglets--compact', role: 'group', 'aria-label': `Présence de ${m.pseudo}` },
        STATUTS_PRESENCE.map((st) => {
          const b = h('button', { type: 'button', title: st.nom, 'aria-label': st.nom, onclick: () => { statuts[m._id] = st.id; peindre(m._id); modifie(); } }, st.court);
          boutons[m._id][st.id] = b;
          return b;
        }));
    } else {
      controle = actuel ? h('span', { class: `puce puce--${TONS[actuel]}` }, libelle(STATUTS_PRESENCE, actuel)) : h('span', { class: 'texte-3 petit' }, prevue ? 'Excusé prévu' : '—');
    }
    return h('li', { class: 'appel__ligne' },
      h('span', { class: 'appel__nom' }, m.pseudo, prevue ? h('span', { class: 'texte-3 tres-petit' }, ` absence prévue${prevue.raison ? ` (${prevue.raison})` : ''}`) : null),
      controle);
  });
  for (const m of membres) peindre(m._id);
  return h('section', { class: 'fiche fiche--serree appel', dataset: { brouillon: cle } },
    enteteSeance(bloc, fiche ? auteurAppel(fiche) : 'Appel à faire'),
    membres.length ? h('ul', { class: 'appel__liste' }, lignes) : h('p', { class: 'texte-3 petit' }, 'Aucun joueur attendu.'),
    editable && membres.length ? h('div', { class: 'rangee rangee--espace' },
      bouton('Tous présents, sauf absences prévues', {
        classe: 'btn--discret btn--petit',
        onclick: () => {
          for (const m of membres) {
            if (!statuts[m._id]) statuts[m._id] = absencePour(m._id, iso, bloc) ? 'excuse' : 'present';
            peindre(m._id);
          }
          modifie();
        },
      }),
      h('div', { class: 'rangee' }, etat, enregistrer)) : null);
}

// ——— Charge de la semaine : heures planifiées, jours off et parties saisies par chaque joueur (aucune donnée de santé) ———

function ligneCharge(c, { heuresMax, joursOffMin }) {
  const alertes = [
    c.depasse ? `Au-delà du plafond de ${heuresMax} h` : null,
    c.sansRepos ? (c.joursOff === 0 ? 'Aucun jour off' : `${pluriel(c.joursOff, 'jour off', 'jours off')} pour ${joursOffMin} au minimum`) : null,
  ].filter(Boolean);
  const pct = heuresMax ? Math.round((c.minutes / (heuresMax * 60)) * 100) : 0;
  return h('li', { class: ['charge__ligne', alertes.length && 'charge__ligne--alerte'] },
    h('span', { class: 'charge__nom' }, c.pseudo),
    h('div', { class: 'charge__heures' },
      jauge(Math.min(100, pct), { legende: 'Heures planifiées', droite: `${dureeLisible(c.minutes)} / ${heuresMax} h`, couleur: c.depasse ? 'var(--brique)' : null })),
    h('span', { class: 'charge__chiffre' }, h('strong', {}, String(c.joursOff)), ` jour${c.joursOff > 1 ? 's' : ''} off`),
    h('span', { class: 'charge__chiffre' }, c.parties === null
      ? h('span', { class: 'texte-3' }, 'Parties non saisies')
      : [h('strong', {}, String(c.parties)), ` partie${c.parties > 1 ? 's' : ''} saisie${c.parties > 1 ? 's' : ''}`]),
    alertes.length
      ? h('span', { class: 'charge__etat charge__etat--alerte' }, icone('alerte'), alertes.join(' · '))
      : h('span', { class: 'charge__etat' }, icone('ok'), 'Dans les seuils'));
}

function sectionCharge(semaine) {
  const def = J.def();
  const seuils = def.charge;
  const planning = E.doc('planning', semaine);
  const lignes = chargeSemaine({ def, planning, membres: E.liste('membres'), mesures: E.liste('mesures'), semaine }).filter((c) => c.pseudo);
  let contenu;
  if (!planning?.blocs?.length) contenu = h('p', { class: 'texte-3' }, 'Aucun planning pour cette semaine : rien à mesurer.');
  else if (!lignes.length) contenu = h('p', { class: 'texte-3' }, 'Aucun joueur nommé dans le roster pour l’instant.');
  else contenu = h('ul', { class: 'charge' }, lignes.map((c) => ligneCharge(c, seuils)));
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' },
      h('h2', {}, 'Charge de la semaine'),
      h('span', { class: 'section__aide' }, `Seuils du jeu : ${seuils.heuresMax} h planifiées au plus, ${pluriel(seuils.joursOffMin, 'jour off', 'jours off')} au moins.`,
        E.peut('jeu.regler') ? [' ', h('a', { href: J.lien('/reglages') }, 'Modifier les seuils')] : null)),
    contenu);
}

// ——— Comptes rendus de la semaine, en lecture (ils s'écrivent depuis le planning) ———

function sectionComptesRendus(semaine) {
  const comptes = E.liste('seances').filter((c) => c.semaine === semaine).sort((a, b) => a.jour - b.jour || minutes(a.debut) - minutes(b.debut));
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Comptes rendus de la semaine'), h('a', { href: J.lien(`/planning/${semaine}`), class: 'petit' }, 'Planning de la semaine')),
    comptes.length
      ? h('div', { class: 'grille-2' }, comptes.map((cr) => h('article', { class: 'fiche fiche--serree compte-rendu-fiche' },
        h('div', { class: 'fiche__titre' },
          h('div', {}, h('strong', {}, cr.titre || J.nomTypeBloc(cr.type)), h('span', { class: 'texte-3 petit' }, ` ${JOURS[cr.jour - 1].nom} ${cr.debut}`)),
          icone('compteRendu', { classe: 'compte-rendu-fiche__icone' })),
        contenuCompteRendu(cr),
        signature(cr))))
      : h('p', { class: 'texte-3' }, E.peut('presences.modifier')
        ? 'Aucun compte rendu cette semaine : écris-les depuis le planning, sur chaque séance passée.'
        : 'Aucun compte rendu cette semaine.'));
}

function exporter() {
  const membres = E.membresActifs();
  const lignes = [];
  for (const p of E.liste('presences').sort((a, b) => `${a.semaine}${a.jour}${a.debut}`.localeCompare(`${b.semaine}${b.jour}${b.debut}`))) {
    for (const m of membres) {
      if (p.statuts?.[m._id]) lignes.push([p.semaine, JOURS[p.jour - 1]?.nom, p.debut, p.titre, m.pseudo, libelle(STATUTS_PRESENCE, p.statuts[m._id])]);
    }
  }
  if (!lignes.length) {
    toast('Aucun appel enregistré pour l’instant.', { type: 'erreur' });
    return;
  }
  telecharger(`presences-${E.jeu().id}.csv`, csv(['Semaine', 'Jour', 'Heure', 'Séance', 'Membre', 'Présence'], lignes), 'text/csv;charset=utf-8');
}

export function rendre(page, params, ctx) {
  const courante = semaineIso(dateCivile(new Date()));
  const semaine = MOTIFS.semaine.test(params[0] || '') ? params[0] : courante;
  const editable = E.peut('presences.modifier');
  const monId = E.monMembreId();
  const peutDeclarer = (!!monId && !!E.doc('membres', monId) && E.peut('dispos.soi')) || E.peut('dispos.tous');
  const planning = E.doc('planning', semaine);
  const jours = joursDe(semaine);
  const seances = seancesAppel(planning?.blocs || []).sort((a, b) => a.jour - b.jour || minutes(a.debut) - minutes(b.debut));

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Présences'),
      h('p', { class: 'entete-page__intro' }, 'L’appel de chaque séance collective. Les absences déclarées à l’avance apparaissent dans l’appel et comptent comme excusées.')),
    h('div', { class: 'entete-page__actions' },
      peutDeclarer ? bouton('Déclarer une absence', { icone: 'ajouter', classe: 'btn--principal', onclick: declarerAbsence }) : null,
      bouton('Exporter (CSV)', { icone: 'telecharger', onclick: exporter }))));
  page.append(h('div', { class: 'barre-outils' }, navSemaine(semaine, courante, (s) => ctx.aller(J.lien(`/presences/${s}`)))));

  const debutSemaine = jours[0].iso;
  const finSemaine = jours[6].iso;
  const absences = E.liste('absences').filter((a) => a.date >= debutSemaine && a.date <= finSemaine).sort((a, b) => a.date.localeCompare(b.date) || (a.debut || '').localeCompare(b.debut || ''));
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Absences prévues'), h('span', { class: 'section__aide' }, libelleSemaine(semaine))),
    absences.length ? h('div', { class: 'liste-lignes' }, absences.map((a) => h('div', { class: 'ligne' },
      icone('presences'),
      h('div', { class: 'ligne__principal' },
        h('div', { class: 'ligne__titre' }, `${E.nomMembre(E.doc('membres', a.membreId))}, ${formatDate(a.date)}${a.debut ? ` de ${a.debut}${a.fin ? ` à ${a.fin}` : ''}` : ', toute la journée'}`),
        a.raison ? h('div', { class: 'ligne__sous' }, a.raison) : null),
      ((monId && a.membreId === monId && E.peut('dispos.soi')) || E.peut('dispos.tous')) ? bouton('Retirer', { classe: 'btn--discret btn--petit', onclick: () => retirerAbsence(a) }) : null)))
      : h('p', { class: 'texte-3' }, 'Aucune absence déclarée cette semaine.')));

  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Appel des séances'), seances.length ? h('span', { class: 'section__aide' }, `${seances.length} séance${seances.length > 1 ? 's' : ''} collective${seances.length > 1 ? 's' : ''}`) : null),
    seances.length
      ? h('div', { class: 'grille-2' }, seances.map((b) => appel(semaine, b, jours[b.jour - 1].iso, editable)))
      : etatVide('Aucune séance collective dans le planning de cette semaine.', h('a', { href: J.lien(`/planning/${semaine}`), class: 'btn' }, 'Ouvrir le planning'))));

  page.append(sectionComptesRendus(semaine), sectionCharge(semaine));

  const stats = statsPresences(E.liste('presences'), { filtre: (p) => MOTIFS.semaine.test(p.semaine || '') && joursDepuis(`${joursDe(p.semaine)[(p.jour || 1) - 1].iso}T12:00:00`) <= 30 });
  const joueurs = E.joueurs().filter((j) => j.pseudo);
  page.append(h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Sur les 30 derniers jours'), h('span', { class: 'section__aide' }, 'Taux = présent ou en retard, absences excusées non comptées.')),
    joueurs.length ? h('div', { class: 'defile' }, h('table', { class: 'tableau' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Joueur'), h('th', { class: 'num' }, 'Taux'), ...STATUTS_PRESENCE.map((s) => h('th', { class: 'num' }, s.nom)))),
      h('tbody', {}, joueurs.map((j) => {
        const s = stats[j._id];
        return h('tr', {},
          h('td', {}, j.pseudo),
          h('td', { class: 'num' }, s ? pourcentage(s.taux) : '—'),
          ...STATUTS_PRESENCE.map((st) => h('td', { class: 'num' }, s ? String(s[st.id]) : '—')));
      }))))
      : h('p', { class: 'texte-3' }, 'Aucun joueur nommé dans le roster pour l’instant.')));
}
