// Administration générale → Administratif → Identité : sauvegarde de la structure et reprise après sinistre.
// La reprise ne crée que ce qui manque (jeux, comptes, documents) et ne modifie jamais l'existant ; le serveur
// exige le mot RESTAURER. Aperçu d'abord (rien n'est écrit), puis les mots de passe temporaires, montrés une seule fois.

import { h, modale, champ, saisie, bouton, toast, messageErreur } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import { puce } from '../composants/jetons.js';
import { copier } from './admin-commun.js';
import { formatHorodatage } from '/shared/temps.js';
import { MARQUE } from '/shared/marque.js';

const FORMAT = `${MARQUE.id}-structure`;
const MOT = 'RESTAURER';
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function ficheReprise() {
  const fichier = h('input', { type: 'file', accept: '.json,application/json', class: 'visuellement-cache', id: 'fichier-structure', tabindex: '-1' });
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
      if (sauvegarde?.format !== FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde de la structure (« _structure.json » ou le fichier téléchargé ici). Une sauvegarde de jeu se restaure dans Gestion du jeu → Service.');
      const { resume } = await api('POST', '/api/admin/administratif/reprise', { sauvegarde, apercu: true });
      confirmer(sauvegarde, resume, f.name);
    } catch (err) {
      toast(err instanceof SyntaxError ? 'Fichier illisible : ce n’est pas un JSON valide.' : messageErreur(err), { type: 'erreur' });
    }
  });
  return h('section', { class: 'fiche pile-s section' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Sauvegarde et reprise après sinistre')),
    h('p', { class: 'texte-2 petit' }, 'La liste des jeux, les comptes (sans aucun mot de passe), les annonces, le livre des comptes, les autorisations des mineurs, le suivi des obligations et l’identité ne sont dans aucun jeu : ils ont leur propre sauvegarde. Le bot du Raspberry Pi en range une copie chaque semaine (fichier « _structure.json ») ; tu peux aussi la télécharger ici.'),
    h('div', { class: 'rangee' },
      h('a', { href: '/api/admin/administratif/sauvegarde', class: 'btn', download: '' }, icone('telecharger'), 'Télécharger la sauvegarde'),
      h('label', {
        for: 'fichier-structure', class: 'btn btn--discret', tabindex: '0', role: 'button',
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fichier.click(); } },
      }, icone('actualiser'), 'Reprise après sinistre…'),
      fichier),
    h('p', { class: 'texte-3 tres-petit' }, 'Reprise : seulement si la base a été perdue. Elle recrée ce qui manque, ne modifie jamais ce qui existe ; un aperçu est montré avant.'));
}

const ligne = (titre, sous, action, raison) => h('li', { class: ['ligne', action === 'ignorer' && 'rep-ignoree'] },
  h('span', { class: 'ligne__principal' }, h('span', { class: 'ligne__titre' }, titre), sous ? h('span', { class: 'ligne__sous' }, ` · ${sous}`) : null),
  action === 'creer' ? puce('Sera créé', 'positif') : puce(raison || 'Ignoré'));

function rubrique(titre, elements) {
  if (!elements.length) return null;
  return h('div', { class: 'pile-s' }, h('h3', { class: 'sous-titre' }, titre), h('ul', { class: 'liste-lignes' }, elements));
}

function tuile(libelle, n, ton = '') {
  return h('div', { class: ['tres-tuile', ton && n && `tres-tuile--${ton}`] }, h('span', { class: 'texte-3 petit' }, libelle), h('strong', { class: 'tres-tuile__valeur' }, String(n)));
}

function confirmer(sauvegarde, resume, nomFichier) {
  const mot = saisie({ autocomplete: 'off', placeholder: MOT, spellcheck: 'false' });
  const aCreer = (l) => l.filter((x) => x.action === 'creer').length;
  const total = aCreer(resume.jeux) + aCreer(resume.comptes) + aCreer(resume.donnees);
  modale({
    titre: 'Reprise après sinistre',
    large: true,
    contenu: [
      h('p', {}, `Fichier « ${nomFichier} »${resume.exporteLe ? `, sauvegarde du ${formatHorodatage(resume.exporteLe)}` : ''} (version ${resume.version}${resume.version === 1 ? ' : ni jeux ni comptes dedans' : ''}).`),
      h('section', { class: 'tres-tuiles' },
        tuile('Jeux à créer', aCreer(resume.jeux), 'positif'),
        tuile('Comptes à recréer', aCreer(resume.comptes), 'positif'),
        tuile('Données à remettre', aCreer(resume.donnees), 'positif'),
        tuile('Fiches refusées', resume.invalides, 'negatif')),
      h('div', { class: 'alerte alerte--attention' }, icone('alerte'), h('span', {},
        h('strong', {}, 'Rien de ce qui existe n’est modifié. '),
        'Un jeu, un compte ou un document déjà présent est gardé tel quel ; le livre des comptes, les autorisations et les annonces ne sont remis que si la base n’en contient aucun. Chaque compte recréé reçoit un mot de passe temporaire, montré une seule fois juste après.')),
      rubrique('Jeux', resume.jeux.map((j) => ligne(j.nom, j.id, j.action, j.raison))),
      rubrique('Comptes', resume.comptes.map((c) => ligne(c.nomAffiche, `${c.identifiant}${c.admin ? ' · Administrateur général' : ''}`, c.action, c.raison))),
      rubrique('Données de la structure', resume.donnees.map((d) => ligne(d.nom, d.nombre > 1 ? pluriel(d.nombre, 'fiche') : '', d.action, d.raison))),
      resume.detailsInvalides.length ? h('p', { class: 'texte-3 petit' }, `Refusées (invalides) : ${resume.detailsInvalides.join(', ')}${resume.invalides > resume.detailsInvalides.length ? '…' : ''}.`) : null,
      total ? champ(`Pour confirmer, tape ${MOT}`, mot) : h('p', { class: 'texte-2' }, 'Tout ce que contient ce fichier existe déjà : il n’y a rien à reprendre.'),
    ],
    actions: total ? [{ libelle: 'Annuler' }, {
      libelle: 'Lancer la reprise',
      classe: 'btn--danger',
      action: async () => {
        if (mot.value.trim() !== MOT) throw new Error(`Tape ${MOT} en majuscules pour confirmer.`);
        const r = await api('POST', '/api/admin/administratif/reprise', { sauvegarde, confirmation: MOT });
        setTimeout(() => resultat(r), 0);
      },
    }] : [{ libelle: 'Fermer', classe: 'btn--principal' }],
  });
}

function resultat({ bilan, motsDePasse }) {
  const texte = [`Adresse : ${window.location.origin}`, ...motsDePasse.map((m) => `${m.identifiant} : ${m.mdpTemporaire}`)].join('\n');
  modale({
    titre: 'Reprise terminée',
    large: true,
    contenu: [
      h('p', {}, `${pluriel(bilan.jeux, 'jeu')} créé${bilan.jeux > 1 ? 's' : ''}, ${pluriel(bilan.comptes, 'compte')} recréé${bilan.comptes > 1 ? 's' : ''}, ${pluriel(bilan.donnees, 'fiche')} remise${bilan.donnees > 1 ? 's' : ''}.`),
      bilan.echecs.length ? h('div', { class: 'alerte alerte--urgent' }, icone('alerte'), h('span', {}, `Non repris : ${bilan.echecs.join(' ; ')}.`)) : null,
      motsDePasse.length ? h('div', { class: 'pile-s' },
        h('p', {}, h('strong', {}, 'Mots de passe temporaires : ils ne seront plus jamais affichés. '), 'Copie-les maintenant et transmets-les à chacun par message privé ; chacun choisira le sien à sa première connexion.'),
        h('ul', { class: 'liste-lignes rep-mdp' }, motsDePasse.map((m) => h('li', { class: 'ligne' },
          h('span', { class: 'ligne__principal' }, h('span', { class: 'ligne__titre' }, m.nomAffiche), h('span', { class: 'ligne__sous' }, ` · ${m.identifiant}`)),
          h('strong', {}, m.mdpTemporaire)))),
        h('div', {}, bouton('Tout copier', { icone: 'copier', onclick: () => copier(texte) }))) : null,
      h('div', { class: 'alerte alerte--info' }, icone('info'), h('span', {},
        h('strong', {}, 'Étape suivante : '), 'restaure chaque jeu avec sa sauvegarde (fichiers du Pi, un par jeu) dans Gestion du jeu → Service → « Restaurer une sauvegarde ». Le roster, le planning et les liens entre comptes et joueurs reviennent avec elle.')),
    ],
    actions: [{ libelle: motsDePasse.length ? 'C’est copié' : 'Fermer', classe: 'btn--principal', action: () => window.location.reload() }],
  });
}
