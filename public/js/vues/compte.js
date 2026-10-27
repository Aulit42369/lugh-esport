// Mon compte (page générale, aucun jeu chargé) : identité, jeux ouverts et métiers dans chacun, agenda personnel,
// mot de passe, double authentification, Discord, thème et installation sur cet appareil, déconnexion.

import { h, vider, champ, saisie, onglets, bouton, toast, modale, messageErreur } from '../ui.js';
import { liensLegaux } from '../composants/confidentialite.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import * as E from '../etat.js';
import { puce } from '../composants/jetons.js';
import { puceJeu } from '../navigation.js';
import { themeActuel, definirTheme } from '../theme.js';
import { dejaInstallee, installable, installer } from '../installation.js';
import { champCode, activation2fa, blocCodesSecours, occupe } from './deuxfacteurs.js';
import { ficheDiscord } from './compte-discord.js';
import { nomsMetiers } from '/shared/roles.js';
import { MARQUE } from '/shared/marque.js';

const METIERS_JOUEUR = ['capitaine', 'joueur', 'remplacant'];

export function rendre(page, params, ctx) {
  const c = E.compte();

  page.append(h('header', { class: 'entete-page' },
    h('div', { class: 'entete-page__texte' },
      h('h1', {}, 'Mon compte'),
      h('p', { class: 'entete-page__intro' }, 'Un seul compte pour tous tes jeux. Tes métiers sont attribués jeu par jeu, par le Responsable de chaque jeu ou par l’Administrateur général.'))));

  page.append(h('div', { class: 'grille-compte' },
    h('div', { class: 'pile' },
      ficheIdentite(c),
      ficheJeux(c)),
    h('div', { class: 'pile' },
      ficheDeuxFacteurs(c),
      ficheDiscord(c),
      formulaireMdp(c),
      ficheAppareil(ctx),
      c.admin ? null : ficheSuppression())));
  page.append(h('p', { class: 'texte-3 petit section' }, 'Ce que Lugh garde sur toi, tes droits et les règles : ', ...liensLegaux(), '.'));
}

// Droit à l'effacement : le compte, ses liaisons Discord et Riot et ses sessions disparaissent ; ce qui a été écrit
// pour l'équipe reste, signé « un ancien compte ». Pas pour l'Administrateur général (il doit en rester un).
function ficheSuppression() {
  return h('section', { class: 'fiche' },
    h('h2', {}, 'Supprimer mon compte'),
    h('p', { class: 'texte-2 petit' }, 'Efface ton compte et tes liaisons Discord et Riot. Ce que tu as écrit pour l’équipe reste, signé « un ancien compte ». Ta fiche du roster est gérée par le staff de ton jeu.'),
    bouton('Supprimer mon compte', {
      classe: 'btn--danger',
      onclick: () => {
        const mdp = saisie({ type: 'password', autocomplete: 'current-password', required: true });
        modale({
          titre: 'Supprimer mon compte',
          contenu: h('div', { class: 'pile' },
            h('p', {}, 'C’est définitif : ton compte ne pourra pas être récupéré. Confirme avec ton mot de passe.'),
            champ('Mot de passe', mdp)),
          actions: [
            { libelle: 'Annuler' },
            {
              libelle: 'Supprimer définitivement',
              classe: 'btn--danger',
              action: async () => {
                await api('POST', '/api/moi/supprimer', { mdp: mdp.value });
                window.location.hash = '';
                window.location.reload();
              },
            },
          ],
        });
      },
    }));
}

function ficheIdentite(c) {
  return h('section', { class: 'fiche compte-identite' },
    h('div', { class: 'compte-identite__tete' },
      h('h2', { class: 'compte-identite__nom' }, c.nomAffiche || c.identifiant),
      E.estAdmin() ? puce('Administrateur général', 'plein') : null),
    h('dl', { class: 'details' },
      h('dt', {}, 'Identifiant'), h('dd', {}, c.identifiant)),
    h('p', { class: 'texte-3 petit' }, E.estAdmin()
      ? 'Administrateur général : tu vois tous les jeux, y compris ceux qui sont désactivés, et tu gères tous les comptes.'
      : 'Pour changer ton nom affiché, demande au Responsable de ton jeu.'),
    h('div', {}, bouton('Se déconnecter', {
      icone: 'deconnexion',
      onclick: async () => {
        try {
          await api('POST', '/api/auth/deconnexion');
        } finally {
          window.location.hash = '';
          window.location.reload();
        }
      },
    })));
}

function ligneJeu(c, j) {
  const relie = !!c.acces?.[j.id]?.membreId;
  const joueur = (j.metiers || []).some((m) => METIERS_JOUEUR.includes(m));
  return h('a', { href: `#/${encodeURIComponent(j.id)}`, class: 'choix-jeu' },
    puceJeu(j),
    h('span', { class: 'choix-jeu__texte' },
      h('strong', {}, j.nom, j.actif ? null : puce('désactivé', 'attention')),
      h('small', {}, nomsMetiers(j.metiers || []).join(', ') || 'Aucun métier'),
      relie ? h('small', {}, 'Profil du roster relié à ton compte')
        : joueur ? h('small', {}, 'Profil du roster pas encore relié : demande à ton Responsable.') : null),
    icone('droite', { classe: 'compte-jeux__fleche' }));
}

function ficheJeux(c) {
  const jeux = E.jeux();
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' },
      h('h2', {}, 'Mes jeux'),
      jeux.length ? h('span', { class: 'fiche__meta' }, `${jeux.length} jeu${jeux.length > 1 ? 'x' : ''}`) : null),
    jeux.length
      ? h('div', { class: 'choix-jeux compte-jeux' }, jeux.map((j) => ligneJeu(c, j)))
      : h('p', { class: 'texte-2' }, E.estAdmin()
        ? 'Aucun jeu n’est encore activé.'
        : 'Aucun jeu ne t’est encore ouvert : demande à ton Responsable ou à l’Administrateur général.'),
    E.estAdmin() ? h('p', { class: 'compte-jeux__admin' },
      h('a', { href: '#/admin/jeux', class: 'btn btn--discret' }, icone('cadenas'), jeux.length ? 'Gérer les jeux' : 'Activer un premier jeu')) : null,
    jeux.length ? h('div', { class: 'agenda-perso' },
      h('h3', { class: 'sous-titre' }, 'Mon agenda'),
      h('a', { href: '/api/moi/agenda.ics', download: '', class: 'btn agenda-perso__lien' }, icone('agenda'), 'Mon agenda, tous mes jeux (4 semaines)'),
      h('p', { class: 'texte-3 petit' }, 'À importer dans Google Agenda ou ton téléphone. Ce n’est pas un abonnement : retélécharge-le après un changement de planning.')) : null);
}

// ——— Double authentification ———

function dateLongue(iso) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function ficheDeuxFacteurs(c) {
  const df = c.deuxFacteurs || { actif: false, codesRestants: 0 };
  const n = df.codesRestants || 0;
  return h('section', { class: 'fiche compte-2fa', 'aria-labelledby': 'titre-2fa' },
    h('div', { class: 'fiche__titre' },
      h('h2', { id: 'titre-2fa', class: 'titre-icone' }, icone('securite'), 'Double authentification'),
      df.actif ? puce('Active', 'positif') : puce('Désactivée', 'attention')),
    df.actif
      ? [h('p', { class: 'texte-2' }, `Active depuis le ${dateLongue(df.depuis)}. À chaque connexion, après le mot de passe, saisis le code de ton application d’authentification.`),
        h('p', { class: ['petit', n <= 3 ? 'compte-2fa__alerte' : 'texte-3'] }, n <= 3 && icone('alerte'),
          n ? `${n} code${n > 1 ? 's' : ''} de secours restant${n > 1 ? 's' : ''}${n <= 3 ? ' : renouvelle-les.' : '.'}` : 'Plus aucun code de secours : renouvelle-les.'),
        h('div', { class: 'rangee' },
          bouton('Renouveler les codes de secours', { onclick: () => fenetreCodes(c) }),
          bouton('Désactiver', { classe: 'btn--discret', onclick: () => fenetreDesactiver() }))]
      : [h('p', { class: 'texte-2' }, 'En plus du mot de passe, un code à 6 chiffres donné par une application sur ton téléphone. Quelqu’un qui découvre ton mot de passe ne peut pas entrer sans ton téléphone.'),
        h('div', {}, bouton('Activer la double authentification', { icone: 'securite', classe: 'btn--principal', onclick: () => fenetreActivation(c) }))]);
}

// Fenêtre des codes de secours : tant qu'ils ne sont pas mis à l'abri, ni Échap ni la croix ne la ferment.
function montrerCodes(fenetre, corps, codes, identifiant, message) {
  fenetre.dialogue.querySelector('.modale__entete .btn--icone')?.setAttribute('hidden', '');
  fenetre.dialogue.addEventListener('cancel', (e) => e.preventDefault());
  fenetre.dialogue.querySelector('h2').textContent = 'Tes codes de secours';
  vider(corps).append(
    h('p', { class: 'bandeau-2fa' }, icone('ok'), message),
    blocCodesSecours(codes, { identifiant, surFin: () => fenetre.fermer() }));
  corps.querySelector('.codes-2fa button')?.focus();
}

function fenetreActivation(c) {
  const corps = h('div', { class: 'pile' });
  const fenetre = modale({ titre: 'Activer la double authentification', contenu: corps, large: true });
  corps.append(
    h('p', { class: 'texte-2' }, 'Trois étapes, deux minutes : garde ton téléphone à portée de main.'),
    activation2fa({
      surActive: (r) => {
        E.majCompte(r.compte);
        montrerCodes(fenetre, corps, r.codesSecours, c.identifiant, 'Double authentification activée. Tes autres appareils ont été déconnectés : reconnecte-les avec le code de l’application.');
        toast('Double authentification activée.');
      },
    }));
}

// Formulaire de fenêtre : un code (et parfois le mot de passe), une action, l'erreur du serveur telle quelle.
function formulaireCode({ intro, champs = [], code, libelle, danger = false, envoyer }) {
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const envoi = h('button', { type: 'submit', class: ['btn', danger ? 'btn--danger' : 'btn--principal'] }, libelle);
  let enCours = false;
  const formulaire = h('form', {
    class: 'formulaire',
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (enCours) return;
      erreur.textContent = '';
      let valeur;
      try {
        valeur = code.lire();
      } catch (err) {
        erreur.textContent = err.message;
        return;
      }
      enCours = true;
      occupe(envoi, true);
      try {
        await envoyer(valeur);
      } catch (err) {
        erreur.textContent = messageErreur(err);
        code.vider();
      } finally {
        enCours = false;
        occupe(envoi, false);
      }
    },
  }, h('p', { class: 'texte-2' }, intro), champs, code.element, erreur, h('div', {}, envoi));
  return formulaire;
}

function fenetreCodes(c) {
  const corps = h('div', { class: 'pile' });
  const fenetre = modale({ titre: 'Renouveler les codes de secours', contenu: corps });
  const code = champCode({ secoursPossible: false, surComplet: () => formulaire.requestSubmit() });
  const formulaire = formulaireCode({
    intro: 'Tu reçois 10 nouveaux codes ; les anciens ne marcheront plus. Confirme avec le code de ton application.',
    code,
    libelle: 'Renouveler les codes',
    envoyer: async (valeur) => {
      const r = await api('POST', '/api/auth/2fa/codes', { code: valeur });
      E.majCompte(r.compte);
      montrerCodes(fenetre, corps, r.codesSecours, c.identifiant, 'Nouveaux codes créés : les anciens ne marchent plus.');
    },
  });
  corps.append(formulaire);
  if (!matchMedia('(max-width: 899px)').matches) code.input.focus();
}

function fenetreDesactiver() {
  const corps = h('div', { class: 'pile' });
  const fenetre = modale({ titre: 'Désactiver la double authentification', contenu: corps });
  const mdp = saisie({ type: 'password', autocomplete: 'current-password' });
  const code = champCode();
  corps.append(formulaireCode({
    intro: 'Ton compte ne sera plus protégé que par ton mot de passe. Confirme avec ton mot de passe et un code (de l’application ou de secours).',
    champs: [champ('Mot de passe', mdp)],
    code,
    libelle: 'Désactiver',
    danger: true,
    envoyer: async (valeur) => {
      const r = await api('POST', '/api/auth/2fa/desactiver', { mdp: mdp.value, code: valeur });
      E.majCompte(r.compte);
      fenetre.fermer();
      toast('Double authentification désactivée.');
    },
  }));
  if (!matchMedia('(max-width: 899px)').matches) mdp.focus();
}

// ——— Appareil ———

function ficheAppareil(ctx) {
  return h('section', { class: 'fiche' },
    h('h2', {}, 'Sur cet appareil'),
    h('h3', { class: 'sous-titre' }, 'Affichage'),
    onglets([{ valeur: 'sombre', libelle: 'Sombre' }, { valeur: 'clair', libelle: 'Clair' }], themeActuel(),
      (v) => { definirTheme(v); ctx.rafraichir(); }, { libelle: 'Thème' }),
    h('p', { class: 'texte-3 petit compte-aide' }, 'Le thème sombre fatigue moins les yeux sur de longues sessions.'),
    blocInstallation(ctx));
}

function blocInstallation(ctx) {
  const titre = h('h3', { class: 'sous-titre' }, 'Appli');
  if (dejaInstallee()) return [titre, h('p', { class: 'texte-2 petit' }, `${MARQUE.nom} est installé sur cet appareil.`)];
  if (installable()) {
    return [titre, h('p', { class: 'texte-2 petit compte-aide' }, `Installe ${MARQUE.nom} : il s’ouvre comme une appli, depuis l’écran d’accueil ou le menu Démarrer.`),
      bouton('Installer l’appli', {
        icone: 'installer',
        onclick: async () => {
          if (await installer()) toast(`${MARQUE.nom} est installé.`);
          ctx.rafraichir();
        },
      })];
  }
  return [titre, h('ul', { class: 'liste-puces petit texte-2' },
    h('li', {}, 'iPhone ou iPad (Safari) : bouton Partager, puis « Sur l’écran d’accueil ».'),
    h('li', {}, 'Android (Chrome) : menu ⋮, puis « Installer l’application ».'),
    h('li', {}, 'Ordinateur (Chrome, Edge) : icône d’installation à droite de la barre d’adresse.'))];
}

function formulaireMdp(c) {
  const ancien = saisie({ type: 'password', autocomplete: 'current-password', required: true });
  const nouveau = saisie({ type: 'password', autocomplete: 'new-password', required: true, minlength: 10 });
  const confirmation = saisie({ type: 'password', autocomplete: 'new-password', required: true });
  const erreur = h('p', { class: 'champ__erreur', role: 'alert' });
  const envoi = h('button', { type: 'submit', class: 'btn btn--principal' }, 'Changer le mot de passe');
  return h('form', {
    class: 'fiche formulaire',
    dataset: { brouillon: 'mdp' },
    onsubmit: async (e) => {
      e.preventDefault();
      erreur.textContent = '';
      if (nouveau.value !== confirmation.value) {
        erreur.textContent = 'Les deux nouveaux mots de passe ne sont pas identiques.';
        return;
      }
      occupe(envoi, true);
      try {
        const r = await api('POST', '/api/auth/mdp', { ancien: ancien.value, nouveau: nouveau.value });
        E.definirBrouillon(false, 'mdp');
        E.majCompte(r.compte);
        toast('Mot de passe changé. Tes autres appareils ont été déconnectés.');
      } catch (err) {
        erreur.textContent = messageErreur(err);
      } finally {
        occupe(envoi, false);
      }
    },
  },
  h('div', { class: 'pile-s' },
    h('h2', {}, 'Changer de mot de passe'),
    h('p', { class: 'texte-3 petit' }, 'Il vaut pour tous tes jeux.')),
  champ('Mot de passe actuel', ancien),
  champ('Nouveau mot de passe', nouveau, { aide: `10 caractères minimum, sans ton identifiant (${c.identifiant}).` }),
  champ('Confirme le nouveau mot de passe', confirmation),
  erreur,
  h('div', {}, envoi));
}
