// Pages HTML rendues par le serveur, lisibles sans JavaScript : les trois pages légales (même source de texte que les
// fenêtres de l'appli, shared/administratif/) et la page 404. Aucun script, aucun style en ligne (CSP stricte).

import { texteConfidentialite } from '../../shared/administratif/confidentialite.js';
import { texteConditions } from '../../shared/administratif/conditions.js';
import { texteMentionsLegales } from '../../shared/administratif/mentions-legales.js';

const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PAGES_LEGALES = {
  '/mentions-legales': { titre: 'Mentions légales', texte: texteMentionsLegales },
  '/confidentialite': { titre: 'Données et confidentialité', texte: texteConfidentialite },
  '/conditions': { titre: 'Conditions d’utilisation', texte: texteConditions },
};

function gabarit({ titre, description, corps }) {
  const liens = Object.entries(PAGES_LEGALES).map(([href, p]) => `<a class="v-lien-legal" href="${href}">${echapper(p.titre)}</a>`).join(' · ');
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${echapper(titre)} · Lugh</title>
  <meta name="description" content="${echapper(description)}">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#0b0813">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/composants.css">
  <link rel="stylesheet" href="/css/identite.css">
  <link rel="stylesheet" href="/css/vitrine.css">
</head>
<body class="vitrine">
  <a class="lien-evitement" href="#contenu">Aller au contenu</a>
  <header class="v-barre v-barre--simple">
    <a class="marque" href="/" aria-label="Lugh, accueil">
      <img class="marque__symbole" src="/icones/marque-symbole-petit.svg" alt="" width="36" height="36">
      <span class="marque__mot"></span>
    </a>
    <a class="btn v-btn-ligne v-connexion" href="/app/">Connexion</a>
  </header>
  <main id="contenu" tabindex="-1" class="v-section v-texte">
${corps}
  </main>
  <footer class="v-pied">
    <nav class="v-pied__legal" aria-label="Informations légales">${liens}</nav>
    <p class="v-pied__note"><a href="/">Retour à l’accueil</a></p>
  </footer>
</body>
</html>
`;
}

export function pageLegale(chemin, identite = {}) {
  const page = PAGES_LEGALES[chemin];
  if (!page) return null;
  const sections = page.texte(identite).map((s) => `    <section>
      <h2>${echapper(s.titre)}</h2>
${s.texte ? `      <p>${echapper(s.texte)}</p>\n` : ''}${s.liste ? `      <ul>${s.liste.map((x) => `<li>${echapper(x)}</li>`).join('')}</ul>\n` : ''}    </section>`).join('\n');
  return gabarit({
    titre: page.titre,
    description: `${page.titre} de Lugh, l’équipe esport.`,
    corps: `    <header class="v-section__tete"><p class="v-kick">Lugh</p><h1>${echapper(page.titre)}</h1></header>\n${sections}`,
  });
}

export const page404 = () => gabarit({
  titre: 'Page introuvable',
  description: 'Cette page n’existe pas.',
  corps: `    <header class="v-section__tete"><p class="v-kick">Erreur 404</p><h1>Page introuvable</h1></header>
    <p>Cette adresse ne mène nulle part : le lien est peut-être ancien ou mal recopié.</p>
    <p class="v-texte__actions"><a class="btn v-btn-or" href="/">Retour à l’accueil</a> <a class="btn v-btn-ligne" href="/app/">Espace membres</a></p>`,
});

export function envoyerHtml(res, statut, html, req) {
  res.writeHead(statut, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Length': Buffer.byteLength(html) });
  res.end(req?.method === 'HEAD' ? undefined : html);
}
