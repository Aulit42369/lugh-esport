// Démonstration légère pour n'importe quel jeu (simulation uniquement) : roster, quelques résultats selon le type
// de score du jeu (manches, score simple ou classement), planning de la semaine. Pseudos et équipes inventés.

import { nouvelId } from '../../shared/validation.js';
import { actifs } from '../../shared/jeux/definition.js';
import { blocsDepuisEbauche, ebauchePourPalier } from '../../shared/jeux/contenus.js';
import { semaineCourante, aujourdhui, ajouterJours, civileDepuisIso, isoCivile } from '../../shared/temps.js';

const PSEUDOS = ['Lune', 'Orion', 'Pavot', 'Rivage', 'Saule', 'Tilt', 'Vigie', 'Zéphyr', 'Ambre', 'Givre', 'Écho', 'Nacre'];
const ADVERSAIRES = ['Nébula', 'Les Sept', 'Orage', 'Kraken eSport'];

export async function remplirJeuGenerique(e, config) {
  const { depot, stockage, def } = e;
  const { documentParDefaut } = e.schemas();
  const jour = (d) => isoCivile(ajouterJours(civileDepuisIso(aujourdhui(config.fuseau)), d));
  const meta = await stockage.lire('meta', 'courante');

  await depot.enregistrer('equipe', 'profil', documentParDefaut('equipe', {
    nom: `Démo ${def.court}`, tag: 'DEMO', devise: 'Un match après l’autre.', palierVise: 'intermediaire',
  }), null);

  const joueurs = (await stockage.lister('membres', { type: 'joueur' })).sort((a, b) => (a.statut === 'titulaire' ? -1 : 1) - (b.statut === 'titulaire' ? -1 : 1));
  const ids = [];
  for (const [i, m] of joueurs.entries()) {
    const candidats = (meta?.personnages || []).filter((p) => !m.roleJeu || p.role === m.roleJeu);
    const principaux = def.aPersonnages ? candidats.slice(i % 3, (i % 3) + 2).map((p) => p.id) : [];
    await depot.enregistrer('membres', m._id, documentParDefaut('membres', {
      ...m, pseudo: PSEUDOS[i % PSEUDOS.length], personnages: { principaux, secondaires: [], parMap: {} },
    }), null);
    await depot.enregistrer('objectifs', m._id, documentParDefaut('objectifs', { palier: i % 2 ? 'debutant' : 'intermediaire' }), null);
    ids.push(m._id);
  }
  for (const m of await stockage.lister('membres', { type: 'staff' })) {
    if (m.fonction === 'headcoach') await depot.enregistrer('membres', m._id, documentParDefaut('membres', { ...m, pseudo: 'Cobalt' }), null);
  }

  const pool = def.aPool ? meta?.mapPool || [] : [];
  const camps = actifs(def.camps).map((c) => c.id);
  for (let k = 0; k < 4; k += 1) {
    const base = { date: jour(-12 + k * 3), heure: '20:30', adversaire: ADVERSAIRES[k], type: k === 2 ? 'officiel' : 'scrim', map: pool[k % Math.max(1, pool.length)] || '' };
    let resultat;
    if (def.score.type === 'manches') {
      const gagne = k % 2 === 0;
      resultat = {
        campDepart: camps[0] || '', mtNous: gagne ? 7 : 4, mtEux: gagne ? 5 : 8,
        scoreNous: gagne ? def.score.gagnant : def.score.gagnant - 4, scoreEux: gagne ? def.score.gagnant - 3 : def.score.gagnant,
        pistols: def.score.pistols && camps.length === 2 ? { [camps[0]]: gagne ? 'gagne' : 'perdu', [camps[1]]: 'gagne' } : {},
      };
    } else if (def.score.type === 'classement') {
      resultat = { place: [3, 11, 1, 7][k], equipes: def.score.equipes || 20, eliminations: [6, 2, 9, 4][k] };
    } else {
      resultat = { scoreNous: [2, 0, 2, 1][k], scoreEux: [1, 2, 0, 1][k] };
    }
    await depot.enregistrer('scrims', nouvelId('x'), documentParDefaut('scrims', {
      ...base, ...resultat, bien: 'Bonne communication en début de partie.', corriger: 'Fins de partie trop hésitantes.',
    }), null);
  }

  const ebauche = ebauchePourPalier(def, 3);
  if (ebauche) await depot.enregistrer('planning', semaineCourante(config.fuseau), { blocs: blocsDepuisEbauche(def, ebauche), note: '', ebauche }, null);
  return ids;
}
