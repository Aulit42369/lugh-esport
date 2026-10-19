// Client minimal de l'API Claude (Messages) avec la recherche web côté serveur.
// Gère la reprise « pause_turn » : la réponse en pause est renvoyée telle quelle, avec les mêmes outils.

export const URL_API = 'https://api.anthropic.com/v1/messages';

export class ErreurClaude extends Error {}

export async function interrogerClaude({
  cle,
  modele,
  systeme,
  question,
  outils = [],
  maxTokens = 12_000,
  delaiMs = 240_000,
  maxReprises = 4,
  fetchImpl = globalThis.fetch,
  url = URL_API,
}) {
  if (!cle) throw new ErreurClaude('Clé API Claude absente.');
  const messages = [{ role: 'user', content: question }];
  const usage = { entree: 0, sortie: 0, recherches: 0 };
  const textes = [];
  let reponse = null;

  for (let tour = 0; tour <= maxReprises; tour += 1) {
    let http;
    try {
      http = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cle,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: modele, max_tokens: maxTokens, system: systeme, messages, tools: outils }),
        signal: AbortSignal.timeout(delaiMs),
      });
    } catch (e) {
      throw new ErreurClaude(`API Claude injoignable (${e.name === 'TimeoutError' ? 'délai dépassé' : 'réseau'}).`);
    }
    const corps = await http.json().catch(() => null);
    if (!http.ok) {
      const detail = corps?.error?.message ? ` : ${String(corps.error.message).slice(0, 200)}` : '';
      throw new ErreurClaude(`API Claude en erreur ${http.status}${detail}`);
    }
    if (!corps || !Array.isArray(corps.content)) throw new ErreurClaude('Réponse de l’API Claude illisible.');

    usage.entree += corps.usage?.input_tokens ?? 0;
    usage.sortie += corps.usage?.output_tokens ?? 0;
    usage.recherches += corps.usage?.server_tool_use?.web_search_requests ?? 0;
    for (const bloc of corps.content) if (bloc.type === 'text' && bloc.text) textes.push(bloc.text);
    reponse = corps;

    if (corps.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: corps.content });
  }

  if (reponse.stop_reason === 'pause_turn') throw new ErreurClaude('Recherche interrompue : trop de reprises.');
  if (reponse.stop_reason === 'max_tokens') throw new ErreurClaude('Réponse tronquée (limite de longueur atteinte).');
  return { texte: textes.join('\n'), usage, stopReason: reponse.stop_reason };
}

// Extrait l'objet JSON de la réponse : dernier bloc ```json, sinon du premier « { » au dernier « } ».
export function extraireJson(texte) {
  const blocs = [...String(texte).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  const candidats = blocs.length ? blocs.reverse() : [];
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut !== -1 && fin > debut) candidats.push(texte.slice(debut, fin + 1));
  for (const c of candidats) {
    try {
      const valeur = JSON.parse(c);
      if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) return valeur;
    } catch {
      // candidat suivant
    }
  }
  throw new ErreurClaude('Aucun JSON exploitable dans la réponse.');
}
