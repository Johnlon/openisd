// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
// "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// deleting the test are one act under different names — making the red go away instead of making
// the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * `OpenISDProject` holds ONLY four state fields — `#saved`, `#edited`, `#whatif` (each an
 * `OpenISDProjectJson` record) and `#engine`. The what-if layer is transient and never serialized.
 * Every other public member (`driver`, `box`,
 * `name`, `comment`, and anything added later) is a getter that builds its accessor fresh from
 * `#saved`/`#edited`/`#whatif` layers on each read — never a separate service-owned copy assigned in the
 * constructor and held for the object's life.
 *
 * `#uuid` is a deliberate, separately-documented exception (QO92: identity that must never
 * enter the record) and is not counted against the four.
 *
 * `#issues` and `#resolving` are a second, narrower exception (S2-7d, leader ruling
 * 2026-09-16 — John to confirm): `#issues` is a DERIVED CACHE of the current layer, rebuilt by
 * every `#resolve()` and never itself read back from or written into a record — it exists so a
 * sweep guard or a getter can answer "what's wrong" without re-solving on every read, which
 * would be a write-on-read loop. `#resolving` is `#resolve()`'s own reentrancy flag. Neither
 * holds a fact about the DESIGN the way `#saved`/`#edited`/`#whatif` do; both are cheaply
 * rebuildable from the record and hold no information a fresh resolve would not reproduce.
 */
import {describe, expect, it} from 'vitest';
import {Project} from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const ALLOWED_FIELDS = new Set([
  '#saved', '#edited', '#whatif', '#engine', '#uuid', '#listeners', '#issues', '#resolving',
]);

describe('OpenISDProject holds only #saved/#edited/#whatif/#engine as stored fields', () => {
  it('declares no property beyond the allowed set', () => {
    // `skipAddingFilesFromTsConfig` — this gate reads ONE class out of ONE file, so adding and
    // type-checking every file the tsconfig names costs the whole program's parse for nothing,
    // and overruns vitest's 5s limit. The timeout is indistinguishable from a real failure.
    const project = new Project({
      tsConfigFilePath: path.join(packageRoot, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });
    const sourceFile = project.addSourceFileAtPath(path.join(packageRoot, 'domain', 'openisdDomain.ts'));
    const classDecl = sourceFile.getClassOrThrow('OpenISDProject');

    const propertyNames = classDecl
      .getProperties()
      .map((prop) => prop.getName());

    const disallowed = propertyNames.filter((name) => !ALLOWED_FIELDS.has(name));

    expect(disallowed, `OpenISDProject declares stored field(s) beyond the project layers: ${disallowed.join(', ')} — these must become getters built from the layers instead`).toEqual([]);
  });
});
