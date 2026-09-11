/**
 * The Composition Root.
 *
 * Assembles the application dependencies and returns a context.
 * A caller that wants two independent apps calls `assemble` twice.
 */

import { projectRepo, type ProjectRepo, type RecordStoreFactory } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
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
  /** The ONE calculation surface. Built here and handed to everything that needs a figure —
   *  no module-scoped instance, and nothing constructs its own. */
  readonly engine: Engine;
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
  const engine = new Engine();
  const repo = projectRepo(makeStore(clock), engine);
  return { clock, engine, repo, workspace: new Workspace(repo, engine) };
}
