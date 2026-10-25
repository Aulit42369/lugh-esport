// Stats Valorant (API Riot) : relier son compte Riot par Riot Sign On (accord explicite), délier, « Mes parties ».
// L'onglet « Équipe » (staff) est dans riot-equipe.js. Page visible seulement si le serveur a les clés Riot.

import { h, bouton, toast, confirmer, messageErreur, onglets, caseACocher, etatVide } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { puce, forme } from '../composants/jetons.js';
import { rendreEquipe, tuile, chiffre, nomFile } from './riot-equipe.js';

const RETOURS = {
  relie: ['Compte Riot relié : tes parties arrivent.', 'ok'],
  annule: ['Connexion Riot annulée : rien n’a été partagé.', 'ok'],
  deja: ['Ce compte Riot est déjà relié à un autre compte Lugh.', 'erreur'],
  expire: ['Le lien de connexion a expiré : recommence.', 'erreur'],
  erreur: ['Riot n’a pas pu confirmer la connexion. Réessaie plus tard.', 'erreur'],
};

const dateCourte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function rendre(page, params, ctx) {
  const staff = E.peut('objectifs.fixer');
  const onglet = staff && params[0] === 'equipe' ? 'equipe' : 'moi';
  if (RETOURS[params[0]]) {
    const [texte, type] = RETOURS[params[0]];
    toast(texte, { type });
    history.replaceState(null, '', J.lien('/riot'));
  }
  const corps = h('div', { class: 'pile' }, h('p', { class: 'texte-3' }, 'Chargement…'));
  page.append(
    h('header', { class: 'entete-page' },
      h('div', { class: 'entete-page__texte' },
        h('h1', {}, 'Stats Valorant'),
        h('p', { class: 'entete-page__intro' }, 'Tes parties Valorant, lues chez Riot seulement si tu relies ton compte. Rien sur les adversaires, aucun rang, rien en direct.'))),
    staff ? onglets([{ valeur: 'moi', libelle: 'Mes parties' }, { valeur: 'equipe', libelle: 'Équipe' }], onglet,
      (v) => ctx.aller(J.lien(v === 'equipe' ? '/riot/equipe' : '/riot')), { libelle: 'Vue' }) : null,
    corps);
  if (onglet === 'equipe') rendreEquipe(corps);
  else charger(corps);
  return null;
}

function charger(corps) {
  api('GET', `/api/e/${E.jeu().id}/riot`).then((etat) => {
    if (!etat.actif) corps.replaceChildren(etatVide('Stats Valorant : bientôt disponible.'));
    else if (!etat.liaison) dessinerAccord(corps, etat);
    else dessinerParties(corps, etat);
  }).catch((err) => corps.replaceChildren(h('p', { class: 'champ__erreur', role: 'alert' }, messageErreur(err))));
}

function bandeauDemo(etat) {
  return etat.demo ? h('p', { class: 'riot-demo' }, icone('info'), 'Démonstration : faux serveur Riot, données inventées.') : null;
}

// Opt-in : ce qui est partagé, avec qui, ce qui ne l'est jamais, et comment revenir en arrière.
function dessinerAccord(corps, etat) {
  const accord = caseACocher('J’accepte que Lugh lise mes parties Valorant chez Riot et les montre au staff de mon équipe.');
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  corps.replaceChildren(...[bandeauDemo(etat), h('section', { class: 'fiche riot-accord' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Relier mon compte Riot'), puce('Non relié')),
    h('div', { class: 'grille-2' },
      h('div', { class: 'pile-s' },
        h('h3', {}, 'Ce qui est partagé'),
        h('ul', { class: 'liste-puces' },
          h('li', {}, 'Ton Riot ID (pseudo#tag).'),
          h('li', {}, 'Tes 20 dernières parties Valorant : date, file, carte, agent, éliminations, morts, assistances, score de combat (ACS), résultat.'),
          h('li', {}, 'Visible par toi, et par le staff de ce jeu (Responsable, head coach, coach adjoint) dans un tableau d’équipe.'))),
      h('div', { class: 'pile-s' },
        h('h3', {}, 'Ce qui ne l’est jamais'),
        h('ul', { class: 'liste-puces' },
          h('li', {}, 'Ton mot de passe Riot : tu te connectes sur le site de Riot, pas dans Lugh.'),
          h('li', {}, 'Ton rang, ton MMR, tes adversaires, ni rien pendant une partie.'),
          h('li', {}, 'Les joueurs qui n’ont pas relié leur compte.')))),
    h('p', { class: 'texte-3 petit' }, 'Tu peux délier quand tu veux : ta liaison et tes parties sont supprimées tout de suite. Sinon, les parties sont gardées 90 jours au plus.'),
    accord.element, erreur,
    h('div', {}, bouton('Se connecter avec Riot', {
      icone: 'externe',
      classe: 'btn--principal',
      onclick: async (e) => {
        const btn = e.currentTarget;
        erreur.textContent = '';
        if (!accord.input.checked) {
          erreur.textContent = 'Coche la case pour accepter le partage.';
          return;
        }
        btn.disabled = true;
        try {
          const r = await api('POST', `/api/e/${E.jeu().id}/riot/relier`, { accord: true });
          window.location.assign(r.url);
        } catch (err) {
          erreur.textContent = messageErreur(err);
          btn.disabled = false;
        }
      },
    })))].filter(Boolean));
}

function dessinerParties(corps, etat, { actualiser = false } = {}) {
  const jeu = E.jeu().id;
  api('GET', `/api/e/${jeu}/riot/parties${actualiser ? '?actualiser=1' : ''}`).then((r) => {
    const s = r.stats;
    corps.replaceChildren(...[
      bandeauDemo(etat),
      h('div', { class: 'barre-outils' },
        h('span', { class: 'riot-relie' }, puce('Relié', 'positif'), h('strong', {}, r.liaison.nomRiot)),
        bouton('Actualiser', { icone: 'actualiser', classe: 'btn--discret btn--petit', onclick: () => dessinerParties(corps, etat, { actualiser: true }) }),
        bouton('Délier', { classe: 'btn--discret btn--petit', onclick: () => delier(corps) })),
      r.avertissement ? h('p', { class: 'conseil' }, r.avertissement) : null,
      h('div', { class: 'tableau-bord' },
        tuile(String(s.parties), 'parties gardées'),
        tuile(chiffre(s.kda), 'KDA : (élim. + assist.) / morts'),
        tuile(s.acs === null ? '—' : String(s.acs), 'ACS moyen'),
        tuile(s.victoires === null ? '—' : `${s.victoires} %`, 'de victoires'),
        h('div', { class: 'tuile' }, forme(s.forme), h('span', { class: 'texte-3 petit' }, 'forme récente'))),
      s.agents.length ? h('section', { class: 'section pile-s' }, h('h2', {}, 'Agents joués'),
        h('div', { class: 'rangee' }, s.agents.map((a) => puce(`${a.nom} · ${a.parties}`)))) : null,
      h('section', { class: 'section pile-s' }, h('h2', {}, 'Mes parties'),
        r.parties.length ? h('div', { class: 'defile' }, h('table', { class: 'tableau' },
          h('thead', {}, h('tr', {}, ['', 'Date', 'Carte', 'Agent', 'File'].map((t) => h('th', {}, t)),
            ['K / D / A', 'ACS', 'Score'].map((t) => h('th', { class: 'num' }, t)))),
          h('tbody', {}, r.parties.map((p) => h('tr', {},
            h('td', {}, p.victoire === null ? '' : h('span', { class: `resultat resultat--${p.victoire ? 'V' : 'D'}`, role: 'img', 'aria-label': p.victoire ? 'victoire' : 'défaite' }, p.victoire ? 'V' : 'D')),
            h('td', {}, dateCourte(p.debut)), h('td', {}, p.carte), h('td', {}, p.agent), h('td', {}, nomFile(p.file)),
            h('td', { class: 'num' }, `${p.k} / ${p.d} / ${p.a}`),
            h('td', { class: 'num' }, p.acs === null ? '—' : String(p.acs)),
            h('td', { class: 'num' }, p.scoreNous === null ? '—' : `${p.scoreNous}–${p.scoreEux}`)))))) : h('p', { class: 'texte-3' }, 'Aucune partie trouvée chez Riot pour l’instant.'))].filter(Boolean));
  }).catch((err) => {
    if (err.statut === 410 || err.statut === 404) {
      toast(err.message, { type: 'erreur' });
      dessinerAccord(corps, etat);
    } else corps.replaceChildren(h('p', { class: 'champ__erreur', role: 'alert' }, messageErreur(err)));
  });
}

async function delier(corps) {
  if (!(await confirmer('Ta liaison Riot et toutes tes parties gardées dans Lugh seront supprimées tout de suite.', { titre: 'Délier mon compte Riot', libelle: 'Délier', danger: true }))) return;
  try {
    await api('DELETE', `/api/e/${E.jeu().id}/riot`);
    toast('Compte Riot délié : tes données ont été supprimées.');
    charger(corps);
  } catch (err) {
    toast(messageErreur(err), { type: 'erreur' });
  }
}
