/**
 * Singletons that survive a Vite hot-reload — one typed slot per owning module.
 *
 * A hot-reload re-runs a module's top-level code, and a fresh `reactive()`/`ref()` on every
 * reload would orphan every other module's already-captured reference to the old one. Hanging
 * the value off `globalThis` (rather than module scope) makes it survive the module object
 * itself being replaced.
 *
 * `globalThis`, not `window`: it is the SAME object in a browser — `window` IS `globalThis`
 * there — and it also exists in Node, so there is one path and no environment branch. A
 * mechanism that behaved one way in the app and another way under test would be two mechanisms
 * wearing one name.
 *
 * Each owning module declares its OWN global (`declare global` in `appState.ts`,
 * `presentationState.ts`) holding a `Partial<>` of an interface it also owns, with one member
 * per singleton. Because the global is declared with a real type, reading a member HAS a real
 * type — the values are never pooled into one heterogeneous string-keyed box, so nothing here
 * asserts what a slot contains. A separate global per module is also what makes a key collision
 * between two modules impossible.
 */

/**
 * The slot object for one module: created on first call, and thereafter the same object for the
 * lifetime of the process or page. `pick`/`put` read and write the caller's own declared global,
 * so this file names no global of its own.
 */
export function hmrSlots<S extends object>(
  pick: () => Partial<S> | undefined,
  put: (slots: Partial<S>) => void,
): Partial<S> {
  const existing = pick();
  if (existing !== undefined) return existing;
  const fresh: Partial<S> = {};
  put(fresh);
  return fresh;
}

/**
 * The value in `slots[key]`, created by `init()` on first use. `init` is the sole writer of a
 * slot, and the slot's declared member type is what the caller gets back — so no assertion is
 * needed to recover it.
 */
export function getOrInit<S extends object, K extends keyof S>(
  slots: Partial<S>,
  key: K,
  init: () => S[K],
): S[K] {
  const existing = slots[key];
  if (existing === undefined) {
    const made = init();
    slots[key] = made;
    return made;
  }
  return existing;
}
