// Impacts de la méta sur l'équipe : écart entre deux versions, alertes du tableau de bord,
// suggestions créées après une actualisation. Fonctions pures, testées sans navigateur.
// Les liens sont relatifs au jeu (« #/maps/bind ») : l'interface les complète avec le jeu affiché.

import { joursDepuis } from './temps.js';
import { STATUTS_MAP, libelle } from './referentiel.js';
import { libelleDans, mot } from './jeux/definition.js';

function nomMap(meta, id) {
  return meta?.maps?.find((m) => m.id === id)?.nom || id;
}

function nomPersonnage(meta, id) {
  return meta?.personnages?.find((a) => a.id === id)?.nom || id;
}

export function diffMeta(avant, apres) {
  if (!apres) return null;
  if (!avant) {
    return { patch: null, mapsEntrees: [], mapsSorties: [], nouveauxPersonnages: [], personnagesModifies: [], vide: true };
  }
  const poolAvant = new Set(avant.mapPool || []);
  const poolApres = new Set(apres.mapPool || []);
  const nom = (id) => (nomMap(apres, id) !== id ? nomMap(apres, id) : nomMap(avant, id));
  const persoAvant = new Map((avant.personnages || []).map((a) => [a.id, a]));

  const diff = {
    patch: avant.patch !== apres.patch ? { avant: avant.patch || null, apres: apres.patch } : null,
    mapsEntrees: [...poolApres].filter((id) => !poolAvant.has(id)).map((id) => ({ id, nom: nom(id) })),
    mapsSorties: [...poolAvant].filter((id) => !poolApres.has(id)).map((id) => ({ id, nom: nom(id) })),
    nouveauxPersonnages: (apres.personnages || []).filter((a) => !persoAvant.has(a.id)),
    personnagesModifies: (apres.personnages || []).filter((a) => {
      const c = a.dernierChangement;
      if (!c || !persoAvant.has(a.id)) return false;
      const precedent = persoAvant.get(a.id).dernierChangement;
      return !precedent || precedent.patch !== c.patch || precedent.resume !== c.resume;
    }),
  };
  diff.vide = !diff.patch && !diff.mapsEntrees.length && !diff.mapsSorties.length
    && !diff.nouveauxPersonnages.length && !diff.personnagesModifies.length;
  return diff;
}

const NOMS_CHANGEMENT = { nerf: 'Nerf', buff: 'Buff', ajustement: 'Ajustement' };

export function idSuggestion(cle) {
  return `g-${cle.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 82);
}

export function suggestionsDepuisDiff(def, diff, { meta, mapsEquipe = [], strats = [], membres = [] }) {
  if (!diff || diff.vide || !meta) return [];
  const sugg = [];
  const patch = meta.patch;
  const carte = mot(def, 'carte');

  for (const m of diff.mapsEntrees) {
    const comps = meta.compsPro?.[m.id] || [];
    sugg.push({
      cle: `map-entree-${m.id}-${patch}`,
      type: 'planning',
      titre: `${m.nom} entre dans le pool`,
      texte: `Prévoir cette semaine une practice de découverte (90 min) et un scrim sur ${m.nom}, puis fixer son statut dans le pool.`,
      lien: `#/maps/${m.id}`,
    });
    if (def.aPersonnages) {
      sugg.push({
        cle: `compo-${m.id}-${patch}`,
        type: 'compo',
        titre: `Construire la compo ${m.nom}`,
        texte: comps.length
          ? `Compo pro la plus jouée : ${comps[0].personnages.map((a) => nomPersonnage(meta, a)).join(', ')}. À adapter au pool de vos joueurs.`
          : `Aucune compo pro relevée pour l’instant : partir des ${mot(def, 'personnages')} que l’équipe maîtrise déjà.`,
        lien: `#/maps/${m.id}`,
      });
    }
  }

  for (const m of diff.mapsSorties) {
    const nb = strats.filter((s) => s.map === m.id && s.statut !== 'archivee').length;
    const etaitPick = mapsEquipe.find((x) => x._id === m.id)?.statut === 'pick';
    const morceaux = [];
    if (nb) morceaux.push(`archiver ${nb} strat${nb > 1 ? 's' : ''}`);
    morceaux.push(`retirer ${m.nom} du planning`);
    if (etaitPick) morceaux.push(`désigner un nouveau pick (${carte})`);
    sugg.push({
      cle: `map-sortie-${m.id}-${patch}`,
      type: 'strats',
      titre: `${m.nom} quitte le pool`,
      texte: `${morceaux.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()),
      lien: `#/strats/${m.id}`,
    });
  }

  const joueurs = membres.filter((x) => x.type === 'joueur' && x.statut !== 'ancien');
  for (const a of diff.personnagesModifies) {
    const concernes = joueurs.filter((j) => (j.personnages?.principaux || []).includes(a.id));
    const maps = mapsEquipe.filter((me) => (me.compo || []).some((e) => e.personnage === a.id));
    if (!concernes.length && !maps.length) continue;
    const qui = [
      ...concernes.map((j) => j.pseudo || 'un joueur'),
      ...maps.map((me) => (me._id === 'general' ? 'compo principale' : `compo ${nomMap(meta, me._id)}`)),
    ];
    sugg.push({
      cle: `perso-${a.id}-${a.dernierChangement.patch}`,
      type: 'compo',
      titre: `${NOMS_CHANGEMENT[a.dernierChangement.type]} de ${a.nom} en ${a.dernierChangement.patch}`,
      texte: `${a.dernierChangement.resume} Concerne : ${qui.join(', ')}.`,
      lien: '#/meta',
    });
  }

  for (const a of diff.nouveauxPersonnages) {
    sugg.push({
      cle: `nouveau-${a.id}`,
      type: 'roster',
      titre: `Nouveau ${mot(def, 'personnage')} : ${a.nom}`,
      texte: `${a.role ? `${libelleDans(def.roles, a.role)}. ` : ''}À tester en classé avant de l’intégrer à une compo.`,
      lien: '#/meta',
    });
  }
  return sugg;
}

const ORDRE_NIVEAUX = { urgent: 0, attention: 1, info: 2 };

export function trierAlertes(alertes) {
  return alertes.sort((a, b) => ORDRE_NIVEAUX[a.niveau] - ORDRE_NIVEAUX[b.niveau]);
}

export function alertesEquipe({ def, meta, mapsEquipe = [], strats = [], membres = [], planningSemaine = null, maintenant = new Date() }) {
  const alertes = [];
  if (!meta) return alertes;

  if (meta.statut === 'echec') {
    alertes.push({ niveau: 'attention', texte: `Dernière actualisation de la méta en échec : ${meta.erreur || 'raison inconnue'}.`, lien: '#/meta' });
  } else {
    const jours = joursDepuis(meta.derniereVerif, maintenant);
    if (jours > 5 && def.meta.auto) alertes.push({ niveau: 'attention', texte: `Méta vérifiée il y a ${Math.floor(jours)} jours.`, lien: '#/meta' });
  }

  if (def.aPool) {
    const parId = new Map(mapsEquipe.map((m) => [m._id, m]));
    for (const id of meta.mapPool || []) {
      const me = parId.get(id);
      const nom = nomMap(meta, id);
      const prep = me?.preparation ?? 0;
      if (prep < 20) alertes.push({ niveau: 'attention', texte: `${nom} : préparation à ${prep} %.`, lien: `#/maps/${id}` });
      const complete = (me?.compo || []).filter((e) => e.personnage).length >= def.equipe.titulaires;
      if (def.aPersonnages && me && ['pick', 'confort'].includes(me.statut) && !complete) {
        alertes.push({ niveau: 'attention', texte: `${nom} (${libelle(STATUTS_MAP, me.statut)}) n’a pas de compo complète.`, lien: `#/maps/${id}` });
      }
    }
    for (const me of mapsEquipe) {
      if (me._id !== 'general' && !(meta.mapPool || []).includes(me._id) && ['pick', 'confort'].includes(me.statut)) {
        alertes.push({ niveau: 'info', texte: `${nomMap(meta, me._id)} n’est plus dans le pool mais reste en ${libelle(STATUTS_MAP, me.statut)}.`, lien: `#/maps/${me._id}` });
      }
    }
    const horsPool = strats.filter((s) => s.statut !== 'archivee' && s.map && !(meta.mapPool || []).includes(s.map)).length;
    if (horsPool) alertes.push({ niveau: 'info', texte: `${horsPool} strat${horsPool > 1 ? 's' : ''} sur des ${mot(def, 'cartes')} hors pool, à archiver.`, lien: '#/strats' });
  }

  const joueurs = membres.filter((x) => x.type === 'joueur' && x.statut !== 'ancien');
  if (def.aPersonnages) {
    for (const j of joueurs) {
      for (const idPerso of j.personnages?.principaux || []) {
        const p = (meta.personnages || []).find((x) => x.id === idPerso);
        const c = p?.dernierChangement;
        if (c && c.type === 'nerf' && c.patch === meta.patch) {
          alertes.push({ niveau: 'attention', texte: `Nerf de ${p.nom} en ${c.patch} : ${j.pseudo || 'un joueur'} le joue en principal.`, lien: '#/meta' });
        }
      }
    }
  }
  if (def.shotcall && def.equipe.titulaires > 1 && !joueurs.some((j) => j.igl && j.statut === 'titulaire')) {
    alertes.push({ niveau: 'info', texte: 'Aucun IGL désigné parmi les titulaires.', lien: '#/roster' });
  }
  if (!planningSemaine || !(planningSemaine.blocs || []).length) {
    alertes.push({ niveau: 'info', texte: 'Le planning de cette semaine est vide.', lien: '#/planning' });
  }
  return trierAlertes(alertes);
}
