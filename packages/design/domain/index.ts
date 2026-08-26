// This package's PUBLIC surface. The raw record shapes (`OpenISDDriverJson`, `OpenISDBoxJson`,
// `OpenISDProjectJson`) are absent because they are never exported AT ALL — they are declared
// privately inside `project.ts`, so no file can name them, let alone a consumer. See that
// file's header.

export type { Provenance, Cell, FieldHandle, RawField } from './cell.js';
export type { VentShape, Vent } from './vent.js';
export type {
  SealedLosses,
  VentedLosses,
  CoupledSealedLosses,
  CoupledVentedLosses,
} from './losses.js';
export type {
  BoxType,
  Box,
  SealedBox,
  VentedBox,
  Bandpass4Box,
  Bandpass6Box,
  AbcBox,
  PassiveRadiatorBox,
  PassiveRadiatorComponent,
  VentedChamber,
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
  ManagedProject,
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
// from outside: `OpenISDDriverStandalone.wrap()` needs an `OpenISDDriverJson`, which is private,
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
  driverFromConformingRecord,
  passiveRadiatorFromConformingRecord,
} from './project.js';

// `OpenISDProject` is NOT exported — the founding rule of this design: "OpenISDProject is not
// exposed to the app directly — instead there is ManagedProject, which holds 2 or 3 copies of
// the project as internal layer state". A consumer holding one would hold a single unlayered
// project and could edit it with no ground/committed/edit/whatif discipline at all, which is
// the entire thing ManagedProject exists to prevent. That it has no public constructor is
// therefore NOT a gap to fill — it is the rule holding.
//
// `ProjectFields` goes with it: its only value was letting a caller accept EITHER an
// `OpenISDProject` or a `ManagedProject`, and the former is exactly what a caller must not have.
//
// `emptyProjectJson` is NOT exported: it takes and returns package-private record types.
//
// STILL MISSING, and now visible rather than papered over: `ManagedProject` has no public way to
// be created. `load()` takes an `OpenISDProject`, which a consumer cannot obtain — correctly. It
// needs a factory that speaks in whatever a repository actually hands over (serialized text, or
// a record the persistence layer owns), never in `OpenISDProject`.
