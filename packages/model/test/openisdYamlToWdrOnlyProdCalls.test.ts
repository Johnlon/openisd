// PACKAGE DECOMMISSIONED — John Lonergan, 2026-08-31: "I don't want to discuss the model package
// any more unless we are borrowing a concept from it - immediately comment out all code in that
// package".
//
// Every line below is commented out. The package exports nothing and compiles to nothing. It is
// kept, rather than deleted, ONLY as a reference to borrow a concept from while
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md moves the app onto packages/design. Delete the
// directory once that plan is finished.

// // THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
// //
// // There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// // check the agent could not run in its own head. A red result IS the finding — never an obstacle
// // standing in front of one.
// //
// // Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// // wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// // If no defect can be named, that option is not available. TWO: STOP and report what it found.
// // "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// // past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// // deleting the test are one act under different names — making the red go away instead of making
// // the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// // not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".
//
// /**
//  * Mechanical enforcement (AST, not prose): every call inside `openisdYamlToWdr.ts`'s
//  * validation functions — `ymlRoundTripErrors`, `wdrRoundTripErrors`, `driverFieldCell`,
//  * `firstDivergence` — resolves to either a real declaration inside `@openisd/model`'s own
//  * source (`packages/model/src/`), the `yaml` package, or a JS/TS language builtin. No
//  * reimplemented parse/serialise/compute logic is permitted to sneak into the validation path.
//  */
// import { describe, it } from 'vitest';
// import assert from 'node:assert/strict';
// import { join } from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { dirname } from 'node:path';
// import { Project, SyntaxKind, type CallExpression } from 'ts-morph';
//
// const here = dirname(fileURLToPath(import.meta.url));
//
// describe('openisdYamlToWdr.ts — validation functions call ONLY real @openisd/model / yaml declarations', () => {
//   it('every call inside ymlRoundTripErrors, wdrRoundTripErrors, driverFieldCell, firstDivergence ' +
//      'resolves to a declaration in packages/model/src/, the yaml package, or a language builtin', () => {
//     const project = new Project({ tsConfigFilePath: join(here, '..', 'tsconfig.json') });
//     const sf = project.getSourceFileOrThrow(join(here, '..', 'src', 'openisdYamlToWdr.ts'));
//
//     const targetNames = ['ymlRoundTripErrors', 'wdrRoundTripErrors', 'driverFieldCell', 'firstDivergence'];
//     const fns = sf.getFunctions().filter(f => targetNames.includes(f.getName() ?? ''));
//     assert.deepEqual(fns.map(f => f.getName()).sort(), [...targetNames].sort(),
//       'expected all four validation functions to exist as top-level function declarations in openisdYamlToWdr.ts');
//
//     // Language/runtime builtins the validation glue legitimately needs — comparison and
//     // error-shaping, never data transformation.
//     const BUILTIN_CALLS = new Set([
//       'JSON.stringify', 'JSON.parse', 'String', 'Array.isArray', 'Object.keys',
//     ]);
//
//     const violations: string[] = [];
//     for (const fn of fns) {
//       const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[];
//       for (const call of calls) {
//         const expr = call.getExpression();
//         const text = expr.getText();
//         if (BUILTIN_CALLS.has(text)) continue;
//
//         let sym = expr.getSymbol();
//         if (sym?.isAlias()) sym = sym.getAliasedSymbol();
//         const decls = sym?.getDeclarations() ?? [];
//         // No declaration at all, or every declaration lives inside TypeScript's own lib.*.d.ts
//         // (Array.prototype.push and friends) — a real JS/TS language builtin, not app logic.
//         const isLangBuiltin = decls.length === 0
//           || decls.every(d => /\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(d.getSourceFile().getFilePath()));
//         if (isLangBuiltin) continue;
//         const fromRealSource = decls.some(d => {
//           const path = d.getSourceFile().getFilePath();
//           return path.includes('/packages/model/src/') || /\/node_modules\/yaml\//.test(path);
//         });
//         if (!fromRealSource) {
//           violations.push(`${fn.getName()}: call "${text}" does not resolve to @openisd/model or yaml`);
//         }
//       }
//     }
//     assert.deepEqual(violations, [],
//       'the validation apparatus must call ONLY the app\'s own real @openisd/model declarations ' +
//       '(OpenISDDriver\'s public methods, INI_ROWS) or the yaml package — no reimplemented ' +
//       'parse/serialise/compute logic');
//   }, 30_000);
// });
//