// Mon compte, fiche Discord : lier son compte au serveur Discord de la structure avec un code à usage unique
// (10 minutes, tapé avec /lier sur Discord), confirmer le pseudo Discord qui l'a tapé, voir la liaison, délier.

import { h, bouton, toast, confirmer, messageErreur } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { puce } from '../composants/jetons.js';
import { copier } from './admin-commun.js';

const dateLongue = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const heure = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

async function actualiserCompte() {
  const r = await api('GET', '/api/auth/moi');
  E.majCompte(r.compte);
  return r.compte;
}

export function ficheDiscord(c) {
  const corps = h('div', { class: 'pile-s' });
  const fiche = h('section', { class: 'fiche compte-discord', 'aria-labelledby': 'titre-discord' },
    h('div', { class: 'fiche__titre' },
      h('h2', { id: 'titre-discord', class: 'titre-icone' }, icone('discord'), 'Discord'),
      h('span', { class: 'compte-discord__etat' }, c.discord ? puce('Lié', 'positif') : puce('Non lié'))),
    corps);
  if (c.discord) dessinerLie(corps, c);
  else if (c.discordAttente && new Date(c.discordAttente.expire) > new Date()) dessinerConfirmation(corps, c);
  else dessinerNonLie(corps);
  return fiche;
}

// La pastille du titre suit l'état affiché.
function marquer(corps, lie) {
  corps.closest('.compte-discord')?.querySelector('.compte-discord__etat')?.replaceChildren(lie ? puce('Lié', 'positif') : puce('Non lié'));
}

function dessinerLie(corps, c) {
  marquer(corps, true);
  corps.replaceChildren(
    h('p', { class: 'texte-2' }, 'Lié à ', h('strong', {}, c.discord.pseudo), c.discord.lieLe ? ` depuis le ${dateLongue(c.discord.lieLe)}.` : '.'),
    h('p', { class: 'texte-3 petit' }, 'Tes rôles sur le serveur suivent tes métiers et tes jeux dans Lugh (mise à jour en quelques heures, ou tout de suite avec /synchro). Sur Discord : /planning, /match et /absent.'),
    h('div', {}, bouton('Délier', {
      classe: 'btn--discret',
      onclick: async () => {
        if (!(await confirmer('Tes rôles Lugh seront retirés du serveur Discord à la prochaine synchronisation.', { titre: 'Délier Discord', libelle: 'Délier', danger: true }))) return;
        try {
          await api('DELETE', '/api/moi/discord');
          const compte = await actualiserCompte();
          toast('Compte Discord délié.');
          dessinerNonLie(corps, compte);
        } catch (err) {
          toast(messageErreur(err), { type: 'erreur' });
        }
      },
    })));
}

function dessinerNonLie(corps) {
  marquer(corps, false);
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  corps.replaceChildren(
    h('p', { class: 'texte-2' }, 'Lie ton compte pour recevoir automatiquement tes rôles sur le serveur Discord de la structure, et utiliser /planning, /match et /absent.'),
    erreur,
    h('div', {}, bouton('Obtenir un code', {
      icone: 'discord',
      classe: 'btn--principal',
      onclick: async (e) => {
        erreur.textContent = '';
        e.currentTarget.disabled = true;
        try {
          const r = await api('POST', '/api/moi/discord/code', {});
          dessinerCode(corps, r);
        } catch (err) {
          erreur.textContent = messageErreur(err);
          e.currentTarget.disabled = false;
        }
      },
    })));
}

function dessinerCode(corps, { code, expire }) {
  const commande = `/lier ${code}`;
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  corps.replaceChildren(
    h('p', { class: 'texte-2' }, 'Sur le serveur Discord, dans n’importe quel salon (même #bienvenue), tape :'),
    h('p', { class: 'code-liaison', 'aria-label': `Commande : slash lier ${code.split('').join(' ')}` }, h('span', { class: 'code-liaison__commande' }, '/lier '), code),
    h('p', { class: 'texte-3 petit' }, `Valable jusqu’à ${heure(expire)}, une seule fois. Ne le montre pas en stream ni en partage d’écran.`),
    erreur,
    h('div', { class: 'rangee' },
      bouton('Copier la commande', { icone: 'copier', onclick: () => copier(commande) }),
      bouton('C’est fait', {
        icone: 'ok',
        classe: 'btn--principal',
        onclick: async () => {
          erreur.textContent = '';
          try {
            const compte = await actualiserCompte();
            if (compte.discordAttente) dessinerConfirmation(corps, compte);
            else erreur.textContent = 'Rien reçu pour l’instant : vérifie que tu as bien tapé la commande sur le serveur de la structure.';
          } catch (err) {
            erreur.textContent = messageErreur(err);
          }
        },
      })));
}

// Le code a pu être vu par quelqu'un d'autre (écran partagé, stream) : la personne vérifie le pseudo avant de lier.
function dessinerConfirmation(corps, c) {
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const repondre = (accepter) => async (e) => {
    erreur.textContent = '';
    e.currentTarget.disabled = true;
    try {
      const r = await api('POST', '/api/moi/discord/confirmer', { accepter });
      E.majCompte(r.compte);
      if (accepter) {
        toast('Compte Discord lié : tes rôles arrivent dans quelques minutes.');
        dessinerLie(corps, r.compte);
      } else {
        toast('Liaison refusée.');
        dessinerNonLie(corps);
      }
    } catch (err) {
      erreur.textContent = messageErreur(err);
      e.currentTarget.disabled = false;
    }
  };
  corps.replaceChildren(
    h('p', { class: 'texte-2' }, 'Le code a été tapé sur Discord par ', h('strong', {}, c.discordAttente.pseudo), '. C’est bien toi ?'),
    h('p', { class: 'texte-3 petit' }, 'Si ce pseudo n’est pas le tien, quelqu’un a vu ton code : refuse, puis demande un nouveau code sans le montrer.'),
    erreur,
    h('div', { class: 'rangee' },
      bouton('Oui, c’est moi', { icone: 'ok', classe: 'btn--principal', onclick: repondre(true) }),
      bouton('Non, refuser', { classe: 'btn--discret', onclick: repondre(false) })));
}
