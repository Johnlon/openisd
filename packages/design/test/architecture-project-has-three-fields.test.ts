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
 * `OpenISDProject` holds ONLY three fields — `#saved`, `#edited` (each an `OpenISDProjectJson`
 * record) and `#engine`. John, 2026-09-06: "OpenISDProject should have ONLY three fields the
 * json saved and the json edited and then engine." Every other public member (`driver`, `box`,
 * `name`, `comment`, and anything added later) is a getter that builds its accessor fresh from
 * `#saved`/`#edited` on each read — never a fourth stored field assigned once in the
 * constructor and held for the object's life.
 *
 * `#uuid` is a deliberate, separately-documented exception (QO92: identity that must never
 * enter the record) and is not counted against the three.
 */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const ALLOWED_FIELDS = new Set(['#saved', '#edited', '#engine', '#uuid', '#listeners']);

describe('OpenISDProject holds only #saved/#edited/#engine as stored fields', () => {
  it('declares no property beyond the allowed set', () => {
    const project = new Project({ tsConfigFilePath: path.join(packageRoot, 'tsconfig.json') });
    const sourceFile = project.getSourceFileOrThrow(path.join(packageRoot, 'domain', 'project.ts'));
    const classDecl = sourceFile.getClassOrThrow('OpenISDProject');

    const propertyNames = classDecl
      .getProperties()
      .map((prop) => prop.getName());

    const disallowed = propertyNames.filter((name) => !ALLOWED_FIELDS.has(name));

    expect(disallowed, `OpenISDProject declares stored field(s) beyond #saved/#edited/#engine: ${disallowed.join(', ')} — these must become getters built from #saved/#edited instead`).toEqual([]);
  });
});
