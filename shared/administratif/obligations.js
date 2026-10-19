// Obligations d'une structure esport en France : le référentiel de départ, vérifié sur les sources officielles le
// VERIFIE_LE ci-dessous. La veille légale (src/domaine/veille.js) ne le modifie jamais : elle propose des changements,
// que l'Administrateur général valide un par un ; les changements validés sont rangés à part et appliqués par
// obligationsEffectives(). Aucun texte ici n'est un avis juridique.

export const VERIFIE_LE = '2026-10-19';

// Seuls ces sites servent de sources (et à la veille légale).
export const SOURCES_OFFICIELLES = [
  'service-public.gouv.fr', 'economie.gouv.fr', 'entreprises.gouv.fr', 'legifrance.gouv.fr', 'cnil.fr', 'associations.gouv.fr',
  'impots.gouv.fr', 'urssaf.fr', 'france-esports.org', 'valorantesports.com', 'lolesports.com', 'riotgames.com',
];

export const NIVEAUX = [
  { id: 'obligatoire', nom: 'Obligatoire' },
  { id: 'condition', nom: 'Obligatoire dans certains cas' },
  { id: 'recommande', nom: 'Recommandé' },
];

export const STATUTS_SUIVI = [
  { id: 'a_faire', nom: 'À faire' },
  { id: 'en_cours', nom: 'En cours' },
  { id: 'fait', nom: 'Fait' },
  { id: 'non_concerne', nom: 'Pas concerné' },
];

const S = {
  creation: { titre: 'Déclaration initiale d’une association', url: 'https://www.service-public.gouv.fr/associations/vosdroits/F1119' },
  siret: { titre: 'Numéro SIRET d’une association', url: 'https://www.service-public.gouv.fr/associations/vosdroits/F1926' },
  franchise: { titre: 'BOFiP : montant de la franchise des impôts commerciaux (août 2026)', url: 'https://bofip.impots.gouv.fr/node/381801' },
  adhesionMineur: { titre: 'Un mineur peut-il créer une association ou en devenir membre ?', url: 'https://www.service-public.gouv.fr/associations/vosdroits/F34101' },
  competitions: { titre: 'Compétitions de jeux vidéo (economie.gouv.fr)', url: 'https://www.economie.gouv.fr/entreprises/competitions-jeux-video-esport-francais' },
  joueursPro: { titre: 'Statut des joueurs professionnels salariés', url: 'https://www.entreprises.gouv.fr/fr/numerique/politique-numerique/statut-des-joueurs-professionnels-salaries-de-jeux-video' },
  image: { titre: 'Droit à l’image (service-public.gouv.fr)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F32103' },
  mineursRgpd: { titre: 'CNIL : consentement d’un parent pour les moins de 15 ans', url: 'https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans' },
  mineursEnLigne: { titre: 'CNIL : capacité d’agir des mineurs en ligne', url: 'https://www.cnil.fr/fr/recommandation-1-encadrer-la-capacite-dagir-des-mineurs-en-ligne' },
  vss: { titre: 'France Esports : lutter contre les dérives et les VSS', url: 'https://www.france-esports.org/wp-content/uploads/2025/10/Guide-pratique-Lutter-contre-les-dérives-dans-les-événements-esports-Lutter-contre-les-VSS.pdf' },
  riot: { titre: 'Règles des compétitions communautaires VALORANT', url: 'https://valorantesports.com/news/valorant-community-competition-guidelines' },
  cnil: { titre: 'CNIL : le RGPD pour les associations', url: 'https://www.cnil.fr/fr/rgpd-par-ou-commencer' },
};

// Chaque point : id (définitif), titre, texte, niveau, sources. L'ordre est celui des étapes de vie de la structure.
export const SECTIONS = [
  {
    id: 'creation', titre: 'Créer l’association', resume: 'Sans structure déclarée, tu es personnellement responsable de l’argent, des sponsors et des litiges.',
    points: [
      { id: 'statuts', niveau: 'obligatoire', titre: 'Assemblée constitutive et statuts', texte: 'Réunir les fondateurs, adopter les statuts (signés par au moins 2 dirigeants) et désigner le bureau : président, trésorier, secrétaire. Un modèle de statuts est dans Documents.', sources: [S.creation] },
      { id: 'declaration', niveau: 'obligatoire', titre: 'Déclaration au greffe des associations', texte: 'En ligne (téléservice e-création), au greffe du département du siège : procès-verbal de l’assemblée constitutive, statuts, liste des dirigeants. Aucune date de naissance sur les documents, sinon la déclaration peut être rejetée. Récépissé avec le numéro RNA (W + 9 chiffres) sous 5 jours ; publication au Journal officiel gratuite.', sources: [S.creation] },
      { id: 'siret', niveau: 'condition', titre: 'Numéro SIRET', texte: 'Seulement pour demander des subventions publiques, employer des salariés ou payer la TVA ou l’impôt sur les sociétés. Le certificat n’a pas de duplicata : le garder précieusement.', sources: [S.siret] },
      { id: 'banque', niveau: 'recommande', titre: 'Compte bancaire au nom de l’association', texte: 'Jamais l’argent de la structure sur un compte personnel : cotisations, sponsors, gains et dépenses passent par le compte de l’association.', sources: [] },
      { id: 'assurance', niveau: 'recommande', titre: 'Assurance responsabilité civile', texte: 'Elle couvre les dommages causés lors des activités. Indispensable dès qu’il y a un événement physique : les salles l’exigent presque toujours.', sources: [] },
    ],
  },
  {
    id: 'gestion', titre: 'Gestion courante', resume: 'Ce qui revient chaque année.',
    points: [
      { id: 'comptes', niveau: 'obligatoire', titre: 'Tenir les comptes', texte: 'Chaque recette et chaque dépense dans le livre des comptes, avec son numéro de justificatif. Conserver les justificatifs au moins 6 ans (contrôle fiscal), 10 ans conseillés.', sources: [] },
      { id: 'ag', niveau: 'obligatoire', titre: 'Assemblée générale', texte: 'Selon les statuts, en général une fois par an : rapport moral, approbation des comptes de l’exercice (bilan du livre des comptes), élection du bureau.', sources: [] },
      { id: 'modifications', niveau: 'condition', titre: 'Déclarer les changements', texte: 'Nouveau président, trésorier ou secrétaire, changement de statuts ou de siège : à déclarer au greffe dans les 3 mois.', sources: [S.creation] },
      { id: 'impots', niveau: 'condition', titre: 'Impôts commerciaux', texte: 'Pas d’impôts tant que la gestion est désintéressée (dirigeants non rémunérés) et que les recettes commerciales accessoires (contreparties publicitaires des sponsors, merch, buvette) restent sous 81 051 € par an (seuil en vigueur depuis les exercices clos au 31 décembre 2025, revalorisé chaque année). Au-delà, demander conseil.', sources: [S.franchise] },
      { id: 'benevoles', niveau: 'obligatoire', titre: 'Bénévoles et joueurs amateurs', texte: 'Rembourser seulement des frais réels, sur justificatifs. Verser régulièrement de l’argent à un joueur en échange d’entraînements imposés peut être requalifié en contrat de travail.', sources: [S.joueursPro] },
    ],
  },
  {
    id: 'mineurs', titre: 'Mineurs', resume: 'Le point le plus sensible : des joueurs peuvent être mineurs.',
    points: [
      { id: 'autorisation', niveau: 'obligatoire', titre: 'Autorisation parentale', texte: 'Un mineur adhère librement, sauf si les statuts en décident autrement ; avant 16 ans, il lui faut l’accord écrit de ses parents pour créer ou diriger l’association. Pour les compétitions, l’autorisation écrite des parents est obligatoire (modèle dans Documents). À cocher sur la fiche du joueur dans le roster.', sources: [S.competitions, S.adhesionMineur] },
      { id: 'image', niveau: 'obligatoire', titre: 'Droit à l’image', texte: 'Autorisation écrite des parents, sans exception, avant de diffuser l’image ou la voix d’un mineur (stream, vidéo, photo, réseaux). Demander aussi l’accord de l’enfant s’il est en âge de comprendre. Diffuser sans accord : jusqu’à 1 an de prison et 15 000 € d’amende.', sources: [S.image] },
      { id: 'gains', niveau: 'condition', titre: 'Compétitions avec gains en argent', texte: 'Interdites aux moins de 12 ans. Autorisation parentale écrite et pièce d’identité présentée. Entre 13 et 16 ans, les gains sont séquestrés à la Caisse des dépôts.', sources: [S.competitions] },
      { id: 'protection', niveau: 'recommande', titre: 'Référent et protection', texte: 'Nommer un référent contre les violences sexistes et sexuelles (charte dans Documents). Aucun message privé entre staff et mineurs : tout se passe dans les salons de l’équipe. Signalement : un Responsable, le référent, et le 119 (enfance en danger).', sources: [S.vss] },
    ],
  },
  {
    id: 'rgpd', titre: 'Données personnelles (RGPD)', resume: 'Lugh stocke peu de données, en Europe ; il reste à informer et à répondre aux demandes.',
    points: [
      { id: 'information', niveau: 'obligatoire', titre: 'Informer les membres', texte: 'Une information simple, compréhensible par un ado : la page « Données et confidentialité » de Lugh, accessible depuis l’écran de connexion. Renseigner l’adresse de contact dans Identité.', sources: [S.cnil, S.mineursEnLigne] },
      { id: 'consentement', niveau: 'condition', titre: 'Moins de 15 ans', texte: 'Pour ce qui repose sur le consentement (photos, Discord, compte Lugh), l’accord du jeune et de ses parents.', sources: [S.mineursRgpd] },
      { id: 'demandes', niveau: 'obligatoire', titre: 'Répondre aux demandes', texte: 'Accès, rectification ou suppression des données : répondre dans le mois. Lugh permet d’exporter un jeu et de supprimer un compte.', sources: [S.cnil] },
      { id: 'registre', niveau: 'recommande', titre: 'Registre des traitements', texte: 'Un simple tableau : quelles données (comptes Lugh, Discord, comptes de la structure), pourquoi, combien de temps, qui y a accès.', sources: [S.cnil] },
    ],
  },
  {
    id: 'tournois', titre: 'Organiser un tournoi', resume: 'Seulement si la structure organise elle-même une compétition.',
    points: [
      { id: 'declaration', niveau: 'condition', titre: 'Déclaration préalable', texte: 'Tournoi physique avec droits d’inscription et récompenses : déclaration au ministère de l’Intérieur au plus tard 30 jours avant. Sans déclaration : jusqu’à 750 € d’amende. Les droits d’inscription ne doivent pas dépasser les coûts d’organisation.', sources: [S.competitions] },
      { id: 'en-ligne', niveau: 'condition', titre: 'Tournoi en ligne', texte: 'Ouvert au public : aucune inscription payante, qualifications comprises.', sources: [S.competitions] },
      { id: 'garantie', niveau: 'condition', titre: 'Plus de 10 000 € de gains', texte: 'Justifier d’une garantie de paiement (séquestre, assurance, fiducie), jointe à la déclaration.', sources: [S.competitions] },
      { id: 'editeur', niveau: 'obligatoire', titre: 'Règles de l’éditeur', texte: 'Riot : formulaire de visibilité, pas de logo Riot ni de nom officiel (« Masters », « Champions »). Sponsors interdits : paris, casinos, alcool, tabac, crypto et NFT, CBD, contenu adulte.', sources: [S.riot] },
    ],
  },
  {
    id: 'pro', titre: 'Joueurs salariés (plus tard)', resume: 'Seulement le jour où la structure rémunère des joueurs.',
    points: [
      { id: 'agrement', niveau: 'condition', titre: 'Agrément de la structure', texte: 'Délivré par le ministre chargé du numérique pour 3 ans : moyens humains et financiers, encadrement physique, psychologique et professionnel des joueurs, dirigeants sans condamnation.', sources: [S.joueursPro] },
      { id: 'cdd', niveau: 'condition', titre: 'Contrat spécifique', texte: 'CDD de 1 à 5 ans. Mal rédigé, il devient un CDI ; amende de 3 750 €.', sources: [S.joueursPro] },
      { id: 'mineurs-pro', niveau: 'condition', titre: 'Joueur salarié de moins de 16 ans', texte: 'Autorisation de la Commission des enfants du spectacle pour chaque mineur, durée de travail limitée, part du salaire séquestrée jusqu’à sa majorité.', sources: [S.joueursPro] },
    ],
  },
  {
    id: 'jeux', titre: 'Jeux et marque', resume: 'Les règles des éditeurs et l’identité de la structure.',
    points: [
      { id: 'comptes-jeu', niveau: 'obligatoire', titre: 'Comptes de jeu', texte: 'Ils appartiennent aux joueurs. Les conditions des éditeurs interdisent de partager, prêter ou vendre un compte : la structure n’en possède aucun.', sources: [] },
      { id: 'marque', niveau: 'recommande', titre: 'Nom et logo', texte: 'Déposer la marque à l’INPI pour la protéger (facultatif). Ne jamais utiliser les visuels officiels des éditeurs.', sources: [] },
    ],
  },
];

export const tousLesPoints = (sections = SECTIONS) => sections.flatMap((s) => s.points.map((p) => ({ ...p, section: s.id })));

// Référentiel effectif : le référentiel livré, plus les changements validés de la veille légale.
// modifs : { [section.point]: { titre?, texte?, niveau?, sources?, supprime?, le } } ; ajouts : [{ section, point }].
export function obligationsEffectives({ modifs = {}, ajouts = [] } = {}) {
  return SECTIONS.map((s) => ({
    ...s,
    points: [...s.points, ...ajouts.filter((a) => a.section === s.id).map((a) => ({ ...a.point, ajouteLe: a.le }))]
      .map((p) => {
        const m = modifs[`${s.id}.${p.id}`];
        return m ? { ...p, ...m, modifieLe: m.le } : p;
      })
      .filter((p) => !p.supprime),
  }));
}
