// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
//
// For a CAST specifically, response TWO is the default: casts are not banned outright, they are
// a decision the human makes. Report what the cast asserts, what the compiler cannot prove, and
// what the alternative costs — then wait.
// "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// deleting the test are one act under different names — making the red go away instead of making
// the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * A CAST IS A CONVERSATION, NOT A CRIME. John, 2026-08-31:
 *
 *   "when you find the need to add a cast then you MUST discuss with the human — it isn't
 *    necessarily evil so discuss with the human ... aim is to speak to human not prevent 100% as
 *    sometimes it's needed"
 *
 * So this gate does NOT exist to make casts impossible. It exists to make one IMPOSSIBLE TO ADD
 * QUIETLY. A red result here is an instruction to the agent: STOP, and put the cast to John with
 * what it is asserting and why the type system cannot prove it. He decides. An approved cast is
 * fine; an unapproved one is the agent making a type-safety decision that was never its to make.
 *
 * The agent's failure mode this catches is not "wrote a cast" — it is "wrote a cast INSTEAD of
 * asking", which is how every one of the examples below arrived.
 *
 * The earlier rulings still describe why the bar is high (John, 2026-08-30): "I told you to use
 * the fucking type system and a cast is a fucking hack", "all casts are fails", "use the type
 * system and the only trust is the compiler". What changed is the remedy, not the suspicion.
 *
 * A cast is the agent telling the compiler to stop checking. Everything the type system could
 * have proven at that point is replaced by an assertion nobody verifies, and the failure surfaces
 * later, somewhere else, as a wrong value rather than a compile error.
 *
 * THIS IS NOT THEORETICAL. Every one of these shipped:
 *
 *   `box as BoxType`        — a string off disk asserted to be a box type. An unrecognised value
 *                             fell off a switch as `undefined` and reached a chart as NaN.
 *   `key as SpecField`      — a `.wdr` row name asserted to be a declared field. Nothing compared
 *                             the 48 row names to the 55 declared fields; the overlap was assumed
 *                             48 times a record.
 *   `as unknown as X`       — the double cast, which erases the type entirely and is what gets
 *                             written when a single cast will not compile.
 *
 * THE ALTERNATIVE IS ALWAYS THE SAME SHAPE, and it costs a few lines:
 *
 *   1. Declare the legal values ONCE, in a form the compiler checks
 *      (`const SPEC_FIELDS = [...] as const satisfies readonly SpecField[]`).
 *   2. Prove the declaration is COMPLETE, not merely valid — an `Exclude<>` that must be `never`,
 *      so a field added to the type and forgotten in the list fails to compile and the error
 *      NAMES the field.
 *   3. Narrow with a type GUARD (`name is SpecField`), never an assertion. The compiler then
 *      knows the type because something proved it.
 *
 * `as const` is NOT a cast and is not counted: it makes a literal readonly, it does not tell the
 * compiler that one type is another. `satisfies` is not a cast either — it CHECKS.
 */
import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { globSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Every shipped TypeScript file in the workspace — not just this package's.
 *
 * A cast in `packages/model` is as dangerous as one here, and the migration moves code between
 * them, so a gate scoped to one package would report a cast leaving and miss it arriving.
 *
 * `.vue` files ARE scanned (John 2026-08-30: "Vue files must be scanned if they contain js or
 * ts") — a `<script>` block is TypeScript, and a cast there is as dangerous as one anywhere. The
 * block is parsed as a virtual `.ts`, with line numbers offset back onto the `.vue`.
 *
 * ONE exemption, temporary: an assertion to a DOM ELEMENT type — `e.target as HTMLInputElement`
 * and relatives — passes for now (John: "as HTMLInputElement gets a pass for now"). It is still
 * a cast: `e.target` is `EventTarget | null`, so it asserts the element that fired is the one
 * the handler expects, and a bubbled event reads `.value` off something that has none. Removing
 * them needs a decision about event typing, tracked as QO100 — not settled here, not silently
 * dropped.
 */
function shippedSource(): Project {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths([
    path.join(repoRoot, 'packages', '*', 'src', '**', '*.ts'),
    path.join(repoRoot, 'packages', 'design', '{domain,engine,browser,app,winisd}', '**', '*.ts'),
  ]);
  return project;
}

/** Every `.vue` `<script>` block, added to the project as TypeScript. `leading` is the line
 *  count before the block, so a reported line points at the real line in the `.vue` — a finding
 *  a reader cannot navigate to is one they will not act on. */
function addVueScripts(project: Project): Map<string, { real: string; leading: number }> {
  const map = new Map<string, { real: string; leading: number }>();
  for (const vue of globSync(path.join(repoRoot, 'packages', '*', 'src', '**', '*.vue'))) {
    const text = readFileSync(vue, 'utf8');
    const open = text.match(/<script[^>]*>/);
    if (!open || open.index === undefined) continue;
    const start = open.index + open[0].length;
    const end = text.indexOf('</script>', start);
    if (end < 0) continue;
    const virtual = `${vue}.script.ts`;
    project.createSourceFile(virtual, text.slice(start, end), { overwrite: true });
    map.set(virtual, { real: path.relative(repoRoot, vue), leading: text.slice(0, start).split('\n').length - 1 });
  }
  return map;
}

const PARSED = shippedSource();
const VUE = addVueScripts(PARSED);

/** A DOM element assertion — exempt for now, QO100. Still a cast. */
const DOM_ELEMENT_CAST = /\bas\s+(HTML[A-Za-z]*Element|Element|EventTarget)\b/;

interface Cast { file: string; line: number; text: string }

/** Every type assertion in shipped source: `x as T`, and the older `<T>x` form. `as const` is
 *  excluded — it asserts nothing about what a value IS. */
function casts(): Cast[] {
  const found: Cast[] = [];
  for (const source of PARSED.getSourceFiles()) {
    const vue = VUE.get(source.getFilePath());
    const file = vue ? vue.real : path.relative(repoRoot, source.getFilePath());
    const offset = vue ? vue.leading : 0;
    if (file.includes('/test/') || file.startsWith('..')) continue;

    for (const as of source.getDescendantsOfKind(SyntaxKind.AsExpression)) {
      if (as.getTypeNode()?.getText() === 'const') continue;
      const text = as.getText().replace(/\s+/g, ' ').slice(0, 90);
      if (DOM_ELEMENT_CAST.test(text)) continue;                    // QO100
      found.push({ file, line: as.getStartLineNumber() + offset, text });
    }
    for (const angle of source.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression)) {
      found.push({
        file, line: angle.getStartLineNumber() + offset,
        text: angle.getText().replace(/\s+/g, ' ').slice(0, 90),
      });
    }
  }
  return found;
}

describe('no casts — the compiler is the only thing trusted', () => {
  it('can actually see the source it is meant to guard', () => {
    // A gate that silently scans nothing passes forever. This proves the workspace loaded.
    const files = PARSED.getSourceFiles()
      .map((s) => path.relative(repoRoot, s.getFilePath()))
      .filter((f) => !f.includes('/test/') && !f.startsWith('..'));
    expect(files.length).toBeGreaterThan(40);
    // One file from each package the scan must reach — a scan that loaded only its own package
    // would pass the count and still miss most of the source.
    expect(files).toContain('packages/design/domain/openisdDomain.ts');
    expect(files).toContain('packages/persistence/src/repos/driverRepo.ts');
    expect(files).toContain('packages/ui/src/logic/appState.ts');
  });

  it('finds the double cast, which erases the type completely', () => {
    // `as unknown as X` is the escape hatch reached for when a single cast will not compile —
    // which is precisely when the code is most wrong. Reported separately so it can never be
    // lost in the noise of the wider count.
    const doubles = casts().filter((c) => /\bas unknown as\b/.test(c.text));
    expect(doubles.map((c) => `${c.file}:${c.line}  ${c.text}`)).toEqual([]);
  });

  it('finds no cast anywhere in shipped source', () => {
    // Every entry is a cast that has NOT been put to John. Red does not mean "delete it" — it
    // means the list below has something on it that nobody agreed to. Take it to him.
    const all = casts();
    expect(all.map((c) => `${c.file}:${c.line}  ${c.text}`),
      'each of these is a cast awaiting a human decision — discuss before removing OR keeping')
      .toEqual([]);
  });
});
