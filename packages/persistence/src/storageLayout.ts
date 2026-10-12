/** The storage layout: ONE integer that alone decides whether a build can read the browser store.
 *
 *  Layout 1 is `main` before T055. Bump this when a loader would read or write a stored record
 *  differently; the bump comes with a migration step in `repos/layoutMigration.ts` and a new
 *  golden dump per case (`test/goldens`). Swapping between builds of one layout is silent. */
export const STORAGE_LAYOUT = 1;
