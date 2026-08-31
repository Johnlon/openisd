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
 * EVERY FIELD IN A SPEC SECTION IS A NUMBER, or it is named here and its route to the
 * calculation is decided deliberately.
 *
 * `OpenISDDriver.fields()` builds the bag the engine's consistency solver works on, and it keeps
 * only what resolves to a number:
 *
 *     const value = winningValue(stated);
 *     if (value !== null) bag[key] = value;
 *
 * `winningValue` reads `readings[origin].read_value` — the ONE legal way to read a spec entry's
 * number. A member that is not a `SpecEntry` has no such reading, so it cannot resolve, and it
 * is skipped in the same silence.
 *
 * That filter cannot tell "this field is not a driver parameter" from "this field is broken". It
 * silently skips both. Nothing throws, nothing warns, and `DriverFields` is
 * `Record<string, number | undefined>`, so a consumer comparing the missing key to a number
 * compiles clean.
 *
 * THAT COMBINATION HAS ALREADY SHIPPED A WRONG ANSWER. When `VCCon` became
 * `'parallel' | 'series'`, it stopped reaching `fields()`; `#wiredInSeries()` compared the
 * resulting `undefined` to `2` and was always false, so every series-wired dual-coil driver was
 * simulated with the PARALLEL factors — `Re` wrong by `numVC²`. It passed the type checker and
 * eight tests, because the test fixtures were themselves typed `Record<string, number>` and wrote
 * the numbers 1 and 2 for the wiring. Found in review by agent `loose-end`, 2026-08-28.
 *
 * The fix removed that victim. This removes the TRAP: the next non-numeric field added to
 * `SpecSection` fails here, loudly, and whoever adds it has to say how it reaches the
 * calculation instead of discovering months later that it never did.
 *
 * STRUCTURAL, not a value assertion — it reads the declaration, so it fires when the field is
 * DECLARED rather than when some test happens to exercise it.
 */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

/**
 * Fields allowed to be non-numeric, each with the reason its value never needs to reach the
 * numeric bag. Adding a name here is a DECISION, which is the point: it cannot be done by
 * accident, and the reason has to be written down.
 */
const NOT_A_SPEC_ENTRY_BY_DESIGN: Readonly<Record<string, string>> = {
  // EMPTY, and that is the current truth. `VCCon` was here while it was a
  // `ScrapedField<VoiceCoilWiring>`; it is now a `SpecEntry` like every other member, holding
  // the encoding the corpus stores (1 parallel, 2 series) and mapped to the enum at the field
  // boundary. So it reaches `fields()` as a number — which is exactly what the bug it caused
  // needed it to do.
};

function specSectionMembers() {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const file = project.addSourceFileAtPath(path.join(packageRoot, 'domain', 'project.ts'));
  const decl = file.getInterface('SpecSection');
  expect(decl, 'SpecSection must exist in domain/project.ts — this guard has no subject without it')
    .toBeDefined();
  return decl!.getProperties().map((p) => ({
    name: p.getName(),
    type: p.getTypeNode()?.getText() ?? '',
  }));
}

describe('a spec section carries numbers, or says why not', () => {
  it('discovers the members (the guard is not silently empty)', () => {
    const members = specSectionMembers();
    // Non-vacuity: an empty or tiny read means the parse broke, and every assertion below would
    // pass on nothing. The real section carries the whole openisd.yml parameter set.
    expect(members.length).toBeGreaterThan(30);
    expect(members.map((m) => m.name)).toContain('Fs');
  });

  it('every member is a SpecEntry unless it is named as something else by design', () => {
    const offenders = specSectionMembers()
      .filter((m) => !/^SpecEntry$/.test(m.type))
      .filter((m) => !(m.name in NOT_A_SPEC_ENTRY_BY_DESIGN))
      .map((m) => `${m.name}: ${m.type}`);

    expect(offenders, [
      'A member that is not a SpecEntry has no `readings[origin]`, so `winningValue()` cannot',
      'resolve it and `OpenISDDriver.fields()` DROPS it — silently, while anything reading it',
      'back off the solved bag gets `undefined` and still compiles. Decide how this field',
      'reaches the calculation, then either make it a SpecEntry or add it to',
      'NOT_A_SPEC_ENTRY_BY_DESIGN in this file with the reason.',
    ].join(' ')).toEqual([]);
  });

  it('the allow-list is honest — every name on it is really in SpecSection', () => {
    // A stale entry would quietly excuse a field that no longer exists, and would hide a real
    // offender if the name were ever reused.
    const declared = new Set(specSectionMembers().map((m) => m.name));
    for (const name of Object.keys(NOT_A_SPEC_ENTRY_BY_DESIGN)) {
      expect(declared.has(name), `${name} is allow-listed but not declared in SpecSection`).toBe(true);
    }
  });
});
