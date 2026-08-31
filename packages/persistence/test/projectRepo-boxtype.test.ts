// COMMENTED OUT — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What survives in this package is ONLY the bundle -> domain construction:
// `driverRepo.ts`'s bundled-entry seam and `bundledPassiveRadiatorRepo.ts`. Storage, My Drivers,
// projects, prefs and view state are all inert. Restore a piece when the app needs it again;
// until then it is not carried through the packages/model -> packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

// /**
//  * The stored box type is PARSED at the storage boundary, never asserted.
//  *
//  * `box` reaches this package as a raw string off disk, out of localStorage, or out of a share
//  * link. Casting it (`box as BoxType`) would hand an arbitrary value to code whose switches are
//  * exhaustive only over the DECLARED members: an unknown string matches no case, falls off the
//  * end as `undefined`, and arrives at a chart as NaN with nothing raised — and the type checker
//  * cannot object, because the cast already told it the value was valid.
//  *
//  * bugs/BUG_20260828_stored_box_type_is_cast_not_parsed_so_an_unknown_string_reaches_the_simulation.md
//  *
//  * These drive the PUBLIC door (`readProjectText`) rather than the private parser, so they prove
//  * the refusal actually reaches a caller.
//  */
// import { describe, it } from 'vitest';
// import assert from 'node:assert/strict';
// import { createProjectRepo } from '../src/repos/projectRepo.js';
// import type { ProjectRepo } from '../src/repos/projectRepo.js';
// import type { KeyValueStorage } from '../src/storage/keyValueStorage.js';
// import type { FileStorage } from '../src/storage/fileStorage.js';
// import { OpenISDDriver } from '@openisd/model';
//
// /** In-memory key/value storage, so a test can read back what was quarantined. */
// function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
//   const map = new Map<string, string>();
//   return {
//     map,
//     get: (k) => map.get(k) ?? null,
//     set: (k, v) => { map.set(k, v); },
//     remove: (k) => { map.delete(k); },
//   };
// }
//
// /** No file is ever written by these tests; the repo only needs the collaborator to exist. */
// const noFiles: FileStorage = {
//   save: () => { throw new Error('no test here writes a file'); },
//   saveAs: () => { throw new Error('no test here writes a file'); },
//   openFileName: () => null,
// } as unknown as FileStorage;
//
// /** A schema collaborator that upgrades nothing — these tests are about the box string alone. */
// const identitySchema = { current: 1, upgrade: (blob: Record<string, unknown>) => ({ blob, from: 1, applied: [] }) };
//
// function repoOn(storage: KeyValueStorage): ProjectRepo {
//   return createProjectRepo(storage, identitySchema, noFiles);
// }
//
// /** A payload whose every OTHER field is valid, so a refusal can only be about `box`. */
// function payloadWithBox(box: string): string {
//   return JSON.stringify({
//     schema: 1,
//     v: 2,
//     driver: OpenISDDriver.empty().toOwdrJson(),
//     box,
//     P: { Vb: 0.03 },
//     project: { name: 'T', creator: '', created: '', modified: '', description: '' },
//   });
// }
//
// describe('a stored box type this build knows is restored', () => {
//   for (const box of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator'] as const) {
//     it(`restores a project stored as "${box}"`, () => {
//       const project = repoOn(memoryStorage()).readProjectText(payloadWithBox(box));
//       assert.notEqual(project, null, `"${box}" is a declared box type and must restore`);
//       assert.equal(project!.activeBoxType(), box, 'the parsed member must be the one stored');
//     });
//   }
//
//   it('accepts "pr", the stored spelling, and returns it as the canon member', () => {
//     // Every .owpr and share link already in circulation carries "pr". Refusing it would make
//     // every saved passive-radiator design unopenable; returning it unchanged would leak the
//     // stored spelling into a system that no longer has that member.
//     const project = repoOn(memoryStorage()).readProjectText(payloadWithBox('pr'));
//     assert.notEqual(project, null, '"pr" must still read');
//     assert.equal(project!.activeBoxType(), 'box-passive-radiator',
//       'the stored spelling must become the canon member, never survive as "pr"');
//   });
// });
//
// describe('a stored box type this build does NOT know is refused, not cast', () => {
//   for (const box of ['banana', '', 'PASSIVE-RADIATOR', 'bandpass8', 'passive-radiator']) {
//     it(`refuses ${JSON.stringify(box)} rather than letting it reach the simulation`, () => {
//       const project = repoOn(memoryStorage()).readProjectText(payloadWithBox(box));
//       assert.equal(project, null,
//         `${JSON.stringify(box)} names no box type this build declares — restoring it would put an `
//         + 'unknown string where every switch expects a declared member, and NaN on a chart');
//     });
//   }
//
//   it('quarantines the refused payload instead of discarding it', () => {
//     // Same reasoning as the refused driver record beside it: refusing leaves nothing to load
//     // from, and the next autosave would overwrite the key — so the evidence must be kept.
//     const storage = memoryStorage();
//     repoOn(storage).readProjectText(payloadWithBox('banana'));
//     const quarantined = storage.map.get('openisd.quarantine.project');
//     assert.ok(quarantined, 'the refused payload must be preserved for repair');
//     assert.ok(quarantined.includes('banana'), 'the quarantined copy must be the payload as stored');
//   });
// });
//