/**
 * `getOrInit()` — one instance per (namespace, key) pair, surviving a Vite hot-reload.
 *
 * A hot-reload re-runs a module's top-level code, and a fresh `reactive()`/`ref()` on every
 * reload would orphan every other module's already-captured reference to the old one. Keying
 * off `window` (rather than module-scope) makes the value survive the module object itself
 * being replaced.
 *
 * `namespace` is the calling module's own name (`store`, `presentationState`). Every caller
 * shares one `window` property, so a bare key (`'state'`,
 * `'_version'`) from two different stores would silently collide and hand one store's
 * singleton back to the other; the namespace makes that structurally impossible instead of
 * relying on every module picking a unique-enough key by convention.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const globalCtx = (typeof window !== 'undefined') ? (window as any) : null;
if (globalCtx && !globalCtx.__hmr_singletons) {
  globalCtx.__hmr_singletons = {};
}
const ctx = globalCtx ? globalCtx.__hmr_singletons : {};

export function getOrInit<T>(namespace: string, key: string, init: () => T): T {
  const fullKey = `${namespace}:${key}`;
  if (!(fullKey in ctx)) {
    ctx[fullKey] = init();
  }
  return ctx[fullKey];
}
