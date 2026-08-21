/**
 * Owns the URL as an app-state surface (ARCHITECTURE.md §"Approved state stores" — the third
 * of the three: store / ManagedOpenISDProject / the URL). `persist.ts` builds the share-link
 * URL string purely; this module is where the app actually reaches into browser history to
 * make the address bar reflect it.
 */
export function setShareUrl(url: string): void {
  try { history.replaceState(null, '', url); } catch { /* replaceState can throw on some file:// origins — non-fatal */ }
}
