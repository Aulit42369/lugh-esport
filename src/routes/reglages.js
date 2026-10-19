// Réglages et maintenance d'un jeu (/api/e/:jeu/…) : Réglages du jeu, notifications Discord, méta (consigne et
// import manuel), sauvegarde et restauration, journal et état du jeu.

import { envoyerJson, erreurs, ErreurHttp } from '../http/outils.js';
import { exigerConnexion, exigerEspace, exigerPerm } from '../auth/acces.js';
import { champsMetier } from '../domaine/depot.js';
import { sauvegardeDuJeu, restaurer, lirePoint, annulerDerniereRestauration } from '../domaine/restauration.js';
import { completerModele } from '../../shared/jeux/commun.js';
import { definitionEffective } from '../../shared/jeux/definition.js';
import { validerReglagesJeu, reglagesVides } from '../../shared/jeux/reglages-jeu.js';
import { estCouleurJeu } from '../../shared/couleurs.js';

const LIMITE_SAUVEGARDE = 15 * 1024 * 1024;

// Ce qui décide de la forme des scrims enregistrés : le type de score et, en manches, la longueur d'une mi-temps.
// Le barème de points ou la taille d'un lobby peuvent changer à tout moment.
function resumeScore(score) {
  return `${score?.type || ''}:${score?.type === 'manches' ? score.miTemps : ''}`;
}

export function routesReglages(routeur, s) {
  const espace = [exigerConnexion(s), exigerEspace(s)];

  // ——— Réglages du jeu (personnalisation du modèle) ———

  routeur.get('/api/e/:jeu/reglages-jeu', ...espace, exigerPerm('jeu.regler'), async (r) => {
    const e = r.espace;
    const doc = await e.stockage.lire('jeu', 'reglages');
    const { initiale, ...modele } = completerModele(e.modele);
    envoyerJson(r.res, 200, {
      modele,
      reglages: doc ? champsMetier(doc) : reglagesVides(),
      rev: doc?.rev ?? 0,
      nom: e.doc.nom,
      court: e.doc.court,
      couleur: e.doc.couleur || '',
      scrims: await e.stockage.compter('scrims'),
    });
  });

  routeur.put('/api/e/:jeu/reglages-jeu', ...espace, exigerPerm('jeu.regler'), async (r) => {
    const e = r.espace;
    const corps = await r.corps(512 * 1024);
    const v = validerReglagesJeu(e.modele, corps.valeur);
    if (!v.ok) throw erreurs.invalide(v.erreurs);
    const futur = definitionEffective(e.modele, v.valeur, { id: e.id, nom: e.doc.nom, court: e.doc.court, couleur: e.doc.couleur });
    if (resumeScore(futur.score) !== resumeScore(e.def.score) && (await e.stockage.compter('scrims'))) {
      throw erreurs.conflit('Le type de score (et la longueur d’une mi-temps) ne change plus une fois des scrims enregistrés.');
    }
    const nom = typeof corps.nom === 'string' ? corps.nom.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
    const court = typeof corps.court === 'string' ? corps.court.trim().slice(0, 12) : '';
    if (corps.couleur !== undefined && !estCouleurJeu(corps.couleur)) throw erreurs.invalide([{ chemin: 'couleur', message: 'couleur inconnue' }]);
    const couleur = corps.couleur || e.doc.couleur;
    // Les réglages d'abord (contrôle de revBase : 409 si quelqu'un a modifié entre-temps), le nom ensuite.
    const revBase = Number.isInteger(corps.revBase) && corps.revBase >= 0 ? corps.revBase : null;
    const doc = await e.depot.enregistrer('jeu', 'reglages', v.valeur, r.compte, { revBase });
    if ((nom && nom !== e.doc.nom) || (court && court !== e.doc.court) || couleur !== e.doc.couleur) {
      await s.registre.modifier(e.id, { nom: nom || e.doc.nom, court: court || e.doc.court, couleur });
    }
    await e.rechargerDefinition();
    await e.depot.journaliser(r.compte, 'réglages du jeu modifiés');
    envoyerJson(r.res, 200, { doc, definition: e.def });
  });

  // ——— Notifications Discord (un webhook par jeu) ———

  routeur.get('/api/e/:jeu/reglages', ...espace, exigerPerm('reglages.gerer'), async (r) => {
    envoyerJson(r.res, 200, { discord: await r.espace.notifications.reglagesPublics() });
  });

  routeur.put('/api/e/:jeu/reglages/discord', ...espace, exigerPerm('reglages.gerer'), async (r) => {
    const { webhook = '', supprimer = false, evenements = {} } = await r.corps();
    if (typeof webhook !== 'string' || typeof evenements !== 'object' || evenements === null) throw erreurs.requete();
    try {
      const discord = await r.espace.notifications.enregistrer({ webhook: webhook.trim(), supprimer: !!supprimer, evenements });
      await r.espace.depot.journaliser(r.compte, 'réglages Discord modifiés');
      envoyerJson(r.res, 200, { discord });
    } catch (e) {
      throw new ErreurHttp(400, 'webhook', e.message);
    }
  });

  routeur.post('/api/e/:jeu/discord/test', ...espace, exigerPerm('reglages.gerer'), async (r) => {
    try {
      await r.espace.notifications.tester(r.compte);
    } catch (e) {
      throw new ErreurHttp(502, 'discord', `Envoi impossible : ${e.message}`);
    }
    envoyerJson(r.res, 200, { ok: true });
  });

  // ——— Méta sans clé API : copier la consigne dans une conversation avec Claude, puis coller la réponse ———

  routeur.get('/api/e/:jeu/meta/consigne', ...espace, exigerPerm('meta.actualiser'), async (r) => {
    envoyerJson(r.res, 200, { texte: await r.espace.actualisation.consigneManuelle() });
  });

  routeur.post('/api/e/:jeu/meta/importer', ...espace, exigerPerm('meta.actualiser'), async (r) => {
    const corps = await r.corps(1024 * 1024);
    if (typeof corps.texte !== 'string' || !corps.texte.trim()) throw erreurs.requete('Colle la réponse complète de Claude.');
    try {
      const resultat = await r.espace.actualisation.importer(corps.texte, r.compte);
      envoyerJson(r.res, 200, { ok: true, vide: resultat.diff.vide });
    } catch (e) {
      throw new ErreurHttp(400, 'meta_refusee', `Méta refusée : ${e.message}`);
    }
  });

  // ——— État, journal, sauvegarde ———

  routeur.get('/api/e/:jeu/etat', ...espace, exigerPerm('comptes.gerer'), async (r) => {
    const e = r.espace;
    const meta = await e.stockage.lire('meta', 'courante');
    envoyerJson(r.res, 200, {
      version: s.config.version,
      stockage: s.fabrique.type,
      cleClaude: !!s.config.claude.cle,
      modele: s.config.claude.modele,
      metaAuto: e.def.meta.auto,
      actualisationEnCours: e.actualisation.enCours,
      meta: meta ? { patch: meta.patch, derniereVerif: meta.derniereVerif || '', statut: meta.statut || '', declencheur: meta.declencheur || '', erreur: meta.erreur || '' } : null,
      discord: (await e.notifications.reglagesPublics()).configure,
      couts: meta?.couts || {},
    });
  });

  routeur.get('/api/e/:jeu/journal', ...espace, exigerPerm('comptes.gerer'), async (r) => {
    envoyerJson(r.res, 200, { entrees: await s.historique.lister({ jeu: r.espace.id }) });
  });

  routeur.get('/api/e/:jeu/export', ...espace, exigerPerm('donnees.exporter'), async (r) => {
    const e = r.espace;
    const sauvegarde = await sauvegardeDuJeu(s, e);
    const corps = JSON.stringify(sauvegarde, null, 2);
    await e.depot.journaliser(r.compte, 'export des données');
    r.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sauvegarde.format}-${e.id}-sauvegarde-${sauvegarde.exporteLe.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(corps),
    });
    r.res.end(corps);
  });

  // Restauration d'une sauvegarde de ce jeu ; l'état actuel est gardé comme point de restauration.
  routeur.post('/api/e/:jeu/restaurer', ...espace, exigerPerm('donnees.exporter'), async (r) => {
    const e = r.espace;
    const sauvegarde = await r.corps(LIMITE_SAUVEGARDE);
    const bilan = await restaurer(s, e, sauvegarde, r.compte);
    await e.depot.journaliser(r.compte, 'sauvegarde restaurée', sauvegarde.exporteLe || '', `${bilan.restaures} fiches, ${bilan.ignores} ignorées`);
    envoyerJson(r.res, 200, { ...bilan, point: await lirePoint(s, e) });
  });

  // Point de restauration : l'état du jeu juste avant la dernière restauration.
  routeur.get('/api/e/:jeu/restauration', ...espace, exigerPerm('donnees.exporter'), async (r) => {
    envoyerJson(r.res, 200, { point: await lirePoint(s, r.espace) });
  });

  routeur.post('/api/e/:jeu/restauration/annuler', ...espace, exigerPerm('donnees.exporter'), async (r) => {
    const e = r.espace;
    const bilan = await annulerDerniereRestauration(s, e, r.compte);
    await e.depot.journaliser(r.compte, 'restauration annulée', '', `${bilan.restaures} fiches remises`);
    envoyerJson(r.res, 200, { ...bilan, point: await lirePoint(s, e) });
  });
}
