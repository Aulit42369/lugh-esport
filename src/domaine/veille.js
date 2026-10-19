// Veille légale de la structure : vérifie les obligations (shared/administratif/obligations.js) sur les sources
// officielles, avec l'API Claude et sa recherche web limitée à ces sites (bouton « Vérifier »), ou par import manuel
// d'une réponse obtenue sur claude.ai. Elle ne modifie jamais rien d'elle-même : chaque changement devient une
// proposition que l'Administrateur général accepte ou refuse. Document unique : parametres/structure-veille.

import { interrogerClaude as interrogerParDefaut, extraireJson } from '../meta/claude.js';
import { coutEstime, cumulerCouts } from '../meta/actualisation.js';
import { obligationsEffectives, SOURCES_OFFICIELLES, NIVEAUX, tousLesPoints } from '../../shared/administratif/obligations.js';
import { nouvelId } from '../../shared/validation.js';

export const ID_VEILLE = 'structure-veille';
const PROPOSITIONS_MAX = 40;
const MOTIF_ID = /^[a-z0-9-]{2,30}$/;
const niveaux = new Set(NIVEAUX.map((n) => n.id));

const court = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Source acceptée : https, sur un site officiel de la liste (ou un sous-domaine).
export function sourceOfficielle(s) {
  try {
    const u = new URL(String(s?.url || ''));
    const hote = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || !SOURCES_OFFICIELLES.some((d) => hote === d || hote.endsWith(`.${d}`))) return null;
    return { titre: court(s.titre, 120) || hote, url: u.href.slice(0, 400) };
  } catch {
    return null;
  }
}

export function construireConsigneVeille({ obligations, aujourdhui, maxRecherches = 10 }) {
  const base = obligations.map((s) => ({
    section: s.id, titre: s.titre,
    points: s.points.map((p) => ({ id: p.id, titre: p.titre, niveau: p.niveau, texte: p.texte })),
  }));
  const systeme = [
    'Tu es chargé de la veille juridique d’une petite association esport française (joueurs amateurs, dont des mineurs).',
    'Ta mission : vérifier, sur les sources officielles uniquement, que chaque point de la liste est toujours exact à la date du jour, et proposer les corrections nécessaires.',
    '',
    'Règles :',
    `1. Sources acceptées : ${SOURCES_OFFICIELLES.join(', ')}. Rien d’autre (pas de blog, pas de forum).`,
    '2. Ne propose un changement que si une source officielle le confirme (nouveau seuil, nouvelle règle, règle abrogée). Sinon, ne propose rien.',
    '3. Textes en français simple, compréhensibles par un bénévole, 600 caractères maximum, sans jargon inutile.',
    '4. Un ajout seulement pour une obligation nouvelle ou oubliée qui concerne vraiment une association esport amateur accueillant des mineurs.',
    '5. Réponds uniquement par un bloc ```json, sans texte autour.',
  ].join('\n');
  const format = {
    verifieLe: 'AAAA-MM-JJ',
    changements: [{ cle: 'section.point', type: 'modifier ou supprimer', titre: 'nouveau titre (facultatif)', texte: 'nouveau texte complet', niveau: 'obligatoire | condition | recommande', raison: 'ce qui a changé, 200 caractères', sources: [{ titre: '…', url: 'https://…' }] }],
    ajouts: [{ section: 'identifiant de section existante', id: 'identifiant-court', titre: '…', texte: '…', niveau: '…', raison: '…', sources: [{ titre: '…', url: 'https://…' }] }],
  };
  const question = [
    `Date du jour : ${aujourdhui}.`,
    'Liste actuelle des obligations (JSON) :',
    JSON.stringify(base),
    '',
    'Format de réponse attendu (listes vides si tout est à jour) :',
    JSON.stringify(format),
  ].join('\n');
  const outil = { type: 'web_search_20250305', name: 'web_search', max_uses: maxRecherches, allowed_domains: SOURCES_OFFICIELLES };
  return { systeme, question, outils: [outil] };
}

// Réponse brute → propositions sûres (clés connues, textes bornés, sources officielles seulement).
export function propositionsDepuis(brut, obligations, quand) {
  const connus = new Map(tousLesPoints(obligations).map((p) => [`${p.section}.${p.id}`, p]));
  const sections = new Set(obligations.map((s) => s.id));
  const sources = (liste) => (Array.isArray(liste) ? liste.slice(0, 4).map(sourceOfficielle).filter(Boolean) : []);
  const sortie = [];
  for (const c of Array.isArray(brut?.changements) ? brut.changements.slice(0, 20) : []) {
    const actuel = connus.get(c?.cle);
    const src = sources(c?.sources);
    if (!actuel || !src.length || !['modifier', 'supprimer'].includes(c.type)) continue;
    const nouveau = c.type === 'supprimer' ? { supprime: true } : {
      ...(court(c.titre, 120) ? { titre: court(c.titre, 120) } : {}),
      ...(court(c.texte, 600) ? { texte: court(c.texte, 600) } : {}),
      ...(niveaux.has(c.niveau) ? { niveau: c.niveau } : {}),
    };
    if (!Object.keys(nouveau).length) continue;
    sortie.push({ _id: nouvelId('v'), type: c.type, cle: c.cle, avant: { titre: actuel.titre, texte: actuel.texte, niveau: actuel.niveau }, nouveau, raison: court(c.raison, 200), sources: src, statut: 'nouvelle', le: quand });
  }
  for (const a of Array.isArray(brut?.ajouts) ? brut.ajouts.slice(0, 10) : []) {
    const src = sources(a?.sources);
    if (!sections.has(a?.section) || !MOTIF_ID.test(String(a?.id || '')) || connus.has(`${a.section}.${a.id}`) || !src.length) continue;
    if (!court(a.titre, 120) || !court(a.texte, 600)) continue;
    sortie.push({
      _id: nouvelId('v'), type: 'ajouter', cle: `${a.section}.${a.id}`,
      nouveau: { id: a.id, titre: court(a.titre, 120), texte: court(a.texte, 600), niveau: niveaux.has(a.niveau) ? a.niveau : 'recommande' },
      raison: court(a.raison, 200), sources: src, statut: 'nouvelle', le: quand,
    });
  }
  return sortie;
}

export function creerVeille({ global, config, maintenant = () => new Date(), interroger = interrogerParDefaut, journal = console }) {
  let enCours = null;

  const lire = async () => (await global.lire('parametres', ID_VEILLE)) || { _id: ID_VEILLE, modifs: {}, ajouts: [], propositions: [], couts: {} };
  const effectives = (doc) => obligationsEffectives({ modifs: doc.modifs, ajouts: doc.ajouts });

  async function enregistrerResultat(brut, { declencheur, usage = null }) {
    const doc = await lire();
    const quand = maintenant().toISOString();
    // Réponse hors du format demandé : échec visible plutôt qu'un faux « tout est à jour ».
    if (!brut || typeof brut !== 'object' || !Array.isArray(brut.changements) || !Array.isArray(brut.ajouts)) {
      throw new Error('Réponse illisible : « changements » et « ajouts » doivent être des listes.');
    }
    const nouvelles = propositionsDepuis(brut, effectives(doc), quand);
    // Une nouvelle proposition remplace celle, encore en attente, qui portait sur le même point.
    const gardees = doc.propositions.filter((p) => p.statut !== 'nouvelle' || !nouvelles.some((n) => n.cle === p.cle));
    // À la limite, les décisions anciennes partent d'abord : une proposition en attente n'est jamais perdue.
    const enAttente = [...nouvelles, ...gardees.filter((p) => p.statut === 'nouvelle')];
    const decidees = gardees.filter((p) => p.statut !== 'nouvelle');
    doc.propositions = [...enAttente, ...decidees].slice(0, Math.max(PROPOSITIONS_MAX, enAttente.length));
    Object.assign(doc, { derniereVerif: quand, declencheur, statut: 'ok', erreur: null });
    if (usage) doc.couts = cumulerCouts(doc.couts, quand.slice(0, 7), usage, coutEstime(config.claude.modele, usage));
    await global.ecrire('parametres', doc);
    return { ok: true, nouvelles: nouvelles.length };
  }

  async function executer() {
    let usage = null;
    try {
      const doc = await lire();
      const c = construireConsigneVeille({ obligations: effectives(doc), aujourdhui: maintenant().toISOString().slice(0, 10), maxRecherches: config.claude.maxRecherches });
      const rep = await interroger({ cle: config.claude.cle, modele: config.claude.modele, maxTokens: 8000, ...c });
      usage = rep.usage;
      return await enregistrerResultat(extraireJson(rep.texte), { declencheur: 'api', usage });
    } catch (e) {
      const doc = await lire();
      const quand = maintenant().toISOString();
      Object.assign(doc, { statut: 'echec', erreur: String(e?.message || e).slice(0, 300), derniereTentative: quand });
      if (usage) doc.couts = cumulerCouts(doc.couts, quand.slice(0, 7), usage, coutEstime(config.claude.modele, usage));
      await global.ecrire('parametres', doc);
      return { ok: false, erreur: doc.erreur };
    }
  }

  return {
    get enCours() {
      return !!enCours;
    },
    async etat() {
      const doc = await lire();
      return {
        obligations: effectives(doc),
        propositions: doc.propositions,
        derniereVerif: doc.derniereVerif || null,
        statut: enCours ? 'en_cours' : doc.statut || null,
        erreur: doc.erreur || null,
        couts: doc.couts || {},
        cleApi: !!config.claude.cle,
      };
    },
    lancer() {
      if (enCours) return { lancee: false, raison: 'en_cours' };
      if (!config.claude.cle) return { lancee: false, raison: 'cle_absente' };
      enCours = executer()
        .catch((e) => {
          journal.error?.('[veille]', e?.message || e);
          return { ok: false };
        })
        .finally(() => {
          enCours = null;
        });
      return { lancee: true, promesse: enCours };
    },
    async consigneManuelle() {
      const c = construireConsigneVeille({ obligations: effectives(await lire()), aujourdhui: maintenant().toISOString().slice(0, 10) });
      return `${c.systeme}\n\n${c.question}\n\nUtilise la recherche web, uniquement sur les sources acceptées, pour vérifier chaque point.`;
    },
    async importer(texte) {
      if (enCours) throw new Error('Une vérification est déjà en cours.');
      let brut;
      try {
        brut = extraireJson(String(texte || ''));
      } catch {
        throw new Error('Aucun JSON lisible dans le texte collé.');
      }
      return enregistrerResultat(brut, { declencheur: 'import' });
    },
    // Accepter applique le changement au référentiel effectif ; refuser le garde en mémoire, sans effet.
    async decider(id, accepter, compte) {
      const doc = await lire();
      const p = doc.propositions.find((x) => x._id === id);
      if (!p || p.statut !== 'nouvelle') return null;
      const quand = maintenant().toISOString();
      p.statut = accepter ? 'acceptee' : 'refusee';
      p.decideLe = quand;
      p.decidePar = compte?._id || '';
      if (accepter) {
        if (p.type === 'ajouter') {
          const [section] = p.cle.split('.');
          doc.ajouts = [...(doc.ajouts || []).filter((a) => `${a.section}.${a.point.id}` !== p.cle), { section, point: { ...p.nouveau, sources: p.sources }, le: quand }];
          // Un ancien retrait du même identifiant masquerait le point tout juste ajouté.
          if (doc.modifs?.[p.cle]) {
            const { [p.cle]: _retire, ...reste } = doc.modifs;
            doc.modifs = reste;
          }
        } else {
          doc.modifs = { ...(doc.modifs || {}), [p.cle]: { ...(doc.modifs?.[p.cle] || {}), ...p.nouveau, sources: p.sources, le: quand } };
        }
      }
      await global.ecrire('parametres', doc);
      return p;
    },
  };
}
