// Appels au serveur : JSON, en-tête anti-CSRF, erreurs lisibles, événements de session.

export class ErreurApi extends Error {
  constructor(statut, code, message, details = null) {
    super(message);
    this.statut = statut;
    this.code = code;
    this.details = details;
  }
}

export async function api(methode, chemin, corps) {
  const init = { method: methode, headers: { 'X-Lugh': '1' }, credentials: 'same-origin' };
  if (corps !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(corps);
  }
  let rep;
  try {
    rep = await fetch(chemin, init);
  } catch {
    throw new ErreurApi(0, 'reseau', 'Serveur injoignable. Vérifie ta connexion puis réessaie.');
  }
  const json = await rep.json().catch(() => null);
  if (!rep.ok) {
    const e = json?.erreur || {};
    if (rep.status === 401 && !chemin.startsWith('/api/auth/')) window.dispatchEvent(new CustomEvent('lugh:deconnecte'));
    if (e.code === 'mdp_a_changer') window.dispatchEvent(new CustomEvent('lugh:mdp-a-changer'));
    if (e.code === 'activer_2fa') window.dispatchEvent(new CustomEvent('lugh:activer-2fa'));
    throw new ErreurApi(rep.status, e.code || 'inconnue', e.message || `Erreur ${rep.status}.`, e.details || null);
  }
  return json;
}
