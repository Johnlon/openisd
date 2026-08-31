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
 * NO GLOBAL VARIABLES IN packages/design. Enforced by AST, not by grep.
 *
 * John's standing order, 2026-08-26: "we are going to attempt to build this entire app without a
 * single global var", and no global exists here unless he has recorded a definite OK for that
 * specific one in `packages/design/AGENTS.md`. The approved list is currently EMPTY.
 *
 * Why an AST and not a regex: a regex over source text matches the word `let` inside a comment,
 * a string, or a variable named `letter`, and misses a declaration wrapped over two lines. The
 * shape of a declaration is a fact about the syntax tree, so the tree is what gets asked.
 * (Same reasoning as the house rule on shape-based gates: test the SHAPE, never grep prose.)
 */
import { describe, it, expect } from 'vitest';
import { Node, Project, SyntaxKind, VariableDeclarationKind, type AsExpression, type VariableDeclaration, type VariableStatement } from 'ts-morph';
import * as path from 'node:path';
import * as url from 'node:url';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

/**
 * Globals John has explicitly approved, by name.
 *
 * An entry belongs here ONLY once John has recorded a definite OK in `packages/design/AGENTS.md`.
 * Adding a name here without one is the exact offence this gate exists to stop.
 *
 * The three below are the starting values a brand-new box is built from, approved 2026-08-27.
 * Every use spreads them, so no project's record ever holds the shared object itself.
 */
const APPROVED: readonly string[] = ['NO_LOSSES', 'NO_VENT', 'NO_CHAMBER'];

/** A module-scoped declaration that can be reassigned — `let` or `var` at the top level. */
function isMutableBinding(stmt: VariableStatement): boolean {
  return stmt.getDeclarationKind() !== VariableDeclarationKind.Const;
}

/**
 * A `const` whose VALUE is mutable: an object, array, Map/Set/WeakMap/WeakSet, or a `new` of
 * anything. `const` freezes the binding, never the contents, so a module-level container is
 * shared mutable state however it is declared — the whole class of bug this gate is about.
 *
 * A `const` bound to a string, number, boolean, arrow function or type-only construct is not
 * state and is not flagged.
 *
 * ENUMERATIONS ARE PERMITTED, COLLECTIONS ARE NOT (John 2026-08-29, AGENTS.md). Both are object
 * literals, so the declaration cannot tell them apart — what separates them is HOW THEY ARE
 * REACHED. An enumeration is read by name (`SourceRole.Manual`); a collection is indexed by a
 * runtime key (`TABLE[name]`). So an `as const` object is allowed until something indexes it
 * with a computed key, at which point it is a lookup table and is flagged.
 */
function isMutableContainer(stmt: VariableStatement): boolean {
  return stmt.getDeclarations().some((decl) => {
    const init = decl.getInitializer();
    if (!init) return false;
    const kind = init.getKind();
    if (kind === SyntaxKind.ArrayLiteralExpression) return true;
    if (kind === SyntaxKind.NewExpression) return true;
    // A BARE object literal is a mutable bag — its members can be reassigned, so it is state
    // whatever it holds. Only `as const` makes the members readonly, and only then is it a
    // candidate for being an enumeration rather than a collection.
    if (kind === SyntaxKind.ObjectLiteralExpression) return true;
    if (kind === SyntaxKind.AsExpression) {
      const inner = (init as AsExpression).getExpression();
      if (inner.getKind() === SyntaxKind.ArrayLiteralExpression) return true;
      if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) return !isEnumeration(decl);
    }
    return false;
  });
}

/**
 * Whether this `as const` object is an ENUMERATION rather than a lookup table.
 *
 * It is, when it is read by name everywhere and never indexed with a computed key. `T.Member`
 * is a name; `T[k]` is a lookup, and ONE such use makes the whole declaration a collection —
 * `as const` does not change that, because the same object still answers every caller.
 */
function isEnumeration(decl: VariableDeclaration): boolean {
  const name = decl.getNameNode();
  if (!Node.isIdentifier(name)) return false;
  for (const ref of name.findReferencesAsNodes()) {
    // Walk out through casts and parentheses first: `(T as Record<string, string>)[k]` is the
    // same lookup as `T[k]`. The cast is what gets written when the enum's narrow type will not
    // index — so a gate reading only the identifier's immediate parent misses exactly the case
    // where the author had to fight the types, which is where the mistake is likeliest.
    let node: Node = ref;
    let parent = node.getParent();
    while (parent && (Node.isParenthesizedExpression(parent) || Node.isAsExpression(parent)
                      || Node.isNonNullExpression(parent))) {
      node = parent;
      parent = node.getParent();
    }
    if (parent && Node.isElementAccessExpression(parent) && parent.getExpression() === node) {
      const arg = parent.getArgumentExpression();
      // `T['Literal']` is still a name. `T[k]` is a lookup.
      if (arg && !Node.isStringLiteral(arg) && !Node.isNumericLiteral(arg)) return false;
    }
  }
  return true;
}

/**
 * The package's SHIPPED source, and only that.
 *
 * Loaded from explicit globs rather than the tsconfig: the tsconfig also includes `test/`, and
 * pulling ~18k lines of test into ts-morph made this gate take longer than the test timeout. A
 * test's own `let fixture` is scaffolding, not application state, so those files were never
 * wanted here anyway.
 */
function shippedSource(): Project {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths([
    path.join(packageRoot, 'domain', '**', '*.ts'),
    path.join(packageRoot, 'engine', '**', '*.ts'),
    path.join(packageRoot, 'browser', '**', '*.ts'),
    path.join(packageRoot, 'app', '**', '*.ts'),
  ]);
  return project;
}

/** The parsed package, ONCE.
 *
 *  Each of the three tests below needs the same tree, and parsing it per test made this file
 *  take ~3.8s alone and time out at 5s under a parallel run — a gate that fails on load rather
 *  than on a finding, which is worse than useless because it trains a reader to ignore it. */
const PARSED = shippedSource();

/** Every module-scoped variable statement in the package's shipped source. */
function moduleScopedStatements() {
  const project = PARSED;
  const found: { file: string; line: number; text: string; why: string }[] = [];

  for (const source of project.getSourceFiles()) {
    const file = path.relative(packageRoot, source.getFilePath());
    if (file.startsWith('test/') || file.startsWith('..')) continue;

    // `getVariableStatements()` returns TOP-LEVEL statements only — one inside a function or a
    // class body is a local, which is exactly what this rule wants people to use instead.
    for (const stmt of source.getVariableStatements()) {
      const why = isMutableBinding(stmt) ? `\`${stmt.getDeclarationKind()}\` binding can be reassigned`
        : isMutableContainer(stmt) ? '`const` binding, but the VALUE is mutable and shared'
        : '';
      if (!why) continue;

      const names = stmt.getDeclarations().map((d) => d.getName());
      if (names.every((n) => APPROVED.includes(n))) continue;

      found.push({
        file,
        line: stmt.getStartLineNumber(),
        text: names.join(', '),
        why,
      });
    }
  }
  return found;
}

describe('packages/design has no global variables', () => {
  // 30s, not the 5s default. `isEnumeration` asks the language service for every reference to
  // each `as const` object — the only way to tell an enumeration (read by name) from a lookup
  // table (indexed by a runtime key), which is the distinction the rule turns on. That walk is
  // what makes this gate slow, and a gate that fails on the clock instead of on a finding
  // teaches a reader to ignore it.
  it('declares no module-scoped mutable state anywhere in its shipped source', () => {
    const offences = moduleScopedStatements();
    const report = offences.map((o) =>
      `${o.file}:${o.line}  ${o.text} — ${o.why}\n` +
      `    http://localhost:8000/openisd/packages/design/${o.file}#L${o.line}`);

    expect(report, [
      'A module-scoped variable is a global (packages/design/AGENTS.md, John 2026-08-26).',
      'It makes order-of-operations part of the API without declaring it, makes a second instance',
      'impossible, and gives "what is the current value" more than one answer.',
      'Pass it in instead — a dependency belongs in a constructor or a parameter.',
      'If a global genuinely cannot be avoided, that means the DESIGN is wrong: say so and stop.',
      'Never add a name to APPROVED without John recording a definite OK in AGENTS.md.',
    ].join(' ')).toEqual([]);
  }, 30_000);

  it('can actually see the source it is meant to guard', () => {
    // A gate that silently scans nothing passes forever. This proves the project loaded.
    const shipped = PARSED.getSourceFiles()
      .map((s) => path.relative(packageRoot, s.getFilePath()))
      .filter((f) => !f.startsWith('test/') && !f.startsWith('..'));

    expect(shipped.length).toBeGreaterThan(3);
    expect(shipped).toContain('domain/project.ts');
  });

  it('flags a mutable const container, not only let and var', () => {
    // Non-vacuity: the `const x = new Map()` case is the one people reach for when told "no let",
    // so the gate is proved able to catch it rather than trusted to.
    const project = new Project({ useInMemoryFileSystem: true });
    const probe = project.createSourceFile('probe.ts', [
      'const aMap = new Map<string, number>();',
      'const aBag = { count: 0 };',
      'const aList: string[] = [];',
      'let aBinding = 1;',
      'const aNumber = 42;',
      'const aString = "fine";',
      'const aFn = (x: number) => x + 1;',
    ].join('\n'));

    const flagged = probe.getVariableStatements()
      .filter((s) => isMutableBinding(s) || isMutableContainer(s))
      .flatMap((s) => s.getDeclarations().map((d) => d.getName()));

    expect(flagged.sort()).toEqual(['aBag', 'aBinding', 'aList', 'aMap']);
  });
});
