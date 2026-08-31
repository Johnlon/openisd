// PACKAGE DECOMMISSIONED — John Lonergan, 2026-08-31: "I don't want to discuss the model package
// any more unless we are borrowing a concept from it - immediately comment out all code in that
// package".
//
// Every line below is commented out. The package exports nothing and compiles to nothing. It is
// kept, rather than deleted, ONLY as a reference to borrow a concept from while
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md moves the app onto packages/design. Delete the
// directory once that plan is finished.

// /**
//  * `OpenISDProject` — the class facade over `OpenISDProjectJson` (PLAN_QO60_LAYERING_REMEDIATION.md
//  * objective 3). This file pins the ONE property review found missing: the class must not
//  * structurally satisfy its own private JSON shape, or a caller could declare a variable typed
//  * `OpenISDProjectJson`, assign an `OpenISDProject` instance to it, and read `.driver` off a
//  * property the class never actually exposes — silently `undefined` at runtime, no compile error.
//  */
// import { describe, it } from 'vitest';
// import assert from 'node:assert/strict';
// import { OpenISDProject } from '../src/openisdProject.js';
// import { OpenISDDriver } from '../src/openisdDriver.js';
// import type { OpenISDProjectJson } from '../src/openisdProject.js';
//
// describe('OpenISDProject — does not structurally leak as OpenISDProjectJson', () => {
//   it('a variable typed as the private JSON shape cannot hold a live facade instance', () => {
//     const p: OpenISDProject = OpenISDProject.empty(OpenISDDriver.empty());
//     // @ts-expect-error — OpenISDProject must not duck-type as OpenISDProjectJson: it exposes
//     // no `driver` property at all (only `driver()`/`setDriver()`), and
//     // `OpenISDProjectJson.driver` is a REQUIRED key precisely so this stays a compile error
//     // rather than a silent runtime `undefined`. This assertion is what `tsc`
//     // actually checks — vitest's own transform strips the directive and runs the line, so the
//     // runtime assertion below is what keeps this test meaningful under `vitest run` too.
//     const leak: OpenISDProjectJson = p;
//     assert.equal(leak, p, 'the assignment is a type-system-only check; at runtime it is the same object');
//   });
// });
//