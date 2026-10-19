// Réglages du jeu, section Score : manches avec mi-temps, score simple ou classement (battle royale), et leurs
// paramètres. Une fois des scrims enregistrés, le type de score (et la mi-temps en manches) ne change plus : il décide
// de la forme de ces scrims. Le reste (manches pour gagner, pistols, taille des lobbies, barème) se règle encore.

import { h } from '../ui.js';
import * as J from '../jeu.js';
import { TYPES_SCORE } from '/shared/jeux/commun.js';
import { section, texteReglage, nombreReglage, caseReglage } from './reglages-outils.js';

function scoreComplet(s = {}) {
  return {
    type: s.type || 'simple',
    gagnant: s.gagnant ?? 13,
    miTemps: s.miTemps ?? 12,
    pistols: !!s.pistols,
    equipes: s.equipes ?? 20,
    bareme: s.bareme ? { places: [...(s.bareme.places || [])], elimination: s.bareme.elimination ?? 1 } : null,
  };
}

function resumeScore(s) {
  if (s.type === 'manches') return `Manches : ${s.gagnant} pour gagner, mi-temps à ${s.miTemps}${s.pistols ? ', pistols' : ''}`;
  if (s.type === 'classement') return `Classement : lobbies de ${s.equipes} équipes${s.bareme ? ', barème de points' : ''}`;
  return 'Score simple';
}

export function sectionScore(S, numero) {
  const actuel = J.def().score; // score en vigueur : celui des scrims déjà enregistrés
  const fige = S.scrims > 0;
  const lire = () => scoreComplet(S.reglages.score || S.modele.score);
  const modeleCompatible = S.modele.score.type === actuel.type && (actuel.type !== 'manches' || S.modele.score.miTemps === actuel.miTemps);
  const sec = section(S, {
    cle: 'score',
    numero,
    titre: 'Score',
    intro: fige
      ? `${S.scrims} scrim${S.scrims > 1 ? 's' : ''} déjà enregistré${S.scrims > 1 ? 's' : ''} : le type de score${actuel.type === 'manches' ? ' et la mi-temps' : ''} ne changent plus (ils décident de la forme de ces scrims). Le reste se règle encore.`
      : 'Comment se compte un match. Choisis-le avant le premier scrim : ensuite, le type ne change plus.',
    resume: () => resumeScore(lire()),
    personnalise: () => !!S.reglages.score,
    revenir: () => { S.reglages.score = null; },
    revenirBloque: fige && !modeleCompatible ? 'Le modèle a un autre type de score : retour impossible avec des scrims enregistrés.' : '',
    corps: () => {
      const s = S.reglages.score || scoreComplet(S.modele.score);
      const ecrire = (k, val, redessiner = false) => {
        if (!S.reglages.score) S.reglages.score = s;
        s[k] = val;
        if (redessiner) sec.redessiner();
        S.modifie();
      };
      const types = h('fieldset', { class: 'rgl-choix-score' },
        h('legend', {}, 'Type de score'),
        TYPES_SCORE.map((t) => {
          const input = h('input', { type: 'radio', name: 'rgl-type-score', value: t.id, checked: s.type === t.id, disabled: fige && t.id !== actuel.type, 'data-chemin': 'score.type', 'data-libelle': 'Score · type' });
          input.addEventListener('change', () => { if (input.checked) ecrire('type', t.id, true); });
          return h('label', { class: 'rgl-carte-choix' }, input, h('span', { class: 'rgl-carte-choix__texte' }, h('strong', {}, t.nom), h('span', { class: 'texte-3 tres-petit' }, t.resume)));
        }));
      const params = [];
      if (s.type === 'manches') {
        params.push(h('div', { class: 'grille-champs grille-champs--3' },
          nombreReglage(S, { libelle: 'Manches pour gagner', valeur: s.gagnant, min: 1, max: 50, chemin: 'score.gagnant', contexte: 'Score · manches pour gagner', ecrire: (x) => ecrire('gagnant', x) }),
          fige ? h('div', { class: 'champ' }, h('span', { class: 'champ__label' }, 'Mi-temps'), h('p', { class: 'rgl-fige' }, `après ${actuel.miTemps} manches (figé)`))
            : nombreReglage(S, { libelle: 'Mi-temps après', valeur: s.miTemps, min: 1, max: 50, unite: 'manches', chemin: 'score.miTemps', contexte: 'Score · mi-temps', ecrire: (x) => ecrire('miTemps', x) }),
          h('div', { class: 'champ rgl-case-seule' },
            caseReglage({ libelle: 'Rounds pistol (1er round de chaque mi-temps)', coche: s.pistols, chemin: 'score.pistols', contexte: 'Score · pistols', ecrire: (x) => ecrire('pistols', x) }).element)));
      } else if (s.type === 'classement') {
        const bareme = caseReglage({
          libelle: 'Calculer les points avec un barème', coche: !!s.bareme, chemin: 'score.bareme', contexte: 'Score · barème',
          ecrire: (x) => ecrire('bareme', x ? { places: [12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1], elimination: 1 } : null, true),
        });
        params.push(h('div', { class: 'grille-champs' },
          nombreReglage(S, { libelle: 'Équipes par partie', valeur: s.equipes, min: 2, max: 150, chemin: 'score.equipes', contexte: 'Score · équipes par partie', ecrire: (x) => ecrire('equipes', x) }),
          h('div', { class: 'champ rgl-case-seule' }, bareme.element)));
        if (s.bareme) params.push(champBareme(S, s.bareme, () => ecrire('bareme', s.bareme)));
      } else {
        params.push(h('p', { class: 'texte-2 petit' }, 'Un score par match : buts, parties ou maps gagnées. Rien d’autre à régler.'));
      }
      return [types, ...params];
    },
  });
  return sec;
}

// Barème d'une partie classée : points par place (de la 1re à la dernière) et points par élimination.
function champBareme(S, bareme, ecrire) {
  const chemin = 'score.bareme.places';
  const places = texteReglage({
    libelle: 'Points par place (1re, 2e, 3e…)', valeur: bareme.places.join(', '), max: 400, chemin, contexte: 'Score · points par place',
    aide: 'Nombres entiers de 0 à 100 séparés par des virgules ; les places non listées valent 0.',
    ecrire: (brut) => {
      const morceaux = brut.split(/[,;\s]+/).filter(Boolean);
      const nombres = morceaux.map(Number);
      if (morceaux.length > 100 || nombres.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
        S.erreursLocales.set(chemin, { chemin, message: 'nombres entiers de 0 à 100, séparés par des virgules (100 places au plus)', ctrl: places.querySelector('input') });
        places.querySelector('input').setAttribute('aria-invalid', 'true');
        S.modifie();
        return;
      }
      S.erreursLocales.delete(chemin);
      bareme.places = nombres;
      ecrire();
    },
  });
  return h('div', { class: 'grille-champs rgl-bareme' }, places,
    nombreReglage(S, { libelle: 'Points par élimination', valeur: bareme.elimination, min: 0, max: 10, decimales: 1, chemin: 'score.bareme.elimination', contexte: 'Score · points par élimination', ecrire: (x) => { bareme.elimination = x; ecrire(); } }));
}
