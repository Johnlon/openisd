// This package's PUBLIC surface. The raw record shapes (`OpenISDDeviceJson`, `OpenISDBoxJson`,
// `OpenISDProjectJson`) are absent from THIS FILE'S exports — `openisdSchema.ts` exports
// them so files inside `packages/design/domain/` can share them, but this barrel never
// re-exports any of them, so no consumer outside `domain/` can name them
// (`packages/design/AGENTS.md` "INTERNAL JSON RECORD TYPES — NEVER RE-EXPORTED FROM
// domain/index.ts").

export type { Readable, Entered, Calculated, Writable, Clearable, Calculatable, Unsolvable, SimpleField } from './cell.js';
// The two ambient system facts a fresh project needs (a new identity, the current time) —
// injected the same way `Engine` already is, so a test substitutes ONE fake instead of
// monkey-patching `crypto.randomUUID`/`Date`. `realAppContext` is the production default every
// `AppContext`-accepting method already falls back to; most callers never need to name it.
export type { AppContext } from './appContext.js';
export { realAppContext } from './appContext.js';
export type { VentShape, Vent } from './vent.js';
// A VALUE export, not a type-only one: `VoiceCoilWiring.Series` must be usable at runtime, which
// is the whole point of it being an enum rather than a bare string literal.
export { VoiceCoilWiring } from './openisdSchema.js';
export type {
  SealedLosses,
  VentedLosses,
  CoupledSealedLosses,
  CoupledVentedLosses,
} from './losses.js';
export type {
  Box,
  SealedBox,
  VentedBox,
  Bandpass4Box,
  Bandpass6Box,
  AbcBox,
  PassiveRadiatorBox,
  OpenIsdPassiveRadiatorSpec,
  VentedChamber,
  FrequencyGrid,
} from './openisdDomain.js';
// We export these strictly as types to ensure encapsulation. Consumers can annotate variables with these types, but must construct them via factory functions instead of calling the class constructors directly.
export { OpenISDDriver, OpenISDDriverStandalone } from './openisdDomain.js';

// Also NOT exported (consumers cannot construct these directly):
//   `DualWriteFieldImpl` — use the capability atoms (`Readable & Entered & …`) / `SimpleField`.
//   `OpenISDBox` class — use `Box` interface.
//   `OpenISDPassiveRadiator` — requires private JSON to build.
//   `OpenISDDriverEmbedded`/`OpenISDDriverStandalone` — use `OpenISDDriver` base.
/** The ONE value this package exports: the way a project comes into existence. Everything else
 *  is a type, so a client can annotate but never construct — see the note above.
 *
 *  `driverFromConformingRecord` and `passiveRadiatorFromConformingRecord` are the seams an
 *  untrusted record crosses — one each, because a driver and a radiator are separate concepts
 *  requiring different spec sections. Each answers with a live component or with everything
 *  wrong with the record, so a picker can show why a row is unselectable. `newProject` then takes that already-validated driver — never a raw record —
 *  and choosing a box type hands back a builder specialised to it, so an invalid project cannot
 *  be expressed. */


// `OpenISDProject` IS the project a consumer holds: one class wrapping the record and holding
// both the saved and the edited state. As a TYPE only, like every other class here — the
// constructor is private, and `OpenISDProject.builder()` is the way one comes into existence.
//
// `projectJson` is NOT exported: it takes and returns package-private record types.
export { OpenISDProject, OpenISDPassiveRadiatorStandalone } from './openisdDomain.js';
// The engine class, named here as well as at its own door (`@openisd/design/engine`): the domain
// takes an `Engine` as the collaborator that does the physics, so a consumer assembling a project
// that RUNS the engine reaches for ONE import specifier (`@openisd/design`) instead of crossing
// into a second one for the class the project already depends on. The engine's other symbols
// keep their dedicated door; only `Engine` appears on both.
export { Engine } from '../engine/index.js';
// The engine class, named here as well as at its own door (`@openisd/design/engine`): the domain
// takes an `Engine` as the collaborator that does the physics, so a consumer assembling a project
// that RUNS the engine reaches for ONE import specifier (`@openisd/design`) instead of crossing
// into a second one for the class the project already depends on. The engine's other symbols
// keep their dedicated door; only `Engine` appears on both.

export type {
  DiscardChallenge,
  DriverSpecFieldName,
} from './openisdDomain.js';
