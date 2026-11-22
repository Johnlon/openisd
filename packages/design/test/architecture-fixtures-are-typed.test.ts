import {describe, expect, it} from 'vitest';
import {type CallExpression, Node, Project, SyntaxKind, type VariableDeclaration} from 'ts-morph';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * A quantity bag handed to the engine must be DECLARED as what it is.
 *
 * TypeScript checks an object literal for unknown keys only where the literal is written
 * directly against a type. Assign it to a bare `const` first and that check never runs — and
 * because every `DriverSolverQuantities` member is optional, an object sharing NONE of its keys is a
 * perfectly valid `DriverSolverQuantities`. So a fixture written with stale names compiles, matches
 * nothing, and the engine reports an empty result rather than an error.
 *
 * That is not a hypothetical: it is how six engine suites came to assert against values the
 * solver had never been given. Annotating the fixture turns every one of those into
 * `TS2353: Object literal may only specify known properties`, at build time, naming the key.
 *
 * No lint rule covers this. `no-unsafe-argument` and friends see a well-typed argument, because
 * the argument IS well typed — it is merely empty. The check has to know that the variable is
 * destined for the engine, which is what this test walks the AST to establish.
 */

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The engine calls that take a bag of quantities. An argument to one of these is a fixture. */
const TAKES_QUANTITIES = [
  'solveConsistencyGroup', 'checkConsistency', 'sweep', 'maxCurves', 'classifyMaxFinite',
];

/** Parsed ONCE. Building the ts-morph project is the expensive part — several seconds — and doing
 *  it per test case pushed this suite past vitest's default timeout as the package grew. The
 *  test files' imports are resolved too: the advice is read from the called method's own
 *  declaration, which lives in the source the tests import. */
const PARSED = (() => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(path.join(packageRoot, 'test', '**', '*.ts'));
  project.resolveSourceFileDependencies();
  return project;
})();

/** The type the called function or method declares for parameter `index`, as written in its
 *  declaration — so the advice is whatever that receiver actually takes (`project.sweep` takes a
 *  `FrequencyGrid`, the engine's `sweep` a `SweepDriver` first and `SweepParams` last). */
function declaredParameterType(call: CallExpression, index: number): string {
  const symbol = call.getExpression().getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  for (const decl of target?.getDeclarations() ?? []) {
    if (!Node.isMethodDeclaration(decl) && !Node.isFunctionDeclaration(decl)
        && !Node.isMethodSignature(decl)) continue;
    const typeNode = decl.getParameters()[index]?.getTypeNode();
    if (typeNode) return typeNode.getText();
  }
  return `the type ${call.getExpression().getText()}() declares (its declaration did not resolve)`;
}

function unannotatedFixtures(project: Project = PARSED, root: string = packageRoot): string[] {
  const offenders: string[] = [];
  for (const file of project.getSourceFiles()) {
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText();
      const method = callee.split('.').pop() ?? '';
      if (!TAKES_QUANTITIES.includes(method)) continue;

      const args = call.getArguments();
      for (let index = 0; index < args.length; index++) {
        const arg = args[index]!;
        // An inline object literal is already checked by the compiler — the excess-property
        // rule fires on a fresh literal. Only a named variable escapes it.
        if (!arg.isKind(SyntaxKind.Identifier)) continue;
        const decl = arg.getSymbol()?.getDeclarations()
          .find((d): d is VariableDeclaration => d.isKind(SyntaxKind.VariableDeclaration));
        if (!decl) continue;
        if (decl.getTypeNode()) continue;                       // annotated: the check runs
        const init = decl.getInitializer();
        // `satisfies` runs the same key check and, unlike an annotation, keeps the literal's
        // exact types — so every member reads as a number rather than `number | undefined`.
        // It is the better form for a fixture, and it counts.
        if (init?.isKind(SyntaxKind.SatisfiesExpression)) continue;
        if (init?.isKind(SyntaxKind.ObjectLiteralExpression) !== true) continue;

        // Which type it should have been depends on WHOSE method this is, so it is read from
        // that method's declaration rather than guessed from the name and position.
        const wanted = declaredParameterType(call, index);
        offenders.push(
          `${path.relative(root, file.getFilePath())}:${decl.getStartLineNumber()}` +
          `  ${decl.getName()} → ${method}() arg ${index}, should be \`: ${wanted}\``);
      }
    }
  }
  return [...new Set(offenders)].sort();
}

describe('a fixture handed to the engine says what it is', () => {
  it('finds the call sites at all (the guard is not silently empty)', () => {
    // Non-vacuity: a walk that matched nothing would pass forever. These suites really do call
    // the engine with fixtures, so the scan must see them.
    const calls = PARSED.getSourceFiles()
      .flatMap(f => f.getDescendantsOfKind(SyntaxKind.CallExpression))
      .filter(c => TAKES_QUANTITIES.includes(c.getExpression().getText().split('.').pop() ?? ''));
    expect(calls.length).toBeGreaterThan(20);
  });

  // 30s, not the 5s default: resolving each argument to its DECLARATION is a real type-checker
  // query, and that is exactly what makes this a gate rather than a name-matching heuristic —
  // it follows the identifier to the `const` that defines it, wherever that is.
  it('every quantity bag passed to the engine declares its type', () => {
    expect(unannotatedFixtures(), [
      'Each of these is an object literal in an un-annotated `const`, handed to the engine.',
      'TypeScript will not check its keys, and every field it is meant to have is optional, so',
      'a stale or misspelled name compiles and silently supplies nothing. Declare the variable',
      'with the type named beside it and the compiler reports the wrong key instead.',
    ].join(' ')).toEqual([]);
  });
});

describe('the advice names the type the called method declares', () => {
  // A project knows its own driver, so `project.sweep(grid)` takes a `FrequencyGrid` — not the
  // engine's `SweepParams` — and the engine's first parameter is a `SweepDriver`. Advice that
  // names a type the method does not take sends the reader to the wrong fix.
  function adviceFor(caller: string): string[] {
    const project = new Project({useInMemoryFileSystem: true});
    project.createSourceFile('/src/types.ts', `
      export interface FrequencyGrid { fMin?: number }
      export interface SweepDriver { Fs_hz?: number }
      export interface SweepParams { fMin?: number }
      export class OpenISDProject { sweep(P: FrequencyGrid): void {} }
      export class Engine {
        sweep(drv: SweepDriver, Le_H: number | undefined, box: string, P: SweepParams): void {}
      }`);
    project.createSourceFile('/test/caller.test.ts',
      `import {OpenISDProject, Engine} from '../src/types';\n${caller}`);
    return unannotatedFixtures(project, '/');
  }

  it('a project sweep is told FrequencyGrid', () => {
    expect(adviceFor(`
      const project = new OpenISDProject();
      const grid = {fMin: 10};
      project.sweep(grid);`)).toEqual(['test/caller.test.ts:4  grid → sweep() arg 0, should be `: FrequencyGrid`']);
  });

  it('an engine sweep is told SweepDriver for the driver and SweepParams for the grid', () => {
    expect(adviceFor(`
      const engine = new Engine();
      const drv = {Fs_hz: 40};
      const P = {fMin: 10};
      engine.sweep(drv, undefined, 'sealed', P);`)).toEqual([
      'test/caller.test.ts:4  drv → sweep() arg 0, should be `: SweepDriver`',
      'test/caller.test.ts:5  P → sweep() arg 3, should be `: SweepParams`',
    ]);
  });
});
