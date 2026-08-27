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
import { Project, SyntaxKind, VariableDeclarationKind, type VariableStatement } from 'ts-morph';
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
 */
function isMutableContainer(stmt: VariableStatement): boolean {
  return stmt.getDeclarations().some((decl) => {
    const init = decl.getInitializer();
    if (!init) return false;
    const kind = init.getKind();
    if (kind === SyntaxKind.ObjectLiteralExpression) return true;
    if (kind === SyntaxKind.ArrayLiteralExpression) return true;
    if (kind === SyntaxKind.NewExpression) return true;
    return false;
  });
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

/** Every module-scoped variable statement in the package's shipped source. */
function moduleScopedStatements() {
  const project = shippedSource();
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
  });

  it('can actually see the source it is meant to guard', () => {
    // A gate that silently scans nothing passes forever. This proves the project loaded.
    const shipped = shippedSource().getSourceFiles()
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
