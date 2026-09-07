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
 * NO SHARED MUTABLE STATE AT MODULE SCOPE IN packages/design. Enforced by AST, not by grep.
 *
 * John's standing order, 2026-08-26: "we are going to attempt to build this entire app without a
 * single global var" — restated 2026-09-01 to key on MUTABILITY, not on the mere existence of a
 * module-scoped binding (see `isMutableContainer`), and restated again 2026-09-07: a constant is
 * not the thing this rule bans. What is banned is state at module scope that can vary after the
 * module loads — a `let`/`var`, a bare object/array/`new` literal nothing freezes, or anything
 * (however declared) that something later writes to.
 *
 * A module-scoped `const` is fine on its own merits, with no per-name approval needed, once it is
 * genuinely immutable:
 *
 *   - `Object.freeze({...})` / `Object.freeze([...])` — immutable at RUNTIME, the strongest form,
 *     and the one to use for a lookup table;
 *   - `{...} as const` / `[...] as const` — readonly to the compiler, which in a package with no
 *     casts (`architecture-no-casts.test.ts`) is enforcement, not decoration;
 *   - a primitive, an arrow function, or a call returning neither a container nor a `new`.
 *
 * There is no allowlist to add a name to. A binding either provably cannot vary — and passes —
 * or it can, and is a defect to fix by freezing it, moving it to `as const`, or passing it as a
 * parameter instead of holding it at module scope.
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

/** A module-scoped declaration that can be reassigned — `let` or `var` at the top level. */
function isMutableBinding(stmt: VariableStatement): boolean {
  return stmt.getDeclarationKind() !== VariableDeclarationKind.Const;
}

/**
 * A `const` whose VALUE is mutable.
 *
 * MUTABILITY IS THE WHOLE TEST, not how the value is reached (John, 2026-09-01: "relax it to key
 * on mutability rather than on indexing — global mutable state is the only problem with globals").
 * A frozen table indexed by a runtime key causes none of the three harms this rule exists to
 * prevent: there is no install order, no second-instance problem, and "what is the current value"
 * has one answer forever. What makes a global dangerous is that it VARIES.
 *
 * So a module-scoped `const` is flagged unless it is provably immutable:
 *
 *   - `Object.freeze({...})` / `Object.freeze([...])` — immutable at RUNTIME, the strongest form,
 *     and the one to use for a lookup table;
 *   - `{...} as const` / `[...] as const` — readonly to the compiler, which in a package with no
 *     casts (`architecture-no-casts.test.ts`) is enforcement, not decoration;
 *   - a primitive, an arrow function, or a call returning neither a container nor a `new`.
 *
 * A BARE object or array literal is still state: its members are assignable, so `const` buys
 * nothing. `new Map()`/`new Set()`/`new` anything is still state.
 *
 * SEPARATELY, and regardless of the initializer, a module-scoped binding that anything WRITES to
 * is state — see `isWrittenTo`.
 */
function isMutableContainer(stmt: VariableStatement): boolean {
  return stmt.getDeclarations().some((decl) => {
    const init = decl.getInitializer();
    if (!init) return false;
    if (isFrozen(init)) return false;
    const kind = init.getKind();
    if (kind === SyntaxKind.ArrayLiteralExpression) return true;
    if (kind === SyntaxKind.NewExpression) return true;
    if (kind === SyntaxKind.ObjectLiteralExpression) return true;
    if (kind === SyntaxKind.AsExpression) {
      // `as const` makes every member readonly, so the value cannot vary and it is not state.
      // Any OTHER cast is just a label on a mutable literal and is flagged as one.
      const as = init as AsExpression;
      const isConstAssertion = as.getTypeNode()?.getText() === 'const';
      const inner = as.getExpression();
      const isLiteral = inner.getKind() === SyntaxKind.ArrayLiteralExpression
        || inner.getKind() === SyntaxKind.ObjectLiteralExpression;
      return isLiteral && !isConstAssertion;
    }
    return false;
  });
}

/** `Object.freeze(x)` — the runtime guarantee. Nested freezes count, so a `freeze` wrapping a
 *  `freeze` is still frozen. */
function isFrozen(init: Node): boolean {
  if (!Node.isCallExpression(init)) return false;
  return init.getExpression().getText() === 'Object.freeze';
}

/**
 * Whether anything WRITES to this module-scoped binding — the actual definition of global mutable
 * state, and the one an initializer cannot reveal on its own.
 *
 * Three shapes, all of them a write: assignment to the name or through it (`T = x`, `T.k = x`,
 * `T[k] = x`), a mutating method call (`push`, `set`, `delete`, `clear`, …), and `delete T.k`.
 * A frozen object makes the first two throw at runtime, so this is belt AND braces: it names the
 * offence at build time rather than leaving it to a production TypeError.
 */
const MUTATORS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
  'set', 'delete', 'clear', 'add',
]);

function isWrittenTo(decl: VariableDeclaration): boolean {
  const name = decl.getNameNode();
  if (!Node.isIdentifier(name)) return false;
  for (const ref of name.findReferencesAsNodes()) {
    if (ref === name) continue;
    // Walk out through parentheses, casts and non-null assertions: `(T as any).k = 1` is the
    // same write as `T.k = 1`, and the cast is exactly what gets written when the types refuse.
    let node: Node = ref;
    let parent = node.getParent();
    while (parent && (Node.isParenthesizedExpression(parent) || Node.isAsExpression(parent)
                      || Node.isNonNullExpression(parent))) {
      node = parent;
      parent = node.getParent();
    }
    if (!parent) continue;

    // `T.k` / `T[k]` — a write only if it is the target of an assignment or a `delete`.
    if ((Node.isPropertyAccessExpression(parent) || Node.isElementAccessExpression(parent))
        && parent.getExpression() === node) {
      const outer = parent.getParent();
      if (outer && Node.isBinaryExpression(outer) && outer.getLeft() === parent
          && outer.getOperatorToken().getText().endsWith('=')) return true;
      if (outer && Node.isDeleteExpression(outer)) return true;
      // `T.push(...)` — the mutating-method case.
      if (Node.isPropertyAccessExpression(parent) && MUTATORS.has(parent.getName())
          && outer && Node.isCallExpression(outer)) return true;
      continue;
    }

    // `T = x` — reassignment of the binding itself (a `const` makes this a compile error, but a
    // `let` that slipped past `isMutableBinding` would not).
    if (Node.isBinaryExpression(parent) && parent.getLeft() === node
        && parent.getOperatorToken().getText().endsWith('=')) return true;
  }
  return false;
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
      const written = stmt.getDeclarations().some(isWrittenTo);
      const why = isMutableBinding(stmt) ? `\`${stmt.getDeclarationKind()}\` binding can be reassigned`
        : written ? 'written to after declaration — shared MUTABLE state'
        : isMutableContainer(stmt) ? '`const` binding, but the VALUE is mutable and shared'
        : '';
      if (!why) continue;

      const names = stmt.getDeclarations().map((d) => d.getName());
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
  // 30s, not the 5s default. `isWrittenTo` asks the language service for every reference to every
  // module-scoped binding — the only way to tell an immutable constant from one something mutates
  // elsewhere, which is the distinction the rule turns on. That walk is what makes this gate slow,
  // and a gate that fails on the clock instead of on a finding teaches a reader to ignore it.
  it('declares no module-scoped mutable state anywhere in its shipped source', () => {
    const offences = moduleScopedStatements();
    const report = offences.map((o) =>
      `${o.file}:${o.line}  ${o.text} — ${o.why}\n` +
      `    http://localhost:8000/openisd/packages/design/${o.file}#L${o.line}`);

    expect(report, [
      'Shared MUTABLE state at module scope is banned (packages/design/AGENTS.md, John 2026-08-26,',
      'restated 2026-09-01 and 2026-09-07). It makes order-of-operations part of the API without',
      'declaring it, makes a second instance impossible, and gives "what is the current value"',
      'more than one answer.',
      'A genuinely immutable constant is not this — freeze it (`Object.freeze`), assert it',
      '(`as const`), or use a primitive/arrow function, and it passes on its own merits.',
      'A binding that still cannot be made immutable is a design that needs a parameter instead:',
      'say so and stop.',
    ].join(' ')).toEqual([]);
  }, 30_000);

  it('can actually see the source it is meant to guard', () => {
    // A gate that silently scans nothing passes forever. This proves the project loaded.
    const shipped = PARSED.getSourceFiles()
      .map((s) => path.relative(packageRoot, s.getFilePath()))
      .filter((f) => !f.startsWith('test/') && !f.startsWith('..'));

    expect(shipped.length).toBeGreaterThan(3);
    expect(shipped).toContain('domain/openisdDomain.ts');
  });

  it('flags what is MUTABLE and passes what is frozen, however it is reached', () => {
    // Non-vacuity, and the whole point of the rule as John restated it on 2026-09-01: a frozen
    // table indexed by a runtime key is NOT state and must pass; a bag anyone can write to is
    // state and must fail, even when it is never indexed at all.
    const project = new Project({ useInMemoryFileSystem: true });
    const probe = project.createSourceFile('probe.ts', [
      // state — flagged
      'const aMap = new Map<string, number>();',
      'const aBag = { count: 0 };',
      'const aList: string[] = [];',
      'let aBinding = 1;',
      // immutable — permitted, INCLUDING the runtime-key lookup that the old rule banned
      'const FROZEN_LIMITS = Object.freeze({ Fs: 5000, Re: 64 });',
      'const CONST_LIMITS = { Fs: 5000, Re: 64 } as const;',
      'const aNumber = 42;',
      'const aString = "fine";',
      'const aFn = (x: number) => x + 1;',
      'export function limitOf(field: string) {',
      '  return FROZEN_LIMITS[field as keyof typeof FROZEN_LIMITS]',
      '    ?? CONST_LIMITS[field as keyof typeof CONST_LIMITS];',
      '}',
    ].join('\n'));

    const flagged = probe.getVariableStatements()
      .filter((s) => isMutableBinding(s) || s.getDeclarations().some(isWrittenTo)
        || isMutableContainer(s))
      .flatMap((s) => s.getDeclarations().map((d) => d.getName()));

    expect(flagged.sort()).toEqual(['aBag', 'aBinding', 'aList', 'aMap']);
  });

  it('flags a frozen-looking table that something actually WRITES to', () => {
    // The case the initializer cannot reveal: immutable on the face of it, mutated elsewhere.
    // Without this, `as const` becomes a way to smuggle a global past the gate.
    const project = new Project({ useInMemoryFileSystem: true });
    const probe = project.createSourceFile('probe.ts', [
      'const CACHE = { hits: 0 } as const;',
      'const SEEN = Object.freeze(new Set<string>());',
      'export function record(k: string) {',
      '  (CACHE as { hits: number }).hits += 1;',
      '  SEEN.add(k);',
      '}',
    ].join('\n'));

    const flagged = probe.getVariableStatements()
      .filter((s) => s.getDeclarations().some(isWrittenTo))
      .flatMap((s) => s.getDeclarations().map((d) => d.getName()));

    expect(flagged.sort()).toEqual(['CACHE', 'SEEN']);
  });
});
