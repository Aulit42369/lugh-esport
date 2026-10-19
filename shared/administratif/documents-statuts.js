// Modèle de statuts d'une association loi 1901 dont l'objet est l'esport. À relire et adapter avant l'assemblée
// constitutive ; les pointillés se remplissent à la main (adresse du siège, durée des mandats, montants).

const BLANC = '……………………………………';

export function statutsAssociation(id) {
  const nom = id.nom || BLANC;
  const sigle = id.sigle ? ` (sigle : ${id.sigle})` : '';
  const article = (n, titre, ...textes) => [{ t: 'sous', texte: `Article ${n} : ${titre}` }, ...textes.map((x) => (typeof x === 'string' ? { t: 'p', texte: x } : x))];
  return [
    { t: 'titre', texte: `Statuts de l’association ${nom}` },
    ...article(1, 'Nom', `Il est fondé entre les adhérents aux présents statuts une association régie par la loi du 1er juillet 1901 et le décret du 16 août 1901, ayant pour nom : ${nom}${sigle}.`),
    ...article(2, 'Objet', 'Cette association a pour objet la pratique, la promotion et le développement du jeu vidéo compétitif (esport) :',
      { t: 'liste', items: [
        'constituer et accompagner des équipes participant à des compétitions de jeux vidéo, en ligne et en présence physique ;',
        'organiser des entraînements, des événements et des compétitions ;',
        'favoriser une pratique saine et respectueuse, et protéger les joueurs mineurs ;',
        'nouer des partenariats en lien avec cet objet.',
      ] }),
    ...article(3, 'Siège social', `Le siège social est fixé à : ${BLANC}. Il pourra être transféré sur simple décision du bureau, ratifiée par l’assemblée générale.`),
    ...article(4, 'Durée', 'La durée de l’association est illimitée.'),
    ...article(5, 'Composition', 'L’association se compose de membres actifs (joueurs, staff, bénévoles) à jour de leur cotisation, de membres bienfaiteurs et de membres d’honneur. Les mineurs peuvent adhérer avec l’autorisation écrite de leur représentant légal.'),
    ...article(6, 'Admission', 'Pour faire partie de l’association, il faut être agréé par le bureau, qui statue sur les demandes d’admission, et adhérer aux présents statuts et au règlement intérieur.'),
    ...article(7, 'Cotisation', 'Le montant de la cotisation annuelle est fixé chaque année par l’assemblée générale.'),
    ...article(8, 'Perte de la qualité de membre', 'La qualité de membre se perd par la démission, le décès, ou la radiation prononcée par le bureau pour non-paiement de la cotisation ou pour motif grave, l’intéressé ayant été invité à fournir ses explications.'),
    ...article(9, 'Ressources', 'Les ressources de l’association comprennent : les cotisations, les subventions publiques, les dons manuels, les recettes des partenariats et des manifestations, et toute ressource autorisée par la loi.'),
    ...article(10, 'Assemblée générale ordinaire', `Elle comprend tous les membres de l’association et se réunit au moins une fois par an. Les membres sont convoqués au moins 15 jours à l’avance ; l’ordre du jour figure sur la convocation. Le président présente le rapport moral ; le trésorier rend compte de la gestion et soumet les comptes de l’exercice à l’approbation de l’assemblée. Les décisions sont prises à la majorité des voix des membres présents ou représentés. Chaque membre de ${BLANC} ans ou plus dispose d’une voix.`),
    ...article(11, 'Assemblée générale extraordinaire', 'Elle est convoquée par le président ou à la demande de la moitié des membres, pour modifier les statuts ou dissoudre l’association. Les décisions sont prises à la majorité des deux tiers des membres présents ou représentés.'),
    ...article(12, 'Bureau', `L’association est dirigée par un bureau élu pour ${BLANC} ans par l’assemblée générale, composé d’un président, d’un trésorier et d’un secrétaire. Les fonctions sont bénévoles ; seuls les frais engagés pour l’association sont remboursés, sur justificatifs.`),
    ...article(13, 'Rôle des membres du bureau', 'Le président représente l’association dans tous les actes de la vie civile et en justice. Le trésorier tient les comptes et les présente à l’assemblée générale. Le secrétaire tient les procès-verbaux et effectue les déclarations au greffe.'),
    ...article(14, 'Protection des mineurs', 'L’association désigne un référent chargé de la prévention des violences et de la protection des mineurs. Une charte, signée par chaque membre du staff, encadre les échanges avec les joueurs mineurs.'),
    ...article(15, 'Règlement intérieur', 'Un règlement intérieur peut être établi par le bureau, puis approuvé par l’assemblée générale, pour préciser le fonctionnement de l’association.'),
    ...article(16, 'Dissolution', 'En cas de dissolution, un ou plusieurs liquidateurs sont nommés par l’assemblée générale extraordinaire, et l’actif net est attribué à une association poursuivant un but similaire, conformément à l’article 9 de la loi du 1er juillet 1901.'),
    { t: 'p', texte: `Statuts adoptés en assemblée constitutive le ${BLANC}, à ${BLANC}.` },
    { t: 'signatures', qui: ['Le président ou la présidente', 'Le trésorier ou la trésorière'] },
    { t: 'note', texte: 'Signés par au moins deux dirigeants (nom, prénom, fonction). Aucune date de naissance sur les documents déposés.' },
  ];
}
