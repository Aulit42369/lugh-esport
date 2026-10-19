// Apex Legends — méta vérifiée à la livraison (18/10/2026) : chargée à la création de l’espace, puis remplacée par
// les vérifications du lundi et du jeudi (API Claude) ou par un import manuel. Sources : voir le modèle.

// Trios les plus joués en Pro League EMEA, Split 2 (saison 30, 60 parties : 20 sur chaque map du pool, ≈ 1 200 compos).
// apexlegendsstatus.com ne publie pas le détail par map : les mêmes trios sont repris sous chaque map du pool.
const SOURCE_EMEA = 'https://apexlegendsstatus.com/algs/Y6-Split2/Pro-League/EMEA/Overview';
const EVENEMENT_EMEA = 'ALGS Year 6 · Pro League Split 2 (EMEA)';
const compsEmea = () => [
  { personnages: ['alter', 'seer', 'wattson'], usage: '10,6 % des compos (127) en Pro League EMEA Split 2, maps confondues', evenement: EVENEMENT_EMEA, source: SOURCE_EMEA },
  { personnages: ['alter', 'catalyst', 'crypto'], usage: '7,3 % des compos (87) en Pro League EMEA Split 2, maps confondues', evenement: EVENEMENT_EMEA, source: SOURCE_EMEA },
  { personnages: ['alter', 'madmaggie', 'wattson'], usage: '5,3 % des compos (64) en Pro League EMEA Split 2, maps confondues', evenement: EVENEMENT_EMEA, source: SOURCE_EMEA },
];

export const INITIALE = {
  verifieLe: '2026-10-18',
  patch: 'Saison 30 · mi-saison',
  patchDate: '2026-09-15',
  saison: 'Saison 30 « Marked » · Split 2',
  // Pool ALGS actif = maps de la Pro League Split 2 (Storm Point, World's Edge, E-District : 20 parties chacune en EMEA).
  // Olympus a été jouée aux Split 1 Playoffs (juillet) ; le classé tourne sur World's Edge, Olympus et Broken Moon.
  mapPool: ['stormpoint', 'worldsedge', 'edistrict'],
  maps: [
    { id: 'stormpoint', nom: 'Storm Point', enPool: true },
    { id: 'worldsedge', nom: 'World’s Edge', enPool: true },
    { id: 'edistrict', nom: 'E-District', enPool: true },
    { id: 'olympus', nom: 'Olympus', enPool: false },
    { id: 'brokenmoon', nom: 'Broken Moon', enPool: false },
    { id: 'kingscanyon', nom: 'Kings Canyon', enPool: false },
  ],
  // Liste complète (28 légendes, page d'aide EA à jour pour la saison 30). Le rôle est un repère tiré de la classe officielle :
  // Assaut et Escarmoucheur → fragger (munitions et grenades en plus, entrée et sortie rapides des combats) ;
  // Reconnaissance → igl (balises de relevé : l'info qui nourrit les appels de rotation) ; Soutien → support (relèves et
  // soins plus rapides) ; Contrôleur → ancre (consoles d'anneau, défense d'une position). Un joueur peut sortir de ce repère.
  personnages: [
    // Assaut
    { id: 'bangalore', nom: 'Bangalore', role: 'fragger' },
    { id: 'fuse', nom: 'Fuse', role: 'fragger' },
    { id: 'ash', nom: 'Ash', role: 'fragger' },
    { id: 'madmaggie', nom: 'Mad Maggie', role: 'fragger' },
    { id: 'ballistic', nom: 'Ballistic', role: 'fragger' },
    // Escarmoucheur
    { id: 'pathfinder', nom: 'Pathfinder', role: 'fragger' },
    { id: 'wraith', nom: 'Wraith', role: 'fragger' },
    { id: 'octane', nom: 'Octane', role: 'fragger' },
    { id: 'revenant', nom: 'Revenant', role: 'fragger' },
    { id: 'horizon', nom: 'Horizon', role: 'fragger' },
    { id: 'alter', nom: 'Alter', role: 'fragger' },
    { id: 'axle', nom: 'Axle', role: 'fragger' },
    // Reconnaissance
    { id: 'bloodhound', nom: 'Bloodhound', role: 'igl' },
    { id: 'crypto', nom: 'Crypto', role: 'igl' },
    { id: 'valkyrie', nom: 'Valkyrie', role: 'igl' },
    { id: 'seer', nom: 'Seer', role: 'igl' },
    { id: 'vantage', nom: 'Vantage', role: 'igl' },
    { id: 'sparrow', nom: 'Sparrow', role: 'igl' },
    // Soutien
    { id: 'gibraltar', nom: 'Gibraltar', role: 'support' },
    { id: 'lifeline', nom: 'Lifeline', role: 'support' },
    { id: 'mirage', nom: 'Mirage', role: 'support' },
    { id: 'loba', nom: 'Loba', role: 'support' },
    { id: 'newcastle', nom: 'Newcastle', role: 'support' },
    { id: 'conduit', nom: 'Conduit', role: 'support' },
    // Contrôleur
    { id: 'caustic', nom: 'Caustic', role: 'ancre' },
    { id: 'wattson', nom: 'Wattson', role: 'ancre' },
    { id: 'rampart', nom: 'Rampart', role: 'ancre' },
    { id: 'catalyst', nom: 'Catalyst', role: 'ancre' },
  ],
  compsPro: {
    stormpoint: compsEmea(),
    worldsedge: compsEmea(),
    edistrict: compsEmea(),
  },
  tendances: [
    'Alter partout : 47 % des compos en Pro League EMEA Split 2 (saison 30) ; trio le plus joué Alter, Seer, Wattson (10,6 %), devant Alter, Catalyst, Crypto (7,3 %).',
    'Bans de légende : après chaque partie d’une série, la plus jouée sort jusqu’à la fin de la série. En Pro League EMEA, Wattson, Seer et Crypto ont été bannies 10 fois en 60 parties : prévoir deux compos par map.',
    'Pool ALGS Pro League Split 2 : Storm Point, World’s Edge, E-District (pool des Playoffs de Las Vegas non publié). Le classé tourne sur d’autres maps : Storm Point et E-District se travaillent en scrims.',
    'Saison 30 « Marked » : refonte de Bloodhound, butin resserré, armes énergie à réserve qui se recharge ; Axle et Seer affaiblis le 25 août, Catalyst, Conduit et Fuse renforcés à la mi-saison (15 sept.).',
  ],
  sources: [
    'https://www.ea.com/games/apex-legends/news/marked-patch-notes',
    'https://www.ea.com/games/apex-legends/news/marked-midseason-patch-notes',
    'https://www.ea.com/games/apex-legends/news/blood-pact-event',
    'https://help.ea.com/en/articles/apex-legends/abilities/',
    'https://help.ea.com/fr/articles/apex-legends/ranked/',
    'https://liquipedia.net/apexlegends/ALGS/2026-27',
    'https://liquipedia.net/apexlegends/Apex_Legends_Global_Series/2026/Split_2/Playoffs',
    'https://apexlegendsstatus.com/algs/Y6-Split2/Pro-League/EMEA/Overview',
    'https://apexlegendsstatus.com/algs/Y6-Split1/ALGS-Playoffs/Global/Overview',
    'https://apexlegendsstatus.com/algs/Y6-Split1/ALGS-Playoffs/Global/Finals/Finals',
    'https://esports.gg/news/apex-legends/how-do-algs-legend-bans-work/',
    'https://esports.gg/news/apex-legends/algs-poi-draft-how-does-it-work/',
    'https://esports.gg/news/apex-legends/is-contesting-about-to-be-a-thing-of-the-past-in-algs',
    'https://www.esports.net/news/apex-legends/apex-legends-reveals-algs-year-6-roadmap-all-events-details',
    'https://esports.gg/news/apex-legends/algs-2026-split-2-playoffs-schedule-teams-prize-pool-and-more/',
    'https://dotesports.com/apex-legends/news/algs-split-1-2026-ewc-standings-results-recap-apex-legends',
    'https://help.ea.com/en/articles/ea-account/how-to-create-ea-id/',
  ],
};
