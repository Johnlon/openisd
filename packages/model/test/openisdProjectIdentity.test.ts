// PACKAGE DECOMMISSIONED — John Lonergan, 2026-08-31: "I don't want to discuss the model package
// any more unless we are borrowing a concept from it - immediately comment out all code in that
// package".
//
// Every line below is commented out. The package exports nothing and compiles to nothing. It is
// kept, rather than deleted, ONLY as a reference to borrow a concept from while
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md moves the app onto packages/design. Delete the
// directory once that plan is finished.

// /**
//  * A project's `uuid` — its IN-MEMORY identity (John 2026-08-26, QO92: "the project has a uuid
//  * that is part of its core data models ... this allows us to have dupe names and so on and not
//  * worry about it", then "lets make the UUID an internal only feature" / "when loading an owdr
//  * we assign a new uuid").
//  *
//  * Two halves, both pinned here. It must be STABLE across a `copy()`, because a `ManagedProject`
//  * is several copies of one project and they have to agree on which project that is. And it must
//  * never reach a wire: absent from the record, fresh on every load. Persisting it would make
//  * re-importing a file a collision the user has to be asked about, over an identity they never
//  * knew existed.
//  */
// import { describe, it } from 'vitest';
// import assert from 'node:assert/strict';
// import { OpenISDProject, OpenISDDriver } from '../src/index.js';
//
// describe('a project carries an identity distinct from its name', () => {
//   it('two projects sharing a name still have different identities', () => {
//     const a = OpenISDProject.empty(OpenISDDriver.empty());
//     const b = OpenISDProject.empty(OpenISDDriver.empty());
//     a.setProjectMeta({ name: 'My Build', creator: '', created: '', modified: '', description: '' });
//     b.setProjectMeta({ name: 'My Build', creator: '', created: '', modified: '', description: '' });
//
//     assert.equal(a.projectMeta().name, b.projectMeta().name, 'precondition: the names collide');
//     assert.notEqual(a.uuid(), b.uuid(),
//       'a duplicate name must not make two projects the same project — that is what identity is for');
//   });
//
//   it('every new project mints its own identity', () => {
//     const ids = new Set(Array.from({ length: 8 }, () => OpenISDProject.empty(OpenISDDriver.empty()).uuid()));
//     assert.equal(ids.size, 8, 'each new project must be distinguishable from every other');
//   });
// });
//
// describe('identity is in-memory only', () => {
//   it('a copy is the SAME project — ManagedProject layers depend on this', () => {
//     const p = OpenISDProject.empty(OpenISDDriver.empty());
//     assert.equal(p.copy().uuid(), p.uuid(),
//       'ground/committed/what-if are copies of ONE project, so a copy that re-minted would ' +
//       'give a single managed project several identities');
//   });
//
//   it('the wire record carries no identity at all', () => {
//     // Read as raw JSON, deliberately: the assertion is about the BYTES, and the typed record
//     // no longer declares a uuid for a typed read to reach.
//     const record = JSON.parse(JSON.stringify(OpenISDProject.empty(OpenISDDriver.empty()).toJsonRecord()));
//     assert.equal(record.uuid, undefined,
//       'identity must not reach a file or a share link — an id in the bytes turns a re-import ' +
//       'into a collision the user has to be asked about, over something they never knew existed');
//   });
//
//   it('loading a record mints a FRESH identity', () => {
//     const p = OpenISDProject.empty(OpenISDDriver.empty());
//     const back = OpenISDProject.fromJsonRecord(p.toJsonRecord());
//     assert.notEqual(back.uuid(), p.uuid(),
//       'a loaded project is a new project — the record states no identity, so there is none to restore');
//   });
//
//   it('two loads of the SAME record are two different projects', () => {
//     const record = OpenISDProject.empty(OpenISDDriver.empty()).toJsonRecord();
//     assert.notEqual(
//       OpenISDProject.fromJsonRecord(record).uuid(),
//       OpenISDProject.fromJsonRecord(record).uuid(),
//       'opening one file twice gives two independently editable projects, so they cannot share an id');
//   });
// });
//