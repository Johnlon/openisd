import { _emptyDriverRecord } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';
import { managedProject } from './store.js';
import { presentationState } from './presentationState.js';
import { driverId, type MyDriverRepo } from '../db/myDrivers.js';
import { driverFromWdrText, driverTextFromRecord } from './managedDriver.js';

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
  record?: _OpenISDDriverJson;
  path?: string;
  repo?: string | null;
  branch?: string | null;
  datasheet?: string;
  manupage?: string;
  vendorpage?: string;
  frd?: string;
  impedance?: string;
  myDriverData?: _OpenISDDriverJson;
}

/** Catalogue link fields live in the library index, not in the .wdr — overlay them on load. */
/** Library-row link → the SourceRole it is recorded under. */
const LINK_ROLES: ReadonlyArray<readonly [keyof LibraryEntry, 'manufacturer_datasheet' | 'manufacturer_product_page' | 'distributor_product_page']> = [
  ['datasheet', 'manufacturer_datasheet'],
  ['manupage', 'manufacturer_product_page'],
  ['vendorpage', 'distributor_product_page'],
];

/** Carry the library row's source links onto the record. They belong in `data_sources` — the
 *  record's own provenance index — not as driver FIELDS: a datasheet URL is not a T/S value. */
function withLinks(record: _OpenISDDriverJson, f: LibraryEntry): _OpenISDDriverJson {
  for (const [entryKey, role] of LINK_ROLES) {
    const url = f[entryKey];
    if (typeof url === 'string' && url) record.data_sources.value[role] = url;
  }
  return record;
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

/** Fetch and parse a federated `.wdr` row, or say why it could not be read. */
async function modelOf(f: LibraryEntry): Promise<{ ok: true; record: _OpenISDDriverJson } | { ok: false; error: string }> {
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
    return { ok: true, record: driverFromWdrText(text).toJsonRecord() };
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
  editMyDriver(d: _OpenISDDriverJson): void;
  editOverviewDriver(f: LibraryEntry): Promise<SelectionResult>;
  editProjectDriver(): void;
  openNewDriver(): void;
  editorSeed(): { driverText: string; subject: EditorSubject['kind'] };
  acceptDriverEdit(json: _OpenISDDriverJson): void;
  cancelDriverEdit(): void;
}

export function createDriverSelection(deps: { myDriverRepo: MyDriverRepo }): DriverSelection {
  const { myDriverRepo } = deps;

  let subject: EditorSubject = { kind: 'project' };
  let editorDraft: _OpenISDDriverJson | null = null;

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
  // disappears when they are migrated onto ManagedOpenISDProject directly.
  function adoptIntoProject(record: _OpenISDDriverJson): void {
    // The managed layer adopts drivers as SERIALISED TEXT, never as the record value (QO73) —
    // the round-trip is the boundary crossing, made explicit.
    managedProject.loadDriverFromOwdrText(JSON.stringify(record));
  }

  function embedInProject(record: _OpenISDDriverJson): void {
    adoptIntoProject(record);
    presentationState.browseOpen = false;
  }

  /** The record behind a library row, whatever kind of row it is. A saved driver and a bundled
   *  record are both already the app's shape; only a federated `.wdr` needs fetching. */
  async function recordOf(f: LibraryEntry):
      Promise<{ ok: true; record: _OpenISDDriverJson } | { ok: false; error: string }> {
    if (f.myDriverData) return { ok: true, record: structuredClone(f.myDriverData) };
    if (f.record) return { ok: true, record: structuredClone(f.record) };
    return modelOf(f);
  }

  function closeEditor(): void {
    subject = { kind: 'project' };
    editorDraft = null;
    presentationState.editDriverInfo = false;
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
      const read = await recordOf(f);
      if (!read.ok) return { ok: false, error: read.error };
      embedInProject(withLinks(read.record, f));
      return { ok: true };
    },

    /** Open the editor on a saved driver. Its OK writes to My Drivers, never to the project. */
    editMyDriver(d) {
      subject = { kind: 'myDriver', openedAs: driverId(d) };
      editorDraft = structuredClone(d);
      presentationState.editDriverInfo = true;
    },

    /** Open the editor on a driver selected in the library overview. Its OK/Save writes to My Drivers. */
    async editOverviewDriver(f) {
      const read = await recordOf(f);
      if (!read.ok) return { ok: false, error: read.error };
      // A saved driver is opened AS ITSELF, so OK replaces that entry. Anything else opens as
      // a new My Driver, so OK files it under whatever identity the user gives it.
      subject = f.myDriverData
        ? { kind: 'myDriver', openedAs: driverId(f.myDriverData) }
        : { kind: 'myDriver', openedAs: '' };
      editorDraft = withLinks(read.record, f);
      presentationState.editDriverInfo = true;
      return { ok: true };
    },

    /** Open the editor on the project's own driver. Auto-cancels any active Tune what-if first —
     *  the editor always seeds from the project's committed driver, so a live preview left
     *  open would silently disagree with what the editor shows. */
    editProjectDriver() {
      if (managedProject.isWhatIfActive()) { managedProject.cancelWhatIf(); presentationState.editDriver = false; }
      subject = { kind: 'project' };
      editorDraft = null;
      presentationState.editDriverInfo = true;
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
      editorDraft = _emptyDriverRecord();
      presentationState.browseOpen = false;
      presentationState.editDriverInfo = true;
    },

    /** What the editor seeds its draft from, as TEXT, and which driver that is. Text because
     *  the editor is the one file licensed to hold a live driver: it builds its draft from
     *  this directly, so nothing in between parses a driver record out of it. */
    editorSeed() {
      return {
        // A library/My-Drivers pick when one is being edited; otherwise the project's own
        // driver (or an empty one when none is chosen — the editor then authors from scratch).
        driverText: editorDraft ? driverTextFromRecord(editorDraft) : managedProject.editorSeedDriverText(),
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
        // A rename MOVES the driver: drop the entry the editor opened, then save under the new
        // identity — which overwrites whatever already held it. Two steps, not one, because they
        // are two different entries whenever the user changed the brand or the model.
        if (subject.openedAs && subject.openedAs !== driverId(json)) myDriverRepo.remove(subject.openedAs);
        myDriverRepo.upsert(json);
      } else {
        adoptIntoProject(json);
      }
      closeEditor();
    },

    /** Cancel/Esc: drop the draft. Neither the project nor My Drivers is touched. */
    cancelDriverEdit() {
      closeEditor();
    },
  };
}
