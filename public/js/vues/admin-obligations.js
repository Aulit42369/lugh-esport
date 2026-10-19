// Administratif → Obligations : ce que la loi et les éditeurs demandent à la structure, point par point, avec son
// suivi (à faire, en cours, fait, pas concerné), ses sources officielles, et la veille légale : un bouton « Vérifier »
// (API Claude, recherche limitée aux sites officiels) ou la vérification manuelle sur claude.ai. Les changements
// trouvés arrivent comme propositions : rien ne change sans « Accepter ».

import { h, bouton, toast, liste, zone, messageErreur, lienExterne } from '../ui.js';
import { api } from '../api.js';
import { icone } from '../icones.js';
import { puce, jauge } from '../composants/jetons.js';
import { copierTexte } from '../composants/sorties.js';
import { NIVEAUX, STATUTS_SUIVI, VERIFIE_LE, tousLesPoints } from '/shared/administratif/obligations.js';
import { formatDate, formatHorodatage, aujourdhui } from '/shared/temps.js';
import { dollars } from './admin-commun.js';

const TON_NIVEAU = { obligatoire: 'accent', condition: '', recommande: '' };
const TON_STATUT = { fait: 'positif', en_cours: 'attention', a_faire: '', non_concerne: '' };

export function rendreObligations(corps, d, recharger) {
  corps.replaceChildren(...[entete(d, recharger), propositions(d, recharger), ...d.veille.obligations.map((s) => section(s, d, recharger))].filter(Boolean));
}

function entete(d, recharger) {
  const points = tousLesPoints(d.veille.obligations);
  const applicables = points.filter((p) => d.suivi[`${p.section}.${p.id}`]?.statut !== 'non_concerne');
  const faits = applicables.filter((p) => d.suivi[`${p.section}.${p.id}`]?.statut === 'fait').length;
  const v = d.veille;
  const enCours = v.statut === 'en_cours';
  const coutMois = Object.values(v.couts || {}).at(-1)?.usd;
  const lancer = async (btn) => {
    btn.disabled = true;
    try {
      await api('POST', '/api/admin/administratif/veille', {});
      toast('Vérification lancée : une à trois minutes.');
      attendre(recharger);
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur', duree: 8000 });
      btn.disabled = false;
    }
  };
  return h('section', { class: 'fiche admv-veille' },
    h('div', { class: 'admv-veille__progres' },
      h('div', { class: 'fiche__titre' }, h('h2', { class: 'titre-icone' }, icone('balance'), 'Où en est la structure')),
      jauge(applicables.length ? Math.round((faits / applicables.length) * 100) : 0, { legende: 'Obligations réglées', droite: `${faits} sur ${applicables.length}` }),
      h('p', { class: 'texte-3 tres-petit' }, 'Coche « Pas concerné » ce qui ne s’applique pas encore (tournois, joueurs salariés) : la jauge ne compte que le reste.')),
    h('div', { class: 'admv-veille__legal pile-s' },
      h('div', { class: 'rangee rangee--espace' },
        h('strong', {}, 'Veille légale'),
        enCours ? puce('Vérification en cours…', 'attention') : v.statut === 'echec' ? puce('Dernière vérification en échec', 'attention') : null),
      h('p', { class: 'texte-2 petit' }, v.derniereVerif ? `Dernière vérification : ${formatHorodatage(v.derniereVerif)}.` : `Informations vérifiées le ${formatDate(VERIFIE_LE)} sur les sites officiels.`,
        v.erreur && v.statut === 'echec' ? h('span', { class: 'texte-3' }, ` (${v.erreur})`) : null),
      h('div', { class: 'rangee' },
        v.cleApi ? bouton('Vérifier maintenant', { icone: 'actualiser', classe: 'btn--principal', disabled: enCours, onclick: (e) => lancer(e.currentTarget) }) : null,
        coutMois ? h('span', { class: 'texte-3 tres-petit' }, `≈ ${dollars(coutMois)} ce mois-ci`) : null),
      manuel(recharger, !v.cleApi)));
}

// Vérification sans clé API : la consigne part dans une conversation claude.ai, la réponse revient ici.
function manuel(recharger, ouvert) {
  const reponse = zone({ lignes: 4, placeholder: 'Colle ici toute la réponse de Claude' });
  return h('details', { class: 'petit admv-manuel', open: ouvert },
    h('summary', {}, 'Vérifier sans la clé API (copier-coller)'),
    h('ol', { class: 'liste-puces' },
      h('li', {}, bouton('Copier la consigne', {
        icone: 'copier', classe: 'btn--petit',
        onclick: async () => {
          try {
            const { texte } = await api('GET', '/api/admin/administratif/veille/consigne');
            await copierTexte(texte, { titre: 'Consigne de veille légale', succes: 'Consigne copiée.' });
          } catch (err) {
            toast(messageErreur(err), { type: 'erreur' });
          }
        },
      })),
      h('li', {}, 'Ouvre une nouvelle conversation sur claude.ai, active la recherche web, colle la consigne et envoie.'),
      h('li', {}, 'Copie toute la réponse et colle-la ici :', reponse,
        bouton('Importer', {
          classe: 'btn--petit',
          onclick: async (e) => {
            const btn = e.currentTarget; // currentTarget vaut null après le premier await
            btn.disabled = true;
            try {
              const r = await api('POST', '/api/admin/administratif/veille/import', { texte: reponse.value });
              toast(r.nouvelles ? `${r.nouvelles} changement(s) à examiner.` : 'Tout est à jour : aucun changement.');
              recharger();
            } catch (err) {
              toast(messageErreur(err), { type: 'erreur', duree: 8000 });
              btn.disabled = false;
            }
          },
        }))));
}

function attendre(recharger, essais = 60) {
  setTimeout(async () => {
    try {
      const d = await api('GET', '/api/admin/administratif');
      if (d.veille.statut === 'en_cours' && essais > 0) return attendre(recharger, essais - 1);
    } catch { /* on réessaie au rechargement */ }
    recharger();
  }, 5000);
}

function propositions(d, recharger) {
  const nouvelles = d.veille.propositions.filter((p) => p.statut === 'nouvelle');
  if (!nouvelles.length) return null;
  const decider = async (p, accepter, btn) => {
    btn.disabled = true;
    try {
      await api('POST', `/api/admin/administratif/veille/propositions/${encodeURIComponent(p._id)}`, { accepter });
      toast(accepter ? 'Changement appliqué.' : 'Changement écarté.');
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
      btn.disabled = false;
    }
  };
  const titreType = { modifier: 'Mise à jour', supprimer: 'Retrait', ajouter: 'Nouvelle obligation' };
  return h('section', { class: 'section pile-s admv-propositions' },
    h('h2', {}, `${nouvelles.length} changement${nouvelles.length > 1 ? 's' : ''} trouvé${nouvelles.length > 1 ? 's' : ''} par la veille`),
    h('p', { class: 'texte-3 petit' }, 'Lis la source avant d’accepter : rien n’est appliqué sans ta validation.'),
    nouvelles.map((p) => h('article', { class: 'fiche pile-s admv-proposition' },
      h('div', { class: 'rangee rangee--espace' }, h('strong', {}, `${titreType[p.type]} · ${p.nouveau.titre || p.avant?.titre || p.cle}`), puce(formatDate(p.le.slice(0, 10)))),
      p.raison ? h('p', { class: 'texte-2 petit' }, p.raison) : null,
      p.avant && p.type !== 'ajouter' ? h('div', { class: 'admv-diff' },
        h('div', {}, h('span', { class: 'texte-3 tres-petit' }, 'Aujourd’hui'), h('p', { class: 'petit' }, p.avant.texte)),
        h('div', {}, h('span', { class: 'texte-3 tres-petit' }, 'Proposé'), h('p', { class: 'petit' }, p.type === 'supprimer' ? 'Ce point est retiré.' : (p.nouveau.texte || p.avant.texte))))
        : h('p', { class: 'petit' }, p.nouveau.texte),
      h('div', { class: 'rangee petit' }, 'Sources : ', p.sources.map((s) => lienExterne(s.url, s.titre))),
      h('div', { class: 'rangee' },
        bouton('Accepter', { classe: 'btn--principal btn--petit', onclick: (e) => decider(p, true, e.currentTarget) }),
        bouton('Refuser', { classe: 'btn--discret btn--petit', onclick: (e) => decider(p, false, e.currentTarget) })))));
}

function section(s, d, recharger) {
  return h('section', { class: 'section pile-s' },
    h('div', { class: 'section__entete' }, h('h2', {}, s.titre), h('p', { class: 'section__aide' }, s.resume)),
    h('div', { class: 'admv-points' }, s.points.map((p) => point(s, p, d, recharger))));
}

function point(s, p, d, recharger) {
  const cle = `${s.id}.${p.id}`;
  const suivi = d.suivi[cle] || { statut: 'a_faire' };
  const statut = liste(STATUTS_SUIVI.map((x) => ({ valeur: x.id, libelle: x.nom })), { valeur: suivi.statut, class: 'saisie saisie--compacte', 'aria-label': `Suivi : ${p.titre}` });
  statut.addEventListener('change', async () => {
    try {
      await api('PUT', `/api/admin/administratif/suivi/${encodeURIComponent(cle)}`, { statut: statut.value, le: statut.value === 'fait' ? aujourdhui() : '', note: suivi.note || '' });
      toast('Suivi enregistré.');
      recharger();
    } catch (err) {
      toast(messageErreur(err), { type: 'erreur' });
      statut.value = suivi.statut;
    }
  });
  return h('article', { class: ['admv-point', `admv-point--${suivi.statut}`] },
    h('div', { class: 'admv-point__tete' },
      h('h3', {}, p.titre),
      h('span', { class: 'rangee' }, puce(NIVEAUX.find((n) => n.id === p.niveau)?.nom || p.niveau, TON_NIVEAU[p.niveau]),
        p.modifieLe || p.ajouteLe ? puce(`Mis à jour le ${formatDate((p.modifieLe || p.ajouteLe).slice(0, 10))}`, 'positif') : null)),
    h('p', { class: 'petit' }, p.texte),
    p.sources?.length ? h('p', { class: 'tres-petit texte-3 admv-sources' }, p.sources.map((src) => lienExterne(src.url, src.titre))) : null,
    h('div', { class: 'admv-point__pied' },
      statut,
      suivi.statut === 'fait' && suivi.le ? puce(`Fait le ${formatDate(suivi.le)}`, TON_STATUT.fait) : null));
}
