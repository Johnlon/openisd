// THE COMPOSITION ROOT — it belongs to the APP, not to the package.
//
//     domain/    pure, platform-free: the private record, the domain objects, the repo
//     browser/   platform-bound: the stores
//     app/       THIS and `workspace.ts` — the application, which decides what exists
//
// ONE function assembles everything and hands back a context. Nothing here is module-scoped, so
// there is no global to install, no order to get right, and no second instance to be impossible:
// a caller that wants two independent apps calls `assemble` twice.

import { projectRepo, type ProjectRepo, type RecordStoreFactory } from '@openisd/design';
import { Workspace } from './workspace.js';

/** Reads the current time as an ISO-8601 string. ISO so timestamps sort lexicographically, which
 *  is what lets a listing be ordered most-recent-first with a plain string compare. */
export type Clock = () => string;

/** The real clock. A test passes its own so orderings are assertable. */
export const systemClock: Clock = () => new Date().toISOString();

/**
 * Everything the app was assembled with, in one object.
 *
 * This is what gets passed down instead of a global. Every member is readonly and is a THING,
 * never a method — the context holds what exists, it does not do anything itself.
 */
export interface AppContext {
  /** The clock everything shares, so nothing reads `Date` on its own and a test controls time
   *  from one place. */
  readonly clock: Clock;
  readonly repo: ProjectRepo;
  readonly workspace: Workspace;
}

/**
 * Build the app.
 *
 * `makeStore` takes the clock rather than closing over one, so the clock is supplied ONCE, here,
 * and the store cannot end up stamping times from a different source than the rest of the app.
 */
export function assemble(makeStore: (clock: Clock) => RecordStoreFactory, clock: Clock): AppContext {
  const repo = projectRepo(makeStore(clock));
  return { clock, repo, workspace: new Workspace(repo) };
}
