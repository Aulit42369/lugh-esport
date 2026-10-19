// Organisation entre les jeux : conflits d'agenda d'une personne présente dans plusieurs jeux, et agenda personnel
// (.ics) qui regroupe tous ses jeux. Le contenu des séances d'un autre jeu n'est jamais montré : jeu et horaire seulement.

import { envoyerJson, erreurs } from '../http/outils.js';
import { exigerConnexion, exigerEspace } from '../auth/acces.js';
import { conflitsEntreJeux, tournoisAVenir, datesAgenda } from '../../shared/organisation.js';
import { concerne } from '../../shared/charge.js';
import { calendrierIcs, evenementBloc } from '../../shared/exports.js';
import { MOTIFS } from '../../shared/validation.js';
import { semaineCourante, decalerSemaine, aujourdhui, minutes } from '../../shared/temps.js';
import { MARQUE } from '../../shared/marque.js';
import { accesEspace } from '../../shared/roles.js';

const SEMAINES_AGENDA = 4;
// Fin d'un événement, au-delà de minuit si besoin (« 25:00 » = 1 h le lendemain, compris par l'export .ics).
const finApres = (debut, duree) => {
  const t = minutes(debut) + duree;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const PUBLICS_SANS_MEMBRE = new Set(['equipe', 'titulaires', 'staff']);

export function routesOrganisation(routeur, s) {
  const espace = [exigerConnexion(s), exigerEspace(s)];

  // Jeux actifs où un compte a un membre lié (lien explicite, même sans métier).
  // Un jeu compte seulement si le compte y a vraiment accès (un membre lié sans métier ne suffit pas, sauf pour
  // l'Administrateur général, qui a accès partout).
  const accesReel = (compte, jeu) => !!accesEspace(compte, jeu);
  function liensDuCompte(compte) {
    return Object.entries(compte.acces || {})
      .filter(([jeu, a]) => a?.membreId && accesReel(compte, jeu))
      .map(([jeu, a]) => ({ e: s.registre.obtenir(jeu), membreId: a.membreId }))
      .filter(({ e }) => e && e.doc.actif !== false);
  }

  routeur.get('/api/e/:jeu/conflits/:semaine', ...espace, async (r) => {
    const e = r.espace;
    const { semaine } = r.params;
    if (!MOTIFS.semaine.test(semaine)) throw erreurs.requete('Semaine invalide.');
    const planning = await e.stockage.lire('planning', semaine);
    if (!planning?.blocs?.length) return envoyerJson(r.res, 200, { conflits: [] });
    const liens = [];
    for (const c of await s.global.lister('comptes')) {
      if (c.actif === false) continue;
      const ici = accesReel(c, e.id) ? c.acces?.[e.id]?.membreId : '';
      const membre = ici ? await e.stockage.lire('membres', ici) : null;
      if (!membre) continue;
      const autres = [];
      for (const { e: autre, membreId } of liensDuCompte(c)) {
        if (autre.id === e.id) continue;
        const [p, m] = await Promise.all([autre.stockage.lire('planning', semaine), autre.stockage.lire('membres', membreId)]);
        if (p?.blocs?.length && m) autres.push({ jeu: { id: autre.id, nom: autre.def.nom, court: autre.def.court, couleur: autre.doc.couleur || '' }, membre: m, planning: p });
      }
      if (autres.length) liens.push({ membre, autres });
    }
    envoyerJson(r.res, 200, { conflits: conflitsEntreJeux({ planning, liens }) });
  });

  // Agenda personnel : les 4 semaines à venir de tous ses jeux (séances qui le concernent, matchs, tournois).
  // Un téléchargement, jamais un lien d'abonnement : il faudrait un jeton secret dans l'adresse.
  routeur.get('/api/moi/agenda.ics', exigerConnexion(s), async (r) => {
    const compte = r.compteGlobal;
    const auj = aujourdhui(s.config.fuseau);
    const { fin } = datesAgenda(auj, SEMAINES_AGENDA * 7);
    const semaines = Array.from({ length: SEMAINES_AGENDA + 1 }, (_, i) => decalerSemaine(semaineCourante(s.config.fuseau), i));
    const evenements = [];
    const jeux = Object.entries(compte.acces || {})
      .filter(([id, a]) => (a?.metiers?.length || a?.membreId) && accesReel(compte, id))
      .map(([id, a]) => ({ e: s.registre.obtenir(id), membreId: a.membreId || '' }))
      .filter(({ e }) => e && e.doc.actif !== false);
    for (const { e, membreId } of jeux) {
      const prefixe = `[${e.def.court}] `;
      const membre = membreId ? await e.stockage.lire('membres', membreId) : null;
      for (const semaine of semaines) {
        const p = await e.stockage.lire('planning', semaine);
        for (const bloc of p?.blocs || []) {
          const pourMoi = membre ? concerne(bloc, membre) : bloc.type !== 'repos' && PUBLICS_SANS_MEMBRE.has(bloc.pour);
          if (!pourMoi) continue;
          const ev = evenementBloc({ def: e.def, semaine, bloc, prefixeTitre: prefixe });
          if (ev.date >= auj && ev.date <= fin) evenements.push(ev);
        }
      }
      for (const a of await e.stockage.lister('adversaires')) {
        const m = a.prochainMatch;
        if (!m?.date || m.date < auj || m.date > fin) continue;
        evenements.push({
          uid: `${e.id}-match-${a._id}-${m.date}`,
          date: m.date,
          debut: m.heure || '',
          fin: m.heure ? finApres(m.heure, 120) : '',
          titre: `${prefixe}Match contre ${a.nom}${m.heure ? '' : ' (heure à confirmer)'}`,
          description: a.circuit || '',
        });
      }
      for (const t of tournoisAVenir(await e.stockage.lister('tournois'), auj)) {
        if (t.statut === 'envisage' || !t.debut || t.debut > fin) continue;
        evenements.push({ uid: `${e.id}-tournoi-${t._id}`, date: t.debut, debut: '', fin: '', titre: `${prefixe}${t.nom}`, description: t.format || '' });
      }
    }
    evenements.sort((a, b) => a.date.localeCompare(b.date) || (a.debut || '').localeCompare(b.debut || ''));
    const corps = calendrierIcs({ nomCalendrier: `${MARQUE.nom} · ${compte.nomAffiche}`, evenements, maintenant: s.maintenant() });
    r.res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${MARQUE.id}-agenda-${auj}.ics"`,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(corps),
    });
    r.res.end(corps);
  });
}
