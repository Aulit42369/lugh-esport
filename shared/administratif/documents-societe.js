// Documents types du passage en société : procès-verbal de l'assemblée générale qui décide la création de la société,
// et convention entre l'association et la société. Modèles à relire avec le comptable, pas des actes de juriste.

const BLANC = '……………………………………';
const asso = (id) => id.nom || 'l’association';
const societe = (id) => (id.societeNom ? `${id.societeNom} (${id.societeForme || 'SAS'})` : `la société ${BLANC} (SAS)`);

export function pvCreationSociete(id) {
  return [
    { t: 'titre', texte: `Procès-verbal de l’assemblée générale de ${asso(id)}` },
    { t: 'p', texte: `Le ${BLANC}, à ${BLANC}, les membres de l’association ${asso(id)}${id.rna ? ` (RNA ${id.rna})` : ''} se sont réunis en assemblée générale ${BLANC} (ordinaire ou extraordinaire, selon les statuts), sur convocation du ${BLANC}.` },
    { t: 'p', texte: `Membres présents ou représentés : ${BLANC} sur ${BLANC}. Le quorum prévu par les statuts est atteint. Présidence de séance : ${BLANC}. Secrétariat de séance : ${BLANC}.` },
    { t: 'sous', texte: 'Ordre du jour' },
    { t: 'liste', items: [
      'Présentation du projet de société (SAS) et de ce qu’elle reprendrait.',
      'Décision de participer ou non à la création de la société.',
      'Contrats, sponsors et joueurs transférés à la société.',
      'Convention entre l’association et la société.',
      'Avenir de l’association (maintenue à côté de la société, ou dissolution).',
    ] },
    { t: 'sous', texte: 'Décisions' },
    { t: 'p', texte: `1. L’assemblée approuve la création de ${societe(id)}, qui portera ${BLANC} (par exemple : l’équipe professionnelle, les contrats de sponsoring, les joueurs salariés). Adopté à ${BLANC} voix pour, ${BLANC} contre, ${BLANC} abstentions.` },
    { t: 'p', texte: `2. L’association ${BLANC} (participe / ne participe pas) au capital de la société, pour un montant de ${BLANC} €.` },
    { t: 'p', texte: `3. Sont transférés à la société, avec l’accord de chaque partenaire et contre un prix fixé à leur valeur estimée (jamais gratuitement) : ${BLANC}, pour ${BLANC} €.` },
    { t: 'p', texte: `4. Le bureau est autorisé à signer une convention avec la société, sur la base du modèle présenté. Adopté à ${BLANC} voix pour, ${BLANC} contre, ${BLANC} abstentions.` },
    { t: 'p', texte: `5. L’association ${BLANC} (poursuit ses activités : communauté, équipes amateurs… / est dissoute dans les conditions prévues par ses statuts, à l’ordre du jour d’une assemblée générale extraordinaire).` },
    { t: 'p', texte: `L’ordre du jour étant épuisé, la séance est levée à ${BLANC}.` },
    { t: 'signatures', qui: ['Le président ou la présidente de séance', 'Le ou la secrétaire de séance'] },
    { t: 'note', texte: 'Un dirigeant de l’association qui devient associé ou président de la société ne prend pas part au vote sur la convention : il a un intérêt personnel à la décision.' },
  ];
}

export function conventionAssoSociete(id) {
  return [
    { t: 'titre', texte: 'Convention entre l’association et la société' },
    { t: 'p', texte: `Entre l’association ${asso(id)}${id.rna ? `, RNA ${id.rna}` : ''}, représentée par ${BLANC}, d’une part,` },
    { t: 'p', texte: `et ${societe(id)}${id.siren ? `, SIREN ${id.siren}` : ''}, représentée par ${BLANC}, d’autre part,` },
    { t: 'p', texte: 'il est convenu ce qui suit.' },
    { t: 'sous', texte: '1. Objet' },
    { t: 'p', texte: `La présente convention règle les relations entre l’association, qui garde ${BLANC} (par exemple : la communauté, les équipes amateurs, les événements locaux), et la société, qui porte ${BLANC} (par exemple : l’équipe professionnelle, les contrats de sponsoring).` },
    { t: 'sous', texte: '2. Nom et logo' },
    { t: 'p', texte: `Le nom et le logo appartiennent à ${BLANC} (titulaire de la marque déposée à l’INPI sous le n° ${BLANC}, ou à défaut de dépôt). Chaque partie les utilise dans les conditions de la licence que lui consent leur titulaire. Une licence consentie à l’association est gratuite.` },
    { t: 'sous', texte: '3. Prestations entre les parties' },
    { t: 'p', texte: 'Chaque service rendu par l’une des parties à l’autre (mise à disposition de joueurs ou de bénévoles, d’outils, d’un local, organisation d’un événement) est décrit ci-dessous et facturé à son prix normal. Aucune somme ne transite sans service réel correspondant.' },
    { t: 'champ', libelle: 'Prestations et prix' },
    { t: 'sous', texte: '4. Sponsors et partenaires' },
    { t: 'p', texte: `Les partenariats sont répartis ainsi : ${BLANC}. Un partenaire qui soutient les deux structures signe un contrat avec chacune.` },
    { t: 'sous', texte: '5. Indépendance de l’association' },
    { t: 'p', texte: 'L’association garde ses propres organes, ses propres comptes et sa gestion désintéressée. Elle ne verse à la société ni à ses associés aucune part de ses ressources en dehors des prestations prévues à l’article 3.' },
    { t: 'sous', texte: '6. Durée' },
    { t: 'p', texte: `Conclue pour ${BLANC} à compter du ${BLANC}, renouvelable par accord écrit. Chaque partie peut y mettre fin avec un préavis de ${BLANC} mois.` },
    { t: 'signatures', qui: ['Pour l’association', 'Pour la société'], lieuDate: true },
    { t: 'note', texte: 'Approuvée au préalable par l’assemblée générale ou le bureau de l’association, selon ses statuts. À relire avec le comptable avant signature.' },
  ];
}
