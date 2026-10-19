// Premier démarrage : compte Administrateur général (uniquement si aucun compte n'existe).
// Les jeux s'activent ensuite depuis le site (Administration → Jeux) : rien n'est créé d'office.

import { nouvelId, MOTIFS } from '../../shared/validation.js';
import { hacherMdp, controlerMdp } from '../auth/mdp.js';

export async function amorcer({ global, config, journal = console }) {
  if ((await global.compter('comptes')) > 0) return;
  const { identifiant, mdp } = config.admin;
  if (!identifiant || !mdp) {
    journal.warn('⚠ Aucun compte : définis LUGH_ADMIN_ID et LUGH_ADMIN_MDP dans Render, puis redémarre le service.');
    return;
  }
  if (!MOTIFS.identifiantConnexion.test(identifiant)) throw new Error('LUGH_ADMIN_ID : 3 à 24 caractères (minuscules, chiffres, point, tiret).');
  const refus = controlerMdp(mdp, identifiant);
  if (refus) throw new Error(`LUGH_ADMIN_MDP refusé : ${refus}`);
  await global.ecrire('comptes', {
    _id: nouvelId('c'),
    identifiant,
    nomAffiche: identifiant,
    admin: true,
    acces: {},
    actif: true,
    doitChangerMdp: true,
    hash: await hacherMdp(mdp),
    creeLe: new Date().toISOString(),
    creePar: 'systeme',
    derniereConnexion: null,
  });
  journal.log(`✔ Administrateur général « ${identifiant} » créé : change son mot de passe à la première connexion.`);
}
