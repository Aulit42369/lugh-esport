// Régénère l'image d'aperçu de la vitrine (og:image, 1200×630, JPEG ≤ 200 Ko) depuis scripts/og/modele.html.
// Usage : node scripts/generer-og.js (Playwright des tests du Site : F:\GITHUB\Site\tests, `npm install` si absent).
// Après : monter le ?v= de og:image dans public/vitrine.html.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { statSync, readFileSync } from 'node:fs';

const { chromium } = createRequire('F:/GITHUB/Site/tests/')('playwright');
const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, '..', 'public', 'og-image.jpg');

const navigateur = await chromium.launch();
try {
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(join(ICI, 'og', 'modele.html')).href);
  // Un masque CSS en file:// est refusé (origine opaque) : le lettrage passe en adresse data:.
  const mot = `url("data:image/svg+xml;base64,${readFileSync(join(ICI, '..', 'public', 'icones', 'marque-mot.svg')).toString('base64')}")`;
  await page.evaluate((m) => { const s = document.querySelector('.mot').style; s.webkitMaskImage = m; s.maskImage = m; }, mot);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: SORTIE, type: 'jpeg', quality: 84 });
} finally {
  await navigateur.close();
}
const ko = statSync(SORTIE).size / 1024;
console.log(`public/og-image.jpg : ${ko.toFixed(0)} Ko`);
if (ko > 200) process.exitCode = 1;
