/** The storage layout: ONE integer that alone decides whether a build can read the browser store.
 *
 *  Layout 1 is `main` before T055. Layout 2: in-store records no longer carry their own version.
 *  Bump this when a loader would read or write a stored record
 *  differently; the bump comes with a migration step in `repos/layoutSteps.ts` and a new
 *  golden dump per case (`test/goldens`). Swapping between builds of one layout is silent. */
export const STORAGE_LAYOUT = 2;
