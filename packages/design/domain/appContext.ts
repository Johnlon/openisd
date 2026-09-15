import { newUuid } from './newUuid.js';

/**
 * The two ambient, non-deterministic system facts the domain needs: a fresh identity, and the
 * current time. An object, not two free-floating functions — a caller holds ONE collaborator
 * (injected the same way `Engine` already is) and a test substitutes ONE fake for both, rather
 * than threading two separate parameters everywhere a project is built. This is also why
 * `newUuid()` is never called directly outside this module: a bare function call is a hidden
 * global exactly like `Math.random()` or `Date.now()` would be — nothing marks the call site as
 * depending on the outside world, and no test can pin what it returns without monkey-patching.
 */
export interface AppContext {
  /** A fresh, unique identity — a project's or an embedded device's `uuid`. */
  newId(): string;
  /** The current moment — a `.wpr` export's `CreateDate`/`ModifyDate` fallback stamp. */
  now(): Date;
}

/** The one production `AppContext` — a frozen object of arrow functions, so sharing this
 *  instance is not the mutable module-scoped state `packages/design/AGENTS.md` bans; a fresh
 *  object built the same way would behave identically. Every caller still takes `AppContext` as
 *  a parameter, defaulting to this, so a test can substitute its own without reaching into this
 *  module. */
export const realAppContext: AppContext = Object.freeze({
  newId: (): string => newUuid(),
  now: (): Date => new Date(),
});
