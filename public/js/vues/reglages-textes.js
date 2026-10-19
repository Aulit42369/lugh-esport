// Réglages du jeu, sections de textes : objectifs (texte et critère, par palier), routines par palier,
// profil public d'un joueur, méta (sources, consigne, vérification automatique).

import { h, bouton, saisie, champ, lienExterne } from '../ui.js';
import { puce } from '../composants/jetons.js';
import { PALIERS_BASE, domaineSource } from '/shared/jeux/commun.js';
import { urlProfil } from '/shared/jeux/definition.js';
import { section, texteReglage, nombreReglage, caseReglage } from './reglages-outils.js';
import { listeEffective } from './reglages-listes.js';

const propre = (t) => String(t || '').replace(/\s+/g, ' ').trim();

// ——— 6. Objectifs ———

export function sectionObjectifs(S, numero) {
  const tous = () => [...S.modele.objectifs, ...S.modele.collectifs];
  const reecrits = () => Object.keys(S.reglages.objectifs).length;
  return section(S, {
    cle: 'objectifs',
    numero,
    titre: 'Objectifs',
    intro: 'Le texte et le critère de réussite de chaque objectif, du débutant complet à l’expert. Seuls les objectifs réécrits sont enregistrés ; un champ vidé reprend le texte du modèle. Les identifiants ne changent pas : la progression des joueurs y reste rattachée.',
    resume: () => (reecrits() ? `${reecrits()} réécrit${reecrits() > 1 ? 's' : ''} sur ${tous().length}` : `${tous().length} objectifs du modèle`),
    personnalise: () => reecrits() > 0,
    revenir: () => { S.reglages.objectifs = {}; },
    corps: () => h('div', { class: 'rgl-paliers', dataset: { chemin: 'objectifs', libelle: 'Objectifs' } },
      PALIERS_BASE.map((p) => palierObjectifs(S, p, tous().filter((o) => o.palier === p.n)))),
  });
}

function palierObjectifs(S, p, objectifs) {
  const compte = h('span', { class: 'rgl-liste__compte' });
  const majCompte = () => {
    const n = objectifs.filter((o) => S.reglages.objectifs[o.id]).length;
    compte.textContent = `${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''}${n ? `, ${n} réécrit${n > 1 ? 's' : ''}` : ''}`;
  };
  majCompte();
  const domaines = listeEffective(S, 'domaines');
  const connus = [...domaines.map((d) => ({ id: d.id, nom: d.nom })), { id: 'coll', nom: 'Objectifs d’équipe' }];
  const autres = objectifs.filter((o) => !connus.some((g) => g.id === o.domaine));
  const groupes = [...connus.map((g) => ({ ...g, objectifs: objectifs.filter((o) => o.domaine === g.id) })), { id: '', nom: 'Autres', objectifs: autres }]
    .filter((g) => g.objectifs.length);
  return h('details', { class: 'rgl-liste rgl-palier' },
    h('summary', { class: 'rgl-liste__titre' }, h('span', {}, `Palier ${p.n} · ${p.nom}`), compte),
    h('div', { class: 'rgl-liste__corps' }, groupes.map((g) => h('div', { class: 'rgl-groupe' },
      h('h4', { class: 'rgl-groupe__titre' }, g.nom),
      h('ol', { class: 'rgl-objectifs' }, g.objectifs.map((o) => objectif(S, o, majCompte)))))));
}

function objectif(S, o, majCompte) {
  const actuel = S.reglages.objectifs[o.id] || { texte: o.texte, critere: o.critere };
  const etat = h('span', { class: 'rgl-objectif__etat' });
  let texte;
  let critere;
  const maj = () => {
    const t = propre(texte.value) || o.texte;
    const c = propre(critere.value) || o.critere;
    if (t === o.texte && c === o.critere) delete S.reglages.objectifs[o.id];
    else S.reglages.objectifs[o.id] = { texte: t, critere: c };
    marquer();
    majCompte();
    S.modifie();
  };
  const retour = bouton('Texte du modèle', {
    classe: 'btn--petit btn--discret', icone: 'actualiser', 'aria-label': `Remettre le texte du modèle pour ${o.id}`,
    onclick: () => {
      texte.value = o.texte;
      critere.value = o.critere;
      maj();
    },
  });
  const marquer = () => {
    const perso = !!S.reglages.objectifs[o.id];
    etat.replaceChildren(perso ? puce('Réécrit', 'accent') : '');
    retour.hidden = !perso;
  };
  const champTexte = texteReglage({ libelle: 'Objectif', valeur: actuel.texte, max: 120, chemin: `objectifs.${o.id}.texte`, contexte: `Objectifs · ${o.id} · texte`, placeholder: o.texte, ecrire: () => maj() });
  const champCritere = texteReglage({ libelle: 'Critère de réussite', valeur: actuel.critere, max: 240, multi: true, lignes: 2, chemin: `objectifs.${o.id}.critere`, contexte: `Objectifs · ${o.id} · critère`, placeholder: o.critere, ecrire: () => maj() });
  texte = champTexte.querySelector('input');
  critere = champCritere.querySelector('textarea');
  marquer();
  return h('li', { class: 'rgl-objectif' },
    h('div', { class: 'rgl-objectif__tete' }, h('code', { class: 'rgl-objectif__id' }, o.id), etat, retour),
    champTexte, champCritere);
}

// ——— 7. Routines par palier ———

const routineVide = () => ({ echauffement: [], hebdo: [], conseil: '' });

function routineModele(S, n) {
  const r = S.modele.routines?.[n] || routineVide();
  return { echauffement: (r.echauffement || []).map((l) => ({ duree: l.duree ?? 10, texte: l.texte || '' })), hebdo: [...(r.hebdo || [])], conseil: r.conseil || '' };
}

// Avant l'enregistrement : les lignes laissées vides sont retirées du brouillon (pas de ligne « obligatoire » en erreur).
export function nettoyerRoutines(S) {
  let retire = false;
  for (const r of Object.values(S.reglages.routines)) {
    const e = r.echauffement.filter((l) => propre(l.texte));
    const w = r.hebdo.filter((t) => propre(t));
    if (e.length !== r.echauffement.length || w.length !== r.hebdo.length) retire = true;
    r.echauffement = e;
    r.hebdo = w;
  }
  return retire;
}

export function sectionRoutines(S, numero) {
  const adaptes = () => Object.keys(S.reglages.routines).length;
  return section(S, {
    cle: 'routines',
    numero,
    titre: 'Routines par palier',
    intro: 'L’échauffement, le travail de la semaine et le conseil que le programme individuel propose à chaque palier.',
    resume: () => (adaptes() ? `${adaptes()} palier${adaptes() > 1 ? 's' : ''} adapté${adaptes() > 1 ? 's' : ''} sur 6` : 'Routines du modèle'),
    personnalise: () => adaptes() > 0,
    revenir: () => { S.reglages.routines = {}; },
    corps: () => h('div', { class: 'rgl-paliers', dataset: { chemin: 'routines', libelle: 'Routines' } }, PALIERS_BASE.map((p) => palierRoutine(S, p))),
  });
}

function palierRoutine(S, p) {
  const n = String(p.n);
  const el = h('details', { class: 'rgl-liste rgl-palier' });
  const dessiner = (focus = null) => {
    const r = S.reglages.routines[n] || routineModele(S, n);
    const etat = h('span', { class: 'rgl-liste__etat' });
    const retour = bouton('Revenir au modèle', { classe: 'btn--petit btn--discret', icone: 'actualiser', onclick: () => { delete S.reglages.routines[n]; dessiner(); S.modifie(); } });
    const majEtat = () => {
      etat.replaceChildren(S.reglages.routines[n] ? puce('Adapté', 'accent') : puce('Modèle'));
      retour.disabled = !S.reglages.routines[n];
    };
    const materialiser = () => { if (!S.reglages.routines[n]) S.reglages.routines[n] = r; majEtat(); };
    const ecrire = () => { materialiser(); S.modifie(); };
    const refaire = (f) => { materialiser(); dessiner(f); S.modifie(); };
    const c = (k) => `routines.${n}.${k}`;
    const ctx = (k) => `Routines · palier ${n} · ${k}`;
    const echauffement = r.echauffement.map((l, i) => h('li', { class: 'rgl-ligne-routine' },
      nombreReglage(S, { libelle: 'Durée', unite: 'min', valeur: l.duree, min: 0, max: 120, chemin: `${c('echauffement')}[${i}].duree`, contexte: ctx(`échauffement ${i + 1}, durée`), ecrire: (v) => { l.duree = v; ecrire(); } }),
      texteReglage({ libelle: `Exercice ${i + 1}`, valeur: l.texte, max: 160, chemin: `${c('echauffement')}[${i}].texte`, contexte: ctx(`échauffement ${i + 1}`), ecrire: (v) => { l.texte = v; ecrire(); }, attrs: { dataset: { focus: `e${i}` } } }),
      bouton('', { classe: 'btn--petit btn--discret btn--icone', icone: 'supprimer', 'aria-label': `Retirer l’exercice ${i + 1}`, onclick: () => { r.echauffement.splice(i, 1); refaire(); } })));
    const hebdo = r.hebdo.map((t, i) => h('li', { class: 'rgl-ligne-routine rgl-ligne-routine--hebdo' },
      texteReglage({ libelle: `Objectif ${i + 1}`, valeur: t, max: 160, chemin: `${c('hebdo')}[${i}]`, contexte: ctx(`semaine ${i + 1}`), ecrire: (v) => { r.hebdo[i] = v; ecrire(); }, attrs: { dataset: { focus: `h${i}` } } }),
      bouton('', { classe: 'btn--petit btn--discret btn--icone', icone: 'supprimer', 'aria-label': `Retirer l’objectif ${i + 1} de la semaine`, onclick: () => { r.hebdo.splice(i, 1); refaire(); } })));
    el.replaceChildren(
      h('summary', { class: 'rgl-liste__titre' }, h('span', {}, `Palier ${p.n} · ${p.nom}`),
        h('span', { class: 'rgl-liste__compte' }, `${r.echauffement.length} exercice${r.echauffement.length > 1 ? 's' : ''} d’échauffement, ${r.hebdo.length} pour la semaine`),
        etat),
      h('div', { class: 'rgl-liste__corps' },
        h('div', { class: 'rangee rangee--espace' }, h('h4', { class: 'rgl-groupe__titre' }, 'Échauffement'),
          retour),
        h('ol', { class: 'rgl-routine' }, echauffement),
        r.echauffement.length < 6 ? bouton('Ajouter un exercice', { classe: 'btn--petit', icone: 'ajouter', onclick: () => { r.echauffement.push({ duree: 10, texte: '' }); refaire(`e${r.echauffement.length - 1}`); } }) : null,
        h('h4', { class: 'rgl-groupe__titre' }, 'Chaque semaine'),
        h('ol', { class: 'rgl-routine' }, hebdo),
        r.hebdo.length < 6 ? bouton('Ajouter un objectif de la semaine', { classe: 'btn--petit', icone: 'ajouter', onclick: () => { r.hebdo.push(''); refaire(`h${r.hebdo.length - 1}`); } }) : null,
        texteReglage({ libelle: 'Conseil du palier', valeur: r.conseil, max: 240, multi: true, lignes: 2, chemin: c('conseil'), contexte: ctx('conseil'), ecrire: (v) => { r.conseil = v; ecrire(); } }),
        h('p', { class: 'texte-3 tres-petit' }, '6 lignes au plus par liste ; une ligne laissée vide est retirée à l’enregistrement.')));
    majEtat();
    if (focus) el.querySelector(`[data-focus="${focus}"]`)?.focus();
  };
  dessiner();
  return el;
}

// ——— 8. Profil public ———

function profilModele(S) {
  const p = S.modele.profil;
  return p ? { actif: true, site: p.site || '', modele: p.modele || '', format: p.format || '', aide: p.aide || '' } : { actif: false, site: '', modele: '', format: '', aide: '' };
}

export function sectionProfil(S, numero) {
  const lire = () => S.reglages.profil || profilModele(S);
  const sec = section(S, {
    cle: 'profil',
    numero,
    titre: 'Profil public',
    intro: 'Le lien vers le profil public d’un joueur (tracker.gg, op.gg, Leetify…), construit avec son identifiant en jeu. Seul le lien s’ouvre : il ne lit rien sur ces sites.',
    resume: () => (lire().actif ? (lire().site || 'lien actif') : 'aucun lien'),
    personnalise: () => !!S.reglages.profil,
    revenir: () => { S.reglages.profil = null; },
    corps: () => {
      const p = S.reglages.profil || profilModele(S);
      const ecrire = (k, v, redessiner = false) => {
        if (!S.reglages.profil) S.reglages.profil = p;
        p[k] = v;
        if (redessiner) sec.redessiner();
        else verifier();
        S.modifie();
      };
      const essai = saisie({ autocomplete: 'off', spellcheck: 'false', placeholder: 'ex. Pseudo#TAG', 'data-pas-brouillon': '' });
      const resultat = h('p', { class: 'petit rgl-essai', 'aria-live': 'polite' });
      const bilan = h('p', { class: 'tres-petit rgl-verif', 'aria-live': 'polite' });
      const verifier = () => {
        const problemes = [];
        if (!/^https:\/\/[^\s]*\{id\}[^\s]*$/.test(p.modele)) problemes.push('l’adresse doit commencer par https:// et contenir {id}');
        try {
          if (p.format) new RegExp(p.format);
        } catch {
          problemes.push('le format n’est pas une expression régulière valide');
        }
        bilan.textContent = problemes.length ? `À corriger : ${problemes.join(' ; ')}.` : 'Adresse et format valides.';
        bilan.classList.toggle('champ__erreur', problemes.length > 0);
        const id = essai.value.trim();
        if (!id) {
          resultat.textContent = 'Saisis un identifiant pour voir le lien obtenu.';
          return;
        }
        const separateur = p.modele === S.modele.profil?.modele ? S.modele.profil?.separateur : undefined;
        const url = problemes.length ? null : urlProfil({ profil: { modele: p.modele, format: p.format, separateur } }, id);
        resultat.replaceChildren(url ? lienExterne(url, url.replace(/^https:\/\//, '')) : 'Identifiant refusé par le format : aucun lien.');
      };
      essai.addEventListener('input', verifier);
      const actif = caseReglage({ libelle: 'Afficher un lien vers le profil public de chaque joueur', coche: p.actif, chemin: 'profil.actif', contexte: 'Profil public · lien actif', ecrire: (v) => ecrire('actif', v, true) });
      const contenu = [actif.element];
      if (p.actif) {
        contenu.push(
          h('div', { class: 'grille-champs' },
            texteReglage({ libelle: 'Nom du site', valeur: p.site, max: 40, chemin: 'profil.site', contexte: 'Profil public · site', placeholder: 'ex. tracker.gg', ecrire: (v) => ecrire('site', v) }),
            texteReglage({ libelle: 'Aide sous l’identifiant', valeur: p.aide, max: 160, chemin: 'profil.aide', contexte: 'Profil public · aide', placeholder: 'ex. Pseudo exact, sans espace.', ecrire: (v) => ecrire('aide', v) }),
            texteReglage({ libelle: 'Adresse du profil', valeur: p.modele, max: 200, chemin: 'profil.modele', contexte: 'Profil public · adresse', large: true, placeholder: 'https://site.gg/profil/{id}', aide: 'En https://, avec {id} à la place de l’identifiant du joueur.', ecrire: (v) => ecrire('modele', v), attrs: { spellcheck: 'false' } }),
            texteReglage({ libelle: 'Format de l’identifiant', valeur: p.format, max: 120, chemin: 'profil.format', contexte: 'Profil public · format', large: true, aide: 'Expression régulière qui valide l’identifiant avant de créer le lien, par exemple ^[^#]{2,16}#[A-Za-z0-9]{2,5}$ pour un Riot ID. Vide : tout identifiant est accepté.', ecrire: (v) => ecrire('format', v), attrs: { spellcheck: 'false', class: 'saisie rgl-mono' } })),
          bilan,
          h('div', { class: 'rgl-essai-bloc' }, champ('Essayer avec un identifiant', essai), resultat));
        verifier();
      } else {
        contenu.push(h('p', { class: 'texte-3 petit' }, 'Aucun lien : l’identifiant en jeu reste affiché, sans lien.'));
      }
      return h('div', { class: 'pile', dataset: { chemin: 'profil', libelle: 'Profil public' } }, contenu);
    },
  });
  return sec;
}

// ——— 9. Méta ———

export function sectionMeta(S, numero) {
  const m = () => S.reglages.meta;
  const sources = () => m().sources ?? S.modele.meta.sources;
  const sec = section(S, {
    cle: 'meta',
    numero,
    titre: 'Méta',
    intro: 'Ce que la vérification de la méta consulte et demande pour ce jeu, qu’elle passe par l’API Claude ou par l’import manuel.',
    resume: () => `${sources().length} source${sources().length > 1 ? 's' : ''} · vérification automatique ${m().auto === false ? 'coupée' : 'active'}`,
    personnalise: () => m().sources !== null || !!m().consigne || m().auto === false,
    revenir: () => { S.reglages.meta = { sources: null, consigne: '', auto: true }; },
    corps: () => {
      const ecrire = () => S.modifie();
      const apercu = h('p', { class: 'tres-petit texte-2 rgl-sources__apercu', 'aria-live': 'polite' });
      const majApercu = () => {
        const lignes = sources();
        const retenus = [...new Set(lignes.map(domaineSource).filter(Boolean))];
        const ignores = lignes.filter((l) => !domaineSource(l));
        apercu.replaceChildren(...[`${retenus.length} domaine${retenus.length > 1 ? 's' : ''} retenu${retenus.length > 1 ? 's' : ''}${retenus.length ? ` : ${retenus.join(', ')}` : ''}.`,
          ignores.length ? h('span', { class: 'champ__erreur' }, ` Ignoré${ignores.length > 1 ? 's' : ''} : ${ignores.join(', ')}.`) : null].filter(Boolean));
      };
      const champSources = texteReglage({
        libelle: 'Sources autorisées (un domaine par ligne)', valeur: sources().join('\n'), max: 2000, multi: true, lignes: 6, chemin: 'meta.sources', contexte: 'Méta · sources',
        aide: 'Notes de patch officielles d’abord, puis les sites de référence. Une adresse complète est réduite à son domaine.',
        ecrire: (v) => { m().sources = v.split('\n').map((l) => l.trim()).filter(Boolean); majApercu(); ecrire(); },
        attrs: { spellcheck: 'false' },
      });
      majApercu();
      const auto = caseReglage({
        libelle: 'Vérification automatique le lundi et le jeudi (si la clé API Claude est configurée)', coche: m().auto !== false, chemin: 'meta.auto', contexte: 'Méta · vérification automatique',
        ecrire: (v) => { m().auto = v; ecrire(); },
      });
      const consigne = texteReglage({
        libelle: 'Consigne propre à l’équipe', valeur: m().consigne, max: 2000, multi: true, lignes: 5, chemin: 'meta.consigne', contexte: 'Méta · consigne',
        placeholder: 'Vide : la consigne du modèle (ci-dessous) s’applique.', aide: 'Remplace la consigne du modèle : ce qu’il faut vérifier en priorité pour ce jeu (2 000 caractères au plus).',
        ecrire: (v) => { m().consigne = v; ecrire(); },
      });
      const zoneConsigne = consigne.querySelector('textarea');
      return h('div', { class: 'pile' },
        auto.element,
        champSources, apercu,
        m().sources !== null ? bouton('Reprendre les sources du modèle', { classe: 'btn--petit btn--discret', icone: 'actualiser', onclick: () => { m().sources = null; sec.redessiner(); S.modifie(); } }) : null,
        consigne,
        S.modele.meta.consigne ? h('details', { class: 'rgl-consigne' },
          h('summary', {}, 'Consigne du modèle'),
          h('div', { class: 'rgl-consigne__corps' },
            h('p', { class: 'texte-multi petit texte-2' }, S.modele.meta.consigne),
            bouton('Partir de cette consigne', {
            classe: 'btn--petit', icone: 'copier',
            onclick: () => {
              zoneConsigne.value = S.modele.meta.consigne;
              m().consigne = S.modele.meta.consigne;
              zoneConsigne.focus();
              ecrire();
            },
          }))) : null);
    },
  });
  return sec;
}

