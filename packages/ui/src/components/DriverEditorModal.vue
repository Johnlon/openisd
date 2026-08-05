<script setup lang="ts">
import DriverDimensionsDiagram from './DriverDimensionsDiagram.vue'
import { ref, shallowRef, markRaw, computed, nextTick } from 'vue';
import { state, driverShort } from '../store.js';
import { editorSeed, acceptDriverEdit, cancelDriverEdit } from '../composables/useDriverSelection.js';
import { ebp, RHO, C } from '@openisd/engine';
import { Driver as DriverModel } from '@openisd/winisd';
import NumInput from './NumInput.vue';
import { precision } from '../fields/fieldRegistry.js';
import { useEscToClose } from '../composables/useEscToClose.js';
import { cellClassOf, useQGroupIncomplete, consistencyNote } from '../composables/useDriverCells.js';
import { saveTextAs } from '../utils/fileSave.js';
import { upsertMyDriver } from '../utils/myDrivers.js';
import { DriverFileFormat } from '../driverFileFormat.js';
import { flash } from '../utils/flash.js';

// Driver editor — a real modal (unlike DriverWhatIfPanel, an inline overlay that keeps
// the graph visible). Recreates WinISD's "Driver editor" dialog (docs/winisd/edit_driver_pg*.png):
// 4 tabs — General / Parameters / Advanced parameters / Dimensions.
//
// Layered Memory architecture:
// - Layer 1: Disk/File/Library (WDR, OWDR)
// - Layer 2: App Active State / Simulation State (committed design driver in store)
// - Layer 3: Dialog/Draft Session Layer (local draftDriver instance, isolated until OK)

const emit = defineEmits<{ close: [] }>();

type Tab = 'General' | 'Parameters' | 'Advanced parameters' | 'Dimensions';
const TABS: Tab[] = ['General', 'Parameters', 'Advanced parameters', 'Dimensions'];

// The draft (layer 3) is seeded from the project's own driver — the only thing this editor
// ever edits. Choosing from the library no longer routes through here: it copies the driver
// straight into the project, so arriving here always means "edit the driver I already have",
// which opens on General.
const seed = editorSeed();
const tab = ref<Tab>('General');

// The title names WHICH driver is on screen, because this one dialog edits two subjects with
// different consequences: OK on the project's driver changes the design, OK on a saved driver
// changes that My Drivers entry and leaves the design alone.
const editorTitle = seed.subject === 'myDriver' ? 'Edit My Driver' : "Edit Project's Driver";
// markRaw + shallowRef: Driver is a class with private fields, and a Vue reactive proxy
// makes every method call on it throw. Redraws are driven by `trigger` below, so the
// instance never needs to be deeply reactive.
const draftDriver = shallowRef(markRaw(DriverModel.fromJSON(seed.json)));
const trigger = ref(0);
function forceUpdate() { trigger.value++; }

// Computed local driverRaw proxy. All template fields bind to this computed property,
// automatically reading from the local draft driver model.
const driverRaw = computed(() => {
  const _ = trigger.value;
  return draftDriver.value.raw();
});

// Computed local driver proxy for derived fields.
const driver = computed(() => {
  const _ = trigger.value;
  return draftDriver.value.toDriver();
});

function setText(field: 'brand' | 'model' | 'providedBy' | 'comment' | 'manufacturer' | 'added', e: Event) {
  draftDriver.value.enter(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
  forceUpdate();
}
function setNum(field: string, v: number | null) {
  if (v == null) {
    draftDriver.value.clear(field);
  } else {
    draftDriver.value.enter(field, v);
  }
  forceUpdate();
}

// One reach into the DRAFT model (layer 3) — the what-if panels pass the store's effective
// model to the same helpers instead, so the provenance marks and the Q-group rule cannot
// disagree between this dialog and a panel showing the same driver.
function cellOf(field: string) {
  const _ = trigger.value;
  return draftDriver.value.cell(field);
}

function cellClass(field: string): string {
  return cellClassOf(cellOf(field).state);
}

function cellVal(field: string): number | null {
  const v = cellOf(field).value;
  return typeof v === 'number' ? v : null;
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
function isBadValue(field: string): boolean {
  const _ = trigger.value;
  const v = draftDriver.value.cell(field).value;
  return typeof v === 'number' && !(v > 0);
}

const BAD_VALUE_NOTE = 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as entered — clear the field to let it be calculated instead.';

// INCONSISTENT — the field belongs to a consistency group (WDR_SCHEMA §4) whose members
// contradict each other beyond their own precision. The ADT decides; every member of the
// group is marked, because none of them is more wrong than the others. Like every other DQ
// state here it blocks nothing: the driver still simulates, saves and exports.
const issues = computed(() => { const _ = trigger.value; return draftDriver.value.consistencyIssues(); });

/** The one DQ mark per field: its reason, or '' when there is nothing to say. */
function dqNote(field: string): string {
  if (isBadValue(field)) return BAD_VALUE_NOTE;
  return consistencyNote(issues.value, field);
}

// Two lists, never merged: a missing Brand does not blank a chart, and a missing Fs does not
// stop the driver being filed. One strip claiming one consequence for both is a statement the
// human has to go and disprove.

// The editor's own filing key. The engine has never heard of Brand or Model — a driver
// without them plots perfectly and simply cannot be FILED, because `<brand>/<model>` is what
// My Drivers, the project and the export filename all look it up by.
const identityReasons = computed<string[]>(() => {
  const _ = trigger.value;
  const r = driverRaw.value;
  const out: string[] = [];
  if (!r.brand?.trim()) out.push('Brand is not set');
  if (!r.model?.trim()) out.push('Model is not set');
  return out;
});

// Mandatory for the SIMULATION, not for saving. The rules are not restated here: the engine
// owns them (packages/engine/src/driver.ts) and the ADT exposes its verdict, so this reads
// that rather than keeping a second copy to drift. It is also how the GROUP rules arrive
// ("any two of Qts/Qes/Qms", "Qms must exceed Qts"), which no per-field check can express.
const chartBlockingReasons = computed<string[]>(() => {
  const _ = trigger.value;
  return draftDriver.value.errors().filter(e => e.level === 'error').map(e => e.message);
});

const qIncomplete = useQGroupIncomplete(cellOf);

function ebpVal(): number | null {
  const _ = trigger.value;
  return driver.value ? ebp(driver.value) : null;
}

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
function copyToMyDrivers() {
  if (!requireIdentity()) return;
  const overwrote = upsertMyDriver(draftDriver.value.raw());
  copiedMsg.value = overwrote ? 'Updated in My Drivers' : 'Copied to My Drivers';
  setTimeout(() => { copiedMsg.value = ''; }, 2000);
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
  const _ = trigger.value;
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

// OK — the draft becomes the design. If we came from the library picker, that closes too.
function close() {
  if (!requireIdentity()) return;
  acceptDriverEdit(draftDriver.value.toJSON());
  emit('close');
}

/** Save-to-file: same gate, because the filename IS `<brand> <model>`. */
function requestExport() {
  if (!requireIdentity()) return;
  exportPickerOpen.value = true;
}

// Cancel — drop the draft AND any library pick. The design is exactly as it was, and the
// picker (still open behind this dialog) is where the user lands.
function cancel() {
  cancelDriverEdit();
  emit('close');
}

// Reset — draft back to what it was seeded from (the picked driver, or the design).
function reset() {
  draftDriver.value = markRaw(DriverModel.fromJSON(seed.json));
  forceUpdate();
}

const fileInput = ref<HTMLInputElement | null>(null);
function triggerLoad() {
  fileInput.value?.click();
}

function handleFileLoaded(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const format = DriverFileFormat.ofFileName(file.name);
  input.value = '';   // so re-picking the SAME file fires `change` again
  if (format === null) { alert(`Not a driver file: ${file.name} (expected ${DriverFileFormat.ACCEPT})`); return; }
  if (format === DriverFileFormat.Wdr) {
    const ok = confirm("Warning: Importing a legacy WinISD (.wdr) file will trigger parameter derivations that may overwrite or change some parameters. For exact loading, OpenISD (.owdr) format is recommended.\n\nDo you want to continue?");
    if (!ok) return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target?.result as string;
    if (!text) return;
    try {
      draftDriver.value = markRaw(format === DriverFileFormat.Wdr
        ? DriverModel.fromWdr(text)
        : DriverModel.fromJSON(JSON.parse(text)));
      forceUpdate();
    } catch (err) {
      alert('Failed to parse file: ' + (err as Error).message);
    }
  };
  reader.readAsText(file);
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
  const base = driverShort(driverRaw.value);
  const text = format === DriverFileFormat.Owdr
    ? JSON.stringify(draftDriver.value.toJSON(), null, 2)
    : draftDriver.value.toWdr();
  // Then the SYSTEM save dialog — the user picks folder and name, as a desktop app would.
  // The MIME must be a CUSTOM type, not application/json or text/plain. The picker unions the
  // extensions we list with every extension registered to that MIME, so `application/json`
  // offered ".owdr, .json" and `text/plain` offered ".wdr, .txt, .text" — a save dialog
  // inviting the user to write a driver to a filename the app will not read back.
  const r = await saveTextAs(text, format.fileName(base), format.label, format.mime, '.' + format.value);
  if (!r.cancelled) flash(`Driver saved as .${format.value}`);
}

useEscToClose(() => state.editDriverInfo, cancel);
// Registered AFTER the editor on purpose: the Esc stack resolves last-registered first, so
// this makes the format picker the innermost dismissal. Otherwise Esc aimed at a two-option
// panel would close the whole editor and discard the session's edits.
useEscToClose(() => exportPickerOpen.value, () => { exportPickerOpen.value = false; });
useEscToClose(() => identityMsgOpen.value, dismissIdentityMsg);
</script>

<template>
  <div class="overlay on">
    <div class="modal de-modal">
      <h2>{{ editorTitle }}<button class="x" @click="cancel" title="Close without keeping changes">✕</button></h2>

      <div class="de-tabs">
        <button v-for="t in TABS" :key="t" class="de-tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      </div>

      <div class="body de-body" :class="{ 'labels-left': tab !== 'General' }">
        <!-- ============================= General ============================= -->
        <div v-if="tab === 'General'" class="de-general">
          <div class="de-row2">
            <div class="de-fld" title="Manufacturer name — WinISD: Manufacturer">
              <label>Manufacturer</label>
              <input type="text" :value="driverRaw.manufacturer || ''" @input="setText('manufacturer', $event)">
            </div>
            <div class="de-fld" title="Manufacturer/brand name — WinISD: Brand">
              <label>Brand</label>
              <input type="text" class="de-brand" :value="driverRaw.brand || ''" @input="setText('brand', $event)"
                     :class="{ 'de-input-mandatory': true, 'de-input-empty': !driverRaw.brand || !driverRaw.brand.trim() }">
            </div>
            <div class="de-fld" title="Model number/name — WinISD: Model">
              <label>Model</label>
              <input type="text" class="de-model" :value="driverRaw.model || ''" @input="setText('model', $event)"
                     :class="{ 'de-input-mandatory': true, 'de-input-empty': !driverRaw.model || !driverRaw.model.trim() }">
            </div>
          </div>
          <div class="de-row2">
            <div class="de-fld" title="Attribution — who supplied this driver's data. WinISD: Data provided by">
              <label>Data provided by</label>
              <input type="text" :value="driverRaw.providedBy || ''" @input="setText('providedBy', $event)">
            </div>
            <div class="de-fld" title="Date added — WinISD: DateAdded">
              <label>Date added</label>
              <input type="text" :value="driverRaw.added || ''" @input="setText('added', $event)">
            </div>
          </div>
          <div class="de-fld de-comment" title="Free-text note saved with this driver. WinISD: Comment">
            <label>Comment</label>
            <textarea :value="driverRaw.comment || ''" @input="setText('comment', $event)"></textarea>
          </div>
        </div>

        <!-- ============================= Parameters ============================= -->
        <div v-if="tab === 'Parameters'" class="de-params">
          <div class="de-group">
            <div class="de-hdr">Thiele/Small parameters</div>
            <div class="de-cols">
              <div class="de-fld" title="Electrical Q factor — motor damping. WinISD: Qes">
                <label>Qes</label>
                <NumInput :class="cellClass('Qes')" :mandatory="qIncomplete" :model-value="cellVal('Qes')" :scale="1" :precision="3" @update:model-value="v => setNum('Qes', v)">
                </NumInput><span v-if="dqNote('Qes')" class="de-dq" :title="dqNote('Qes')">&#9888;</span>
              </div>
              <div class="de-fld" title="Mechanical Q factor — suspension damping. WinISD: Qms">
                <label>Qms</label>
                <NumInput :class="cellClass('Qms')" :mandatory="qIncomplete" :model-value="cellVal('Qms')" :scale="1" :precision="3" @update:model-value="v => setNum('Qms', v)">
                </NumInput><span v-if="dqNote('Qms')" class="de-dq" :title="dqNote('Qms')">&#9888;</span>
              </div>
              <div class="de-fld" title="Total Q factor = Qes·Qms/(Qes+Qms). WinISD: Qts">
                <label>Qts</label>
                <NumInput :class="cellClass('Qts')" :mandatory="qIncomplete" :model-value="cellVal('Qts')" :scale="1" :precision="3" @update:model-value="v => setNum('Qts', v)">
                </NumInput><span v-if="dqNote('Qts')" class="de-dq" :title="dqNote('Qts')">&#9888;</span>
              </div>
              <div class="de-fld" title="Free-air resonance frequency. WinISD: Fs">
                <label>Fs</label>
                <NumInput :class="cellClass('Fs')" :mandatory="true" :model-value="cellVal('Fs')" :scale="1" :precision="2" @update:model-value="v => setNum('Fs', v)">
                </NumInput><span v-if="dqNote('Fs')" class="de-dq" :title="dqNote('Fs')">&#9888;</span>
                <span class="u">Hz</span>
              </div>
              <div class="de-fld" title="Equivalent compliance volume. WinISD: Vas">
                <label>Vas</label>
                <NumInput :class="cellClass('Vas')" :mandatory="true" :model-value="cellVal('Vas')" :scale="1000" :precision="precision('Vas')" @update:model-value="v => setNum('Vas', v)">
                </NumInput><span v-if="dqNote('Vas')" class="de-dq" :title="dqNote('Vas')">&#9888;</span>
                <span class="u">L</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Electro-Mechanical parameters</div>
            <div class="de-cols">
              <div class="de-fld" title="Derived: Mms = 1 / ((2π·Fs)²·Cms) — total moving mass.">
                <label>Mms</label>
                <NumInput :class="cellClass('Mms')" :model-value="cellVal('Mms')" :scale="1000" :precision="2" @update:model-value="v => setNum('Mms', v)">
                </NumInput><span v-if="dqNote('Mms')" class="de-dq" :title="dqNote('Mms')">&#9888;</span>
                <span class="u">g</span>
              </div>
              <div class="de-fld" title="Derived: Cms = Vas / (ρc²·Sd²) — suspension compliance.">
                <label>Cms</label>
                <NumInput :class="cellClass('Cms')" :model-value="cellVal('Cms')" :scale="1000" :precision="4" @update:model-value="v => setNum('Cms', v)">
                </NumInput><span v-if="dqNote('Cms')" class="de-dq" :title="dqNote('Cms')">&#9888;</span>
                <span class="u">mm/N</span>
              </div>
              <div class="de-fld" title="Derived: Rms = 2π·Fs·Mms/Qms — suspension mechanical resistance.">
                <label>Rms</label>
                <NumInput :class="cellClass('Rms')" :model-value="cellVal('Rms')" :scale="1" :precision="4" @update:model-value="v => setNum('Rms', v)">
                </NumInput><span v-if="dqNote('Rms')" class="de-dq" :title="dqNote('Rms')">&#9888;</span>
                <span class="u">Ns/m</span>
              </div>
              <div class="de-fld" title="DC voice coil resistance. WinISD: Re">
                <label>Re</label>
                <NumInput :class="cellClass('Re')" :mandatory="true" :model-value="cellVal('Re')" :scale="1" :precision="3" @update:model-value="v => setNum('Re', v)">
                </NumInput><span v-if="dqNote('Re')" class="de-dq" :title="dqNote('Re')">&#9888;</span>
                <span class="u">ohm</span>
              </div>
              <div class="de-fld" title="Derived: Bl = √(2π·Fs·Mms·Re / Qes) — motor force factor.">
                <label>BL</label>
                <NumInput :class="cellClass('Bl')" :model-value="cellVal('Bl')" :scale="1" :precision="3" @update:model-value="v => setNum('Bl', v)">
                </NumInput><span v-if="dqNote('Bl')" class="de-dq" :title="dqNote('Bl')">&#9888;</span>
                <span class="u">Tm</span>
              </div>
              <div class="de-fld" title="Diaphragm/dome depth — WinISD: Dd">
                <label>Dd</label>
                <NumInput :class="cellClass('Dd')" :model-value="cellVal('Dd')" @update:model-value="v => setNum('Dd', v)"></NumInput><span v-if="dqNote('Dd')" class="de-dq" :title="dqNote('Dd')">&#9888;</span>
                <span class="u">m</span>
              </div>
              <div class="de-fld" title="Voice coil inductance. 0 = resistive-only model. WinISD: Le">
                <label>Le</label>
                <NumInput :class="cellClass('Le')" :model-value="cellVal('Le')" :scale="1000" :precision="3" @update:model-value="v => setNum('Le', v)">
                </NumInput><span v-if="dqNote('Le')" class="de-dq" :title="dqNote('Le')">&#9888;</span>
                <span class="u">mH</span>
              </div>
              <div class="de-fld" title="Effective piston area. WinISD: Sd">
                <label>Sd</label>
                <NumInput :class="cellClass('Sd')" :mandatory="true" :model-value="cellVal('Sd')" :scale="1e4" :precision="precision('Sd')" @update:model-value="v => setNum('Sd', v)">
                </NumInput><span v-if="dqNote('Sd')" class="de-dq" :title="dqNote('Sd')">&#9888;</span>
                <span class="u">cm²</span>
              </div>
              <div class="de-fld" title="Voice-coil inductance corner frequency — WinISD: fLe">
                <label>fLe</label>
                <NumInput :class="cellClass('fLe')" :model-value="cellVal('fLe')" :scale="1000" @update:model-value="v => setNum('fLe', v)"></NumInput><span v-if="dqNote('fLe')" class="de-dq" :title="dqNote('fLe')">&#9888;</span>
                <span class="u">kHz</span>
              </div>
              <div class="de-fld" title="Le semi-inductance coefficient — WinISD: KLe">
                <label>KLe</label>
                <NumInput :class="cellClass('Le2')" :model-value="cellVal('Le2')" @update:model-value="v => setNum('Le2', v)"></NumInput><span v-if="dqNote('Le2')" class="de-dq" :title="dqNote('Le2')">&#9888;</span>
                <span class="u">H·√Hz</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Large-Signal parameters</div>
            <div class="de-cols">
              <div class="de-fld" title="Peak one-way linear excursion. WinISD: Xmax">
                <label>Xmax</label>
                <NumInput :class="cellClass('Xmax')" :model-value="cellVal('Xmax')" :scale="1000" :precision="3" @update:model-value="v => setNum('Xmax', v)">
                </NumInput><span v-if="dqNote('Xmax')" class="de-dq" :title="dqNote('Xmax')">&#9888;</span>
                <span class="u">mm peak</span>
              </div>
              <div class="de-fld" title="Voice coil former height above/below the gap — WinISD: hc.">
                <label>Hc</label>
                <NumInput :class="cellClass('hc')" :model-value="cellVal('hc')" :scale="1000" @update:model-value="v => setNum('hc', v)"></NumInput><span v-if="dqNote('hc')" class="de-dq" :title="dqNote('hc')">&#9888;</span>
                <span class="u">mm</span>
              </div>
              <div class="de-fld" title="Magnetic gap height — WinISD: hag.">
                <label>Hg</label>
                <NumInput :class="cellClass('hag')" :model-value="cellVal('hag')" :scale="1000" @update:model-value="v => setNum('hag', v)"></NumInput><span v-if="dqNote('hag')" class="de-dq" :title="dqNote('hag')">&#9888;</span>
                <span class="u">mm</span>
              </div>
              <div class="de-fld" title="Volume displaced by the cone at Xmax — WinISD: Vd.">
                <label>Vd</label>
                <NumInput :class="cellClass('Vd')" :model-value="cellVal('Vd')" :scale="1e6" @update:model-value="v => setNum('Vd', v)"></NumInput><span v-if="dqNote('Vd')" class="de-dq" :title="dqNote('Vd')">&#9888;</span>
                <span class="u">cm³</span>
              </div>
              <div class="de-fld" title="Mechanical excursion limit before physical damage — WinISD: Xlim.">
                <label>Xlim</label>
                <NumInput :class="cellClass('Xlim')" :model-value="cellVal('Xlim')" :scale="1000" @update:model-value="v => setNum('Xlim', v)"></NumInput><span v-if="dqNote('Xlim')" class="de-dq" :title="dqNote('Xlim')">&#9888;</span>
                <span class="u">mm</span>
              </div>
              <div class="de-fld" title="Rated continuous power handling. WinISD: Pe">
                <label>Pe</label>
                <NumInput :class="cellClass('Pe')" :model-value="cellVal('Pe')" :scale="1" :precision="1" @update:model-value="v => setNum('Pe', v)">
                </NumInput><span v-if="dqNote('Pe')" class="de-dq" :title="dqNote('Pe')">&#9888;</span>
                <span class="u">W</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Miscellaneous parameters</div>
            <div class="de-cols">
              <div class="de-fld" title="Reference efficiency — WinISD: no">
                <label>no</label>
                <NumInput :class="cellClass('no')" :model-value="cellVal('no')" :scale="100" @update:model-value="v => setNum('no', v)"></NumInput><span v-if="dqNote('no')" class="de-dq" :title="dqNote('no')">&#9888;</span>
                <span class="u">%</span>
              </div>
              <div class="de-fld" title="Nominal impedance — label only, not used in simulation. WinISD: Znom. OpenISD field: Z">
                <label>Znom</label>
                <NumInput :class="cellClass('Z')" :model-value="cellVal('Z')" :scale="1" :precision="3" @update:model-value="v => setNum('Z', v)">
                </NumInput><span v-if="dqNote('Z')" class="de-dq" :title="dqNote('Z')">&#9888;</span>
                <span class="u">ohm</span>
              </div>
              <div class="de-fld" title="Unity SPL — WinISD: USPL">
                <label>USPL</label>
                <NumInput :class="cellClass('USPL')" :model-value="cellVal('USPL')" @update:model-value="v => setNum('USPL', v)"></NumInput><span v-if="dqNote('USPL')" class="de-dq" :title="dqNote('USPL')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" title="Rated sensitivity — WinISD: SPL">
                <label>SPL</label>
                <NumInput :class="cellClass('SPL')" :model-value="cellVal('SPL')" @update:model-value="v => setNum('SPL', v)"></NumInput><span v-if="dqNote('SPL')" class="de-dq" :title="dqNote('SPL')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" title="Number of voice coils — WinISD: numVC">
                <label>Voicecoils</label>
                <NumInput :class="cellClass('numVC')" :model-value="cellVal('numVC')" @update:model-value="v => setNum('numVC', v)"></NumInput><span v-if="dqNote('numVC')" class="de-dq" :title="dqNote('numVC')">&#9888;</span>
              </div>
              <div class="de-fld" title="Dual voice coil wiring — WinISD: Connection">
                <label>Connection</label>
                <select :value="driverRaw.VCCon ?? 1" @change="e => setNum('VCCon', parseInt((e.target as HTMLSelectElement).value))"><option :value="1">Parallel</option><option :value="2">Series</option></select>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================= Advanced parameters ============================= -->
        <div v-if="tab === 'Advanced parameters'" class="de-params">
          <div class="de-group">
            <div class="de-hdr">Thermal parameters</div>
            <div class="de-cols">
              <div class="de-fld" title="Voice coil resistance temperature coefficient — WinISD: AlfaVC">
                <label>AlfaVC</label>
                <NumInput :class="cellClass('tc')" :model-value="cellVal('tc')" @update:model-value="v => setNum('tc', v)"></NumInput><span v-if="dqNote('tc')" class="de-dq" :title="dqNote('tc')">&#9888;</span>
                <span class="u">1000/K</span>
              </div>
              <div class="de-fld" title="Thermal resistance voice coil→ambient — WinISD: R(t)">
                <label>R(t)</label>
                <NumInput :class="cellClass('Rth')" :model-value="cellVal('Rth')" @update:model-value="v => setNum('Rth', v)"></NumInput><span v-if="dqNote('Rth')" class="de-dq" :title="dqNote('Rth')">&#9888;</span>
                <span class="u">K/W</span>
              </div>
              <div class="de-fld" title="Thermal capacitance — WinISD: C(t)">
                <label>C(t)</label>
                <NumInput :class="cellClass('Cth')" :model-value="cellVal('Cth')" @update:model-value="v => setNum('Cth', v)"></NumInput><span v-if="dqNote('Cth')" class="de-dq" :title="dqNote('Cth')">&#9888;</span>
                <span class="u">J/K</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Figure of merits</div>
            <div class="de-cols">
              <div class="de-fld" title="Max SPL, low-frequency-limited — WinISD: SPLmaxLF">
                <label>SPLmaxLF</label>
                <NumInput :class="cellClass('SPLmaxLF')" :model-value="cellVal('SPLmaxLF')" @update:model-value="v => setNum('SPLmaxLF', v)"></NumInput><span v-if="dqNote('SPLmaxLF')" class="de-dq" :title="dqNote('SPLmaxLF')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" title="Max SPL — WinISD: SPLmax">
                <label>SPLmax</label>
                <NumInput :class="cellClass('SPLmax')" :model-value="cellVal('SPLmax')" @update:model-value="v => setNum('SPLmax', v)"></NumInput><span v-if="dqNote('SPLmax')" class="de-dq" :title="dqNote('SPLmax')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" title="Motional electrical resistance at resonance — WinISD: Rme">
                <label>Rme</label>
                <NumInput :class="cellClass('Rme')" :model-value="cellVal('Rme')" @update:model-value="v => setNum('Rme', v)"></NumInput><span v-if="dqNote('Rme')" class="de-dq" :title="dqNote('Rme')">&#9888;</span>
                <span class="u">Ns/m</span>
              </div>
              <div class="de-fld" title="Motor figure of merit — WinISD: gamma">
                <label>gamma</label>
                <NumInput :class="cellClass('gamma')" :model-value="cellVal('gamma')" @update:model-value="v => setNum('gamma', v)"></NumInput><span v-if="dqNote('gamma')" class="de-dq" :title="dqNote('gamma')">&#9888;</span>
                <span class="u">N/(A·kg)</span>
              </div>
              <div class="de-fld" title="Power-limited motor figure of merit — WinISD: Mpow">
                <label>Mpow</label>
                <NumInput :class="cellClass('Mpow')" :model-value="cellVal('Mpow')" @update:model-value="v => setNum('Mpow', v)"></NumInput><span v-if="dqNote('Mpow')" class="de-dq" :title="dqNote('Mpow')">&#9888;</span>
                <span class="u">N/√W</span>
              </div>
              <div class="de-fld" title="Cost-normalised motor figure of merit — WinISD: Mcost">
                <label>Mcost</label>
                <NumInput :class="cellClass('Mcost')" :model-value="cellVal('Mcost')" @update:model-value="v => setNum('Mcost', v)"></NumInput><span v-if="dqNote('Mcost')" class="de-dq" :title="dqNote('Mcost')">&#9888;</span>
                <span class="u">kg/s</span>
              </div>
              <div class="de-fld st-c" title="Derived: EBP = Fs / Qes — Efficiency Bandwidth Product. Read-only, not entered directly. WinISD: EBP">
                <label>EBP</label>
                <input type="text" readonly :value="ebpVal() != null ? ebpVal()!.toFixed(1) : ''"><span class="u">Hz</span>
              </div>
              <div class="de-fld" title="Cone material loss factor — WinISD: Gloss">
                <label>Gloss</label>
                <NumInput :class="cellClass('loss')" :model-value="cellVal('loss')" @update:model-value="v => setNum('loss', v)"></NumInput><span v-if="dqNote('loss')" class="de-dq" :title="dqNote('loss')">&#9888;</span>
                <span class="u">%</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Environment parameters</div>
            <div class="de-cols">
              <div class="de-fld cl-dim" title="Speed of sound — OpenISD's engine constant, fixed at 20°C (packages/engine/src/constants.ts). Not adjustable in this editor.">
                <label>c</label>
                <input type="text" readonly :value="C.toFixed(2)"><span class="u">m/s</span>
              </div>
              <div class="de-fld cl-dim" title="Air density — OpenISD's engine constant, fixed at 20°C (packages/engine/src/constants.ts). Not adjustable in this editor.">
                <label>roo</label>
                <input type="text" readonly :value="RHO.toFixed(5)"><span class="u">kg/m³</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================= Dimensions ============================= -->
        <div v-if="tab === 'Dimensions'" class="de-dims">
          <div class="de-dimlist">
            <div class="de-hdr">Dimensions</div>
            <div class="de-fld" title="Frame flange thickness — WinISD: Thick"><label>Thick</label><NumInput :class="cellClass('thick')" :model-value="cellVal('thick')" @update:model-value="v => setNum('thick', v)"></NumInput><span v-if="dqNote('thick')" class="de-dq" :title="dqNote('thick')">&#9888;</span><span class="u">in</span></div>
            <div class="de-fld" title="Overall driver depth — WinISD: Depth"><label>Depth</label><NumInput :class="cellClass('depth')" :model-value="cellVal('depth')" @update:model-value="v => setNum('depth', v)"></NumInput><span v-if="dqNote('depth')" class="de-dq" :title="dqNote('depth')">&#9888;</span><span class="u">m</span></div>
            <div class="de-fld" title="Magnet stack depth — WinISD: Magnet depth"><label>Magnet Depth</label><NumInput :class="cellClass('magnetDepth')" :model-value="cellVal('magnetDepth')" @update:model-value="v => setNum('magnetDepth', v)"></NumInput><span v-if="dqNote('magnetDepth')" class="de-dq" :title="dqNote('magnetDepth')">&#9888;</span><span class="u">m</span></div>
            <div class="de-fld" title="Magnet diameter — WinISD: Magnet"><label>Magnet</label><NumInput :class="cellClass('magnet')" :model-value="cellVal('magnet')" @update:model-value="v => setNum('magnet', v)"></NumInput><span v-if="dqNote('magnet')" class="de-dq" :title="dqNote('magnet')">&#9888;</span><span class="u">m</span></div>
            <div class="de-fld" title="Basket/frame diameter — WinISD: Basket"><label>Basket</label><NumInput :class="cellClass('basket')" :model-value="cellVal('basket')" @update:model-value="v => setNum('basket', v)"></NumInput><span v-if="dqNote('basket')" class="de-dq" :title="dqNote('basket')">&#9888;</span><span class="u">m</span></div>
            <div class="de-fld" title="Overall outer frame diameter — WinISD: Outer"><label>Outer</label><NumInput :class="cellClass('outer')" :model-value="cellVal('outer')" @update:model-value="v => setNum('outer', v)"></NumInput><span v-if="dqNote('outer')" class="de-dq" :title="dqNote('outer')">&#9888;</span><span class="u">m</span></div>
            <div class="de-fld" title="Voice coil diameter — WinISD: VCd"><label>VCd</label><NumInput :class="cellClass('VCd')" :model-value="cellVal('VCd')" @update:model-value="v => setNum('VCd', v)"></NumInput><span v-if="dqNote('VCd')" class="de-dq" :title="dqNote('VCd')">&#9888;</span><span class="u">m</span></div>
            <div class="de-fld" title="Basket displacement volume — WinISD: Dvol"><label>Dvol</label><NumInput :class="cellClass('basketDisplacement')" :model-value="cellVal('basketDisplacement')" :scale="1e6" @update:model-value="v => setNum('basketDisplacement', v)"></NumInput><span v-if="dqNote('basketDisplacement')" class="de-dq" :title="dqNote('basketDisplacement')">&#9888;</span><span class="u">cm³</span></div>
          </div>

          <div class="de-diagram" aria-hidden="true" title="Driver cross-section (reference diagram — dimensions not modelled)">
            <DriverDimensionsDiagram />
          </div>
        </div>
      </div>

      <!-- What is missing, and what it actually costs. Saving is never blocked by either —
           the strip states the consequence instead, so the human keeps their typing. Two
           strips, not one, because a missing Brand does not blank a chart and a missing Fs
           does not stop the driver being filed. Per-field red borders stay. -->
      <div v-if="identityReasons.length" class="de-incomplete"
           :title="identityReasons.join('\n')">
        <span class="de-incomplete-hd">⚠ Saves fine, but can’t be filed under a name until:</span>
        <span class="de-incomplete-list">{{ identityReasons.join(' · ') }}</span>
      </div>
      <div v-if="chartBlockingReasons.length" class="de-incomplete"
           :title="chartBlockingReasons.join('\n')">
        <span class="de-incomplete-hd">⚠ Saves fine, but the charts stay blank until:</span>
        <span class="de-incomplete-list">{{ chartBlockingReasons.join(' · ') }}</span>
      </div>

      <div class="de-footer">
        <div class="de-legend2">
          <span class="de-sw st-e"></span>Entered
          <span class="de-sw st-c"></span>Calculated
          <span class="de-sw st-n"></span>Not entered
        </div>
        <div class="de-btns">
          <input type="file" ref="fileInput" style="display:none" @change="handleFileLoaded" :accept="DriverFileFormat.ACCEPT">
          <button class="pri" @click="close" title="Apply changes and close the editor (updates local browser/project)">OK</button>
          <button class="de-copy-my" @click="copyToMyDrivers"
                  :title="copiedMsg || 'Copy this driver into My Drivers as an independent copy — no link back to it'">
            {{ copiedMsg || 'Copy to My Drivers' }}
          </button>
          <button @click="requestExport" title="Save this driver to a file — choose the format, then pick where to put it">Save</button>
          <button @click="triggerLoad" title="Load driver from a .wdr file on disk">Load</button>
          <button @click="reset" title="Reset fields to the values when the editor was opened">Reset</button>
          <button @click="cancel" title="Discard edits made in this session and close">Cancel</button>
        </div>
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
            <button class="pri" @click="dismissIdentityMsg">Fill them in</button>
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
            <button @click="exportPickerOpen = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
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
   the widest (748px of content) and Parameters the tallest (550px including chrome). Both
   measured, not guessed. The vh caps are only a small-screen backstop. */
/* position: relative anchors the format picker's scrim to the editor, not the viewport. */
.de-modal { position: relative !important; display: flex !important; flex-direction: column !important; width: 770px !important; max-width: 96vw !important; min-height: 550px !important; max-height: 96vh !important; flex-shrink: 0 !important; overflow: hidden !important; }
.de-tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid var(--line); }
.de-tab { padding: 4px 10px; border: 1px solid var(--line); border-bottom: none; border-radius: 3px 3px 0 0; background: var(--panel2); color: var(--fg); cursor: pointer; font: inherit; font-size: 13px; }
.de-tab.on { background: var(--panel); font-weight: 600; }
.de-body { display: flex; flex-direction: column; gap: 6px; flex: 1 !important; }

.de-fld { display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px; }
.de-fld label { font-size: 11px; color: var(--mut); }
.de-fld input, .de-fld select { padding: 2px 5px; border: 1px solid var(--line); border-radius: 3px; font: inherit; background: var(--panel); color: var(--fg); width: 90px; }
.de-fld .u { font-size: 11px; color: var(--mut); }
.de-fld.cl-dim input, .de-fld.cl-dim select { background: var(--panel2); color: var(--mut); }
.de-row2 { display: flex; gap: 16px; }
.de-row2 .de-fld { flex: 1; }
.de-row2 .de-fld input { width: 100%; }

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
.de-dims .de-diagram :deep(.dd-dim-svg) { width: 405px; height: 338px; }
.de-comment textarea { width: 100%; min-height: 90px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 3px; font: inherit; background: var(--panel); color: var(--fg); resize: vertical; }

.de-legend, .de-legend2 { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mut); margin-top: 6px; }
.de-sw { width: 14px; height: 14px; border: 1px solid var(--line); border-radius: 2px; display: inline-block; margin-left: 8px; }
.de-legend .de-sw:first-child, .de-legend2 .de-sw:first-child { margin-left: 0; }
.de-sw.st-e { background: var(--good); }
.de-sw.st-c { background: var(--acc); }
.de-sw.st-n { background: #333; }
.de-auto { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; opacity: .8; }

/* Provenance colouring — text colour on the value, matching the legend swatches.
   Two shapes: cellClass() lands directly on NumInput's root <input> (fallthrough
   attrs), or on a wrapping .de-fld for the read-only derived fields. */
input.st-e, .de-fld.st-e input { color: var(--good); }
input.st-c, .de-fld.st-c input { color: var(--acc); }
input.st-n, .de-fld.st-n input { color: var(--mut); }

.de-group { margin-bottom: 2px; }
.de-hdr { background: var(--panel2); text-align: center; font-size: 11px; padding: 2px 0; border-radius: 3px; margin-bottom: 4px; color: var(--mut); }
.de-cols { display: flex; gap: 10px 14px; flex-wrap: wrap; }
.de-col { display: flex; flex-direction: column; }

.de-dims { display: flex; gap: 24px; align-items: flex-start; }
.de-dimlist { width: 200px; flex-shrink: 0; }
.de-note { font-size: 11px; color: var(--mut); font-style: italic; margin-top: 4px; }
.de-diagram { flex: 1; display: flex; justify-content: center; padding-top: 0; }
.de-diagram :deep(.dd-dim-svg) { color: var(--fg); }
.de-diagram :deep(text) { fill: var(--fg); }

.de-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--line); }
.de-btns { display: flex; gap: 6px; }
.de-btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }

/* Row-flex (labels-left) by default for Parameters, Advanced, and Dimensions tabs */
.de-fld {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 8px !important;
  margin-bottom: 0 !important;
}
.de-fld label {
  display: inline-block !important;
  width: 62px !important;
  text-align: right !important;
  flex: 0 0 62px !important;
}
.de-fld input,
.de-fld select {
  width: 75px !important;
}

/* Column-flex (labels-above) override specifically for the General tab */
.de-general .de-fld {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 2px !important;
  margin-bottom: 3px !important;
}
.de-general .de-fld label {
  display: block !important;
  width: auto !important;
  text-align: left !important;
  flex: none !important;
}
.de-general .de-fld input,
.de-general .de-fld select {
  width: 90px !important;
}
.de-general .de-row2 .de-fld input {
  width: 100% !important;
}

/* Spreading out the dimension fields slightly */
.de-dims .de-fld {
  margin-bottom: 10px !important;
}

/* 4-column grid with fixed column widths to align separate grid sections */
.de-cols {
  display: grid !important;
  grid-template-columns: 165px 165px 165px 1fr !important;
  gap: 10px 14px !important;
}

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
.fmt-foot { display: flex; justify-content: flex-end; margin-top: 2px; }
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
/* `.de-dq`, the field-level DQ mark, is styled in style.css — the what-if panels wear the same
   mark, so one driver's data quality cannot look different in two places. */

/* One strip, above the footer, naming everything that stops the driver simulating. It never
   disables a button — see the DQ block in the script for why. */
.de-incomplete {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px;
  padding: 5px 14px; border-top: 1px solid var(--line);
  background: color-mix(in srgb, #d9381e 8%, transparent);
  font-size: 11px; line-height: 1.4;
}
.de-incomplete-hd   { color: #d9381e; font-weight: 600; flex: 0 0 auto; }
.de-incomplete-list { color: var(--mut); min-width: 0; }
</style>

