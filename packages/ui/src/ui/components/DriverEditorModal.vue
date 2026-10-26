<script setup lang="ts">
import {DateField, EnumField, NumberField, PhoneEditorText, PhoneHelp, PhoneLabels, TextField} from '@openisd/design/fields';
import DriverDimensionsDiagram from './DriverDimensionsDiagram.vue'
import {computed, nextTick, onBeforeUnmount, provide, ref, watch} from 'vue';
import type {NumSpecField} from '../../logic/appState.js';
import {useFocusedProject} from '../../logic/focusedProjectContext.js';
import {useApp} from '../../logic/app.js';
import {wiringOptions} from '../../logic/driverDraft.js';
import {readDriverFileText} from '../../logic/driverFileText.js';
import {driverToWdrBytes} from '../../logic/fileImportExport.js';
import {cellClassOf} from '../../logic/driverCells.js';
import {commitMyDriver} from '../../hooks/DriverEditorModal-hooks.js';
import type {DqReason} from '@openisd/design';
import type {Calculated, Clearable, Entered, Precise, Readable, Writable} from '@openisd/design';
import UIField from './UIField.vue';
import UIFixedField from './UIFixedField.vue';
import UIPickField from './UIPickField.vue';
import type {DriverEditorSkin} from './driverEditorSkin.js';
import {provideCellScope} from './cellScope.js';
import {useEscToClose} from '../../logic/useEscToClose.js';
import {DriverFileFormat} from '../../fileFormat.js';
import EquationInspectorModal from './EquationInspectorModal.vue';
import MobileKeyStrip from '../shells/mobile/MobileKeyStrip.vue';
import PhoneBand from '../shells/mobile/PhoneBand.vue';
import SaveToLibraryDialog from './SaveToLibraryDialog.vue';
import type {SaveNameField} from '../../hooks/saveNameField.js';
import {getProvenanceInfo, PROVENANCE_MAP} from '../../logic/provenance.js';
import {editableFrom, elementFrom, inputFrom, selectedOption} from '../../logic/domEvents.js';
import {FIELD_EDIT_MODE} from '../../logic/fieldEditMode.js';

function cellOf(field: NumSpecField): Readable<number | null> & Entered & Calculated {
  return fieldOf(field);
}

const { presentation: presentationState, selection, myDrivers, logging, driverFileStorage, designFiles, driverDrafts, confirmPort } = useApp();

// Driver editor — a modal. Recreates WinISD's "Driver editor" dialog (docs/winisd_screenshots/edit_driver_pg*.png):
// 4 tabs — General / Parameters / Advanced / Dimension
//
// Layered Memory architecture:
// - Layer 1: Disk/File/Library (WDR, OWDR)
// - Layer 2: App Active State / Simulation State (committed design driver in store)
// - Layer 3: Dialog/Draft Session Layer (local draftDriver instance, isolated until OK)
//
// THE EDITOR OWNS ITS OWN DRAFT (D22): `selection.editSubject()` says WHICH driver is being
// edited and hands over a SEED to build a DETACHED draft from — `selection` holds no draft of
// its own and never receives the edited driver back. This dialog is one of the files the
// containment gate licenses to construct `OpenISDDriver` directly (the others: managedProject.ts,
// driverSelection.ts) — see architecture.test.ts "ManagedProject is the only holder of
// OpenISDDriver".

const props = defineProps<{
  /** The phone's classes for the shared field rows and buttons; none on the desktop. */
  skin?: DriverEditorSkin;
}>();
const emit = defineEmits<{ close: [] }>();

type Tab = 'General' | 'Parameters' | 'Advanced' | 'Dimensions';
const TABS: Tab[] = ['General', 'Parameters', 'Advanced', 'Dimensions'];

// What subject is open, fixed for the dialog's whole lifetime (selection is not consulted
// again until this dialog closes).
const subject = selection.editSubject();
const tab = ref<Tab>('Parameters');
const project = useFocusedProject();

// The title names WHICH driver is on screen, because this one dialog edits two subjects with
// different consequences: OK on the project's driver changes the design, OK on a saved driver
// changes that My Drivers entry and leaves the design alone.
const editorTitle = subject.kind === 'myDriver' ? 'Edit My Driver' : "Edit Project's Driver";

// The editing session lives in logic/: it constructs and detaches the driver, and this dialog
// only reads and writes fields through the handle. `draftDriver` is the handle's current
// driver, re-read on every redraw so a reset() or a file load is picked up.
const draft = driverDrafts.open(subject, () => project.value.driver);
const trigger = ref(0);
function forceUpdate() { trigger.value++; }
provideCellScope({ revision: trigger, written: forceUpdate });
const draftDriver = computed(() => { void trigger.value; return draft.driver; });

/** OK on a myDriver subject: save the draft under its uuid — in place, same identity. A save
 *  that would CHANGE the driver's brand/model first asks the ONE ruled question (rename in
 *  place vs save as copy) via `renameQuestionOpen`; by the time this runs, that is decided. */
function commitToMyDrivers(driver: typeof draft.driver, replacesOpened: boolean): void {
  if (subject.kind !== 'myDriver') throw new Error('commitToMyDrivers called on a project subject');
  if (!commitMyDriver(myDrivers, driver, replacesOpened ? subject.openedAs : '')) {
    alert('Saved drivers are read-only until the storage problem is resolved');
  }
}

/** The saved entry this editor session opened, as it stands in storage — the comparison base
 *  for the rename question. Null when the subject is new or storage is not readable. */
function savedEntryForSubject(): typeof draft.driver | null {
  if (subject.kind !== 'myDriver' || !subject.openedAs) return null;
  // The uuid is the REPOSITORY's key, held beside the driver rather than on it — a driver
  // carries no identity of its own (John: "the id is not on the driver, it is the key into the
  // open driver map").
  return myDrivers.list().find(e => e.uuid === subject.openedAs)?.driver ?? null;
}

/** A save is a RENAME when the draft's brand/model differ from the SAVED entry's. */
function saveWouldRename(): boolean {
  const saved = savedEntryForSubject();
  if (!saved) return false;
  return saved.brand.value !== draftDriver.value.brand.value
    || saved.model.value !== draftDriver.value.model.value;
}

// The ONE question (QO81 rename ruling, "option 3"): rename this driver in place (same uuid),
// or save as a copy (new uuid, the original untouched). Two real actions; Clone stays the
// explicit fork elsewhere.
const renameQuestionOpen = ref(false);

function saveRenameInPlace(): void {
  renameQuestionOpen.value = false;
  commitToMyDrivers(draftDriver.value, true);
  logging.flash('Saved to My Drivers');
  selection.closeEditor();
  emit('close');
}

function saveAsCopy(): void {
  renameQuestionOpen.value = false;
  // A copy is a DIFFERENT driver (QO81): its own record identity, never the source's — sharing
  // the source's uuid would make the two rows answer to one favourites entry.
  commitToMyDrivers(draftDriver.value.copyAsNew(), false);
  logging.flash('Saved as a copy to My Drivers');
  selection.closeEditor();
  emit('close');
}

// A DISPLAY VIEW of the draft, not a second model: every value is read back out of the draft
// through its own accessors, so the template binds to one shape while the draft stays the only
// place a value lives.
const driverRaw = computed(() => {
  void trigger.value;
  const d = draftDriver.value;
  return {
    brand: d.brand.value,
    model: d.model.value,
    manufacturer: d.manufacturer.value,
    providedBy: d.providedBy.value,
    comment: d.comment.value,
    added: d.added.value,
    sku: d.sku.value,
    VCCon: d.specs.VCCon.value,
  };
});

/** The General tab's text boxes, three to a row on the desktop and one per row on the phone. */
type TextKey = 'manufacturer' | 'brand' | 'model' | 'sku' | 'providedBy' | 'added';
interface TextRow { readonly key: TextKey; readonly def: TextField | DateField }
const GENERAL_TEXT_ROWS: readonly (readonly TextRow[])[] = [
  [
    {key: 'manufacturer', def: TextField.DRIVER_MANUFACTURER},
    {key: 'brand', def: TextField.DRIVER_BRAND},
    {key: 'model', def: TextField.DRIVER_MODEL},
  ],
  [
    {key: 'sku', def: TextField.DRIVER_SKU},
    {key: 'providedBy', def: TextField.DRIVER_PROVIDEDBY},
    {key: 'added', def: DateField.DRIVER_ADDED},
  ],
];
/** Brand and Model are the filing key: bold border always, red while empty. */
function textInputClass(key: TextKey): Record<string, boolean> {
  if (key !== 'brand' && key !== 'model') return {};
  const value = driverRaw.value[key];
  return {'de-brand': key === 'brand', 'de-model': key === 'model', 'de-input-mandatory': true, 'de-input-empty': !value || !value.trim()};
}

function setText(field: TextKey | 'comment', e: Event) {
  // Metadata is a ScrapedField, a different envelope from a SpecEntry, so it has its own
  // entry point. Routing a string through enter() would put it in the wrong envelope.
  const edited = editableFrom(e);
  if (edited === null) return;
  const value = edited.value;
  const d = draftDriver.value;
  switch (field) {
    case 'brand': d.brand.set(value); break;
    case 'model': d.model.set(value); break;
    case 'manufacturer': d.manufacturer.set(value); break;
    case 'providedBy': d.providedBy.set(value); break;
    case 'comment': d.comment.set(value); break;
    case 'added': d.added.set(value); break;
    case 'sku': d.sku.set(value); break;
  }
  forceUpdate();
}

/** Dispatch a runtime `SpecField` name to the draft's flat accessor — `SpecField` never
 *  appears as a public parameter on `OpenISDDriver` itself (human ruling 2026-08-24,
 *  ENCAPSULATION_AND_LAYERING.md); this is the one UI-layer dispatch point for the editor's
 *  data-driven field table. */

/** The voice-coil wiring, which is a NAME rather than a number and so has its own entry point —
 *  `setNum`'s table is numeric, and routing a wiring through it would put a 1 or a 2 where the
 *  domain expects 'parallel'/'series'. */
const WIRING_OPTIONS = wiringOptions();
/** The Connection control's provenance mark. Read off the same cell every numeric field beside
 *  it is read off, so an unstated wiring shows calculated (the record's own 'C' parallel) and a
 *  chosen one shows entered — it was the one control in the dialog with no mark
 *  (BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded). */
const wiringClass = computed(() => {
  void trigger.value;
  const d = draftDriver.value;
  return cellClassOf(d.specs.VCCon);
});
function setWiring(e: Event) {
  const wiring = selectedOption(e, WIRING_OPTIONS);
  if (wiring === null) return;
  draft.setWiring(wiring);
  forceUpdate();
}

// One reach into the DRAFT model (layer 3) — What-if? passes the store's effective
// model to the same helpers instead, so the provenance marks and the Q-group rule cannot
// disagree between this dialog and What-if? showing the same driver.


/** The draft's HANDLE for one field — total over `NumSpecField`, never null
 *  (BUG_20260927_ui-fakes-driver-cells.md). `VCCon` is deliberately excluded from the
 *  PARAMETER TYPE: it is the one spec field holding a wiring NAME rather than a number, so it
 *  cannot be read as a numeric cell, and the template binds it through `driverRaw.VCCon`
 *  instead — no cast, no runtime check, no fake cell standing in for it here. */
function fieldOf(field: NumSpecField): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable {
  void trigger.value;
  return draftDriver.value.specField(field);
}

function cellVal(field: NumSpecField): number | null {
  const v = cellOf(field).value;
  return typeof v === 'number' ? v : null;
}

// ── Auto-calculate & Provenance Inspector ──────────────────────────────────────
const autoCalculate = computed({
  get: () => { void trigger.value; return draft.autoCalculate; },
  set: (v: boolean) => { draft.setAutoCalculate(v); forceUpdate(); },
});

const inspectProvenance = ref(false);
const provenanceHintVisible = ref(false);
const inspectedField = ref<string | null>(null);
provide(FIELD_EDIT_MODE, {
  enabled: computed(() => props.skin !== undefined && inspectProvenance.value),
  disabledAttempt: () => logging.flash('Input is disabled while inspecting provenance — long-press to edit'),
});

// Guards the popup sitting at a fixed viewport corner (right: 20px, bottom: 20px) regardless of
// where the editor renders — on a narrower or off-centre viewport it would land on top of the
// very modal it explains. Anchored here to the editor's OWN measured bounding box instead:
// beside its right edge when there is room, its left edge otherwise — so it can never cover the
// dialog it is inspecting, at any viewport size.
const modalRootEl = ref<HTMLElement | null>(null);
const popupStyle = ref<Record<string, string>>({});
// Phone: height of the docked card. The editor body gets this much bottom padding and scroll
// padding, so every row can be scrolled clear of the card and the tapped row is kept above it.
const dockedCardHeight = ref(0);
function updatePopupPosition() {
  const el = modalRootEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const gap = 12;
  const popupWidth = 380;
  // ~380px measured height of the rendered card (header + `.eq-body`'s own 320px max-height +
  // padding). Always beside the modal's right edge — never below/above it, which on a modest
  // window height positioned the card past the bottom of the viewport with nothing to signal
  // it was there. Both axes are clamped into the viewport as a hard floor: on a window too
  // narrow to clear the modal's right edge this can mean the popup brushes the modal, but a
  // popup rendered off-screen helps nobody, and that is strictly worse than a rare overlap.
  const popupHeight = 380;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // No room beside the editor (a phone, where the editor fills the screen): dock the card
  // inside the editor, over the lower part of its body, so the header, tabs and footer buttons
  // stay in view and tappable.
  const body = el.querySelector('.de-body');
  if (r.left <= gap && vw - r.right - 2 * gap < 200 && body) {
    const b = body.getBoundingClientRect();
    const height = Math.min(popupHeight, Math.round(b.height / 2));
    popupStyle.value = {
      position: 'fixed', left: `${Math.round(b.left)}px`, width: `${Math.round(b.width)}px`,
      top: `${Math.round(b.bottom - height)}px`, right: 'auto', bottom: 'auto',
      maxWidth: 'none', maxHeight: `${height}px`, display: 'flex', flexDirection: 'column',
    };
    dockedCardHeight.value = height;
    nextTick(keepInspectedRowAboveCard);
    return;
  }
  dockedCardHeight.value = 0;

  const width = Math.min(popupWidth, Math.max(200, vw - r.right - 2 * gap));
  const left = Math.min(Math.max(gap, r.right + gap), vw - gap - width);
  const top = Math.min(Math.max(gap, r.top), vh - gap - popupHeight);

  popupStyle.value = { position: 'fixed', left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, right: 'auto', bottom: 'auto', width: `${Math.round(width)}px` };
}
function keepInspectedRowAboveCard() {
  const key = inspectedField.value;
  const body = modalRootEl.value?.querySelector('.de-body');
  if (!key || !body || dockedCardHeight.value === 0) return;
  const row = Array.from(body.querySelectorAll<HTMLElement>('.de-fld')).find(f => f.dataset.fieldKey === key);
  row?.scrollIntoView({block: 'nearest'});
}
watch(inspectedField, (v) => {
  if (v) nextTick(updatePopupPosition);
  else dockedCardHeight.value = 0;
});
watch(inspectProvenance, (enabled) => {
  if (enabled) {
    if (props.skin !== undefined) {
      provenanceHintVisible.value = true;
      if (inspectedField.value === null) inspectedField.value = 'Qes';
    }
  } else {
    provenanceHintVisible.value = false;
    inspectedField.value = null;
  }
});
window.addEventListener('resize', updatePopupPosition);
onBeforeUnmount(() => window.removeEventListener('resize', updatePopupPosition));

/** Every number in the draft driver by schema name: what a formula input is worth right now. `driverRaw`
 *  is metadata only (brand/model/…), so the values come from the driver's own spec section.
 *  bugs/archive/BUG_20260817_provenance_live_substitution_always_shows_question_marks.md */
const inspectedValues = computed<Record<string, number | null>>(() => {
  void trigger.value;
  const currentValues: Record<string, number | null> = {};
  for (const [field, handle] of Object.entries(draftDriver.value.specs)) {
    const v = handle.value;
    if (typeof v === 'number') currentValues[field] = v;
  }
  return currentValues;
});

const provenanceInfo = computed(() => {
  if (!inspectProvenance.value || !inspectedField.value) return null;
  return getProvenanceInfo(inspectedField.value, inspectedValues.value);
});

/** Phone inspector: a formula input with its current value ("Qes = 0.420"); none on the desktop. */
const inputBadge = computed<((key: string) => string) | undefined>(() =>
  props.skin === undefined ? undefined : (key) => PhoneEditorText.valueBadge(key, inspectedValues.value[key] ?? null));

/** A field a formula path names as an input is tinted across its whole row cell (see `.de-feeds`). */
function feedsClass(fieldKey: string): string {
  const info = provenanceInfo.value;
  if (!inspectProvenance.value || !info || fieldKey === inspectedField.value) return '';
  return info.paths.some(path => path.inputs.includes(fieldKey)) ? 'de-feeds' : '';
}

/** Phone: a row whose value can be worked out from other rows carries the ƒ mark while Inspect Provenance is on. */
function fxClass(fieldKey: string): string {
  if (props.skin === undefined || !inspectProvenance.value) return '';
  return Object.hasOwn(PROVENANCE_MAP, fieldKey) ? 'de-fx' : '';
}

/** The classes a row takes while the provenance inspector is on: fed by the inspected field, and the ƒ mark. */
function inspectClass(fieldKey: string): string {
  return `${feedsClass(fieldKey)} ${fxClass(fieldKey)}`.trim();
}

function getFieldStyle(fieldKey: string) {
  if (!inspectProvenance.value || !inspectedField.value || !provenanceInfo.value) return {};

  if (fieldKey === inspectedField.value) {
    return {
      outline: '2px solid #38bdf8',
      outlineOffset: '1px',
      boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)',
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      borderRadius: '4px'
    };
  }

  for (const path of provenanceInfo.value.paths) {
    if (path.inputs.includes(fieldKey)) {
      return {
        backgroundColor: `${path.color}40`,
        borderRadius: '4px'
      };
    }
  }

  return {};
}

function handleBodyClickOrFocus(e: Event) {
  if (!inspectProvenance.value) return;
  const target = elementFrom(e);
  if (target === null) return;
  const fld = target?.closest('.de-fld');
  if (!fld) return;
  // The field's own key, read straight off the element — no label→key lookup.
  const key = (fld as HTMLElement).dataset.fieldKey;
  if (key) {
    provenanceHintVisible.value = false;
    inspectedField.value = key;
  }
}

function closeProvenance(): void {
  if (props.skin !== undefined) inspectProvenance.value = false;
  inspectedField.value = null;
}

// ── Data quality ──────────────────────────────────────────────────────────────
// Incompleteness NEVER blocks this dialog (human ruling 2026-08-05: "I need the save button
// to work even when the driver is incomplete"). A half-known driver is real data — it is
// recorded, flagged, and saved exactly as entered. The ENGINE is what declines to simulate
// an incomplete driver, and the charts carry that message; a disabled OK button just strands
// the human with typing they cannot keep.
//
// Two states that must not be merged, because the fix differs:
//   NOT ENTERED — no value at all. Renders blank.
//   BAD VALUE   — a number that cannot be physical (≤ 0). Renders as typed, marked .de-dq.
// Zero is a VALUE, not an absence: someone recorded it, and a scraper mis-read or a typo is
// worth showing rather than silently treating as "nothing here".
//
// The actual logic is in DriverEditorModal-hooks.ts, as plain functions parameterised on
// `cellOf`/the draft driver — these are thin wrappers closing over this component's own
// reactive `cellOf`/`draftDriver`/`trigger` so the template's call sites need no change.

// INCONSISTENT — the field belongs to a consistency group (WINISD_SCHEMA §4) whose members
// contradict each other beyond their own precision. The ADT decides; every member of the
// group is marked, because none of them is more wrong than the others. Like every other DQ
// state here it blocks nothing: the driver still simulates, saves and exports.

// Three lists, never merged: a missing Brand does not blank a chart, a missing Fs does not stop
// the driver being filed, and values that disagree with each other do neither — every one of
// them is present and every chart plots from them as stated. One strip claiming one consequence
// for all three is a statement the human has to go and disprove.

// The editor's own filing key. The engine has never heard of Brand or Model — a driver
// without them plots perfectly and simply cannot be FILED, because `<brand>/<model>` is what
// My Drivers, the project and the export filename all look it up by.
const identityReasons = computed<DqReason[]>(() => {
  void trigger.value;
  const r = driverRaw.value;
  const out: DqReason[] = [];
  if (!r.brand?.trim()) out.push({subject: 'Brand', text: 'is not set'});
  if (!r.model?.trim()) out.push({subject: 'Model', text: 'is not set'});
  return out;
});

// Mandatory for the SIMULATION, not for saving. The rules are not restated here: the design
// package's driver ADT owns them and exposes its verdict, so this reads that rather than
// keeping a second copy to drift. It is also how the GROUP rules arrive
// ("any two of Qts/Qes/Qms", "Qms must exceed Qts"), which no per-field check can express.
//
// Only a quantity the solver cannot derive, or a mandatory field with no value, reaches this
// list. An `inconsistent-inputs` issue never does: its values are all present
// (BUG_20260924_inconsistent-inputs-claims-charts-blank).
const chartBlockingReasons = computed<readonly DqReason[]>(() => {
  void trigger.value;
  return draftDriver.value.chartBlockingReasons();
});

// The stated values contradict each other. The charts plot from the stated values regardless,
// so this is a conflict to resolve, not a blocker — hence its own strip and its own consequence.
const inconsistentInputReasons = computed<readonly DqReason[]>(() => {
  void trigger.value;
  return draftDriver.value.inconsistentInputReasons();
});


/** The full-text tooltip for a `.de-incomplete` strip — one line per reason, subject and text
 *  rejoined, since a native `title` attribute cannot render `<strong>`. */
const reasonTitle = (reasons: readonly DqReason[]) => reasons.map(r => `${r.subject} ${r.text}`).join('\n');

/**
 * Copy to My Drivers — the draft as it stands becomes a saved driver, DISCONNECTED: no link
 * back to whatever is being edited, so later edits here do not follow it. Available whichever
 * driver the editor was opened on.
 *
 * A saved driver IS its `<brand>/<model>`, so this overwrites the entry already holding that
 * identity and adds one when none does. Nothing else in the editor is disturbed — the dialog
 * stays open and the project's driver is untouched until OK.
 */
const copiedMsg = ref('');
const saveMyDialogOpen = ref(false);
const saveBrand = ref('');
const saveModel = ref('');
const isCopyAction = ref(false);
const saveMyFields: readonly SaveNameField[] = [
  { label: 'Brand', placeholder: 'Brand name', text: saveBrand, inputClass: 'save-brand-input' },
  { label: 'Model', placeholder: 'Model (e.g. E150HE-44)', text: saveModel, inputClass: 'save-model-input' },
];


// Same-name drivers COEXIST under uuid identity (QO81): a name collision overwrites nothing,
// so there is no overwrite warning to show.

function openSaveMyDialog(forCopy: boolean = false) {
  // A saved driver IS its <brand>/<model>. There is no separate `name` to fall back to —
  // brand + model IS the name.
  saveBrand.value = driverRaw.value.brand || '';
  saveModel.value = driverRaw.value.model || '';
  isCopyAction.value = forCopy;
  saveMyDialogOpen.value = true;
}

function confirmSaveToMyDrivers() {
  if (!saveBrand.value.trim() || !saveModel.value.trim()) return;
  draftDriver.value.brand.set(saveBrand.value.trim());
  draftDriver.value.model.set(saveModel.value.trim());
  forceUpdate();

  if (isCopyAction.value) {
    // A copy is a DIFFERENT driver: fresh identity, never an overwrite (QO81). `upsert` with no
    // uuid mints a new REPOSITORY key regardless, but the driver's own record uuid — what
    // favourites key off — travels with the record unless reassigned here.
    const saved = myDrivers.upsert(draftDriver.value.copyAsNew());
    saveMyDialogOpen.value = false;
    copiedMsg.value = saved ? 'Copied to My Drivers' : 'Saved drivers are read-only — copy not stored';
    logging.flash(copiedMsg.value);
    setTimeout(() => { copiedMsg.value = ''; }, 2000);
  } else if (saveWouldRename()) {
    saveMyDialogOpen.value = false;
    renameQuestionOpen.value = true;   // the ONE question; its two buttons finish the save
  } else {
    saveMyDialogOpen.value = false;
    // No saved entry backs this session (e.g. Edit on a library/bundled driver's overview, or a
    // brand-new driver) — this save FILES a new My Drivers entry, so it needs its own record
    // identity rather than the source's (the bug: editing a library driver and saving it kept
    // that driver's own uuid, so its favourite star stayed linked to the library original's).
    const opened = savedEntryForSubject() != null;
    commitToMyDrivers(opened ? draftDriver.value : draftDriver.value.copyAsNew(), opened);
    logging.flash('Saved to My Drivers');
    selection.closeEditor();
    emit('close');
  }
}

function copyToMyDrivers() {
  if (!requireIdentity()) return;
  openSaveMyDialog(true);
}

// ── The ONE gate: Brand + Model ───────────────────────────────────────────────
// A saved driver IS its `<brand>/<model>` — that pair is the index key every store here
// looks it up by (My Drivers upsert, the project's driver, the export filename), so a
// driver without one cannot be filed anywhere. Nothing else gates anything: missing T/S
// only means the charts stay blank, which the strip above the footer says.
//
// The buttons stay ENABLED and answer the click (human ruling 2026-08-05: "all the buttons
// on driver editor need to work regardless of driver"). A disabled button explains nothing;
// this one tells the human exactly what is wrong and puts the caret in the field.
const identityMissing = computed(() => {
  void trigger.value;
  const r = driverRaw.value;
  return !r.brand?.trim() || !r.model?.trim();
});
const identityMsgOpen = ref(false);

/** Guard for the three actions that FILE the driver somewhere. True ⇒ go ahead. */
function requireIdentity(): boolean {
  if (!identityMissing.value) return true;
  identityMsgOpen.value = true;
  return false;
}

/** Dismiss lands the human on the field to fix, not back where they were stuck. */
function dismissIdentityMsg() {
  identityMsgOpen.value = false;
  tab.value = 'General';
  const r = driverRaw.value;
  const sel = !r.brand?.trim() ? '.de-brand' : '.de-model';
  nextTick(() => document.querySelector<HTMLInputElement>(sel)?.focus());
}

// OK — the draft becomes the design or saves to My Drivers.
function close() {
  if (!requireIdentity()) return;
  if (subject.kind === 'myDriver') {
    openSaveMyDialog(false);
  } else {
    project.value.setDriver(draftDriver.value);
    selection.closeEditor();
    emit('close');
  }
}

/** Save-to-file: same gate, because the filename IS `<brand> <model>`. */
function requestExport() {
  if (!requireIdentity()) return;
  exportPickerOpen.value = true;
}

// Cancel — drop the draft AND any library pick. The design is exactly as it was, and the
// picker (still open behind this dialog) is where the user lands.
function cancel() {
  selection.closeEditor();
  emit('close');
}

// Reset — draft back to what it was seeded from (the picked driver, or the design).
function reset() {
  draft.reset();
  forceUpdate();
}

// Phone footer: OK, Cancel and More; More opens Export, Import, Copy to My Drivers and Reset as a popup.
const moreOpen = ref(false);
function fromMore(action: () => void) {
  moreOpen.value = false;
  action();
}

// Phone: the "N values disagree" bar. Its list stays shut while the inspector is on (it would sit on the card).
const disagreeOpen = ref(false);
const disagreeListShown = computed(() => disagreeOpen.value && !inspectProvenance.value);
function toggleDisagree() {
  if (inspectProvenance.value) logging.flash(PhoneEditorText.CLOSE_PROVENANCE_FIRST);
  else disagreeOpen.value = !disagreeOpen.value;
}
const modalStyle = computed(() => props.skin === undefined ? undefined : {...props.skin.rowVars, '--de-fx': `'${PhoneEditorText.FX_MARK}'`});

const fileInput = ref<HTMLInputElement | null>(null);
function triggerLoad() {
  fileInput.value?.click();
}

async function handleFileLoaded(e: Event) {
  const input = inputFrom(e);
  if (input === null) return;
  const file = input.files?.[0];
  if (!file) return;

  const format = DriverFileFormat.ofFileName(file.name);
  input.value = '';   // so re-picking the SAME file fires `change` again
  if (format === null) { logging.flash(`Could not import ${file.name}: not a driver file (expected ${DriverFileFormat.ACCEPT})`); return; }
  if (format === DriverFileFormat.Wdr) {
    const ok = await confirmPort.port.ask({
      title: 'Legacy driver import',
      message: 'Warning: Importing a legacy WinISD (.wdr) file will trigger parameter derivations that may overwrite or change some parameters. For exact loading, OpenISD (.owdr) format is recommended.\n\nDo you want to continue?',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
  }

  const failed = (why: string) => logging.flash(`Could not import ${file.name}: ${why}`);
  void readDriverFileText(file).then(({ text }) => {
    if (!text) { failed('the file is empty'); return; }
    try {
      // A `.wdr` is read as-read by the serialiser then projected into the app's own record;
      // an `.owdr` IS that record already. One reader each, and no second parse invented here.
      const { value: read, errors } = designFiles.driverFromText(text, format);
      if (!read) { failed(errors[0]?.message ?? 'unreadable'); return; }
      draft.replace(read);
      forceUpdate();
      logging.flash(`Driver imported from ${file.name}`);
    } catch (err) {
      failed(err instanceof Error ? err.message : String(err));
    }
  }, (err: Error) => { failed(err.message); });
}

// Format choice is an in-app panel, not a confirm(): OK/Cancel cannot name two formats, so
// the old dialog had to explain that "Cancel" MEANT ".wdr" — a destructive-looking button
// bound to an ordinary choice. The panel shows both formats with their trade-offs visible at
// the point of decision, so the .wdr caveat needs no second dialog to carry it.
const exportPickerOpen = ref(false);

async function writeDriver(format: DriverFileFormat) {
  exportPickerOpen.value = false;
  // `<brand> <model>` — the same name the driver reads by everywhere else, and what WinISD's
  // Save-Driver defaults to. It is also what makes the file load back under its own identity.
  const base = [driverRaw.value.brand, driverRaw.value.model]
    .filter((x): x is string => !!x && x.length > 0).join(' ').trim() || 'Driver';
  // `.owdr` IS the record. A `.wdr` is that record projected by the serialiser — the one place
  // that knows the format — and a driver too incomplete to project says so rather than writing
  // a file WinISD would refuse.
  const { value: body, errors } = format === DriverFileFormat.Owdr
    ? { value: designFiles.driverToOwdrBytes(draftDriver.value), errors: [] }
    : driverToWdrBytes(draftDriver.value);
  if (!body) { logging.flash(`Cannot export .${format.value}: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
  // Then the SYSTEM save dialog — the user picks folder and name, as a desktop app would.
  // The MIME must be a CUSTOM type, not application/json or text/plain. The picker unions the
  // extensions we list with every extension registered to that MIME, so `application/json`
  // offered ".owdr, .json" and `text/plain` offered ".wdr, .txt, .text" — a save dialog
  // inviting the user to write a driver to a filename the app will not read back.
  const r = await driverFileStorage.saveAs(body, format.fileName(base), format.mime, format.label, '.' + format.value);
  if (!r.cancelled) logging.flash(`Driver exported as ${r.name ?? '.' + format.value}`);
}

useEscToClose(() => presentationState.editDriverInfo, cancel);
// Registered AFTER the editor on purpose: the Esc stack resolves last-registered first, so
// this makes the format picker the innermost dismissal. Otherwise Esc aimed at a two-option
// panel would close the whole editor and discard the session's edits.
useEscToClose(() => exportPickerOpen.value, () => { exportPickerOpen.value = false; });
useEscToClose(() => identityMsgOpen.value, dismissIdentityMsg);
</script>

<template>
  <div class="overlay on">
    <div class="modal de-modal" :class="skin ? 'de-phone mob-classic' : 'de-desktop'" :style="modalStyle" ref="modalRootEl">
      <h2>{{ editorTitle }}<button class="x" @click="cancel" title="Close without keeping changes">✕</button></h2>

      <div class="de-tabs">
        <button v-for="t in TABS" :key="t" class="de-tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      </div>

      <MobileKeyStrip v-if="skin" />

      <!-- The scroll area: the fields, then what is wrong with them. On the desktop it dissolves into the dialog's own column; on the phone it is the one thing that scrolls. -->
      <div class="de-scroll">
        <div class="body de-body" :class="{ 'labels-left': tab !== 'General' }"
             :style="dockedCardHeight > 0 ? { paddingBottom: `${dockedCardHeight}px`, scrollPaddingBottom: `${dockedCardHeight}px` } : {}" @click="handleBodyClickOrFocus" @focusin="handleBodyClickOrFocus">
          <!-- ============================= General ============================= -->
          <div v-if="tab === 'General'" class="de-general" :style="skin?.generalColumnVars">
            <div v-for="(row, i) in GENERAL_TEXT_ROWS" :key="i" class="de-row2">
              <template v-for="t in row" :key="t.key">
                <UIPickField v-if="skin" class="de-fld" :class="skin.field" :data-field-key="t.key" :title="t.def.description" :label="t.def.label" :input-id="`de-text-${t.key}`">
                  <input :id="`de-text-${t.key}`" type="text" :class="textInputClass(t.key)" :value="driverRaw[t.key] || ''" @input="setText(t.key, $event)">
                </UIPickField>
                <div v-else class="de-fld" :data-field-key="t.key" :title="t.def.description">
                  <label>{{ t.def.label }}</label>
                  <input type="text" :class="textInputClass(t.key)" :value="driverRaw[t.key] || ''" @input="setText(t.key, $event)">
                </div>
              </template>
            </div>
            <UIPickField v-if="skin" class="de-fld de-comment" :class="skin.fieldStacked" data-field-key="comment" :title="TextField.DRIVER_COMMENT.description" :label="TextField.DRIVER_COMMENT.label" input-id="de-text-comment">
              <textarea id="de-text-comment" :value="driverRaw.comment || ''" @input="setText('comment', $event)"></textarea>
            </UIPickField>
            <div v-else class="de-fld de-comment" data-field-key="comment" :title="TextField.DRIVER_COMMENT.description">
              <label>{{ TextField.DRIVER_COMMENT.label }}</label>
              <textarea :value="driverRaw.comment || ''" @input="setText('comment', $event)"></textarea>
            </div>
          </div>

          <!-- ============================= Parameters ============================= -->
          <div v-if="tab === 'Parameters'" class="de-params">
            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_THIELE_SMALL" />
              <div v-else class="de-hdr">Thiele/Small parameters</div>
              <div class="de-cols">
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Qes')]" data-field-key="Qes" :style="getFieldStyle('Qes')" :field="NumberField.QES" :cell="fieldOf('Qes')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Qms')]" data-field-key="Qms" :style="getFieldStyle('Qms')" :field="NumberField.QMS" :cell="fieldOf('Qms')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Qts')]" data-field-key="Qts" :style="getFieldStyle('Qts')" :field="NumberField.QTS" :cell="fieldOf('Qts')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Fs_hz')]" data-field-key="Fs_hz" :style="getFieldStyle('Fs_hz')" :field="NumberField.FS_HZ" :cell="fieldOf('Fs_hz')" required />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Vas_m3')]" data-field-key="Vas_m3" :style="getFieldStyle('Vas_m3')" :field="NumberField.VAS_M3" :cell="fieldOf('Vas_m3')" required />
              </div>
            </div>

            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_ELECTRO_MECHANICAL" />
              <div v-else class="de-hdr">Electro-Mechanical parameters</div>
              <div class="de-cols">
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Mms_kg')]" data-field-key="Mms_kg" :style="getFieldStyle('Mms_kg')" :field="NumberField.MMS_KG" :cell="fieldOf('Mms_kg')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Cms_m_per_N')]" data-field-key="Cms_m_per_N" :style="getFieldStyle('Cms_m_per_N')" :field="NumberField.CMS_M_PER_N" :cell="fieldOf('Cms_m_per_N')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Rms_kg_per_s')]" data-field-key="Rms_kg_per_s" :style="getFieldStyle('Rms_kg_per_s')" :field="NumberField.RMS_KG_PER_S" :cell="fieldOf('Rms_kg_per_s')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Re_ohm')]" data-field-key="Re_ohm" :style="getFieldStyle('Re_ohm')" :field="NumberField.RE_OHM" :cell="fieldOf('Re_ohm')" required />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('BL_Tm')]" data-field-key="BL_Tm" :style="getFieldStyle('BL_Tm')" :field="NumberField.BL_TM" :cell="fieldOf('BL_Tm')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Dd_m')]" data-field-key="Dd_m" :style="getFieldStyle('Dd_m')" :field="NumberField.DD_M" :cell="fieldOf('Dd_m')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Le_H')]" data-field-key="Le_H" :style="getFieldStyle('Le_H')" :field="NumberField.LE_H" :cell="fieldOf('Le_H')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Sd_m2')]" data-field-key="Sd_m2" :style="getFieldStyle('Sd_m2')" :field="NumberField.SD_M2" :cell="fieldOf('Sd_m2')" required />
                <!-- fLe is STORED IN HERTZ (docs/design/WINISD_SCHEMA.md) and shown in kHz, so the
                     scale DIVIDES by 1000. NumInput renders `SI × scale`, so a ×1000 here read
                     Hz as kHz and put the field out by 1e6. -->
                <UIField class="de-fld" :class="[skin?.field, inspectClass('fLe_hz')]" data-field-key="fLe_hz" :style="getFieldStyle('fLe_hz')" :field="NumberField.FLE_HZ" :cell="fieldOf('fLe_hz')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('KLe_H_sqrtHz')]" data-field-key="KLe_H_sqrtHz" :style="getFieldStyle('KLe_H_sqrtHz')" :field="NumberField.KLE_H_SQRTHZ" :cell="fieldOf('KLe_H_sqrtHz')" />
              </div>
            </div>

            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_LARGE_SIGNAL" />
              <div v-else class="de-hdr">Large-Signal parameters</div>
              <div class="de-cols">
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Xmax_m')]" data-field-key="Xmax_m" :style="getFieldStyle('Xmax_m')" :field="NumberField.XMAX_M" :cell="fieldOf('Xmax_m')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Hc_m')]" data-field-key="Hc_m" :style="getFieldStyle('Hc_m')" :field="NumberField.HC_M" :cell="fieldOf('Hc_m')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Hg_m')]" data-field-key="Hg_m" :style="getFieldStyle('Hg_m')" :field="NumberField.HG_M" :cell="fieldOf('Hg_m')" />

                <UIField class="de-fld" :class="[skin?.field, inspectClass('Vd_m3')]" data-field-key="Vd_m3" :style="getFieldStyle('Vd_m3')" :field="NumberField.VD_M3" :cell="fieldOf('Vd_m3')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Xlim_m')]" data-field-key="Xlim_m" :style="getFieldStyle('Xlim_m')" :field="NumberField.XLIM_M" :cell="fieldOf('Xlim_m')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Pe_W')]" data-field-key="Pe_W" :style="getFieldStyle('Pe_W')" :field="NumberField.PE_W" :cell="fieldOf('Pe_W')" />
              </div>
            </div>

            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_MISCELLANEOUS" />
              <div v-else class="de-hdr">Miscellaneous parameters</div>
              <div class="de-cols">
                <UIField class="de-fld" :class="[skin?.field, inspectClass('no')]" data-field-key="no" :style="getFieldStyle('no')" :field="NumberField.NO" :cell="fieldOf('no')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Znom_ohm')]" data-field-key="Znom_ohm" :style="getFieldStyle('Znom_ohm')" :field="NumberField.ZNOM_OHM" :cell="fieldOf('Znom_ohm')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('USPL_dB')]" data-field-key="USPL_dB" :style="getFieldStyle('USPL_dB')" :field="NumberField.USPL_DB" :cell="fieldOf('USPL_dB')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('SPL_dB')]" data-field-key="SPL_dB" :style="getFieldStyle('SPL_dB')" :field="NumberField.SPL_DB" :cell="fieldOf('SPL_dB')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('numVC')]" data-field-key="numVC" :style="getFieldStyle('numVC')" :field="NumberField.NUMVC" :cell="fieldOf('numVC')" />
                <UIPickField class="de-fld de-conn" :class="skin?.field" data-field-key="VCCon" :title="EnumField.VCCON.description" :label="EnumField.VCCON.label" input-id="de-conn-sel">
                  <select id="de-conn-sel" class="de-conn-sel" :class="wiringClass" :value="driverRaw.VCCon ?? 'parallel'" @change="setWiring"><option v-for="o in WIRING_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select>
                </UIPickField>
                <UIField class="de-fld" :class="[skin?.field, inspectClass('power_peak_W')]" data-field-key="power_peak_W" :style="getFieldStyle('power_peak_W')" :field="NumberField.POWER_PEAK_W" :cell="fieldOf('power_peak_W')" />
              </div>
            </div>
          </div>

          <!-- ============================= Advanced parameters ============================= -->
          <div v-if="tab === 'Advanced'" class="de-params">
            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_THERMAL" />
              <div v-else class="de-hdr">Thermal parameters</div>
              <div class="de-cols">
                <UIField class="de-fld" :class="[skin?.field, inspectClass('alfaVC_per_K')]" data-field-key="alfaVC_per_K" :style="getFieldStyle('alfaVC_per_K')" :field="NumberField.ALFAVC_PER_K" :cell="fieldOf('alfaVC_per_K')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Rt_K_per_W')]" data-field-key="Rt_K_per_W" :style="getFieldStyle('Rt_K_per_W')" :field="NumberField.RT_K_PER_W" :cell="fieldOf('Rt_K_per_W')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Ct_J_per_K')]" data-field-key="Ct_J_per_K" :style="getFieldStyle('Ct_J_per_K')" :field="NumberField.CT_J_PER_K" :cell="fieldOf('Ct_J_per_K')" />
              </div>
            </div>

            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_FIGURE_OF_MERIT" />
              <div v-else class="de-hdr">Figure of merits</div>
              <div class="de-cols">
                <UIField class="de-fld" :class="[skin?.field, inspectClass('SPLmaxLF_dB')]" data-field-key="SPLmaxLF_dB" :style="getFieldStyle('SPLmaxLF_dB')" :field="NumberField.SPLMAXLF_DB" :cell="fieldOf('SPLmaxLF_dB')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('SPLmax_dB')]" data-field-key="SPLmax_dB" :style="getFieldStyle('SPLmax_dB')" :field="NumberField.SPLMAX_DB" :cell="fieldOf('SPLmax_dB')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Rme_kg_per_s')]" data-field-key="Rme_kg_per_s" :style="getFieldStyle('Rme_kg_per_s')" :field="NumberField.RME_KG_PER_S" :cell="fieldOf('Rme_kg_per_s')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('gamma_m_per_s2_A')]" data-field-key="gamma_m_per_s2_A" :style="getFieldStyle('gamma_m_per_s2_A')" :field="NumberField.GAMMA_M_PER_S2_A" :cell="fieldOf('gamma_m_per_s2_A')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Mpow_N_per_sqrtW')]" data-field-key="Mpow_N_per_sqrtW" :style="getFieldStyle('Mpow_N_per_sqrtW')" :field="NumberField.MPOW_N_PER_SQRTW" :cell="fieldOf('Mpow_N_per_sqrtW')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Mcost_kg_per_s')]" data-field-key="Mcost_kg_per_s" :style="getFieldStyle('Mcost_kg_per_s')" :field="NumberField.MCOST_KG_PER_S" :cell="fieldOf('Mcost_kg_per_s')" />
                <UIField class="de-fld" :class="[skin?.field, inspectClass('EBP_hz')]" data-field-key="EBP_hz" :style="getFieldStyle('EBP_hz')" :field="NumberField.EBP_HZ" :cell="fieldOf('EBP_hz')" />
                <!-- The model holds the FRACTION the .wdr carries; WinISD's pane prints a
                     percentage. The `percent` unit group is the ONE place that ×100 lives. -->
                <UIField class="de-fld" :class="[skin?.field, inspectClass('Gloss')]" data-field-key="Gloss" :style="getFieldStyle('Gloss')" :field="NumberField.GLOSS" :cell="fieldOf('Gloss')" />
              </div>
            </div>

            <div class="de-group">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_ENVIRONMENT" />
              <div v-else class="de-hdr">Environment parameters</div>
              <div class="de-cols">
                <UIFixedField class="de-fld value-c" :class="skin?.field" data-field-key="c_m_per_s" :title="NumberField.C_M_PER_S.description" :field="NumberField.C_M_PER_S" :value="cellVal('c_m_per_s')" readonly />
                <UIFixedField class="de-fld value-c" :class="skin?.field" data-field-key="roo_kg_per_m3" :title="NumberField.ROO_KG_PER_M3.description" :field="NumberField.ROO_KG_PER_M3" :value="cellVal('roo_kg_per_m3')" readonly />
              </div>
            </div>
          </div>

          <!-- ============================= Dimensions ============================= -->
          <div v-if="tab === 'Dimensions'" class="de-dims">
            <div class="de-dimlist">
              <PhoneBand v-if="skin" :section="PhoneHelp.EDITOR_DIMENSIONS" />
              <div v-else class="de-hdr">Dimensions</div>
              <!-- Every length below is stored in METRES and shown in MILLIMETRES (the length unit group),
                   the same unit the Parameters tab uses for Xmax/Hc/Hg/Dd, and one of the units
                   WinISD offers on each of these fields. Unscaled, a 6.5" basket read "0.17";
                   Thick read a metre value under an inches label. -->
              <UIField class="de-fld" :class="skin?.field" data-field-key="Thick_m" :label="skin ? PhoneLabels.THICK : undefined" :field="NumberField.THICK_M" :cell="fieldOf('Thick_m')" />
              <UIField class="de-fld" :class="[skin?.field, inspectClass('Depth_m')]" data-field-key="Depth_m" :label="skin ? PhoneLabels.DEPTH : undefined" :style="getFieldStyle('Depth_m')" :field="NumberField.DEPTH_M" :cell="fieldOf('Depth_m')" />
              <UIField class="de-fld" :class="[skin?.field, inspectClass('MagDepth_m')]" data-field-key="MagDepth_m" :label="skin ? PhoneLabels.MAG_DEPTH : undefined" :style="getFieldStyle('MagDepth_m')" :field="NumberField.MAGDEPTH_M" :cell="fieldOf('MagDepth_m')" />
              <UIField class="de-fld" :class="[skin?.field, inspectClass('Magnet_m')]" data-field-key="Magnet_m" :label="skin ? PhoneLabels.MAGNET : undefined" :style="getFieldStyle('Magnet_m')" :field="NumberField.MAGNET_M" :cell="fieldOf('Magnet_m')" />
              <UIField class="de-fld" :class="skin?.field" data-field-key="Basket_m" :label="skin ? PhoneLabels.BASKET : undefined" :field="NumberField.BASKET_M" :cell="fieldOf('Basket_m')" />
              <UIField class="de-fld" :class="skin?.field" data-field-key="Outer_m" :label="skin ? PhoneLabels.OUTER : undefined" :field="NumberField.OUTER_M" :cell="fieldOf('Outer_m')" />
              <UIField class="de-fld" :class="skin?.field" data-field-key="Vcd_m" :label="skin ? PhoneLabels.VCD : undefined" :field="NumberField.VCD_M" :cell="fieldOf('Vcd_m')" />
              <UIField class="de-fld" :class="[skin?.field, inspectClass('DVol_m3')]" data-field-key="DVol_m3" :label="skin ? PhoneLabels.DVOL : undefined" :style="getFieldStyle('DVol_m3')" :field="NumberField.DVOL_M3" :cell="fieldOf('DVol_m3')" />
            </div>

            <div class="de-diagram" aria-hidden="true" title="Driver cross-section (reference diagram — dimensions not modelled)">
              <DriverDimensionsDiagram />
            </div>
          </div>
        </div>
      <!-- What is wrong, and what it actually costs. Saving is never blocked by any of them —
           each strip states its own consequence instead, so the human keeps their typing. Three
           strips, not one: a missing Brand does not blank a chart, a missing Fs does not stop
           the driver being filed, and values that merely disagree do neither — they are all
           present, so every chart plots from them as stated. Per-field red borders stay. -->
      <div class="de-strips">
        <div v-if="identityReasons.length" class="de-incomplete"
             :title="reasonTitle(identityReasons)">
          <span class="de-incomplete-hd">⚠ Saves fine, but can’t be filed under a name because:</span>
          <ul class="de-incomplete-list">
            <li v-for="r in identityReasons" :key="r.subject + r.text"><strong class="de-incomplete-subject">{{ r.subject }}</strong> {{ r.text }}</li>
          </ul>
        </div>
        <div v-if="chartBlockingReasons.length" class="de-incomplete"
             :title="reasonTitle(chartBlockingReasons)">
          <span class="de-incomplete-hd">⚠ Saves fine, but the charts stay blank because:</span>
          <ul class="de-incomplete-list">
            <li v-for="r in chartBlockingReasons" :key="r.subject + r.text"><strong class="de-incomplete-subject">{{ r.subject }}</strong> {{ r.text }}</li>
          </ul>
        </div>
        <div v-if="!skin && inconsistentInputReasons.length" class="de-incomplete de-inconsistent"
             :title="reasonTitle(inconsistentInputReasons)">
          <span class="de-incomplete-hd">⚠ Saves fine and the charts plot from the values as stated, but those values disagree because:</span>
          <ul class="de-incomplete-list">
            <li v-for="r in inconsistentInputReasons" :key="r.subject + r.text"><strong class="de-incomplete-subject">{{ r.subject }}</strong> {{ r.text }}</li>
          </ul>
        </div>
      </div>
      </div>

      <!-- On the phone the inspector is an overlay; its editing and action controls are hidden. -->
      <EquationInspectorModal
        v-if="skin"
        docked
        :open="inspectProvenance && inspectedField !== null"
        :target-field="inspectedField"
        :provenance-info="provenanceInfo"
        :show-edit-hint="provenanceHintVisible"
        :input-badge="inputBadge"
        @close="closeProvenance"
      />

      <div v-if="skin && inconsistentInputReasons.length" class="de-dq-bar">
        <button type="button" class="de-dq-head" :aria-expanded="disagreeListShown" @click="toggleDisagree">
          {{ PhoneEditorText.disagreeHeading(inconsistentInputReasons.length) }}<span aria-hidden="true">{{ disagreeListShown ? '▾' : '▸' }}</span>
        </button>
        <ul v-if="disagreeListShown" class="de-dq-list">
          <li v-for="r in inconsistentInputReasons" :key="r.subject + r.text"><strong>{{ r.subject }}</strong> {{ r.text }}</li>
        </ul>
      </div>

      <div v-if="!skin || !inspectProvenance" class="de-toolbar">
        <label class="de-provenance-chk" title="Auto-calculate derived/unknown T/S fields when parameters change">
          <input type="checkbox" v-model="autoCalculate" />
          <span>Auto calculate unknowns</span>
        </label>
        <label class="de-provenance-chk" title="Auto-highlight calculation feeding paths and display equations overlay">
          <input type="checkbox" v-model="inspectProvenance" />
          <span>Inspect Provenance</span>
        </label>
      </div>

      <div class="de-footer">
        <div v-if="!skin" class="de-legend2">
          <span class="de-legend-item"><span class="de-sw value-e"></span>Entered</span>
          <span class="de-legend-item"><span class="de-sw value-c"></span>Calculated</span>
          <span class="de-legend-item"><span class="de-sw value-n"></span>Not entered</span>
        </div>
        <div class="de-btns">
          <input type="file" ref="fileInput" style="display:none" @change="handleFileLoaded" :accept="DriverFileFormat.ACCEPT">
          <template v-if="!skin">
            <div class="de-btn-row">
              <button @click="requestExport" title="Export this driver to a file — choose the format, then where to put it">Export</button>
              <button @click="triggerLoad" title="Import a driver from a file">Import</button>
              <button class="de-copy-my" @click="copyToMyDrivers"
                      :title="copiedMsg || 'Copy this driver into My Drivers as an independent copy — no link back to it'">
                {{ copiedMsg || 'Copy to My Drivers' }}
              </button>
            </div>
            <div class="de-btn-row">
              <button v-if="!skin || !inspectProvenance" class="pri" @click="close" title="Apply changes and close the editor (updates local browser/project)">OK</button>
              <button @click="reset" title="Reset fields to the values when the editor was opened">Reset</button>
              <button v-if="!skin || !inspectProvenance" @click="cancel" title="Discard edits made in this session and close">Cancel</button>
            </div>
          </template>
          <div v-else class="de-btn-row">
            <button v-if="!inspectProvenance" class="pri" :class="[skin.button, skin.buttonPrimary]" @click="close" title="Apply changes and close the editor (updates local browser/project)">OK</button>
            <button v-if="!inspectProvenance" :class="[skin.button, skin.buttonSecondary]" @click="cancel" title="Discard edits made in this session and close">Cancel</button>
            <button v-if="!inspectProvenance" class="de-more" :class="[skin.button, skin.buttonSecondary, {on: moreOpen}]" aria-haspopup="menu" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">{{ PhoneEditorText.MORE }}<i>{{ PhoneEditorText.MORE_MARK }}</i></button>
          </div>
        </div>
        <template v-if="skin && moreOpen && !inspectProvenance">
          <div class="de-more-scrim" @click="moreOpen = false"></div>
          <div class="de-more-menu" role="menu" aria-label="More actions">
            <button type="button" role="menuitem" class="de-more-item" @click="fromMore(requestExport)" title="Export this driver to a file — choose the format, then where to put it">Export</button>
            <button type="button" role="menuitem" class="de-more-item" @click="fromMore(triggerLoad)" title="Import a driver from a file">Import</button>
            <button type="button" role="menuitem" class="de-more-item de-copy-my" @click="fromMore(copyToMyDrivers)" title="Copy this driver into My Drivers as an independent copy — no link back to it">Copy to My Drivers</button>
            <button type="button" role="menuitem" class="de-more-item" @click="fromMore(reset)" title="Reset fields to the values when the editor was opened">Reset</button>
            <hr>
            <div class="de-more-hint">{{ PhoneEditorText.HINT_UNIT }}</div>
            <div class="de-more-hint">{{ PhoneEditorText.HINT_SPIN }}</div>
          </div>
        </template>
      </div>

      <!-- Brand/Model gate. A popup rather than a disabled button, because a disabled button
           is silent: it neither says what is wrong nor where to fix it. Dismissing lands the
           caret in the empty field. -->
      <div v-if="identityMsgOpen" class="fmt-scrim" @click.self="dismissIdentityMsg">
        <div class="fmt-panel de-id-panel" role="alertdialog" aria-label="Brand and Model are required">
          <h3>Brand and Model are both required</h3>
          <p class="fmt-note">
            A driver is filed under its Brand and Model — that pair is how My Drivers, the
            project and the saved file all find it again. Every other field can stay empty.
          </p>
          <div class="fmt-foot">
            <button class="pri" :class="[skin?.button, skin?.buttonPrimary]" @click="dismissIdentityMsg">Fill them in</button>
          </div>
        </div>
      </div>

      <!-- Format picker. Sits INSIDE the editor rather than being a browser dialog, so both
           formats and their trade-offs are visible together at the moment of choosing. The
           system save dialog follows the choice. -->
      <div v-if="exportPickerOpen" class="fmt-scrim" @click.self="exportPickerOpen = false">
        <div class="fmt-panel" role="dialog" aria-label="Choose driver file format">
          <h3>Save driver as</h3>
          <button class="fmt-opt" @click="writeDriver(DriverFileFormat.Owdr)">
            <span class="fmt-name">OpenISD driver <code>.owdr</code> <em>recommended</em></span>
            <span class="fmt-note">Keeps everything: entered/calculated marks, dimensions and all OpenISD metadata. Reloads exactly as saved.</span>
          </button>
          <button class="fmt-opt" @click="writeDriver(DriverFileFormat.Wdr)">
            <span class="fmt-name">WinISD driver <code>.wdr</code></span>
            <span class="fmt-note">For opening in WinISD. Discards OpenISD-specific metadata and dimensions that the format has no field for.</span>
          </button>
          <div class="fmt-foot">
            <button :class="[skin?.button, skin?.buttonSecondary]" @click="exportPickerOpen = false">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Save to My Drivers prompt dialog -->
      <div v-if="renameQuestionOpen" class="fmt-scrim de-rename-panel">
        <div class="fmt-panel" role="dialog" aria-label="Rename or copy">
          <h3>This changes the driver's name</h3>
          <p class="fmt-note">
            You changed this saved driver's brand or model. Rename it in place, or keep the
            original and save your changes as a copy?
          </p>
          <div class="fmt-foot" style="margin-top: 14px;">
            <button class="pri rename-in-place-btn" :class="[skin?.button, skin?.buttonPrimary]" @click="saveRenameInPlace">Rename this driver</button>
            <button class="save-as-copy-btn" :class="[skin?.button, skin?.buttonSecondary]" @click="saveAsCopy">Save as a copy</button>
          </div>
        </div>
      </div>
      <SaveToLibraryDialog v-if="saveMyDialogOpen" title="Save to My Drivers"
        note="Confirm or update the Brand and Model to save this driver in My Drivers."
        :fields="saveMyFields" :can-save="!!saveBrand.trim() && !!saveModel.trim()" save-label="Save to My Drivers" :phone="skin !== undefined"
        @save="confirmSaveToMyDrivers" @cancel="saveMyDialogOpen = false" />
    </div>
    <EquationInspectorModal
      v-if="!skin"
      :open="inspectProvenance && inspectedField !== null"
      :target-field="inspectedField"
      :provenance-info="provenanceInfo"
      :show-edit-hint="provenanceHintVisible"
      :style="popupStyle"
      @close="closeProvenance"
    />
  </div>
</template>

<style scoped>
.overlay {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0,0,0,0.5) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 1100 !important;
}
/* ONE fixed box for all four tabs — switching tab must never resize the dialog under the
   user's cursor. Sized to the largest tab so nothing ever scrolls: Advanced parameters is
   the widest (about 840px of content with the step arrows) and Parameters the tallest. Both measured, not guessed. The
   vh caps are only a small-screen backstop. */
/* position: relative anchors the format picker's scrim to the editor, not the viewport. */
.de-modal { position: relative !important; display: flex !important; flex-direction: column !important; width: 976px !important; max-width: 96vw !important; min-height: 550px !important; max-height: 96vh !important; flex-shrink: 0 !important; overflow: hidden !important; }
.de-tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid var(--line); }
.de-tab { padding: 5px 12px; border: 1px solid var(--line); border-bottom: none; border-radius: 3px 3px 0 0; background: var(--panel2); color: var(--fg); cursor: pointer; font: inherit; font-size: 14px; font-weight: 500; }
.de-tab.on { background: var(--panel); font-weight: 600; }
.de-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 14px;
  border-top: 1px solid var(--line);
  background: var(--panel2);
}
.de-provenance-chk {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--mut, #94a3b8);
  cursor: pointer;
  user-select: none;
  padding: 3px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line, #2c384e);
}
.de-provenance-chk:hover {
  color: #38bdf8;
  border-color: #38bdf8;
}
.de-provenance-chk input {
  accent-color: #38bdf8;
  cursor: pointer;
  margin: 0;
}
.de-body { display: flex; flex-direction: column; gap: 6px; flex: 1 !important; }

.de-fld { position: relative; }
.de-desktop .de-fld { display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px; width: fit-content; justify-self: start; }
.de-desktop .de-fld :deep(label) { font-size: 11px; color: var(--mut); white-space: nowrap; }
.de-desktop .de-fld input, .de-desktop .de-fld select { padding: 2px 5px; border: 1px solid var(--line); border-radius: 3px; font: inherit; background: var(--panel); color: var(--fg); }
/* A unit button wider than two characters ("mm/N", "1000/K", "kg/m³") takes its width from its
   text; 34px is the minimum. bugs/BUG_20261019_driver-editor-unit-buttons-overflow.md */
.de-body :deep(.unit-label) { width: auto; min-width: 34px; }
.de-fld.cl-dim input, .de-fld.cl-dim select { background: var(--panel2); color: var(--mut); }
.de-row2 { display: flex; gap: 16px; }
.de-row2 .de-fld { flex: 1; width: auto; }
.de-row2 .de-fld :deep(input) { width: 100%; }

/* ── Dimensions panel only ──────────────────────────────────────────────────
   Two corrections after the diagram was consolidated into a shared component
   (2026-07-29):

   1. LABEL LEFT OF FIELD, not above. `.de-fld` is column-flex globally, which is
      right for the dense two-column tabs but wrong here — this panel is a short
      labelled list and reads as one when the label sits beside its input. Scoped
      to `.de-dims` so no other tab is touched.
   2. The diagram is HALF SIZE. The shared component is the 540x450 drawing (the
      good one, with dimension arrows); the inline copy it replaced was 300x260,
      so consolidating made this panel's illustration nearly twice as wide and it
      crowded the fields. Constrained here rather than in the component, because
      the component is shared and the size is this panel's concern. */


/* The shared diagram component is the 540x450 drawing; the inline copy it
   replaced was 300x260, so consolidating made this panel's illustration nearly
   twice as wide and it crowded the fields. Constrained HERE rather than in the
   component, because the component is shared and the size is this panel's
   concern. */
.de-general {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  height: 100% !important;
  min-height: 0 !important;
  gap: 6px !important;
}
/* The Comment box is this tab's FILLER — it takes the leftover width and the leftover height,
   being the only field on the tab with no natural size. The selector carries `.de-general` and
   both classes deliberately: `.de-fld` is one class too and declares `width: fit-content`
   further down the sheet, which won on cascade order and collapsed the box to 50px.
   bugs/archive/BUG_20260817_driver_editor_general_comment_box_renders_50px_wide.md */
.de-desktop .de-general .de-fld.de-comment {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 auto !important;
  width: 100% !important;
  max-width: 100% !important;
  min-height: 0 !important;
  margin-top: 4px !important;
}
.de-general .de-fld.de-comment textarea {
  width: 100% !important;
  height: 100% !important;
  flex: 1 1 auto !important;
  min-height: 120px !important;
  padding: 8px 10px !important;
  border: 1px solid var(--line);
  border-radius: 4px;
  font: inherit;
  background: var(--panel);
  color: var(--fg);
  resize: vertical;
  box-sizing: border-box !important;
}

.de-legend, .de-legend2 { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mut); margin-top: 6px; }
.de-sw { width: 14px; height: 14px; border: 1px solid var(--line); border-radius: 2px; display: inline-block; margin-left: 8px; }
.de-legend .de-sw:first-child, .de-legend2 .de-sw:first-child { margin-left: 0; }
.de-legend2 { gap: 14px; }
.de-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.de-sw.value-e { background: var(--good); }
.de-sw.value-c { background: var(--acc); }
.de-sw.value-n { background: #333; }
.de-auto { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; opacity: .8; }

/* Provenance colouring — text colour on the value, matching the legend swatches.
   Three shapes: cellClass() lands directly on NumInput's root <input> (fallthrough
   attrs), on a wrapping .de-fld for the read-only derived fields, or on the Connection
   <select>, whose value is a wiring name rather than a number. */
input.value-e, .de-fld.value-e input, .de-modal select.value-e { color: var(--good); }
input.value-c, .de-fld.value-c input, .de-modal select.value-c { color: var(--acc); }
input.value-n, .de-fld.value-n input, .de-modal select.value-n { color: var(--mut); }

/* ONE grid for the WHOLE tab, not one per section: WinISD's editor puts Qes, Mms, Xmax and
   `no` on the same column edge even though they live under four different headings, and a grid
   per section can only align the rows inside it. The section wrappers dissolve into it with
   `display: contents`, so every field on the tab sits in the same four columns and each heading
   spans the lot. The columns need no negotiation — every field component is the same width. */
.de-desktop .de-params {
  display: grid !important;
  /* Field-slots per row, 4 tracks each (label/value/unit/alert). A `.de-fld`
     subgrids across 4 of them (one field-slot); with only 4 tracks total here, every field
     spanned the whole row and the tab rendered as one field per line instead of four. */
  /* Two field-slots per row: four phone-sized controls (T595) are wider than the modal. */
  grid-template-columns: repeat(2, max-content max-content minmax(34px, max-content) 16px) !important;
  /* 2px between tracks: 15 gaps across 16 tracks; at 6px the grid was wider than the modal's body in Chromium and wider still in Firefox, so the body scrolled sideways. */
  gap: 3px 0 !important;
  align-items: center !important;
  align-content: start !important;
  justify-content: start !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
}
.de-desktop .de-params > .de-group,
.de-desktop .de-params .de-cols { display: contents !important; }
.de-desktop .de-params .de-hdr { grid-column: 1 / -1 !important; margin: 2px 0 0 !important; }
.de-hdr { background: var(--panel2); text-align: center; font-size: 11px; padding: 1px 0; border-radius: 3px; margin-bottom: 2px; color: var(--mut); }
.de-col { display: flex; flex-direction: column; }

.de-dims { display: flex; gap: 20px; align-items: flex-start; height: 100%; flex: 1 1 auto; }
.de-desktop .de-dimlist {
  /* Sized by its widest row, not a fixed 200px — the labels alone are wider than that, which
     is what forced them over their inputs. `max-content` on the label track keeps every row
     on one column edge. FOUR tracks: label, input, unit, DQ marker — the marker needs a track
     of its own or the row it appears on wraps and stops matching the rows around it. */
  display: grid;
  grid-template-columns: max-content max-content minmax(34px, max-content) 16px;
  align-items: center;
  /* A tight row pitch: eight fields read as ONE list, as they do in WinISD's own Dimensions
     page. Row spacing lives HERE and nowhere else — a per-field margin on top of it stacked
     up to a 24px band between 24px inputs. */
  gap: 4px 6px;
  width: max-content;
  flex-shrink: 0;
}
.de-note { font-size: 11px; color: var(--mut); font-style: italic; margin-top: 4px; }
.de-diagram { flex: 1 1 auto; display: flex; justify-content: center; align-items: center; min-width: 260px; height: 100%; }
.de-diagram :deep(.dd-dim-svg) { width: 100%; max-width: 440px; max-height: 350px; height: auto; color: var(--fg); }
.de-diagram :deep(text) { fill: var(--fg); }

.de-footer { display: flex; flex-direction: column; gap: 6px; padding: 8px 14px; border-top: 1px solid var(--line); }
.de-footer .de-legend2 { margin-top: 0; }
.de-btns { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; }
.de-btn-row { display: flex; gap: 6px; flex-wrap: wrap; }
.de-btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }

/* ONE FIELD = ONE COMPONENT, four parts: [label] [value] [unit] [alerts]. A unitless field
   keeps its unit track empty rather than collapsing it, and a field with no DQ mark keeps its
   alert track empty — every component in a column is therefore the SAME width, and same width
   is what makes the columns line up with no per-field negotiation. `subgrid` is how the width
   is shared: it takes the four tracks from the parent `.de-cols`/`.de-params` grid rather than
   sizing itself, so "same width" is enforced structurally, not by a guessed pixel number that
   fits one tab's labels and clips another's. The provenance highlight is painted on this box,
   so it wraps all four parts as one component. */
.de-desktop .de-fld {
  display: grid !important;
  grid-template-columns: subgrid !important;
  grid-column: span 4 !important;
  align-items: center !important;
  gap: 4px !important;
  margin-bottom: 0 !important;
  width: fit-content !important;
  max-width: 100% !important;
  padding: 1px 4px !important;
  border-radius: 4px !important;
  box-sizing: border-box !important;
  justify-self: start !important;
}
/* A field that feeds the inspected one is tinted across its whole row cell, label through unit,
   not only as wide as its content. The tint is the highlight; there is no border. */
.de-desktop .de-fld.de-feeds { width: 100% !important; justify-self: stretch !important; }
/* Connection flows beside Voicecoils: with two fields per row (T595) a forced row of its own
   left a one-field row above a full one. */
/* The phone row is as tall as its ▲▼ pair; the shell's 40px field floor would pad the editor out. */
.de-desktop .de-fld { min-height: 0 !important; }
/* "Parallel"/"Series" plus the native select arrow do not fit the shared 90px input track —
   it read as "Paralle" with the last letter clipped. Widened just for this one field. */
.de-desktop .de-conn-sel { width: 96px !important; }
.de-desktop .de-fld label {
  display: block !important;
  /* Sized by the shared subgrid track, never by a fixed pixel width: the track is as wide as
     the column's longest label — Parameters/Advanced labels are short and the track shrinks to
     match; Dimensions labels are 3-4x longer ("Driver Displacement Volume (Dvol)") and the same
     mechanism gives them their own wider track. A hardcoded px width fits one and clips or
     wastes space on the other. Every field in a column is still the SAME width, because they
     all subgrid onto the same tracks — that sameness is what makes the columns line up and the
     provenance highlight (painted on `.de-fld`, wrapping all four parts) read as one component
     per field. bugs/archive/BUG_20260817_driver_editor_labels_overflow_a_fixed_62px_column.md */
  width: auto !important;
  text-align: left !important;
  flex: 0 0 auto !important;
}
/* Column-flex (labels-above) override specifically for the General tab */
.de-desktop .de-general .de-fld {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 2px !important;
  margin-bottom: 3px !important;
}
.de-desktop .de-general .de-fld label {
  display: block !important;
  width: auto !important;
  text-align: left !important;
  flex: none !important;
}
.de-general input,
.de-general textarea {
  background: #ffffff !important;
  color: #000000 !important;
}

/* FOUR field columns, each of four parts: label, input, DQ marker, unit. The parts are real
   grid tracks so `.de-fld` can subgrid onto them — that is what puts every field in a column on
   ONE label edge, ONE input edge and ONE unit edge, the way WinISD's own editor reads
   (docs/images/winisd/edit-driver-page2-parameters.png). A field laid out inside a single wide track
   instead starts its input wherever its own label happens to end, which put "no" and
   "Voicecoils" 40px apart in the same column:
   bugs/archive/BUG_20260817_driver_editor_columns_do_not_share_a_column_edge.md
   minmax(0, …) on the two content tracks: a bare max-content track refuses to shrink, and four
   columns of them overran the modal and forced a sideways scroll. */
.de-desktop .de-cols {
  display: grid !important;
  /* Two field-slots per row: four phone-sized controls (T595) are wider than the modal. */
  grid-template-columns: repeat(2, max-content max-content minmax(34px, max-content) 16px) !important;
  gap: 6px 12px !important;
  align-items: center !important;
}
/* Placement is EXPLICIT, never by document order: a field without a DQ marker would otherwise
   slide its unit into the marker's track and break the column it shares. */
.de-desktop .de-cols .de-fld > label,
.de-desktop .de-dimlist .de-fld > label { grid-column: 1 !important; }

.de-desktop .de-cols .de-fld > .ui-field-value,
.de-desktop .de-dimlist .de-fld > .ui-field-value,
.de-desktop .de-cols .de-fld > :deep(input), .de-desktop .de-cols .de-fld > select,
.de-desktop .de-dimlist .de-fld > :deep(input), .de-desktop .de-dimlist .de-fld > select { grid-column: 2 !important; }

.de-desktop .de-cols .de-fld > .ui-field-unit,
.de-desktop .de-dimlist .de-fld > .ui-field-unit,

.de-desktop .de-cols .de-fld > .ui-field-dq,
.de-desktop .de-dimlist .de-fld > .ui-field-dq,
.de-desktop .de-cols .de-fld > .de-dq,
.de-desktop .de-dimlist .de-fld > .de-dq {
  grid-column: 4 !important;
  /* The DQ track sits right against the input/unit with no padding of its own, so the triangle
     glyph renders flush on the unit's edge. A small left margin only. */
  margin-left: 4px !important;
}

/* ── Phone: the shared pieces, nothing sized here ─────────────────────────────────────────────
   The field rows are `mob-ui-field` and the buttons `mob-btn` (style.css), handed in as `skin`.
   What is left is the dialog's own frame: the tab strip and toolbar at finger height, the groups
   stacked, the footer in two rows. Every size comes from SheetSizes via those shared classes. */
.de-phone > * { min-width: 0; }
.de-phone .de-tabs { flex-shrink: 0; padding-left: 6px; padding-right: 6px; }
.de-phone .de-tab { flex: 1 1 0; min-width: 0; min-height: var(--mob-touch-min); padding-left: 2px; padding-right: 2px; font-size: 13px; white-space: nowrap; }
/* The selected tab owns the strip's bottom line: it sits 1 px over it, so the line never shows across the tab (at any pixel density), and the others keep it under them. */
.de-phone .de-tab.on { position: relative; margin-bottom: -1px; }
.de-desktop .de-scroll { display: contents; }
.de-desktop .de-toolbar { order: 1; }
.de-desktop .de-strips { order: 2; }
.de-desktop .de-footer { order: 3; }
.de-phone .de-scroll { flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; }
.de-phone .de-body { flex: none; overflow: visible; padding: 0; gap: 0; }
.de-phone .de-params, .de-phone .de-group, .de-phone .de-cols, .de-phone .de-dimlist, .de-phone .de-row2 { display: block; }
/* The first section band of a tab sits flush under the key strip (the classic page rule gives later bands a 12 px gap). */
.de-phone .de-body > .de-params > .de-group:first-child > .mob-band:first-child, .de-phone .de-dimlist > .mob-band:first-child { margin-top: 0; }
.de-phone .de-dims { flex-direction: column; align-items: stretch; gap: 0; height: auto; }
.de-phone .de-diagram { min-width: 0; height: auto; padding: 12px; }
.de-phone .de-scroll { display: flex; flex-direction: column; }
.de-phone .de-scroll > .de-body { flex: 1 0 auto !important; }
/* General tab on the phone: the Comment box takes whatever height the tab has left. */
.de-phone .de-general { display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; height: auto !important; }
.de-phone .de-general .de-fld.de-comment { display: flex; flex-direction: column; flex: 1 1 auto; }
.de-phone .de-general .de-fld.de-comment > :deep(.ui-field-value) { flex: 1 1 auto; display: flex; align-items: stretch; }
.de-phone .de-general .de-fld.de-comment.ui-field { display: flex; flex-direction: column; align-items: stretch; height: auto; min-height: var(--mob-row-min); padding-top: 6px; padding-bottom: 8px; }
.de-phone .de-general .de-fld.de-comment textarea { flex: 1 1 auto; width: 100% !important; min-height: 120px !important; box-sizing: border-box; font-size: 15px; border: 1px solid var(--mob-box-line); border-radius: 4px; padding: 6px var(--mob-col-gutter) !important; resize: none; }
/* The editor's rows carry no ≠W badge, so the ⚠ sits right beside the unit chip and leaves the middle of the box free to tap. */
.de-phone.mob-classic :deep(.mob-ui-field.ui-field .ui-field-dq) { margin-right: calc(var(--mob-col-stepper) + var(--mob-col-chip-min) + 8px); }
.de-phone h2 .x { min-width: var(--mob-touch-min); min-height: var(--mob-touch-min); }
/* The unit toggle and the ⚠ are buttons: as tall as the row's box, so a finger finds them. */
.de-phone :deep(.ui-field-unit), .de-phone :deep(.ui-field-dq-btn) { min-height: var(--mob-input-h); display: inline-flex; align-items: center; }
.de-phone .de-toolbar { gap: 6px; padding-left: 10px; padding-right: 10px; }
.de-phone .de-provenance-chk { flex: 1 1 0; min-width: 0; min-height: var(--mob-input-h); box-sizing: border-box; font-size: 12px; }
.de-phone .de-provenance-chk input { width: 18px; height: 18px; }
.de-phone .de-incomplete { overflow-wrap: anywhere; }
.de-phone .de-footer { padding-left: 10px; padding-right: 10px; }
.de-phone .de-legend2 { flex-wrap: wrap; gap: 4px 12px; }
.de-phone .de-btns { min-width: 0; flex-direction: column; align-items: stretch; gap: 6px; }
.de-phone .de-btn-row { gap: 6px; flex-wrap: nowrap; }
.de-phone .de-btn-row > button { min-width: 0; padding-left: 6px; padding-right: 6px; }
.de-phone .fmt-foot { gap: 8px; }
.de-phone .fmt-foot > button { flex: 1; }

/* Format picker — scoped to the editor, not the page, so it reads as part of the editor. */
.fmt-scrim {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, .35);
}
.fmt-panel {
  background: var(--panel); border: 1px solid var(--line); box-shadow: 0 6px 22px rgba(0,0,0,.35);
  width: 460px; max-width: 92%; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
}
.fmt-panel h3 { margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: var(--fg); }
.fmt-opt {
  all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 3px;
  padding: 9px 11px; border: 1px solid var(--line); color: var(--fg);
}
.fmt-opt:hover, .fmt-opt:focus-visible { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 10%, transparent); }
.fmt-opt:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px; }
.fmt-name { font-size: 13px; font-weight: 600; }
.fmt-name code { font-weight: 400; opacity: .85; }
.fmt-name em { font-style: normal; font-size: 11px; font-weight: 400; color: var(--acc2, var(--acc)); margin-left: 4px; }
.fmt-note { font-size: 11px; line-height: 1.45; color: var(--mut); }
.fmt-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 2px; }
.fmt-foot .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
.de-id-panel { width: 380px; }
.de-id-panel h3 { color: #d9381e; }


/* ── DQ indicators ──────────────────────────────────────────────────────────── */
/* Mandatory fields have bold border always, and red outline when empty. */
.de-input-mandatory {
  border-width: 2px !important;
}
.de-input-empty {
  border-color: #d9381e !important;
  box-shadow: 0 0 0 1px rgba(217, 56, 30, .25) !important;
}
/* `.de-dq`, the field-level DQ mark, is styled in style.css — What-if? wears the same
   mark, so one driver's data quality cannot look different in two places. */

/* One strip, above the footer, naming everything that stops the driver simulating. It never
   disables a button — see the DQ block in the script for why. */
.de-incomplete {
  display: flex; flex-direction: column; gap: 2px;
  padding: 5px 14px; border-top: 1px solid var(--line);
  background: color-mix(in srgb, #d9381e 8%, transparent);
  font-size: 11px; line-height: 1.4;
}
.de-incomplete-hd   { color: #d9381e; font-weight: 600; }
/* Capped at 5 lines (5 × line-height 1.4em = 7em); a 6th reason scrolls instead of pushing the
   footer down. */
.de-incomplete-list {
  color: var(--mut); margin: 0; padding-left: 1.2em;
  max-height: 7em; overflow-y: auto;
}
.de-incomplete-subject { color: var(--fg); font-weight: 600; }

/* ── Phone footer: OK, Cancel, More ▲ and the More popup (editor-live.html) ── */
.de-phone .de-footer { position: relative; }
.de-phone .de-btn-row > button { flex: 1 1 0; }
.de-phone .de-btn-row > .de-more { flex: 0 0 auto; padding-left: 14px; padding-right: 14px; white-space: nowrap; }
.de-phone .de-more i { font-style: normal; font-size: 11px; margin-left: 6px; }
.de-phone .de-more.on { position: relative; z-index: 7; background: #3a3a3a; color: #fff; border-color: #222; box-shadow: inset 0 2px 4px rgba(0, 0, 0, .5); }
.de-more-scrim { position: fixed; inset: 0; z-index: 5; background: rgba(0, 0, 0, .25); }
.de-more-menu { position: absolute; z-index: 6; right: 10px; bottom: 100%; width: min(260px, calc(100% - 20px)); box-sizing: border-box; background: #fff; border: 1px solid #999; border-radius: 8px; box-shadow: 0 6px 24px rgba(0, 0, 0, .25); padding: 4px 0; font-size: 14px; color: #222; }
.de-more-item { display: block; width: 100%; min-height: var(--mob-touch-min); text-align: left; padding: 0 14px; border: none; background: none; font: inherit; color: inherit; cursor: pointer; }
.de-more-item:active { background: #eee; }
.de-more-menu hr { border: none; border-top: 1px solid #e3e3e3; margin: 2px 0; }
.de-more-hint { color: #666; font-size: 13px; padding: 4px 14px; line-height: 18px; }

/* ── Phone: the "N values disagree" bar, between the body and the checkboxes ── */
.de-dq-bar { flex: none; border-top: 1px solid #e3b4b4; background: #fbeaea; color: #a02020; font-size: 13px; }
.de-dq-head { display: flex; align-items: center; width: 100%; min-height: var(--mob-touch-min); padding: 0 16px; font: inherit; font-weight: 600; border: none; background: none; color: inherit; text-align: left; cursor: pointer; }
.de-dq-head span { margin-left: auto; font-size: 16px; }
.de-dq-list { margin: 0; padding: 0 16px 6px; list-style: none; max-height: calc(var(--mob-row-min) * 3); overflow-y: auto; }
.de-dq-list li { padding: 2px 0; color: #5a1a1a; overflow-wrap: anywhere; }

/* ── Phone: the ƒ mark in the left gutter of a row the inspector can explain ── */
.de-phone .de-fld.de-fx { position: relative; }
.de-phone .de-fld.de-fx::before { content: var(--de-fx); position: absolute; left: 4px; top: 50%; transform: translateY(-50%); color: #888; font-style: italic; font-family: Georgia, serif; font-size: 14px; line-height: 1; pointer-events: none; }
</style>
