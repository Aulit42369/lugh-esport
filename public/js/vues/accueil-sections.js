// Sections de l'accueil d'un jeu : annonces de la structure, premiers pas, méta à vérifier, quoi de neuf,
// prochain match et prochain tournoi, absences d'une séance. metaAVerifier sert aussi à la page Méta.

import { h, bouton, vider, toast, messageErreur } from '../ui.js';
import { icone } from '../icones.js';
import { api } from '../api.js';
import * as E from '../etat.js';
import * as J from '../jeu.js';
import { visible } from '../navigation.js';
import { puce, nomMap, nomPersonnage } from '../composants/jetons.js';
import { quoiDeNeuf } from '/shared/suivi.js';
import { tournoisAVenir, libelleStatutTournoi } from '/shared/organisation.js';
import { aujourdhui, formatDate, formatDateCourte, formatHorodatage, ilYA, minutes } from '/shared/temps.js';

// ——— Annonces de la structure : chargées une fois par minute, non lues d'abord, les lues repliées ———

const annoncesParJeu = new Map();
const FRAICHEUR_ANNONCES_MS = 60_000;

function zonesAnnonces(jeu) {
  return document.querySelectorAll(`.annonces-zone[data-jeu="${jeu}"]`);
}

function carteAnnonce(a, jeu) {
  const lire = !a.lu ? bouton('J’ai lu', {
    classe: 'btn--petit annonce__lu',
    onclick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        await api('POST', `/api/annonces/${encodeURIComponent(a._id)}/lu`);
        a.lu = true;
        for (const z of zonesAnnonces(jeu)) peindreAnnonces(z, annoncesParJeu.get(jeu)?.annonces || []);
      } catch (err) {
        b.disabled = false;
        toast(messageErreur(err), { type: 'erreur' });
      }
    },
  }) : null;
  return h('article', { class: ['annonce', a.importante && 'annonce--importante', a.lu && 'annonce--lue'] },
    icone('annonce', { classe: 'annonce__icone' }),
    h('div', { class: 'annonce__corps' },
      h('div', { class: 'annonce__titre' }, a.importante ? puce('Important', 'accent') : null, h('strong', {}, a.titre)),
      a.texte ? h('p', { class: 'texte-multi petit' }, a.texte) : null,
      h('p', { class: 'texte-3 tres-petit' }, [`Par ${a.auteur || 'la structure'}, ${ilYA(a.creeLe)}`, a.expireLe ? `, jusqu’au ${formatDateCourte(a.expireLe)}` : '', '.'].join(''))),
    lire);
}

function peindreAnnonces(zone, annonces) {
  vider(zone);
  const nonLues = annonces.filter((a) => !a.lu);
  const lues = annonces.filter((a) => a.lu);
  if (!annonces.length) return;
  const jeu = zone.dataset.jeu;
  if (nonLues.length) zone.append(h('div', { class: 'annonces__liste' }, nonLues.map((a) => carteAnnonce(a, jeu))));
  if (lues.length) {
    zone.append(h('details', { class: 'annonces__lues' },
      h('summary', {}, `Annonces lues (${lues.length})`),
      h('div', { class: 'annonces__liste' }, lues.map((a) => carteAnnonce(a, jeu)))));
  }
}

export function bandeauAnnonces() {
  const jeu = E.jeu()?.id || '';
  const zone = h('section', { class: 'annonces-zone', dataset: { jeu }, 'aria-label': 'Annonces de la structure' });
  const connu = annoncesParJeu.get(jeu);
  if (connu?.annonces) peindreAnnonces(zone, connu.annonces);
  if (!connu || (!connu.enCours && Date.now() - connu.le > FRAICHEUR_ANNONCES_MS)) {
    const entree = { le: Date.now(), annonces: connu?.annonces ?? null, enCours: true };
    annoncesParJeu.set(jeu, entree);
    api('GET', `/api/annonces?jeu=${encodeURIComponent(jeu)}`)
      .then((r) => {
        entree.annonces = Array.isArray(r?.annonces) ? r.annonces : [];
        for (const z of zonesAnnonces(jeu)) peindreAnnonces(z, entree.annonces);
      })
      .catch(() => {
        entree.annonces ??= [];
      })
      .finally(() => {
        entree.enCours = false;
        entree.le = Date.now();
      });
  }
  return zone;
}

// Lien enregistré relatif au jeu (« #/maps/bind », alertes et suggestions) : complété avec le jeu affiché.
export function lienJeu(lien) {
  const jeu = E.jeu()?.id || '';
  if (!lien) return J.lien('');
  return lien === `#/${jeu}` || lien.startsWith(`#/${jeu}/`) ? lien : J.lien(lien);
}

const CLE_MASQUE = 'lugh-premiers-pas-masques';
const cleMasque = () => `${CLE_MASQUE}-${E.jeu()?.id || ''}`;

function lireMasque() {
  try {
    return localStorage.getItem(cleMasque()) === '1';
  } catch {
    return false;
  }
}

// Liste de démarrage d'un jeu : chaque jeu a la sienne (nom, effectif, comptes, paliers, semaine type, maps).
export function premiersPas(ctx) {
  if (!(E.peut('comptes.gerer') || E.peut('equipe.profil')) || lireMasque()) return null;
  const def = J.def();
  const eq = E.equipe();
  const effectif = def.equipe.titulaires;
  const titulaires = E.joueurs().filter((j) => j.statut === 'titulaire');
  const nommes = titulaires.filter((t) => t.pseudo);
  const avecRoles = J.roles().length > 0;
  const comptes = E.comptesDuJeu().filter((c) => c.actif !== false);
  const relies = nommes.filter((t) => comptes.some((c) => c.membreId === t._id));
  const modele = E.doc('planning', 'modele');
  const pool = E.meta()?.mapPool || [];
  const gestion = visible('gestion') ? J.lien('/gestion') : null;
  const etapes = [
    { fait: !!(eq.nom && eq.tag), texte: 'Donner un nom et un tag à l’équipe', lien: J.lien('/roster') },
    {
      fait: nommes.length >= effectif && (!avecRoles || nommes.every((t) => t.roleJeu)),
      texte: `Renseigner les ${effectif} titulaires${avecRoles ? ' et leur rôle' : ''}`,
      detail: `${Math.min(nommes.length, effectif)} sur ${effectif}`,
      lien: J.lien('/roster'),
    },
    {
      fait: nommes.length > 0 && relies.length === nommes.length,
      texte: `Créer un compte ${def.nom} pour chaque titulaire`,
      detail: nommes.length ? `${relies.length} sur ${nommes.length} relié${relies.length > 1 ? 's' : ''}` : '',
      lien: gestion,
      sansLien: 'à faire par le Responsable du jeu',
    },
    { fait: titulaires.length > 0 && titulaires.every((t) => E.palierDe(t._id)), texte: 'Fixer le palier de chaque titulaire', lien: J.lien('/progression') },
    { fait: !!modele?.maj?.par && modele.maj.par !== 'systeme', texte: 'Adapter la semaine type à vos créneaux', lien: J.lien('/planning/modele') },
    J.aPool() ? {
      fait: pool.length > 0 && pool.every((id) => { const m = E.doc('mapsEquipe', id); return m?.maj?.par && m.maj.par !== 'systeme'; }),
      texte: `Fixer le statut de chaque ${J.v('carte')} du pool`,
      lien: J.lien('/maps'),
    } : null,
  ].filter(Boolean);
  const faites = etapes.filter((e) => e.fait).length;
  if (faites === etapes.length) return null;
  const ligne = (e) => {
    const detail = e.detail && !e.fait ? h('span', { class: 'premiers-pas__detail' }, e.detail) : null;
    if (e.fait) return h('li', { class: 'premiers-pas__fait' }, icone('ok'), h('span', {}, e.texte));
    return h('li', {}, h('span', { class: 'premiers-pas__puce' }),
      e.lien ? h('a', { href: e.lien }, e.texte) : h('span', {}, e.texte, h('span', { class: 'texte-3' }, ` (${e.sansLien})`)),
      detail);
  };
  return h('section', { class: 'section fiche premiers-pas' },
    h('div', { class: 'fiche__titre' },
      h('h2', {}, 'Premiers pas'),
      h('span', { class: 'fiche__meta' }, `${faites} sur ${etapes.length}`)),
    h('ol', { class: 'premiers-pas__liste' }, etapes.map(ligne)),
    h('div', { class: 'rangee rangee--espace' },
      E.peut('reglages.gerer') && gestion
        ? h('span', { class: 'texte-3 tres-petit' }, 'Notifications Discord (facultatif) : ', h('a', { href: gestion }, 'Gestion du jeu'), '.')
        : h('span', {}),
      bouton('Masquer sur cet appareil', {
        classe: 'btn--discret btn--petit',
        onclick: () => {
          try {
            localStorage.setItem(cleMasque(), '1');
          } catch {
            // ignoré : la liste réapparaîtra à la prochaine visite
          }
          ctx.rafraichir();
        },
      })));
}

// Dernier créneau de vérification de la méta (lundi ou jeudi 7 h 45) passé à cet instant.
export function dernierCreneau(maintenant = new Date()) {
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(maintenant);
    d.setDate(d.getDate() - i);
    d.setHours(7, 45, 0, 0);
    if ([1, 4].includes(d.getDay()) && d <= maintenant) return d;
  }
  return null;
}

// Vérification automatique : clé API sur le serveur ET activée dans les Réglages du jeu.
export const metaAutomatique = () => !!E.serveur()?.metaAuto && J.def()?.meta?.auto !== false;

// Méta tenue à la main : un créneau du lundi ou du jeudi 7 h 45 est passé depuis la dernière vérification.
export function metaAVerifier(meta = E.meta()) {
  if (!meta || metaAutomatique()) return false;
  const creneau = dernierCreneau();
  return !!creneau && (!meta.derniereVerif || new Date(meta.derniereVerif) < creneau);
}

export function alerteMeta() {
  if (!E.peut('meta.actualiser') || !metaAVerifier()) return null;
  return h('a', { href: J.lien('/meta'), class: 'alerte alerte--attention' }, icone('meta'),
    h('span', {}, `Méta ${J.def().nom} à vérifier : nouveau créneau du lundi ou du jeudi, mise à jour manuelle en deux copier-coller.`), icone('droite'));
}

const QUOI_DE_NEUF_VISIBLES = 5;

export function quoiDeNeufSection() {
  const depuis = E.depuisVisite();
  const items = quoiDeNeuf({
    depuis,
    moi: E.compte()?._id,
    monMembreId: E.monMembreId(),
    liste: E.liste,
    nomMap,
    nomMembre: (id) => E.nomMembre(E.doc('membres', id)),
    semaineCourante: E.serveur()?.semaine,
  });
  if (!items.length) return null;
  const ligne = (i) => h('a', { href: lienJeu(i.lien), class: 'alerte alerte--info' }, icone('info'), h('span', {}, i.texte), icone('droite'));
  const reste = items.slice(QUOI_DE_NEUF_VISIBLES);
  return h('section', { class: 'section' },
    h('div', { class: 'section__entete' }, h('h2', {}, 'Depuis ta dernière visite'), h('span', { class: 'section__aide' }, formatHorodatage(depuis))),
    h('div', { class: 'pile-s' }, items.slice(0, QUOI_DE_NEUF_VISIBLES).map(ligne),
      reste.length ? h('details', { class: 'plus-de-nouvelles' },
        h('summary', { class: 'petit' }, `${reste.length} autre${reste.length > 1 ? 's' : ''} nouveauté${reste.length > 1 ? 's' : ''}`),
        h('div', { class: 'pile-s' }, reste.map(ligne))) : null));
}

// Points forts de l'adversaire : des maps (veto de maps, ou jeu à maps sans veto), des personnages (draft).
function fortesAdversaire(a) {
  if (!a.fortes?.length) return null;
  if (J.typeVeto() === 'draft' && J.aPersonnages()) return `Leurs ${J.v('personnages')} forts : ${a.fortes.map(nomPersonnage).join(', ')}.`;
  if (J.aCartes()) return `Leurs ${J.v('cartes')} fortes : ${a.fortes.map(nomMap).join(', ')}.`;
  return null;
}

// Matchs à venir (aujourd'hui compris), du plus proche au plus lointain.
export function matchsAVenir(auj = aujourdhui()) {
  const cle = (x) => `${x.prochainMatch.date}${x.prochainMatch.heure || ''}`;
  return E.liste('adversaires').filter((x) => x.prochainMatch?.date && x.prochainMatch.date >= auj).sort((x, y) => cle(x).localeCompare(cle(y)));
}

// Prochain tournoi : inscription à boucler, ou date et statut.
function ligneTournoi(t, auj) {
  const inscription = t.statut === 'envisage' && t.dateLimite && t.dateLimite >= auj;
  return h('a', { href: J.lien('/tournois'), class: 'prochain-tournoi' },
    icone('tournois'),
    h('span', {},
      h('span', { class: 'texte-3' }, 'Prochain tournoi : '),
      h('strong', {}, t.nom),
      inscription ? `, inscription avant le ${formatDateCourte(t.dateLimite)}` : `, ${t.debut ? `le ${formatDate(t.debut)}` : 'date à fixer'}`),
    puce(libelleStatutTournoi(t.statut), t.statut === 'inscrit' || t.statut === 'encours' ? 'positif' : 'attention'));
}

export function prochainMatch() {
  const auj = aujourdhui();
  const a = matchsAVenir(auj)[0] || null;
  const t = tournoisAVenir(E.liste('tournois'), auj)[0] || null;
  if (!a && !t) return null;
  if (!a) {
    return h('section', { class: 'fiche' },
      h('div', { class: 'fiche__titre' }, h('h2', {}, 'Prochain tournoi'), h('a', { href: J.lien('/tournois'), class: 'petit' }, 'Tournois')),
      ligneTournoi(t, auj));
  }
  const m = a.prochainMatch;
  const points = J.checklist();
  const faits = points.filter((c) => a.checklist?.[c.id]).length;
  const serie = J.typeScore() !== 'classement' && m.format ? J.nomFormat(m.format) : '';
  const fortes = fortesAdversaire(a);
  const aujourdhuiMeme = m.date === auj;
  return h('section', { class: 'fiche' },
    h('div', { class: 'fiche__titre' }, h('h2', {}, 'Prochain match'), h('a', { href: J.lien(`/adversaires/${a._id}`), class: 'petit' }, 'Préparation')),
    h('div', { class: 'rangee' }, h('span', { class: 'chiffre chiffre--l' }, a.nom), serie ? puce(serie, 'plein') : null),
    h('p', { class: 'texte-2 petit' }, `${aujourdhuiMeme ? 'Aujourd’hui' : formatDate(m.date)}${m.heure ? ` à ${m.heure}` : ''}.${points.length ? ` Préparation : ${faits} sur ${points.length}.` : ''}`),
    fortes ? h('p', { class: 'texte-3 petit' }, fortes) : null,
    h('a', { href: J.lien(`/match/${a._id}`), class: ['btn', 'btn--petit', 'prochain-match__jour', aujourdhuiMeme && 'btn--principal'] }, icone('match'), aujourdhuiMeme ? 'Ouvrir le jour de match' : 'Jour de match'),
    t ? ligneTournoi(t, auj) : null);
}

// Absences déclarées pour une séance précise (date ISO + horaires du bloc).
export function absencesSeance(iso, bloc) {
  return E.liste('absences').filter((a) => a.date === iso
    && (!a.debut || !a.fin || (minutes(a.debut) < minutes(bloc.fin) && minutes(a.fin) > minutes(bloc.debut))));
}
