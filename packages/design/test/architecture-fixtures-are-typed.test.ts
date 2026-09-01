import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind, type VariableDeclaration } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A quantity bag handed to the engine must be DECLARED as what it is.
 *
 * TypeScript checks an object literal for unknown keys only where the literal is written
 * directly against a type. Assign it to a bare `const` first and that check never runs — and
 * because every `SolverQuantities` member is optional, an object sharing NONE of its keys is a
 * perfectly valid `SolverQuantities`. So a fixture written with stale names compiles, matches
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
 *  it per test case pushed this suite past vitest's default timeout as the package grew. */
const PARSED = (() => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths(path.join(packageRoot, 'test', '**', '*.ts'));
  return project;
})();

function unannotatedFixtures(): string[] {
  const project = PARSED;
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

        // Which type it should have been depends on WHOSE method this is. The engine takes the
        // quantity bag first and the sweep parameters last; a project already knows its own
        // driver, so `project.sweep(P)` takes the parameters FIRST. Reading the position without
        // the receiver gives confident, wrong advice.
        const onEngine = /(^|\.)engine$/.test(callee.slice(0, callee.lastIndexOf('.')));
        const wanted = !onEngine ? 'SweepParams'
          : index === 0 ? 'SolverQuantities'
          : index === 3 ? 'SweepParams'
          : 'its declared type';
        offenders.push(
          `${path.relative(packageRoot, file.getFilePath())}:${decl.getStartLineNumber()}` +
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
  it('every quantity bag passed to the engine is a declared SolverQuantities', { timeout: 30_000 }, () => {
    expect(unannotatedFixtures(), [
      'Each of these is an object literal in an un-annotated `const`, handed to the engine.',
      'TypeScript will not check its keys, and every field it is meant to have is optional, so',
      'a stale or misspelled name compiles and silently supplies nothing. Declare the variable',
      'with the type named beside it and the compiler reports the wrong key instead.',
    ].join(' ')).toEqual([]);
  });
});
