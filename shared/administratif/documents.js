// Documents types de la structure, pré-remplis avec son identité (Administration générale → Administratif → Identité).
// Chaque document est une liste de blocs simples, rendus à l'écran et imprimés en PDF par le navigateur :
//   { t: 'titre' | 'sous' | 'p' | 'liste' | 'champ' | 'cases' | 'signatures' | 'note', … }
// Ce qui concerne une personne (nom, adresse, signature) reste en pointillés, à remplir à la main : rien de personnel
// n'est stocké. Ce sont des modèles, pas des actes rédigés par un juriste.

import { statutsAssociation } from './documents-statuts.js';
import { pvCreationSociete, conventionAssoSociete } from './documents-societe.js';

export const BLANC = '……………………………………';
const nomDe = (id) => id.nom || 'l’association';

export const DOCUMENTS = [
  { id: 'statuts', titre: 'Statuts de l’association', pour: 'Création : à adopter en assemblée constitutive, puis à joindre à la déclaration.' },
  { id: 'pv-constitutif', titre: 'Procès-verbal de l’assemblée constitutive', pour: 'Création : à joindre à la déclaration au greffe.' },
  { id: 'autorisation-parentale', titre: 'Autorisation parentale', pour: 'Chaque joueur mineur : adhésion, entraînements et compétitions.' },
  { id: 'droit-image', titre: 'Autorisation de droit à l’image', pour: 'Chaque mineur (et chaque majeur filmé) avant toute diffusion.' },
  { id: 'charte-mineurs', titre: 'Charte de protection des mineurs', pour: 'Signée par chaque membre du staff ; le référent y est nommé.' },
  { id: 'registre-rgpd', titre: 'Registre des traitements (RGPD)', pour: 'À garder à jour : quelles données, pourquoi, combien de temps.' },
  // Groupe « passage » : affichés quand un passage en société est prévu, ou la société créée.
  { id: 'pv-creation-societe', groupe: 'passage', titre: 'Procès-verbal d’AG : création de la société', pour: 'Passage en société : l’assemblée générale décide ce que la société reprend.' },
  { id: 'convention-asso-societe', groupe: 'passage', titre: 'Convention entre l’association et la société', pour: 'Si les deux continuent : nom, prestations, sponsors, au prix normal.' },
];

function pvConstitutif(id) {
  return [
    { t: 'titre', texte: `Procès-verbal de l’assemblée constitutive de ${nomDe(id)}` },
    { t: 'p', texte: `Le ${BLANC}, à ${BLANC}, les fondateurs de l’association ${nomDe(id)} se sont réunis en assemblée constitutive.` },
    { t: 'p', texte: `Personnes présentes : ${BLANC} (liste et signatures en annexe). Présidence de séance : ${BLANC}. Secrétariat de séance : ${BLANC}.` },
    { t: 'sous', texte: 'Ordre du jour' },
    { t: 'liste', items: ['Présentation du projet d’association.', 'Adoption des statuts.', 'Désignation des premiers dirigeants.', 'Montant de la cotisation de la première année.', 'Pouvoirs pour accomplir les formalités de déclaration.'] },
    { t: 'sous', texte: 'Décisions' },
    { t: 'p', texte: `1. Les statuts, dont un exemplaire est annexé, sont adoptés à ${BLANC} voix pour, ${BLANC} contre, ${BLANC} abstentions.` },
    { t: 'p', texte: `2. Sont désignés : président(e) ${BLANC} ; trésorier(ère) ${BLANC} ; secrétaire ${BLANC}.` },
    { t: 'p', texte: `3. La cotisation annuelle est fixée à ${BLANC} €.` },
    { t: 'p', texte: `4. ${BLANC} reçoit pouvoir d’accomplir la déclaration de l’association au greffe des associations.` },
    { t: 'p', texte: `L’ordre du jour étant épuisé, la séance est levée à ${BLANC}.` },
    { t: 'signatures', qui: ['Le président ou la présidente de séance', 'Le ou la secrétaire de séance'] },
    { t: 'note', texte: 'Pour la déclaration : aucune date de naissance sur les documents joints.' },
  ];
}

function autorisationParentale(id) {
  return [
    { t: 'titre', texte: 'Autorisation parentale' },
    { t: 'p', texte: `Je soussigné(e) ${BLANC}, représentant(e) légal(e) de ${BLANC} (pseudo : ${BLANC}),` },
    { t: 'p', texte: `autorise mon enfant à adhérer à l’association ${nomDe(id)} et à participer à ses activités :` },
    { t: 'cases', items: ['Entraînements et séances en ligne (vocal Discord, appli Lugh)', 'Compétitions en ligne', 'Compétitions en présence physique', 'Compétitions avec récompenses en argent (à partir de 12 ans)'] },
    { t: 'p', texte: `Jeux pratiqués et leur classification PEGI : ${BLANC}.` },
    { t: 'p', texte: 'Je déclare avoir été informé(e) des enjeux financiers des compétitions. Je sais qu’une compétition avec récompenses en argent est interdite aux moins de 12 ans, et qu’entre 13 et 16 ans les gains en argent sont placés à la Caisse des dépôts et consignations.' },
    { t: 'champ', libelle: 'Contact du représentant légal (téléphone ou e-mail)' },
    { t: 'champ', libelle: 'Personne à prévenir en cas d’urgence' },
    { t: 'p', texte: 'Pour une compétition en présence physique, une copie de la pièce d’identité du représentant légal est jointe ; l’organisateur la conserve un an.' },
    { t: 'signatures', qui: ['Le représentant légal (« lu et approuvé »)'], lieuDate: true },
  ];
}

function droitImage(id) {
  return [
    { t: 'titre', texte: 'Autorisation de captation et de diffusion de l’image et de la voix' },
    { t: 'p', texte: `Je soussigné(e) ${BLANC}, agissant pour moi-même ou en qualité de représentant(e) légal(e) de ${BLANC} (pseudo : ${BLANC}),` },
    { t: 'p', texte: `autorise l’association ${nomDe(id)} à capter et diffuser, dans le cadre de ses activités esport :` },
    { t: 'cases', items: ['L’image (visage, webcam, photos)', 'La voix (vocal pendant les matchs et les streams)', 'Le pseudo'] },
    { t: 'p', texte: 'Sur les supports suivants :' },
    { t: 'cases', items: ['Streams (Twitch, YouTube)', 'Vidéos et extraits', 'Réseaux sociaux de l’association', 'Site et documents de l’association'] },
    { t: 'p', texte: `Cette autorisation est donnée à titre gratuit, pour une durée de ${BLANC} (par exemple la saison en cours). Elle peut être retirée à tout moment par écrit ; les diffusions déjà faites ne sont alors plus renouvelées et les contenus retirés dans la mesure du possible. Aucune image ne sera utilisée d’une façon qui porte atteinte à la dignité ou à la réputation de la personne.` },
    { t: 'p', texte: 'Pour un mineur en âge de comprendre, son accord est aussi demandé :' },
    { t: 'signatures', qui: ['La personne filmée ou son représentant légal', 'Le joueur mineur (s’il est en âge de comprendre)'], lieuDate: true },
  ];
}

function charteMineurs(id) {
  const referent = id.referent || BLANC;
  return [
    { t: 'titre', texte: `Charte de protection des mineurs de ${nomDe(id)}` },
    { t: 'p', texte: 'Des joueurs de la structure sont mineurs. Chaque membre du staff (coach, analyste, manager, responsable) s’engage à :' },
    { t: 'liste', items: [
      'Échanger avec les joueurs uniquement dans les salons de l’équipe (Discord, Lugh), jamais en message privé.',
      'Ne jamais demander d’informations personnelles (adresse, école, téléphone), de photos ou de rencontre hors des activités.',
      'Respecter les horaires : pas d’entraînement tardif en semaine pour les mineurs.',
      'Ne jamais diffuser l’image ou la voix d’un mineur sans l’autorisation de ses parents (vérifier dans le roster de Lugh).',
      'Refuser toute insulte, humiliation, pression ou discrimination, en jeu comme hors jeu.',
      'Signaler sans attendre tout comportement inquiétant au référent.',
    ] },
    { t: 'sous', texte: 'Référent' },
    { t: 'p', texte: `Le référent de la structure contre les violences sexistes et sexuelles et pour la protection des mineurs est : ${referent}. Tout joueur, parent ou membre du staff peut le contacter, en toute confidentialité.` },
    { t: 'sous', texte: 'En cas de danger' },
    { t: 'p', texte: 'Un enfant en danger ou en risque de l’être : appeler le 119 (gratuit, 24 h/24). En cas d’urgence : le 17 ou le 112.' },
    { t: 'p', texte: 'Tout manquement à cette charte entraîne l’exclusion du staff et, si nécessaire, un signalement aux autorités.' },
    { t: 'signatures', qui: ['Le membre du staff (nom ou pseudo)', 'Le président ou la présidente'], lieuDate: true },
  ];
}

function registreRgpd(id) {
  const resp = `${nomDe(id)}${id.contact ? ` (contact : ${id.contact})` : ''}`;
  return [
    { t: 'titre', texte: 'Registre des traitements de données personnelles' },
    { t: 'p', texte: `Responsable : ${resp}. Mis à jour le ${BLANC}.` },
    { t: 'sous', texte: '1. Comptes et organisation des équipes (appli Lugh)' },
    { t: 'liste', items: [
      'Données : identifiant, nom affiché ou pseudo, accès et métiers par jeu, planning, disponibilités, absences, résultats et notes d’équipe, journal des connexions.',
      'Pourquoi : organiser les entraînements, les matchs et le suivi des joueurs.',
      'Qui y accède : les membres de chaque jeu selon leur rôle ; l’Administrateur général.',
      'Où : Render (Francfort, Allemagne) et MongoDB Atlas (Europe) ; copie de sauvegarde hebdomadaire sur un ordinateur de la structure.',
      'Combien de temps : tant que le compte existe ; journal des connexions 90 jours.',
    ] },
    { t: 'sous', texte: '2. Serveur Discord' },
    { t: 'liste', items: ['Données : identifiant et pseudo Discord liés au compte Lugh, rôles.', 'Pourquoi : rôles automatiques, rappels, commandes.', 'Combien de temps : jusqu’à la déliaison ou la suppression du compte.'] },
    { t: 'sous', texte: '3. Adhésions, autorisations et comptes de l’association' },
    { t: 'liste', items: [
      'Données : nom des adhérents et des représentants légaux, autorisations signées (papier ou fichiers rangés par le bureau), cotisations.',
      'Dans Lugh : pour chaque joueur, l’indication « mineur » et les dates de l’autorisation parentale et du droit à l’image (jamais l’âge), visibles du Responsable du jeu et de l’Administrateur général ; dans le livre des comptes, le nom ou pseudo du payeur ou du bénéficiaire (« tiers ») de chaque écriture, visible du Trésorier et de l’Administrateur général.',
      'Pourquoi : obligations de l’association, tenue de ses comptes et protection des mineurs.',
      'Combien de temps : la durée de l’adhésion ; l’indication « mineur » et ses dates sont effacées avec la fiche du joueur ; écritures et justificatifs comptables 6 à 10 ans ; autorisations de compétition 1 an après l’événement.',
    ] },
    { t: 'p', texte: 'Droits : accès, rectification, effacement, opposition, auprès du responsable ci-dessus ; réponse dans le mois. Réclamation possible auprès de la CNIL (cnil.fr).' },
  ];
}

const CONSTRUCTEURS = {
  statuts: statutsAssociation,
  'pv-constitutif': pvConstitutif,
  'autorisation-parentale': autorisationParentale,
  'droit-image': droitImage,
  'charte-mineurs': charteMineurs,
  'registre-rgpd': registreRgpd,
  'pv-creation-societe': pvCreationSociete,
  'convention-asso-societe': conventionAssoSociete,
};

// Document prêt à afficher : { id, titre, blocs } ; null pour un identifiant inconnu.
export function documentType(idDoc, identite = {}) {
  const fiche = DOCUMENTS.find((d) => d.id === idDoc);
  if (!fiche) return null;
  return { ...fiche, blocs: CONSTRUCTEURS[idDoc](identite) };
}
