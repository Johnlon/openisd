// THE COMPOSITION ROOT — and it belongs to the APP, not to the package.
//
//     domain/    pure, platform-free: the private record, the domain objects, the repo
//     browser/   platform-bound: the stores
//     app/       THIS and `workspace.ts` — the application, which decides what exists
//
// The package publishes PARTS and the app assembles them. Putting the assembly inside the package
// would be the package deciding on the app's behalf, and would leave any app outside the package
// unable to assemble anything at all — it could only call whatever pre-baked wiring the package
// happened to offer.
//
// Everywhere else the two halves stay ignorant of each other by construction: the domain takes a
// GENERIC store factory, so it cannot name a store implementation, and a store is parametric in
// the record, so it cannot name what it holds. This file is where that ignorance is resolved, and
// it is the only file importing both entry points.

import { projectRepo, type ProjectRepo } from '@openisd/design';
import { indexedDbStore, memoryStore } from '@openisd/design/browser';

/** The clock the store stamps `modified` with. Injected rather than read from `Date` inside the
 *  store so a test can make modification times deterministic and orderings assertable. */
export type Clock = () => string;

/** A real clock, ISO-8601 so timestamps sort lexicographically — which is what lets the repo
 *  order a listing most-recent-first with a plain string compare and no date parsing. */
export const systemClock: Clock = () => new Date().toISOString();

/**
 * Wire the app up: a browser-backed store, and the repo over it.
 *
 * CALL ONCE, at startup, and share the result. Nothing prevents a second call — the store lives
 * on the repo, not in a global — but two repos would be two stores, and deciding what exists
 * once is exactly what a composition root is for.
 *
 * WHY IT EXISTS: without it, every caller wanting a repo would have to know which store to build,
 * and "which store are we using" would stop having a single answer.
 */
export function composeBrowserApp(dbName: string, clock: Clock = systemClock): ProjectRepo {
  return projectRepo(indexedDbStore(dbName, clock));
}

/**
 * The same wiring over an in-memory store — for tests, and for a browser where IndexedDB is
 * unavailable or blocked.
 *
 * Deliberately the SAME composition path as the real app, differing only in which store is
 * installed. A test that built its own wiring would be exercising a second assembly nobody ships.
 */
export function composeInMemoryApp(clock: Clock): ProjectRepo {
  return projectRepo(memoryStore(clock));
}
