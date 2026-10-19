// Consigne envoyée à Claude pour actualiser la méta d'un jeu, construite depuis sa définition :
// vocabulaire, rôles, maps, sources autorisées et consignes propres au jeu (modifiables dans les Réglages du jeu).

import { actifs } from '../../shared/jeux/definition.js';

function systemeDe(def) {
  const perso = def.aPersonnages ? def.vocabulaire.personnages : null;
  const sources = def.meta.sources.length ? def.meta.sources.join(', ') : 'les sites officiels de l’éditeur et les wikis de référence (Liquipedia…)';
  const roles = actifs(def.roles).map((r) => r.id).join('|');
  const camps = actifs(def.camps).map((c) => c.id).join('|');
  const regles = [
    `1. Sources : d’abord les notes de patch officielles, puis ${sources}. Ignore les fuites, rumeurs et « leaks » tant que l’éditeur ne les a pas confirmés.`,
    `2. Le numéro de patch, sa date${def.aPool ? ' et le map pool compétitif' : ''} doivent venir d’une source officielle ou d’un wiki de référence.`,
    '3. Ne modifie une valeur que si une source la confirme ; sinon recopie la base actuelle à l’identique.',
    perso ? `4. Compositions pro : uniquement celles relevées dans les derniers événements majeurs, avec leur source. N’invente jamais une composition ni un chiffre.` : '4. N’invente jamais un chiffre ni un événement.',
    '5. Garde les identifiants existants (minuscules ASCII et chiffres, sans espace ni ponctuation, 2 à 20 caractères).',
    `6. Inclue ${[def.aCartes ? `TOUTES les ${def.vocabulaire.cartes} compétitives existantes` : '', perso ? `TOUS les ${perso} jouables` : ''].filter(Boolean).join(' et ') || 'toutes les informations de la base'}, pas seulement ce qui change.`,
    '7. Textes en français, concis.',
    '8. Réponds uniquement par un bloc ```json contenant l’objet complet, sans aucun texte autour.',
  ];
  const format = {
    saison: 'saison ou période compétitive en cours',
    patch: 'numéro ou nom du dernier patch',
    patchDate: 'AAAA-MM-JJ',
    mapPool: def.aPool ? ['identifiants des maps du pool compétitif'] : [],
    maps: def.aCartes ? [{ id: 'identifiant', nom: 'Nom', enPool: true, mode: '', entreePatch: '', sortiePatch: '', noteMeta: '160 caractères maximum, ou vide' }] : [],
    personnages: perso ? [{ id: 'identifiant', nom: 'Nom', role: roles, ...(def.personnagesParCamp ? { camp: camps } : {}), annee: 2024, dernierChangement: null }] : [],
    compsPro: perso ? { [def.aPool ? 'identifiant d’une map du pool' : 'general']: [{ personnages: [`${def.equipe.titulaires} identifiants`], usage: 'chiffre et événement', evenement: 'nom de l’événement', source: 'https://…' }] } : {},
    tendances: ['3 à 5 phrases de 160 caractères maximum'],
    incertitudes: ['ce que tu n’as pas pu confirmer, 200 caractères maximum chacun (liste vide si tout est confirmé)'],
    circuit: null,
    sources: ['https://… pages réellement consultées'],
  };
  return [
    `Tu es l’analyste méta d’une équipe ${def.nom} francophone. Ta mission : vérifier l’état actuel du jeu compétitif et renvoyer la base méta complète, à jour, au format JSON décrit plus bas.`,
    '',
    'Règles :',
    ...regles,
    '',
    def.meta.consigne ? `Consignes propres à ${def.nom} :\n${def.meta.consigne}\n` : '',
    'Format :',
    JSON.stringify(format, null, 1),
    perso ? `« dernierChangement » vaut null ou {"patch": "…", "type": "buff|nerf|ajustement", "resume": "140 caractères maximum"} : le changement d’équilibrage le plus récent sur les cinq derniers patchs.` : '',
    '« circuit » vaut null ou {"etape": "", "dates": "", "format": "", "notes": ""} pour le circuit amateur ou semi-pro en cours.',
  ].filter((l) => l !== '').join('\n');
}

function compacter(meta) {
  if (!meta) return null;
  const { saison, patch, patchDate, mapPool, maps, personnages, compsPro, tendances, incertitudes, circuit, sources } = meta;
  return { saison, patch, patchDate, mapPool, maps, personnages, compsPro, tendances, incertitudes, circuit, sources };
}

export function construireConsigne({ def, meta, aujourdhui, maxRecherches = 8 }) {
  const base = compacter(meta);
  const perso = def.aPersonnages ? def.vocabulaire.personnages : null;
  const etapes = [
    `Le dernier patch publié (numéro et date). Base : ${base?.patch || 'inconnu'}.`,
    def.aPool ? `Le map pool compétitif en vigueur et les ${def.vocabulaire.cartes} entrées ou sorties au dernier changement.` : null,
    perso ? `Les changements d’équilibrage des ${perso} publiés depuis le patch de la base, et un éventuel nouveau ${def.vocabulaire.personnage} déjà jouable.` : 'Les changements d’équilibrage importants publiés depuis le patch de la base.',
    perso ? `Les compositions les plus jouées dans les derniers événements majeurs${def.aPool ? ' sur chaque map du pool (1 à 3 par map, avec source)' : ' (1 à 3, avec source)'}.` : null,
    '3 à 5 tendances de la méta compétitive actuelle.',
  ].filter(Boolean);
  const question = [
    `Date du jour : ${aujourdhui}.`,
    '',
    'Base actuelle :',
    base ? JSON.stringify(base) : 'aucune (première actualisation)',
    '',
    'Vérifie, dans cet ordre :',
    ...etapes.map((e, i) => `${i + 1}. ${e}`),
    '',
    'Puis renvoie la base complète mise à jour.',
  ].join('\n');

  const outil = { type: 'web_search_20250305', name: 'web_search', max_uses: maxRecherches };
  if (def.meta.sources.length) outil.allowed_domains = def.meta.sources;
  return { systeme: systemeDe(def), question, outils: [outil] };
}
