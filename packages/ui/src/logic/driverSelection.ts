import type { OpenISDDriver } from '@openisd/design';
import { OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { requireFocusedProject } from './appState.js';
import { presentationState } from './presentationState.js';

// A driver-file/YAML parse needs an `Engine` to build the resulting `OpenISDDriver` against
// (`driverFromOpenIsdYml`'s own signature) — cheap and stateless (`Engine.ts`: no constructor
// args, no I/O), so a fresh instance per module is the same pattern `appState.ts` uses.
const engine = new Engine();

// The ONE implementation of "the user chose a driver" (ARCHITECTURE.md AD-7).
//
// WORKFLOW, so it lives in `logic`: choosing a driver decides what the app does next — it
// embeds the driver in the project, closes the picker and moves the baseline. A repository
// cannot do that without reaching back into the store, which is what inverted the arrow when
// this lived under `db/`. It CALLS the repository to read and write saved drivers.
//
// docs/design/STATE_MODEL.md's memory layers, applied to the library picker:
//   library / My Drivers / disk  →  the project's OWN driver  →  editor draft
//
// Choosing EMBEDS. WinISD has no driver database and no live link from a project to a
// driver file: its driver manager handles one driver on disk, disconnected from any open
// project, and selecting one copies it in. OpenISD follows that model, so `selectDriver`
// builds a Driver, copies it into the project, and closes the picker — the user lands back
// in the project, not in an editor.
//
// Editing is a separate act, and THE EDITOR OWNS ITS OWN DRAFT (docs/plans/
// PROMPT_RELEASE_HARDENING.md D22): this module decides WHICH driver is being edited and
// hands the editor a SEED to build its own detached draft from — it does not hold a draft of
// its own, and it does not receive the edited driver back. `subject` records which of the
// editor's two consequences applies: the PROJECT's own copy (OK changes the design), or a
// driver from MY DRIVERS (OK saves that entry and the design is not involved). The project is
// never written back into My Drivers — a saved driver changes only through the editor's own
// explicit save.
//
// The pickers own markup and CSS. They must not parse, fetch, commit, or decide what a
// selection means — they call this.

/** A row in the driver pool, as the pickers build it. Only the fields selection needs. */
export interface PoolEntry {
  name: string;
  content?: string;
  /** A bundled record, already constructed by the model. */
  record?: OpenISDDriver;
  path?: string;
  repo?: string | null;
  branch?: string | null;
  datasheet?: string;
  manupage?: string;
  vendorpage?: string;
  frd?: string;
  impedance?: string;
  myDriverData?: OpenISDDriver;
}

/** Catalogue link fields live in the library index, not in the .wdr — overlay them on load. */
/** Library-row link → the SourceRole it is recorded under. */
const LINK_ROLES: ReadonlyArray<readonly [keyof PoolEntry, 'manufacturer_datasheet' | 'manufacturer_product_page' | 'distributor_product_page']> = [
  ['datasheet', 'manufacturer_datasheet'],
  ['manupage', 'manufacturer_product_page'],
  ['vendorpage', 'distributor_product_page'],
];

/** Carry the library row's source links onto the driver. They belong in the record's own
 *  provenance index — not as driver FIELDS: a datasheet URL is not a T/S value.
 *
 * GAP (fork investigation 2026-09-07, PLAN_DELETE_PACKAGES_MODEL.md §4b/§4c/§4e): `@openisd/
 * design`'s `OpenISDDriver` carries no `.withDataSourceLinks()` — the accessor was deliberately
 * removed (John: "and why are there accessors on OpenISDDriver" / "kill them all") and no
 * replacement for attaching catalogue-row provenance links exists yet. Until one does, this is a
 * no-op passthrough — a selected driver keeps its own record's data-source links (if any) but
 * does not pick up the library row's datasheet/manufacturer/vendor links. */
function withLinks(driver: OpenISDDriver, _f: PoolEntry): OpenISDDriver {
  return driver;
}

/** Outcome of a selection. `error` is a message the picker shows in its own status line. */
export interface SelectionResult {
  ok: boolean;
  error?: string;
}

/** Fetch and parse a federated `.wdr` row, or say why it could not be read.
 *
 * GAP (fork investigation 2026-09-07, PLAN_DELETE_PACKAGES_MODEL.md §4b/§4c/§4e): there is no
 * function anywhere in `@openisd/design` converting a `.wdr` file (`WinISDDriver.fromWdrIni`,
 * `packages/design/winisd/winisdDriver.ts:265`) into an `OpenISDDeviceJson`/`OpenISDDriver`. The
 * intended per-field E/C/N decision table is documented but unimplemented
 * (`packages/design/domain/openisdSchema.ts:705-727`) — building it is a real mapper, not
 * a mechanical fix, so this function cannot honestly be ported yet. Every federated `.wdr` row
 * now fails closed with this message rather than being silently mis-converted. */
async function modelOf(_f: PoolEntry): Promise<{ ok: true; driver: OpenISDDriver } | { ok: false; error: string }> {
  return { ok: false, error: 'Loading a .wdr driver is not supported yet (no WDR-to-OpenISD conversion exists)' };
}

// ---- reading a driver file off the user's own disk -------------------------------------
// Driver file IO that is not bound to a project — Load File… lands a driver in My Drivers,
// never in the open project, so it belongs beside the rest of this module's "driver file IO
// not bound to a project" work (`modelOf()` above) rather than in a project-scoped module.

/** A driver read off the user's disk, or the reason the file could not be read. The driver is
 *  the public domain object — never the record shape. */
export type FileReadResult =
  | { ok: true; driver: OpenISDDriver }
  | { ok: false; error: string };

/**
 * Read a driver file the user picked off their own disk.
 *
 * `format` is the caller's classification (`fileFormat.ts`'s `DriverFileFormat.ofFileName`/
 * `sniff`) — this module names no private type, parses nothing, and sniffs no format itself.
 *
 * The file name also supplies the MODEL when the file itself carries neither brand nor model
 * — a `.wdr` written by another tool need not fill those in, and a driver with no
 * `<brand>/<model>` has no identity to be saved under. The name is the file's own, not an
 * invented value.
 */
export function driverFromFileText(text: string, format: 'wdr' | 'owdr', fileName: string): FileReadResult {
  // GAP (fork investigation 2026-09-07, PLAN_DELETE_PACKAGES_MODEL.md §4b/§4c/§4e): `.wdr` has
  // no conversion to an `OpenISDDeviceJson`/`OpenISDDriver` yet — same blocker as `modelOf()`
  // above. Only `.owdr` (OpenISD YAML) can be read here until that mapper exists.
  if (format === 'wdr') {
    return { ok: false, error: `${fileName}: reading a .wdr file is not supported yet (no WDR-to-OpenISD conversion exists)` };
  }

  const driver = OpenISDDriver.fromYml(text, engine);
  if (Array.isArray(driver)) return { ok: false, error: driver[0] ?? `${fileName} could not be read` };

  // A driver IS its <brand>/<model>, so one with neither cannot be filed. The file name is the
  // last thing that can name it; if that is empty too, say so rather than saving it nameless.
  if (!driver.brand.get().value && !driver.model.get().value) {
    const base = fileName.replace(/\.[^.]*$/, '').trim();
    if (!base) return { ok: false, error: `${fileName} carries no brand or model, and its name gives none` };
    driver.model.set(base);
  }
  return { ok: true, driver };
}

// ---- what the editor is editing --------------------------------------------------------
// The one editor dialog serves two subjects with different consequences: the PROJECT's own
// driver (OK changes the design) and a SAVED driver from My Drivers (OK changes the library
// entry, and the design is not involved at all). The subject is set when the editor opens
// and read by the title, so the user can never be unsure which one they are changing.
//
// A saved driver being edited is remembered by the identity it had when the editor opened —
// which is what lets a rename REPLACE that entry rather than orphan it, while a rename that
// collides with a different saved driver still overwrites that one, exactly as Save does.

type EditorSubject =
  | { kind: 'project' }
  | { kind: 'myDriver'; openedAs: string };

/** What the editor should build its OWN draft from. `seed` is a detached copy, handed once —
 *  the editor owns it from there; this module keeps nothing for it to hand back. `seed: null`
 *  means the editor builds its own (a blank `OpenISDDriver.empty()` for a fresh My Driver, or
 *  the project's committed driver via `requireFocusedProject().committedDriverText()` for the project
 *  subject — this module does not construct either, since it is not a licensed constructor). */
export type EditorDraftSeed =
  | { kind: 'project' }
  | { kind: 'myDriver'; openedAs: string; seed: OpenISDDriver | null };

export interface DriverSelection {
  selectDriver(f: PoolEntry): Promise<SelectionResult>;
  editMyDriver(d: OpenISDDriver): void;
  editOverviewDriver(f: PoolEntry): Promise<SelectionResult>;
  editProjectDriver(): void;
  openNewDriver(): void;
  /** What the editor is open on right now, and what to seed its own draft from. */
  editSubject(): EditorDraftSeed;
  /** The editor is done — cancelled, or committed elsewhere (the editor commits through the
   *  domain API directly; this only resets which subject is open). */
  closeEditor(): void;
}

export function createDriverSelection(): DriverSelection {
  let subject: EditorSubject = { kind: 'project' };
  let editSeed: OpenISDDriver | null = null;

  /**
   * Choosing a driver COPIES it into the project and returns the user to the project.
   *
   * This is WinISD's model, which OpenISD follows: there is no live link from a project back
   * to wherever the driver came from. The library row, the saved My Driver and the file on
   * disk are all sources; once chosen, the project owns its own copy and later edits change
   * that copy alone. Editing is a separate act, from the Driver panel's Edit button.
   */
  function adoptIntoProject(driver: OpenISDDriver): void {
    requireFocusedProject().setDriver(driver);
  }

  function embedInProject(driver: OpenISDDriver): void {
    adoptIntoProject(driver);
    presentationState.browseOpen = false;
  }

  /** The driver behind a library row, whatever kind of row it is — a DETACHED copy, so the
   *  caller can edit it freely without mutating the row still on screen. A saved driver and a
   *  bundled one are both already domain objects; only a federated `.wdr` needs fetching. */
  async function driverOf(f: PoolEntry):
      Promise<{ ok: true; driver: OpenISDDriver } | { ok: false; error: string }> {
    if (f.myDriverData) return { ok: true, driver: f.myDriverData.detach() };
    if (f.record) return { ok: true, driver: f.record.detach() };
    return modelOf(f);
  }

  function closeEditor(): void {
    subject = { kind: 'project' };
    editSeed = null;
    presentationState.editDriverInfo = false;
  }

  return {
    /**
     * The user chose a driver from the library. Builds it (from a saved My Driver, a bundled
     * record, or a `.wdr` fetched from a federated source) and embeds it in the project.
     *
     * The picker closes and the user is back in the project. The source is left exactly as it
     * was — the project took a copy.
     */
    async selectDriver(f) {
      const read = await driverOf(f);
      if (!read.ok) return { ok: false, error: read.error };
      embedInProject(withLinks(read.driver, f));
      return { ok: true };
    },

    // GAP (fork investigation 2026-09-07, PLAN_DELETE_PACKAGES_MODEL.md §4b/§4c/§4e):
    // `@openisd/design`'s `OpenISDDriver` has no `.uuid()` — deliberately removed with the rest
    // of the killed accessor surface, and no replacement identity for a My Drivers entry has
    // been decided. `openedAs` is left `''` below rather than inventing an identity scheme (a
    // hash, a brand/model key, ...); until John rules on what identifies a My Drivers row, OK
    // on this editor files every save as a NEW entry rather than replacing the one opened.
    /** Open the editor on a saved driver. Its OK writes to My Drivers, never to the project. */
    editMyDriver(d) {
      subject = { kind: 'myDriver', openedAs: '' };
      editSeed = d.detach();
      presentationState.editDriverInfo = true;
    },

    /** Open the editor on a driver selected in the library overview. Its OK/Save writes to My Drivers. */
    async editOverviewDriver(f) {
      const read = await driverOf(f);
      if (!read.ok) return { ok: false, error: read.error };
      // See the GAP note on `editMyDriver` above — `.uuid()` no longer exists, so a saved
      // driver cannot be reopened "as itself"; every OK from here also files as a new entry.
      subject = { kind: 'myDriver', openedAs: '' };
      editSeed = withLinks(read.driver, f);
      presentationState.editDriverInfo = true;
      return { ok: true };
    },

    /** Open the editor on the project's own driver. */
    editProjectDriver() {
      subject = { kind: 'project' };
      editSeed = null;
      presentationState.editDriverInfo = true;
    },

    /**
     * Open the editor to CREATE a new driver from scratch — a completely blank driver, with no
     * placeholder brand or model. The editor's OK stays disabled until the user supplies both,
     * so the driver cannot be saved without the `<brand>/<model>` identity it will be filed under.
     *
     * Uses the myDriver subject, so OK saves it into My Drivers and leaves the open project's
     * driver alone. `openedAs` is empty: there is no existing entry this one replaces. `seed`
     * is null — this module is not a licensed `OpenISDDriver` constructor, so the editor builds
     * its own blank via `OpenISDDriver.empty()`.
     */
    openNewDriver() {
      subject = { kind: 'myDriver', openedAs: '' };
      editSeed = null;
      presentationState.browseOpen = false;
      presentationState.editDriverInfo = true;
    },

    editSubject() {
      return subject.kind === 'myDriver'
        ? { kind: 'myDriver', openedAs: subject.openedAs, seed: editSeed }
        : { kind: 'project' };
    },

    closeEditor,
  };
}
