// Administration générale, onglet Discord : état du bot (dernier contact, serveur, problèmes signalés), réglages
// des rôles synchronisés et des rappels, jeux branchés sur Discord, annonces reprises sur Discord, sauvegardes sur le Pi,
// comptes liés. Les réglages s'appliquent à la prochaine synchronisation du bot.

import { h, bouton, toast, confirmer, liste, champ, saisie, caseACocher, messageErreur } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import { puce } from '../composants/jetons.js';
import { formatHorodatage, ilYA } from '/shared/temps.js';
import { chargement, erreurChargement, interrupteur } from './admin-commun.js';

const SILENCE_INQUIETANT_MS = 7 * 3_600_000; // le bot se synchronise toutes les 3 h
const SAUVEGARDE_EN_RETARD_MS = 8 * 86_400_000; // une par semaine (même seuil que le serveur, domaine/bot.js)

export function rendreDiscord(zone, ctx) {
  zone.replaceChildren(chargement());
  api('GET', '/api/admin/discord')
    .then((d) => zone.replaceChildren(...contenu(d, () => rendreDiscord(zone, ctx))))
    .catch((err) => zone.replaceChildren(erreurChargement(err, () => rendreDiscord(zone, ctx))));
}

function contenu(d, recharger) {
  return [
    h('div', { class: 'grille-2 section' }, ficheEtat(d), ficheReglages(d)),
    ficheJeux(d),
    ficheAnnonces(d, recharger),
    ficheLiaisons(d, recharger),
  ];
}

function ficheEtat(d) {
  const e = d.etat;
  const titre = h('div', { class: 'fiche__titre' }, h('h2', { class: 'titre-icone' }, icone('discord'), 'Bot Discord'));
  if (!d.configure) {
    titre.append(puce('Non installé', 'attention'));
    return h('section', { class: 'fiche' }, titre,
      h('p', { class: 'texte-2' }, 'Pour activer le bot : ajoute la variable LUGH_CLE_BOT dans Render (la même clé que dans le fichier .env du bot sur le Raspberry Pi), puis installe le bot. Le guide est dans le README de Lugh-Discord.'));
  }
  if (!e?.dernierContact) {
    titre.append(puce('Jamais vu', 'attention'));
    return h('section', { class: 'fiche' }, titre,
      h('p', { class: 'texte-2' }, 'La clé est en place mais le bot ne s’est encore jamais présenté. Vérifie sur le Pi : pm2 logs lugh-bot.'));
  }
  const silence = Date.now() - new Date(e.dernierContact).getTime() > SILENCE_INQUIETANT_MS;
  titre.append(silence ? puce('Silencieux', 'attention') : puce('En ligne', 'positif'));
  const st = e.stats || {};
  return h('section', { class: 'fiche' }, titre,
    h('dl', { class: 'details' },
      h('dt', {}, 'Dernier contact'), h('dd', {}, `${ilYA(e.dernierContact)} (${formatHorodatage(e.dernierContact)})`),
      h('dt', {}, 'Serveur'), h('dd', {}, e.serveur?.nom || '—'),
      h('dt', {}, 'Version du bot'), h('dd', {}, e.version || '—'),
      st.membres !== null && st.membres !== undefined ? [h('dt', {}, 'Membres'), h('dd', {}, `${st.membres} sur le serveur, ${st.lies ?? 0} liés à Lugh`)] : null,
      st.ajoutes || st.retires ? [h('dt', {}, 'Dernière synchro'), h('dd', {}, `${st.ajoutes || 0} rôle(s) donné(s), ${st.retires || 0} retiré(s)`)] : null,
      h('dt', {}, 'Sauvegarde sur le Pi'), h('dd', {}, e.sauvegarde
        ? `${ilYA(e.sauvegarde.le)} : ${e.sauvegarde.jeux} jeu${e.sauvegarde.jeux > 1 ? 'x' : ''}, ${(e.sauvegarde.octets / 1_048_576).toFixed(1).replace('.', ',')} Mo`
        : 'pas encore (une fois par semaine)')),
    silence ? h('p', { class: 'petit compte-2fa__alerte' }, icone('alerte'), 'Plus de nouvelles depuis plus de 7 h : le Pi est-il allumé ? Sur le Pi : pm2 status lugh-bot.') : null,
    e.sauvegarde && Date.now() - new Date(e.sauvegarde.le).getTime() > SAUVEGARDE_EN_RETARD_MS
      ? h('p', { class: 'petit compte-2fa__alerte' }, icone('alerte'), 'Sauvegarde sur le Pi de plus de 8 jours : seule copie hors d’Atlas, vérifie le Pi (pm2 logs lugh-bot).') : null,
    e.problemes?.length
      ? h('div', { class: 'pile-s' },
        h('h3', { class: 'sous-titre' }, 'Problèmes signalés par le bot'),
        h('ul', { class: 'liste-puces petit' }, e.problemes.map((p) => h('li', {}, p))))
      : h('p', { class: 'texte-3 petit' }, 'Aucun problème signalé à la dernière synchronisation.'));
}

function ficheReglages(d) {
  const r = structuredClone(d.reglages);
  const enregistrer = async (bouton_) => {
    bouton_.disabled = true;
    try {
      const rep = await api('PUT', '/api/admin/discord/reglages', r);
      Object.assign(r, rep.reglages);
      toast('Réglages enregistrés : appliqués à la prochaine synchronisation du bot (ou tout de suite avec /synchro).');
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
    } finally {
      bouton_.disabled = false;
    }
  };
  const basculer = (cle) => (input) => { if (cle === 'roles') r.roles = input.checked; else r.rappels[cle] = input.checked; };
  const delai = liste(d.delais.map((m) => ({ valeur: String(m), libelle: m < 60 ? `${m} minutes avant` : `${m / 60} h avant` })), { valeur: String(r.rappels.delai) });
  delai.addEventListener('change', () => { r.rappels.delai = Number(delai.value); });
  const cases = [['seances', 'Séances du planning'], ['scrims', 'Scrims'], ['matchs', 'Matchs officiels'], ['tournois', 'Tournois (le matin du jour J)']]
    .map(([cle, libelle]) => {
      const c = caseACocher(libelle, { coche: r.rappels[cle] });
      c.input.addEventListener('change', () => { r.rappels[cle] = c.input.checked; });
      return c.element;
    });
  return h('section', { class: 'fiche pile-s' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Réglages')),
    h('div', { class: 'rangee rangee--espace adm-discord__ligne' },
      h('div', {}, h('strong', {}, 'Rôles synchronisés'), h('p', { class: 'texte-3 petit' }, 'Métiers et jeux de Lugh → rôles Discord des comptes liés.')),
      interrupteur({ coche: r.roles, nom: 'Rôles synchronisés', surChange: basculer('roles') })),
    h('div', { class: 'rangee rangee--espace adm-discord__ligne' },
      h('div', {}, h('strong', {}, 'Rappels'), h('p', { class: 'texte-3 petit' }, 'Message dans le salon #général du jeu, qui mentionne le rôle du jeu.')),
      interrupteur({ coche: r.rappels.actif, nom: 'Rappels', surChange: basculer('actif') })),
    champ('Quand', delai),
    h('fieldset', { class: 'pile-s adm-discord__types' }, h('legend', { class: 'petit texte-2' }, 'Rappels pour'), cases),
    h('div', {}, bouton('Enregistrer', { classe: 'btn--principal', onclick: (e) => enregistrer(e.currentTarget) })));
}

function etatJeu(j) {
  if (j.configure) return puce('Notifications branchées', 'positif');
  if (j.retire) return puce('Webhook retiré à la main');
  return puce('En attente du bot', 'attention');
}

// Chaque jeu actif reçoit du bot son rôle, sa catégorie, ses salons et son webhook #lugh-notifs.
function ficheJeux(d) {
  const jeux = d.jeux || [];
  const enAttente = jeux.filter((j) => !j.configure).length;
  return h('section', { class: 'fiche section pile-s' },
    h('div', { class: 'fiche__titre' }, h('h2', { class: 'titre-icone' }, icone('jeux'), 'Jeux sur Discord'),
      jeux.length ? h('span', { class: 'fiche__meta' }, `${jeux.length - enAttente} sur ${jeux.length}`) : null),
    h('p', { class: 'texte-3 petit' }, 'Le bot crée lui-même ce qui manque pour chaque jeu actif (rôle, catégorie, salons, webhook #lugh-notifs) et branche ici ses notifications, à sa prochaine synchronisation ou tout de suite avec /synchro. Il ne supprime jamais rien : un jeu désactivé garde ses salons. Un webhook retiré à la main n’est pas rebranché ; pour couper seulement certaines notifications, décoche-les dans Gestion du jeu.'),
    jeux.length
      ? h('ul', { class: 'liste-lignes' }, jeux.map((j) => h('li', { class: 'rangee rangee--espace' },
        h('strong', {}, j.nom),
        etatJeu(j))))
      : h('p', { class: 'texte-3' }, 'Aucun jeu actif : active-les dans l’onglet Jeux.'));
}

function ficheLiaisons(d, recharger) {
  return h('section', { class: 'fiche section' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Comptes liés'), h('span', { class: 'fiche__meta' }, `${d.liaisons.length}`)),
    d.liaisons.length
      ? h('ul', { class: 'liste-lignes' }, d.liaisons.map((l) => h('li', { class: 'rangee rangee--espace' },
        h('span', {}, h('strong', {}, l.nomAffiche), h('span', { class: 'texte-3' }, ` (${l.identifiant})`), ' → ', l.pseudo,
          l.actif ? null : puce('compte désactivé', 'attention'),
          h('span', { class: 'texte-3 tres-petit' }, l.lieLe ? ` · lié ${ilYA(l.lieLe)}` : '')),
        bouton('Délier', {
          classe: 'btn--discret',
          onclick: async () => {
            if (!(await confirmer(`Délier ${l.nomAffiche} de ${l.pseudo} ? Ses rôles Lugh seront retirés du serveur à la prochaine synchronisation.`, { titre: 'Délier', libelle: 'Délier', danger: true }))) return;
            try {
              await api('DELETE', `/api/admin/comptes/${encodeURIComponent(l.compteId)}/discord`);
              toast('Délié.');
              recharger();
            } catch (err) {
              toast(messageErreur(err), { type: 'erreur' });
            }
          },
        }))))
      : h('p', { class: 'texte-3' }, 'Personne n’a encore lié son compte. Chacun le fait depuis Mon compte → Discord, puis /lier sur le serveur.'));
}

// Webhook du salon #annonces : chaque nouvelle annonce de la structure y est reprise (case cochée par défaut).
function ficheAnnonces(d, recharger) {
  const a = d.annonces;
  const adresse = saisie({ type: 'url', placeholder: 'https://discord.com/api/webhooks/…', autocomplete: 'off', spellcheck: 'false' });
  const envoyer = async (btn, corps, message) => {
    btn.disabled = true;
    try {
      await api('PUT', '/api/admin/discord/annonces', corps);
      toast(message);
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
      btn.disabled = false;
    }
  };
  return h('section', { class: 'fiche section pile-s' },
    h('div', { class: 'fiche__titre' }, h('h2', { class: 'titre-icone' }, icone('annonce'), 'Annonces sur Discord'),
      a.configure ? puce(`Webhook …${a.apercu.slice(-6)}`, 'positif') : puce('Non configuré')),
    h('p', { class: 'texte-3 petit' }, 'Une annonce publiée dans Administration → Annonces part aussi dans #annonces du serveur. Une annonce importante y mentionne @everyone. L’adresse est celle que l’installateur affiche pour les annonces ; elle reste secrète.'),
    champ(a.configure ? 'Remplacer l’adresse du webhook' : 'Adresse du webhook #annonces', adresse),
    h('div', { class: 'rangee' },
      bouton('Enregistrer', { classe: 'btn--principal', onclick: (e) => envoyer(e.currentTarget, { webhook: adresse.value.trim() }, 'Webhook des annonces enregistré.') }),
      a.configure ? bouton('Envoyer un test', {
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try {
            await api('POST', '/api/admin/discord/annonces/test', {});
            toast('Message de test envoyé dans #annonces.');
          } catch (err) {
            toast(messageErreur(err), { type: 'erreur' });
          } finally {
            e.currentTarget.disabled = false;
          }
        },
      }) : null,
      a.configure ? bouton('Retirer', {
        classe: 'btn--discret',
        onclick: async (e) => {
          const btn = e.currentTarget;
          if (await confirmer('Les annonces ne seront plus reprises sur Discord.', { titre: 'Retirer le webhook', libelle: 'Retirer', danger: true })) {
            envoyer(btn, { supprimer: true }, 'Webhook des annonces retiré.');
          }
        },
      }) : null));
}
