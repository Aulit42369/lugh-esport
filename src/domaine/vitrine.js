// Vitrine publique (page d'accueil du site, sans connexion) : ce qui est montré, et RIEN d'autre.
// Liste blanche champ par champ : nom public, présentation, lien « Postuler », jeux actifs, et pour chaque jeu
// le profil public de l'équipe, les membres qui ont CHOISI d'apparaître (pseudo, rôle, photo), les places ouvertes
// au recrutement et les résultats de tournois terminés. Jamais : identifiant de connexion, nom affiché, identifiant
// en jeu, Discord, notes, disponibilités, objectifs, autorisations.

import { nomPublic } from '../../shared/administratif/identite.js';
import { trouverDans } from '../../shared/jeux/definition.js';
import { libelle, FONCTIONS_STAFF, STATUTS_MEMBRE } from '../../shared/referentiel.js';

const ORDRE_STATUT = { titulaire: 0, remplacant: 1, essai: 2, actif: 3 };
const RESULTATS_MAX = 6;

// Un compte apparaît s'il est actif et a coché « Apparaître sur la vitrine publique ».
export const consent = (c) => !!c && c.actif !== false && c.vitrine?.visible === true;

// Photo publiée seulement si le joueur l'a mise, et, pour un mineur, avec le droit à l'image enregistré.
function photoPubliable(c, autorisation) {
  if (!c.vitrine?.photo) return null;
  if (autorisation?.mineur && !autorisation.image) return null;
  return `/api/public/photo/${c.vitrine.photo}`;
}

export async function construireVitrine({ global, registre, identite }) {
  const comptes = (await global.lister('comptes')).filter(consent);
  const autorisations = await global.lister('autorisations');
  const jeux = [];
  for (const doc of registre.liste()) {
    if (doc.actif === false) continue;
    const espace = registre.obtenir(doc._id);
    if (!espace) continue;
    const def = espace.definition();
    const equipe = (await espace.stockage.lire('equipe', 'profil')) || {};
    const membres = new Map((await espace.stockage.lister('membres')).map((m) => [m._id, m]));
    const presents = [];
    for (const c of comptes) {
      const m = membres.get(c.acces?.[doc._id]?.membreId);
      if (!m || !m.pseudo || m.statut === 'ancien' || m.vitrineMasque) continue;
      const auto = autorisations.find((a) => a.jeu === doc._id && a.membreId === m._id);
      const joueur = m.type === 'joueur';
      presents.push({
        pseudo: m.pseudo,
        type: joueur ? 'joueur' : 'staff',
        role: joueur ? (trouverDans(def.roles, m.roleJeu)?.nom || '') : libelle(FONCTIONS_STAFF, m.fonction, 'Staff'),
        statut: libelle(STATUTS_MEMBRE, m.statut, ''),
        photo: photoPubliable(c, auto),
        ordre: ORDRE_STATUT[m.statut] ?? 9,
      });
    }
    presents.sort((a, b) => a.ordre - b.ordre || a.pseudo.localeCompare(b.pseudo, 'fr'));
    const resultats = (await espace.stockage.lister('tournois'))
      .filter((t) => t.statut === 'termine' && (t.place || t.resultat))
      .sort((a, b) => String(b.fin || b.debut || '').localeCompare(String(a.fin || a.debut || '')))
      .slice(0, RESULTATS_MAX)
      .map((t) => ({ nom: t.nom, date: t.fin || t.debut || '', place: t.place || null, resultat: t.resultat || '' }));
    jeux.push({
      id: doc._id,
      nom: doc.nom,
      court: doc.court || '',
      couleur: doc.couleur || '',
      equipe: { nom: equipe.nom || '', tag: equipe.tag || '', devise: equipe.devise || '', circuit: equipe.circuit || '' },
      membres: presents.map(({ ordre, ...p }) => p),
      places: Number.isInteger(equipe.placesRecrutement) ? equipe.placesRecrutement : 0,
      // Rôles recherchés : seulement quand le jeu recrute.
      recherche: equipe.placesRecrutement > 0 ? String(equipe.rolesRecherches || '') : '',
      resultats,
    });
  }
  return {
    structure: { nom: nomPublic(identite), presentation: identite.presentation || '', postuler: identite.postuler || identite.contact || '' },
    jeux,
  };
}

// Clés des photos actuellement publiées : une photo retirée, masquée ou non consentie n'est plus servie.
export function photosPubliees(vitrine) {
  return new Set(vitrine.jeux.flatMap((j) => j.membres.map((m) => m.photo).filter(Boolean)));
}
