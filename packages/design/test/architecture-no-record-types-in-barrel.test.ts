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
 * `domain/index.ts` — the package's public surface — never re-exports a raw JSON record type.
 *
 * `packages/design/AGENTS.md` "INTERNAL JSON RECORD TYPES — NEVER RE-EXPORTED FROM
 * domain/index.ts" (John Lonergan, 2026-09-05): `OpenISDDeviceJson`, `OpenISDBoxJson`,
 * `OpenISDProjectJson` and every JSON-shape type declared alongside them in
 * `domain/openisdRecordSchema.ts` may be exported FROM THAT FILE so other files inside
 * `packages/design/domain/` can import them — that is what makes colocating them there useful
 * instead of leaving them locked inside `project.ts`. But `domain/index.ts` must never re-export
 * any of them: a consumer outside `domain/` gets the class/interface surface those files already
 * publish (`OpenISDDriver`, `OpenISDProject`, `Box`, and so on), never the raw record shape.
 *
 * STRUCTURAL: reads `domain/index.ts`'s own export specifiers via the AST, rather than trusting a
 * hand-maintained list to stay in sync with what `openisdRecordSchema.ts` actually declares.
 */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

/**
 * The private JSON record shapes `domain/index.ts` must never re-export — named explicitly,
 * not inferred from every exported declaration in the file: `openisdRecordSchema.ts` also
 * exports genuinely public names (`VoiceCoilWiring`, the enum; `DriverSpec`, a type alias onto
 * `OpenISDDriver`'s own public `spec` property) that are NOT record shapes and are deliberately
 * re-exported from the barrel today. A declaration-scan would flag those as false positives.
 */
const RECORD_SHAPE_NAMES = [
  'DqMark', 'Reading', 'SpecEntryJson', 'DriverSpecsSection', 'PassiveRadiatorSpecsSection',
  'VentJson', 'LossesJson', 'ChamberJson', 'OpenISDBoxJson', 'OpenISDEnvironmentJson',
  'OpenISDSignalJson', 'OpenISDProjectMetaJson', 'OpenISDProjectJson', 'OpenISDDeviceJson',
] as const;

/** Every one of `RECORD_SHAPE_NAMES` is actually declared in `openisdRecordSchema.ts` — a name
 *  in the list that no longer exists there would hide a real rename instead of catching it. */
function recordShapeNames(): string[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const file = project.addSourceFileAtPath(
    path.join(packageRoot, 'domain', 'openisdRecordSchema.ts'));

  const declared = new Set([
    ...file.getInterfaces().map((d) => d.getName()),
    ...file.getTypeAliases().map((d) => d.getName()),
  ]);
  for (const name of RECORD_SHAPE_NAMES) {
    expect(declared.has(name), `${name} is listed as a record shape but is no longer declared ` +
      'in domain/openisdRecordSchema.ts — update RECORD_SHAPE_NAMES').toBe(true);
  }
  return [...RECORD_SHAPE_NAMES];
}

/** Every name `domain/index.ts` actually re-exports, from any module specifier. */
function barrelExportNames(): string[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const file = project.addSourceFileAtPath(path.join(packageRoot, 'domain', 'index.ts'));

  const names: string[] = [];
  for (const exportDecl of file.getExportDeclarations()) {
    for (const named of exportDecl.getNamedExports()) {
      names.push((named.getAliasNode() ?? named.getNameNode()).getText());
    }
  }
  return names;
}

describe('domain/index.ts never re-exports a private JSON record type', () => {
  it('the record-shape list is real and non-vacuous', () => {
    const shapes = recordShapeNames();
    expect(shapes.length).toBeGreaterThan(5);
    expect(shapes).toContain('OpenISDDeviceJson');
    expect(shapes).toContain('OpenISDBoxJson');
    expect(shapes).toContain('OpenISDProjectJson');
  });

  it('none of openisdRecordSchema.ts\'s record shapes appear in the barrel\'s export list', () => {
    const shapes = new Set(recordShapeNames());
    const leaked = barrelExportNames().filter((name) => shapes.has(name));

    expect(leaked, [
      'domain/index.ts re-exports a name also declared as a JSON record shape in',
      'openisdRecordSchema.ts. That publishes the private record shape to every consumer of',
      '@openisd/design — the exact leak packages/design/AGENTS.md\'s "INTERNAL JSON RECORD',
      'TYPES" ruling exists to prevent. Remove the re-export, or expose the caller\'s actual',
      'question through a real method/factory instead.',
    ].join(' ')).toEqual([]);
  });
});
