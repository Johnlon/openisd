// This package's PUBLIC surface. The raw record shapes (`OpenISDDeviceJson`, `OpenISDBoxJson`,
// `OpenISDProjectJson`) are absent from THIS FILE'S exports — `openisdRecordSchema.ts` exports
// them so files inside `packages/design/domain/` can share them, but this barrel never
// re-exports any of them, so no consumer outside `domain/` can name them
// (`packages/design/AGENTS.md` "INTERNAL JSON RECORD TYPES — NEVER RE-EXPORTED FROM
// domain/index.ts").

export type { Provenance, Cell, FieldHandle, RawField } from './cell.js';
export type { VentShape, Vent } from './vent.js';
// A VALUE export, not a type-only one: `VoiceCoilWiring.Series` must be usable at runtime, which
// is the whole point of it being an enum rather than a bare string literal.
export { VoiceCoilWiring } from './openisdRecordSchema.js';
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
  PassiveRadiatorSpec,
  VentedChamber,
  FrequencyGrid,
} from './project.js';
// `export type`, not `export` — DELIBERATE, and the general rule here: a consumer gets the TYPE
// to annotate with, never the class VALUE. `export type` omits the runtime binding entirely, so
// there is no constructor to call and no static to reach; `OpenISDDriver.sectionOf(...)` and
// friends are simply not there.
//
// That an API is worth exposing never implies its construction is: `project.driver` should be a
// visible, usable `OpenISDDriver`, while MAKING one stays the project's business. Creating any
// of these is a factory's job — a function, exported as a value, speaking in public types — and
// no such factory exists yet (see the note below).
export type {
  OpenISDDriver,
} from './project.js';

// Also NOT exported, all for the same reason — a consumer cannot obtain one, so exporting it
// would advertise a capability that does not exist:
//   `Field`                   — its constructor takes three closures over storage no consumer
//                               can reach. `FieldHandle`/`RawField` are what a caller holds.
//   `OpenISDBox`              — the CLASS. `wrap()` only ever makes a second window onto a
//                               project that already has one. `Box`, the interface, is what
//                               `project.box` hands back and what a caller annotates with.
//   `OpenISDPassiveRadiator`  — `wrap()` needs a private record, so no consumer can build one
//                               to pass to `configurePR()`. See the construction gap below.
//
// `OpenISDDriverEmbedded`/`OpenISDDriverStandalone` are NOT exported either. Neither is usable
// from outside: `OpenISDDriverStandalone.wrap()` needs an `OpenISDDeviceJson`, which is private,
// and an embedded driver is only ever produced by `OpenISDProject` itself. Exporting them would
// advertise a capability a consumer does not have. `OpenISDDriver` — the base both share — IS
// exported, because that is the type a consumer actually holds (via `project.driver`, or from
// `driverFromConformingRecord`), and it is all the driver editor binds to.
//
/** The ONE value this package exports: the way a project comes into existence. Everything else
 *  is a type, so a client can annotate but never construct — see the note above.
 *
 *  `driverFromConformingRecord` and `passiveRadiatorFromConformingRecord` are the seams an
 *  untrusted record crosses — one each, because a driver and a radiator are separate concepts
 *  requiring different spec sections. Each answers with a live component or with everything
 *  wrong with the record, so a picker can show why a row is unselectable. `newProject` then takes that already-validated driver — never a raw record —
 *  and choosing a box type hands back a builder specialised to it, so an invalid project cannot
 *  be expressed. */
export {
  newProject,
  conformingRecordToDriver,
  conformingRecordToPassiveRadiator,
} from './project.js';

// `OpenISDProject` IS the project a consumer holds: one class wrapping the record and holding
// both the saved and the edited state. As a TYPE only, like every other class here — the
// constructor is private, and `newProject()` is the way one comes into existence.
//
// `projectJson` is NOT exported: it takes and returns package-private record types.
export type { OpenISDProject } from './project.js';

// ── PERSISTENCE ────────────────────────────────────────────────────────────────────────────
//
// `OpenISDProjectJson` is ABSENT here, as it is absent from every signature below — that is the
// whole design. `projectRepo()` takes a GENERIC store factory, so a store implementation is
// parametric in the record and can neither name nor inspect it; the domain instantiates the
// factory at its own private type. Parametricity enforces the boundary, so no cast is needed and
// no architecture test has to guard a naming convention.
//
// `ProjectRepo` is exported as a TYPE only, like every other class here — `projectRepo()` is the
// function that hands one back, and it reads the installed store at call time.
export type {
  ProjectRepo,
  ProjectListing,
  RecordStore,
  RecordStoreFactory,
  DeleteChallenge,
  DeleteOutcome,
} from './project.js';
// `projectRepo()` IS exported: this package publishes parts, and the APP assembles them. A
// composition root belongs to the application — it is the thing that decides what exists — so a
// pre-baked assembly here would be the package making that decision on the app's behalf, and
// would leave an app outside this package unable to assemble anything at all.
export { projectRepo } from './project.js';
