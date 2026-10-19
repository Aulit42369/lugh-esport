// Vue d'ensemble de la structure (Administrateur général) : pour chaque jeu, les prochains matchs et tournois,
// le moniteur de santé, la présence, les derniers résultats, l'état de la méta et l'effectif. Lecture seule.

import { envoyerJson } from '../http/outils.js';
import { exigerConnexion, exigerAdmin } from '../auth/acces.js';
import { alertesSante } from '../../shared/sante.js';
import { rappelsTournois, tournoisAVenir } from '../../shared/organisation.js';
import { statsPresences } from '../../shared/suivi.js';
import { statsScrims, trierParDate, resultat, scoreLisible } from '../../shared/stats.js';
import { trouverDans } from '../../shared/jeux/definition.js';
import { accesEspace } from '../../shared/roles.js';
import { semaineCourante, aujourdhui, ajouterJours, civileDepuisIso, isoCivile, lundiDe } from '../../shared/temps.js';

const JOUEURS = new Set(['titulaire', 'remplacant', 'essai']);

export function routesStructure(routeur, s) {
  routeur.get('/api/admin/structure', exigerConnexion(s), exigerAdmin(), async (r) => {
    const auj = aujourdhui(s.config.fuseau);
    const semaine = semaineCourante(s.config.fuseau);
    const il30 = isoCivile(ajouterJours(civileDepuisIso(auj), -30));
    const comptes = await s.global.lister('comptes');
    const jeux = [];
    for (const doc of s.registre.liste()) {
      const e = s.registre.obtenir(doc._id);
      if (!e) continue;
      const st = e.stockage;
      const [membres, presences, mesures, scrims, adversaires, tournois, meta, planning] = await Promise.all([
        st.lister('membres'), st.lister('presences'), st.lister('mesures'), st.lister('scrims'), st.lister('adversaires'),
        st.lister('tournois'), st.lire('meta', 'courante'), st.lire('planning', semaine),
      ]);
      const alertes = [
        ...alertesSante({ def: e.def, membres, presences, mesures, scrims, meta, planning: planning ? [planning] : [], semaineCourante: semaine, aujourdhui: auj }),
        ...rappelsTournois(tournois, auj),
      ];
      const recentes = presences.filter((p) => /^\d{4}-W\d{2}$/.test(p.semaine || '')
        && isoCivile(ajouterJours(lundiDe(p.semaine), (p.jour || 1) - 1)) >= il30);
      const totaux = Object.values(statsPresences(recentes)).reduce((t, m) => ({ ok: t.ok + m.present + m.retard, n: t.n + m.present + m.retard + m.absent }), { ok: 0, n: 0 });
      const stats30 = statsScrims(scrims.filter((x) => x.date >= il30 && x.date <= auj), e.def);
      jeux.push({
        id: e.id,
        nom: e.def.nom,
        court: e.def.court,
        couleur: doc.couleur || '',
        actif: doc.actif !== false,
        effectif: {
          joueurs: membres.filter((m) => m.type === 'joueur' && JOUEURS.has(m.statut)).length,
          staff: membres.filter((m) => m.type === 'staff' && m.statut !== 'ancien').length,
          comptes: comptes.filter((c) => !c.admin && accesEspace(c, e.id)).length,
        },
        matchs: adversaires.filter((a) => a.prochainMatch?.date && a.prochainMatch.date >= auj)
          .map((a) => ({ adversaire: a.nom, date: a.prochainMatch.date, heure: a.prochainMatch.heure || '', format: trouverDans(e.def.formats, a.prochainMatch.format)?.nom || '' }))
          .sort((a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`)).slice(0, 3),
        tournois: tournoisAVenir(tournois, auj).slice(0, 3).map((t) => ({ nom: t.nom, debut: t.debut || '', statut: t.statut, dateLimite: t.dateLimite || '' })),
        alertes: { attention: alertes.filter((a) => a.niveau === 'attention').length, total: alertes.length, premieres: alertes.slice(0, 4) },
        presence: totaux.n ? Math.round((totaux.ok / totaux.n) * 100) : null,
        resultats: {
          joues30: stats30.total,
          winrate30: stats30.winrate,
          derniers: trierParDate(scrims, -1).slice(0, 5).map((x) => ({ date: x.date, adversaire: x.adversaire, resultat: resultat(x), score: scoreLisible(x) })),
        },
        meta: meta ? { patch: meta.patch || '', derniereVerif: meta.derniereVerif || '', statut: meta.statut || '' } : null,
      });
    }
    envoyerJson(r.res, 200, { jeux, aujourdhui: auj, semaine });
  });
}
