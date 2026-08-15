import { Driver as DriverModel, type DriverJSON, WinISDDriver } from '@openisd/winisd';
import type { DriverRaw } from '@openisd/engine';
import { state, managedProject, driverRecord } from './store.js';
import { driverId, type MyDriverRepo } from '../db/myDrivers.js';
import { DriverFileFormat } from '../driverFileFormat.js';

// The ONE implementation of "the user chose a driver" (ARCHITECTURE.md AD-7).
//
// WORKFLOW, so it lives in `logic`: choosing a driver decides what the app does next — it
// embeds the record in the project, closes the picker and moves the baseline. A repository
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
// Editing is a separate act. The editor serves two subjects and `subject` below records
// which: the PROJECT's own copy (OK changes the design), or a driver from MY DRIVERS (OK
// saves that entry and the design is not involved). The project is never written back into
// My Drivers — a saved driver changes only through an explicit save, of which
// `acceptDriverEdit` on a `myDriver` subject is one.
//
// The pickers own markup and CSS. They must not parse, fetch, commit, or decide what a
// selection means — they call this.

/** A row in the driver pool, as the pickers build it. Only the fields selection needs. */
export interface LibraryEntry {
  name: string;
  content?: string;
  /** A bundled `openisd.yml` record — the app's own driver shape. */
  record?: DriverJSON;
  path?: string;
  repo?: string | null;
  branch?: string | null;
  datasheet?: string;
  manupage?: string;
  vendorpage?: string;
  frd?: string;
  impedance?: string;
  myDriverData?: DriverRaw;
}

/** Catalogue link fields live in the library index, not in the .wdr — overlay them on load. */
const LINK_FIELDS: ReadonlyArray<[keyof LibraryEntry, string]> = [
  ['datasheet', 'datasheetUrl'],
  ['manupage', 'manuPageUrl'],
  ['vendorpage', 'vendorpageUrl'],
  ['frd', 'frdUrl'],
  ['impedance', 'impedanceUrl'],
];

function withLinks(m: DriverModel, f: LibraryEntry): DriverModel {
  for (const [entryKey, field] of LINK_FIELDS) {
    const url = f[entryKey];
    if (typeof url === 'string' && url) m.enter(field, url);
  }
  return m;
}

function rawUrlOf(f: LibraryEntry): string {
  const path = (f.path ?? '').split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${f.repo}/${f.branch}/${path}`;
}

/** Outcome of a selection. `error` is a message the picker shows in its own status line. */
export interface SelectionResult {
  ok: boolean;
  error?: string;
}

/** A driver read off the user's disk, or the reason the file could not be read. */
export type FileReadResult =
  | { ok: true; raw: DriverRaw }
  | { ok: false; error: string };

/**
 * Read a driver file the user picked off their own disk. The format is taken from the file
 * NAME, not sniffed from the bytes: `.owdr` is the app's own record, `.wdr` is WinISD text.
 *
 * The file name also supplies the MODEL when the file itself carries neither brand nor model
 * — a `.wdr` written by another tool need not fill those in, and a driver with no
 * `<brand>/<model>` has no identity to be saved under. The name is the file's own, not an
 * invented value.
 *
 * Reading a file does not touch the project. The driver lands in My Drivers, and choosing it
 * from there is what embeds it — the same one act for every driver, wherever it came from.
 */
export function driverFromFileText(text: string, fileName: string): FileReadResult {
  const format = DriverFileFormat.ofFileName(fileName);
  if (format === null)
    return { ok: false, error: `Not a driver file: ${fileName} (expected ${DriverFileFormat.ACCEPT})` };

  let m: DriverModel;
  try {
    m = format === DriverFileFormat.Wdr
      ? DriverModel.fromWdr(text)
      : DriverModel.fromJSON(JSON.parse(text) as DriverJSON);
  } catch (err) {
    return { ok: false, error: `Failed to parse ${fileName}: ${(err as Error).message}` };
  }

  const raw = m.raw();
  if (!raw.brand && !raw.model) {
    const base = fileName.replace(/\.[^.]*$/, '').trim();
    if (!base) return { ok: false, error: `${fileName} carries no brand or model, and its name gives none` };
    m.enter('model', base);
    return { ok: true, raw: m.raw() };
  }
  return { ok: true, raw };
}

/** Fetch and parse a federated `.wdr` row, or say why it could not be read. */
async function modelOf(f: LibraryEntry): Promise<{ ok: true; model: DriverModel } | { ok: false; error: string }> {
  let text = f.content;
  if (!text) {
    let res: Response;
    try {
      res = await fetch(rawUrlOf(f));
    } catch (err) {
      return { ok: false, error: 'Could not load: ' + (err as Error).message };
    }
    if (!res.ok) return { ok: false, error: 'Could not load: fetch failed (' + res.status + ')' };
    text = await res.text();
  }
  if (!/\[Driver\]/.test(text)) return { ok: false, error: 'Could not load: file did not parse as a WDR' };
  try {
    return { ok: true, model: DriverModel.fromWdr(text) };
  } catch (err) {
    return { ok: false, error: 'Could not load: ' + (err as Error).message };
  }
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

export interface DriverSelection {
  selectDriver(f: LibraryEntry): Promise<SelectionResult>;
  editMyDriver(d: DriverRaw): void;
  editOverviewDriver(f: LibraryEntry): Promise<SelectionResult>;
  editProjectDriver(): void;
  openNewDriver(): void;
  editorSeed(): { json: DriverJSON; subject: EditorSubject['kind'] };
  acceptDriverEdit(json: DriverJSON): void;
  cancelDriverEdit(): void;
}

export function createDriverSelection(deps: { myDriverRepo: MyDriverRepo }): DriverSelection {
  const { myDriverRepo } = deps;

  let subject: EditorSubject = { kind: 'project' };
  let editorDraft: DriverJSON | null = null;

  /**
   * Choosing a driver COPIES it into the project and returns the user to the project.
   *
   * This is WinISD's model, which OpenISD follows: there is no live link from a project back
   * to wherever the driver came from. The library row, the saved My Driver and the file on
   * disk are all sources; once chosen, the project owns its own copy and later edits change
   * that copy alone. Editing is a separate act, from the Driver panel's Edit button.
   *
   * The baseline is the driver AS CHOSEN, so Reset returns to it rather than to whatever the
   * user has since typed over it.
   */
  // The classic ADT and the app's model meet at `.wdr` text — the one format both can write
  // and read. This is the bridge while the picker/editor still speak the classic ADT; it
  // disappears when they are migrated onto ManagedProject directly.
  function adoptIntoProject(m: DriverModel): void {
    managedProject.loadDriverRecord(WinISDDriver.fromWdr(m.toWdr()).toOpenISDRecord());
  }
  /** The project's current driver, as the classic ADT the editor still edits. */
  function projectDriverAsModel(): DriverModel {
    const record = driverRecord.value;
    if (!record) return new DriverModel();          // no driver chosen — a blank one to edit
    const { value: wdr } = WinISDDriver.fromOpenISDRecord(record);
    return wdr ? DriverModel.fromWdr(wdr.toWdr()) : new DriverModel();
  }

  function embedInProject(m: DriverModel): void {
    adoptIntoProject(m);
    state.browseOpen = false;
  }

  function closeEditor(): void {
    subject = { kind: 'project' };
    editorDraft = null;
    state.editDriverInfo = false;
  }

  return {
    /**
     * The user chose a driver from the library. Builds it (from a saved My Driver, a bundled
     * openisd record, or a `.wdr` fetched from a federated source) and embeds it in the project.
     *
     * The picker closes and the user is back in the project. The source is left exactly as it
     * was — the project took a copy.
     */
    async selectDriver(f) {
      let m: DriverModel;
      if (f.myDriverData) {
        m = DriverModel.fromRaw(f.myDriverData);
      } else if (f.record) {
        // A bundled openisd record is already the app's driver shape — no file parsing.
        m = DriverModel.fromJSON(f.record);
      } else {
        const read = await modelOf(f);
        if (!read.ok) return { ok: false, error: read.error };
        m = read.model;
      }
      embedInProject(withLinks(m, f));
      return { ok: true };
    },

    /** Open the editor on a saved driver. Its OK writes to My Drivers, never to the project. */
    editMyDriver(d) {
      subject = { kind: 'myDriver', openedAs: driverId(d) };
      editorDraft = DriverModel.fromRaw(d).toJSON();
      state.editDriverInfo = true;
    },

    /** Open the editor on a driver selected in the library overview. Its OK/Save writes to My Drivers. */
    async editOverviewDriver(f) {
      let m: DriverModel;
      if (f.myDriverData) {
        m = DriverModel.fromRaw(f.myDriverData);
        subject = { kind: 'myDriver', openedAs: driverId(f.myDriverData) };
      } else if (f.record) {
        m = DriverModel.fromJSON(f.record);
        subject = { kind: 'myDriver', openedAs: '' };
      } else {
        const read = await modelOf(f);
        if (!read.ok) return { ok: false, error: read.error };
        m = read.model;
        subject = { kind: 'myDriver', openedAs: '' };
      }
      editorDraft = withLinks(m, f).toJSON();
      state.editDriverInfo = true;
      return { ok: true };
    },

    /** Open the editor on the project's own driver. Auto-cancels any active Tune what-if first —
     *  the editor always seeds from the project's committed driver, so a live preview left
     *  open would silently disagree with what the editor shows. */
    editProjectDriver() {
      if (managedProject.isWhatIfActive()) { managedProject.cancelWhatIf(); state.editDriver = false; }
      subject = { kind: 'project' };
      editorDraft = null;
      state.editDriverInfo = true;
    },

    /**
     * Open the editor to CREATE a new driver from scratch — a completely blank driver, with no
     * placeholder brand or model. The editor's OK stays disabled until the user supplies both,
     * so the driver cannot be saved without the `<brand>/<model>` identity it will be filed under.
     *
     * Uses the myDriver subject, so OK saves it into My Drivers and leaves the open project's
     * driver alone. `openedAs` is empty: there is no existing entry this one replaces.
     */
    openNewDriver() {
      subject = { kind: 'myDriver', openedAs: '' };
      editorDraft = new DriverModel().toJSON();
      state.browseOpen = false;
      state.editDriverInfo = true;
    },

    /** What the editor seeds its draft from, and which driver that is. */
    editorSeed() {
      return {
        json: editorDraft ?? projectDriverAsModel().toJSON(),
        subject: subject.kind,
      };
    },

    /**
     * OK. For the project's driver the draft becomes the design. For a saved driver the draft
     * is written to My Drivers under its `<brand>/<model>` identity — replacing the entry the
     * editor opened, so a rename moves that driver rather than leaving a stale twin behind, and
     * replacing any entry the new identity collides with, which is what Save does too.
     */
    acceptDriverEdit(json) {
      if (subject.kind === 'myDriver') {
        const raw = DriverModel.fromJSON(json).raw();
        // A rename MOVES the driver: drop the entry the editor opened, then save under the new
        // identity — which overwrites whatever already held it. Two steps, not one, because they
        // are two different entries whenever the user changed the brand or the model.
        if (subject.openedAs && subject.openedAs !== driverId(raw)) myDriverRepo.remove(subject.openedAs);
        myDriverRepo.upsert(raw);
      } else {
        adoptIntoProject(DriverModel.fromJSON(json));
      }
      closeEditor();
    },

    /** Cancel/Esc: drop the draft. Neither the project nor My Drivers is touched. */
    cancelDriverEdit() {
      closeEditor();
    },
  };
}
