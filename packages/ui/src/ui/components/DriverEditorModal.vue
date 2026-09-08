<script setup lang="ts">
import DriverDimensionsDiagram from './DriverDimensionsDiagram.vue'
import { ref, shallowRef, markRaw, computed, nextTick, watch, onBeforeUnmount } from 'vue';
import { formatInUnit } from '../../logic/appState.js';
import { useFocusedProject } from '../../logic/focusedProjectContext.js';
import { presentationState } from '../../logic/presentationState.js';
import { useApp } from '../../logic/app.js';
import { referenceRho, referenceC } from '../../logic/environment.js';
import { OpenISDDriver } from '@openisd/design';
import { readDriverFileText, driverFileBody } from '../../logic/driverFileText.js';
import type { SpecField, Cell } from '@openisd/design';
import { Provenance } from '@openisd/design';
import NumInput from './NumInput.vue';
import UnitToggle from './UnitToggle.vue';
import { precision, fieldHelp } from '../../logic/fields/fieldRegistry.js';
import { useEscToClose } from '../../logic/useEscToClose.js';
import { cellClassFor, consistencyNote, fieldIsMandatoryAndUnsatisfied } from '../../logic/useDriverCells.js';
import { DriverFileFormat } from '../../fileFormat.js';
import EquationInspectorModal from './EquationInspectorModal.vue';
import { getProvenanceInfo, LABEL_TO_FIELD_KEY } from '../../logic/provenance.js';
import { editableFrom, elementFrom, inputFrom, selectValue } from '../../logic/domEvents.js';

const { selection, myDrivers, logging, driverFileStorage } = useApp();

// Driver editor — a modal. Recreates WinISD's "Driver editor" dialog (docs/winisd_screenshots/edit_driver_pg*.png):
// 4 tabs — General / Parameters / Advanced parameters / Dimensions.
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

const emit = defineEmits<{ close: [] }>();

type Tab = 'General' | 'Parameters' | 'Advanced parameters' | 'Dimensions';
const TABS: Tab[] = ['General', 'Parameters', 'Advanced parameters', 'Dimensions'];

// What subject is open, fixed for the dialog's whole lifetime (selection is not consulted
// again until this dialog closes).
const subject = selection.editSubject();
const tab = ref<Tab>('General');
const project = useFocusedProject();

// The title names WHICH driver is on screen, because this one dialog edits two subjects with
// different consequences: OK on the project's driver changes the design, OK on a saved driver
// changes that My Drivers entry and leaves the design alone.
const editorTitle = subject.kind === 'myDriver' ? 'Edit My Driver' : "Edit Project's Driver";

/** A fresh, detached draft to start or reset from — the project's committed driver (seeded via
 *  TEXT, since `ManagedProject` never hands an `OpenISDDriver` out) for the project
 *  subject; the picked driver `selection` handed over for an existing My Driver; a blank one
 *  for a fresh My Driver (`openNewDriver()` — `subject.seed` is null exactly then). */
function seedDraft(): OpenISDDriver {
  if (subject.kind === 'project') return OpenISDDriver.fromOwdrJson(project.value.committedDriverText());
  return subject.seed ? subject.seed.copy() : OpenISDDriver.empty();
}

// markRaw + shallowRef: Driver is a class with private fields, and a Vue reactive proxy
// makes every method call on it throw. Redraws are driven by `trigger` below, so the
// instance never needs to be deeply reactive.
const draftDriver = shallowRef(markRaw(seedDraft()));
const trigger = ref(0);
function forceUpdate() { trigger.value++; }

/** OK on a myDriver subject: save the draft under its uuid — in place, same identity. A save
 *  that would CHANGE the driver's brand/model first asks the ONE ruled question (rename in
 *  place vs save as copy) via `renameQuestionOpen`; by the time this runs, that is decided. */
function commitToMyDrivers(driver: OpenISDDriver): void {
  if (subject.kind !== 'myDriver') throw new Error('commitToMyDrivers called on a project subject');
  if (myDrivers.upsert(driver) == null) {
    alert('Saved drivers are read-only until the storage problem is resolved');
  }
}

/** The saved entry this editor session opened, as it stands in storage — the comparison base
 *  for the rename question. Null when the subject is new or storage is not readable. */
function savedEntryForSubject(): OpenISDDriver | null {
  if (subject.kind !== 'myDriver' || !subject.openedAs) return null;
  return myDrivers.list().find(d => d.uuid() === subject.openedAs) ?? null;
}

/** A save is a RENAME when the draft's brand/model differ from the SAVED entry's. */
function saveWouldRename(): boolean {
  const saved = savedEntryForSubject();
  if (!saved) return false;
  return saved.brand() !== draftDriver.value.brand()
    || saved.model() !== draftDriver.value.model();
}

// The ONE question (QO81 rename ruling, "option 3"): rename this driver in place (same uuid),
// or save as a copy (new uuid, the original untouched). Two real actions; Clone stays the
// explicit fork elsewhere.
const renameQuestionOpen = ref(false);

function saveRenameInPlace(): void {
  renameQuestionOpen.value = false;
  commitToMyDrivers(draftDriver.value);
  selection.closeEditor();
  emit('close');
}

function saveAsCopy(): void {
  renameQuestionOpen.value = false;
  draftDriver.value.mintFreshUuid();
  commitToMyDrivers(draftDriver.value);
  selection.closeEditor();
  emit('close');
}

// A DISPLAY VIEW of the draft, not a second model: every value is read back out of the draft
// through its own accessors, so the template binds to one shape while the draft stays the only
// place a value lives. `sku` is a DerivedField — built by the pipeline, never hand-edited — so
// it is read off the record rather than through metaCell().
const driverRaw = computed(() => {
  const _ = trigger.value;
  const d = draftDriver.value;
  return {
    brand: d.brand(),
    model: d.model(),
    manufacturer: d.manufacturer(),
    providedBy: d.providedBy(),
    comment: d.comment(),
    added: d.added(),
    sku: d.sku(),
    VCCon: d.spec[d.section].VCCon.get().value,
  };
});

const editorModelValue = computed(() => {
  const r = driverRaw.value;
  if (r.sku) return r.sku.toUpperCase();
  return String(r.model ?? '');
});

function setText(field: 'brand' | 'model' | 'providedBy' | 'comment' | 'manufacturer' | 'added', e: Event) {
  // Metadata is a ScrapedField, a different envelope from a SpecEntry, so it has its own
  // entry point. Routing a string through enter() would put it in the wrong envelope.
  const edited = editableFrom(e);
  if (edited === null) return;
  const value = edited.value;
  const d = draftDriver.value;
  switch (field) {
    case 'brand': d.enterBrand(value); break;
    case 'model': d.enterModel(value); break;
    case 'manufacturer': d.enterManufacturer(value); break;
    case 'providedBy': d.enterProvidedBy(value); break;
    case 'comment': d.enterComment(value); break;
    case 'added': d.enterAdded(value); break;
  }
  forceUpdate();
}

/** Dispatch a runtime `SpecField` name to the draft's flat accessor — `SpecField` never
 *  appears as a public parameter on `OpenISDDriver` itself (human ruling 2026-08-24,
 *  ENCAPSULATION_AND_LAYERING.md); this is the one UI-layer dispatch point for the editor's
 *  data-driven field table. */
function setNum(field: string, v: number | null) {
  const d = draftDriver.value;
  if (v == null) {
    switch (field as SpecField) {
    case 'Fs': d.spec[d.section].Fs_hz.clear(); return;
    case 'Re': d.spec[d.section].Re_ohm.clear(); return;
    case 'Le': d.spec[d.section].Le_H.clear(); return;
    case 'fLe': d.clearFLe(); return;
    case 'KLe': d.spec[d.section].KLe_H_sqrtHz.clear(); return;
    case 'Znom': d.spec[d.section].Znom_ohm.clear(); return;
    case 'Qts': d.spec[d.section].Qts.clear(); return;
    case 'Qes': d.spec[d.section].Qes.clear(); return;
    case 'Qms': d.spec[d.section].Qms.clear(); return;
    case 'Vas': d.spec[d.section].Vas_m3.clear(); return;
    case 'Sd': d.spec[d.section].Sd_m2.clear(); return;
    case 'BL': d.spec[d.section].BL_Tm.clear(); return;
    case 'Mms': d.spec[d.section].Mms_kg.clear(); return;
    case 'Cms': d.spec[d.section].Cms_m_per_N.clear(); return;
    case 'Rms': d.spec[d.section].Rms_kg_per_s.clear(); return;
    case 'Xmax': d.spec[d.section].Xmax_m.clear(); return;
    case 'Xlim': d.spec[d.section].Xlim_m.clear(); return;
    case 'SPL': d.spec[d.section].SPL_dB.clear(); return;
    case 'Pe': d.spec[d.section].Pe_W.clear(); return;
    case 'Dd': d.spec[d.section].Dd_m.clear(); return;
    case 'EBP': d.spec[d.section].EBP_hz.clear(); return;
    case 'numVC': d.clearNumVC(); return;
    case 'VCCon': d.spec[d.section].VCCon.clear(); return;
    case 'Dia': d.spec[d.section].Dia_m.clear(); return;
    case 'Vd': d.spec[d.section].Vd_m3.clear(); return;
    case 'no': d.clearNo(); return;
    case 'SPLmax': d.spec[d.section].SPLmax_dB.clear(); return;
    case 'SPLmaxLF': d.spec[d.section].SPLmaxLF_dB.clear(); return;
    case 'USPL': d.spec[d.section].USPL_dB.clear(); return;
    case 'alfaVC': d.clearAlfaVC(); return;
    case 'Rt': d.spec[d.section].Rt_K_per_W.clear(); return;
    case 'Ct': d.spec[d.section].Ct_J_per_K.clear(); return;
    case 'gamma': d.clearGamma(); return;
    case 'Rme': d.spec[d.section].Rme_kg_per_s.clear(); return;
    case 'Mpow': d.spec[d.section].Mpow_N_per_sqrtW.clear(); return;
    case 'Mcost': d.spec[d.section].Mcost_kg_per_s.clear(); return;
    case 'Gloss': d.spec[d.section].Gloss.clear(); return;
    case 'c': d.clearC(); return;
    case 'roo': d.clearRoo(); return;
    case 'Vcd': d.spec[d.section].Vcd_m.clear(); return;
    case 'Hg': d.spec[d.section].Hg_m.clear(); return;
    case 'Hc': d.spec[d.section].Hc_m.clear(); return;
    case 'freq_low_hz': d.clearFreq_low_hz(); return;
    case 'freq_high_hz': d.clearFreq_high_hz(); return;
    case 'power_peak_W': d.clearPower_peak_W(); return;
    case 'weight_kg': d.clearWeight_kg(); return;
    case 'Thick': d.spec[d.section].Thick_m.clear(); return;
    case 'Depth': d.spec[d.section].Depth_m.clear(); return;
    case 'MagDepth': d.spec[d.section].MagDepth_m.clear(); return;
    case 'Magnet': d.spec[d.section].Magnet_m.clear(); return;
    case 'Basket': d.spec[d.section].Basket_m.clear(); return;
    case 'Outer': d.spec[d.section].Outer_m.clear(); return;
    case 'OuterX': d.spec[d.section].OuterX_m.clear(); return;
    case 'OuterY': d.spec[d.section].OuterY_m.clear(); return;
    case 'DVol': d.spec[d.section].DVol_m3.clear(); return;
    }
  } else {
    const value = v;
    switch (field as SpecField) {
    case 'Fs': d.spec[d.section].Fs_hz.set(value); return;
    case 'Re': d.spec[d.section].Re_ohm.set(value); return;
    case 'Le': d.spec[d.section].Le_H.set(value); return;
    case 'fLe': d.enterFLe(value); return;
    case 'KLe': d.spec[d.section].KLe_H_sqrtHz.set(value); return;
    case 'Znom': d.spec[d.section].Znom_ohm.set(value); return;
    case 'Qts': d.spec[d.section].Qts.set(value); return;
    case 'Qes': d.spec[d.section].Qes.set(value); return;
    case 'Qms': d.spec[d.section].Qms.set(value); return;
    case 'Vas': d.spec[d.section].Vas_m3.set(value); return;
    case 'Sd': d.spec[d.section].Sd_m2.set(value); return;
    case 'BL': d.spec[d.section].BL_Tm.set(value); return;
    case 'Mms': d.spec[d.section].Mms_kg.set(value); return;
    case 'Cms': d.spec[d.section].Cms_m_per_N.set(value); return;
    case 'Rms': d.spec[d.section].Rms_kg_per_s.set(value); return;
    case 'Xmax': d.spec[d.section].Xmax_m.set(value); return;
    case 'Xlim': d.spec[d.section].Xlim_m.set(value); return;
    case 'SPL': d.spec[d.section].SPL_dB.set(value); return;
    case 'Pe': d.spec[d.section].Pe_W.set(value); return;
    case 'Dd': d.spec[d.section].Dd_m.set(value); return;
    case 'EBP': d.spec[d.section].EBP_hz.set(value); return;
    case 'numVC': d.enterNumVC(value); return;
    case 'VCCon': d.spec[d.section].VCCon.set(value); return;
    case 'Dia': d.spec[d.section].Dia_m.set(value); return;
    case 'Vd': d.spec[d.section].Vd_m3.set(value); return;
    case 'no': d.enterNo(value); return;
    case 'SPLmax': d.spec[d.section].SPLmax_dB.set(value); return;
    case 'SPLmaxLF': d.spec[d.section].SPLmaxLF_dB.set(value); return;
    case 'USPL': d.spec[d.section].USPL_dB.set(value); return;
    case 'alfaVC': d.enterAlfaVC(value); return;
    case 'Rt': d.spec[d.section].Rt_K_per_W.set(value); return;
    case 'Ct': d.spec[d.section].Ct_J_per_K.set(value); return;
    case 'gamma': d.enterGamma(value); return;
    case 'Rme': d.spec[d.section].Rme_kg_per_s.set(value); return;
    case 'Mpow': d.spec[d.section].Mpow_N_per_sqrtW.set(value); return;
    case 'Mcost': d.spec[d.section].Mcost_kg_per_s.set(value); return;
    case 'Gloss': d.spec[d.section].Gloss.set(value); return;
    case 'c': d.enterC(value); return;
    case 'roo': d.enterRoo(value); return;
    case 'Vcd': d.spec[d.section].Vcd_m.set(value); return;
    case 'Hg': d.spec[d.section].Hg_m.set(value); return;
    case 'Hc': d.spec[d.section].Hc_m.set(value); return;
    case 'freq_low_hz': d.enterFreq_low_hz(value); return;
    case 'freq_high_hz': d.enterFreq_high_hz(value); return;
    case 'power_peak_W': d.enterPower_peak_W(value); return;
    case 'weight_kg': d.enterWeight_kg(value); return;
    case 'Thick': d.spec[d.section].Thick_m.set(value); return;
    case 'Depth': d.spec[d.section].Depth_m.set(value); return;
    case 'MagDepth': d.spec[d.section].MagDepth_m.set(value); return;
    case 'Magnet': d.spec[d.section].Magnet_m.set(value); return;
    case 'Basket': d.spec[d.section].Basket_m.set(value); return;
    case 'Outer': d.spec[d.section].Outer_m.set(value); return;
    case 'OuterX': d.spec[d.section].OuterX_m.set(value); return;
    case 'OuterY': d.spec[d.section].OuterY_m.set(value); return;
    case 'DVol': d.spec[d.section].DVol_m3.set(value); return;
    }
  }
  forceUpdate();
}

// One reach into the DRAFT model (layer 3) — Tune passes the store's effective
// model to the same helpers instead, so the provenance marks and the Q-group rule cannot
// disagree between this dialog and Tune showing the same driver.
function cellOf(field: string): Cell {
  const _ = trigger.value;
  const d = draftDriver.value;
  switch (field as SpecField) {
    case 'Fs': return d.spec[d.section].Fs_hz;
    case 'Re': return d.spec[d.section].Re_ohm;
    case 'Le': return d.spec[d.section].Le_H;
    case 'fLe': return d.spec[d.section].fLe_hz;
    case 'KLe': return d.spec[d.section].KLe_H_sqrtHz;
    case 'Znom': return d.spec[d.section].Znom_ohm;
    case 'Qts': return d.spec[d.section].Qts;
    case 'Qes': return d.spec[d.section].Qes;
    case 'Qms': return d.spec[d.section].Qms;
    case 'Vas': return d.spec[d.section].Vas_m3;
    case 'Sd': return d.spec[d.section].Sd_m2;
    case 'BL': return d.spec[d.section].BL_Tm;
    case 'Mms': return d.spec[d.section].Mms_kg;
    case 'Cms': return d.spec[d.section].Cms_m_per_N;
    case 'Rms': return d.spec[d.section].Rms_kg_per_s;
    case 'Xmax': return d.spec[d.section].Xmax_m;
    case 'Xlim': return d.spec[d.section].Xlim_m;
    case 'SPL': return d.spec[d.section].SPL_dB;
    case 'Pe': return d.spec[d.section].Pe_W;
    case 'Dd': return d.spec[d.section].Dd_m;
    case 'EBP': return d.spec[d.section].EBP_hz;
    case 'numVC': return d.spec[d.section].numVC;
    case 'VCCon': return d.spec[d.section].VCCon;
    case 'Dia': return d.spec[d.section].Dia_m;
    case 'Vd': return d.spec[d.section].Vd_m3;
    case 'no': return d.spec[d.section].no;
    case 'SPLmax': return d.spec[d.section].SPLmax_dB;
    case 'SPLmaxLF': return d.spec[d.section].SPLmaxLF_dB;
    case 'USPL': return d.spec[d.section].USPL_dB;
    case 'alfaVC': return d.spec[d.section].alfaVC_per_K;
    case 'Rt': return d.spec[d.section].Rt_K_per_W;
    case 'Ct': return d.spec[d.section].Ct_J_per_K;
    case 'gamma': return d.spec[d.section].gamma_m_per_s2_A;
    case 'Rme': return d.spec[d.section].Rme_kg_per_s;
    case 'Mpow': return d.spec[d.section].Mpow_N_per_sqrtW;
    case 'Mcost': return d.spec[d.section].Mcost_kg_per_s;
    case 'Gloss': return d.spec[d.section].Gloss;
    case 'c': return d.spec[d.section].c_m_per_s;
    case 'roo': return d.spec[d.section].roo_kg_per_m3;
    case 'Vcd': return d.spec[d.section].Vcd_m;
    case 'Hg': return d.spec[d.section].Hg_m;
    case 'Hc': return d.spec[d.section].Hc_m;
    case 'freq_low_hz': return d.spec[d.section].freq_low_hz;
    case 'freq_high_hz': return d.spec[d.section].freq_high_hz;
    case 'power_peak_W': return d.spec[d.section].power_peak_W;
    case 'weight_kg': return d.spec[d.section].weight_kg;
    case 'Thick': return d.spec[d.section].Thick_m;
    case 'Depth': return d.spec[d.section].Depth_m;
    case 'MagDepth': return d.spec[d.section].MagDepth_m;
    case 'Magnet': return d.spec[d.section].Magnet_m;
    case 'Basket': return d.spec[d.section].Basket_m;
    case 'Outer': return d.spec[d.section].Outer_m;
    case 'OuterX': return d.spec[d.section].OuterX_m;
    case 'OuterY': return d.spec[d.section].OuterY_m;
    case 'DVol': return d.spec[d.section].DVol_m3;
    default: return { value: null, state: Provenance.NotAvailable };
  }
}

function cellClass(field: string): string {
  return cellClassFor(cellOf, field as SpecField);
}

function cellVal(field: string): number | null {
  const v = cellOf(field).value;
  return typeof v === 'number' ? v : null;
}

// ── Auto-calculate & Provenance Inspector ──────────────────────────────────────
const autoCalculate = computed({
  get: () => draftDriver.value.autoCalculate,
  set: (val: boolean) => {
    draftDriver.value.autoCalculate = val;
    forceUpdate();
  }
});

const inspectProvenance = ref(false);
const inspectedField = ref<string | null>(null);

// Guards the popup sitting at a fixed viewport corner (right: 20px, bottom: 20px) regardless of
// where the editor renders — on a narrower or off-centre viewport it would land on top of the
// very modal it explains. Anchored here to the editor's OWN measured bounding box instead:
// beside its right edge when there is room, its left edge otherwise — so it can never cover the
// dialog it is inspecting, at any viewport size.
const modalRootEl = ref<HTMLElement | null>(null);
const popupStyle = ref<Record<string, string>>({});
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

  const width = Math.min(popupWidth, Math.max(200, vw - r.right - 2 * gap));
  const left = Math.min(Math.max(gap, r.right + gap), vw - gap - width);
  const top = Math.min(Math.max(gap, r.top), vh - gap - popupHeight);

  popupStyle.value = { position: 'fixed', left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, right: 'auto', bottom: 'auto', width: `${Math.round(width)}px` };
}
watch(inspectedField, (v) => { if (v) nextTick(updatePopupPosition); });
window.addEventListener('resize', updatePopupPosition);
onBeforeUnmount(() => window.removeEventListener('resize', updatePopupPosition));

const provenanceInfo = computed(() => {
  if (!inspectProvenance.value || !inspectedField.value) return null;
  // `driverRaw` is metadata only (brand/model/…) — it never carried a T/S value, so every
  // "Live:" substitution read `undefined` and printed `?` for every input, always.
  // bugs/BUG_20260817_provenance_live_substitution_always_shows_question_marks.md
  // `cellVal` is the same accessor every NumInput on this modal reads through, and it is
  // reactive to `trigger` — a Proxy lets `getProvenanceInfo` pull any SpecField id it names
  // without this file hand-listing every input every formula might use.
  const currentValues = new Proxy({} as Record<string, number | null>, {
    get: (_target, key) => cellVal(String(key)),
  });
  return getProvenanceInfo(inspectedField.value, currentValues);
});

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
        borderColor: path.color,
        borderWidth: '2px',
        borderStyle: 'solid',
        backgroundColor: `${path.color}25`,
        boxShadow: `0 0 6px ${path.color}66`,
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
  const labelText = fld.querySelector('label')?.textContent?.trim();
  if (labelText) {
    const key = LABEL_TO_FIELD_KEY[labelText] || labelText;
    inspectedField.value = key;
  }
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
  const v = cellOf(field).value;
  return typeof v === 'number' && !(v > 0);
}

const BAD_VALUE_NOTE = 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as entered — clear the field to let it be calculated instead.';

// INCONSISTENT — the field belongs to a consistency group (WINISD_SCHEMA §4) whose members
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

// Mandatory for the SIMULATION, not for saving. The rules are not restated here: the design
// package's driver ADT owns them and exposes its verdict, so this reads that rather than
// keeping a second copy to drift. It is also how the GROUP rules arrive
// ("any two of Qts/Qes/Qms", "Qms must exceed Qts"), which no per-field check can express.
const chartBlockingReasons = computed<string[]>(() => {
  const _ = trigger.value;
  return draftDriver.value.errors().filter(e => e.level === 'error').map(e => e.message);
});

// The domain object already answers this — see OgTune.vue.
const mandatory = (field: string) => fieldIsMandatoryAndUnsatisfied(cellOf, field);

function ebpVal(): number | null {
  const _ = trigger.value;
  return draftDriver.value.ebp();
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
const saveMyDialogOpen = ref(false);
const saveBrand = ref('');
const saveModel = ref('');
const isCopyAction = ref(false);


// Same-name drivers COEXIST under uuid identity (QO81): a name collision overwrites nothing,
// so there is no overwrite warning to show.

function openSaveMyDialog(forCopy: boolean = false) {
  saveBrand.value = driverRaw.value.brand || '';
  // A saved driver IS its <brand>/<model>. The sku, when the pipeline derived one, is the
  // canonical spelling of the model; otherwise the stated model is. There is no separate
  // `name` to fall back to — brand + model IS the name, so nothing has to be un-prefixed.
  const sku = driverRaw.value.sku;
  saveModel.value = sku ? sku.toUpperCase() : (driverRaw.value.model || '');
  isCopyAction.value = forCopy;
  saveMyDialogOpen.value = true;
  nextTick(() => {
    document.querySelector<HTMLInputElement>('.save-model-input')?.focus();
  });
}

function confirmSaveToMyDrivers() {
  if (!saveBrand.value.trim() || !saveModel.value.trim()) return;
  draftDriver.value.enterBrand(saveBrand.value.trim());
  draftDriver.value.enterModel(saveModel.value.trim());
  forceUpdate();

  if (isCopyAction.value) {
    // A copy is a DIFFERENT driver: fresh identity, never an overwrite (QO81).
    draftDriver.value.mintFreshUuid();
    const saved = myDrivers.upsert(draftDriver.value);
    saveMyDialogOpen.value = false;
    copiedMsg.value = saved ? 'Copied to My Drivers' : 'Saved drivers are read-only — copy not stored';
    setTimeout(() => { copiedMsg.value = ''; }, 2000);
  } else if (saveWouldRename()) {
    saveMyDialogOpen.value = false;
    renameQuestionOpen.value = true;   // the ONE question; its two buttons finish the save
  } else {
    saveMyDialogOpen.value = false;
    commitToMyDrivers(draftDriver.value);
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

// OK — the draft becomes the design or saves to My Drivers.
function close() {
  if (!requireIdentity()) return;
  if (subject.kind === 'myDriver') {
    openSaveMyDialog(false);
  } else {
    project.value.loadDriverFromOwdrText(draftDriver.value.toOwdrYml());
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
  draftDriver.value = markRaw(seedDraft());
  forceUpdate();
}

const fileInput = ref<HTMLInputElement | null>(null);
function triggerLoad() {
  fileInput.value?.click();
}

function handleFileLoaded(e: Event) {
  const input = inputFrom(e);
  if (input === null) return;
  const file = input.files?.[0];
  if (!file) return;

  const format = DriverFileFormat.ofFileName(file.name);
  input.value = '';   // so re-picking the SAME file fires `change` again
  if (format === null) { alert(`Not a driver file: ${file.name} (expected ${DriverFileFormat.ACCEPT})`); return; }
  if (format === DriverFileFormat.Wdr) {
    const ok = confirm("Warning: Importing a legacy WinISD (.wdr) file will trigger parameter derivations that may overwrite or change some parameters. For exact loading, OpenISD (.owdr) format is recommended.\n\nDo you want to continue?");
    if (!ok) return;
  }

  void readDriverFileText(file).then(({ text }) => {
    if (!text) return;
    try {
      // A `.wdr` is read as-read by the serialiser then projected into the app's own record;
      // an `.owdr` IS that record already. One reader each, and no second parse invented here.
      draftDriver.value = markRaw(format === DriverFileFormat.Wdr
        ? OpenISDDriver.fromWdrText(text)
        : OpenISDDriver.fromOwdrYml(text));
      forceUpdate();
    } catch (err) {
      alert('Failed to parse file: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, (err: Error) => { alert('Failed to read file: ' + err.message); });
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
    .filter(x => x.length > 0).join(' ').trim() || 'Driver';
  // `.owdr` IS the record. A `.wdr` is that record projected by the serialiser — the one place
  // that knows the format — and a driver too incomplete to project says so rather than writing
  // a file WinISD would refuse.
  const { value: text, errors } = format === DriverFileFormat.Owdr
    ? { value: draftDriver.value.toOwdrYml(), errors: [] }
    : draftDriver.value.toWdrText();
  if (!text) { logging.flash(`Cannot save .${format.value}: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
  const body = driverFileBody(text, format !== DriverFileFormat.Owdr);
  // Then the SYSTEM save dialog — the user picks folder and name, as a desktop app would.
  // The MIME must be a CUSTOM type, not application/json or text/plain. The picker unions the
  // extensions we list with every extension registered to that MIME, so `application/json`
  // offered ".owdr, .json" and `text/plain` offered ".wdr, .txt, .text" — a save dialog
  // inviting the user to write a driver to a filename the app will not read back.
  const r = await driverFileStorage.saveAs(body, format.fileName(base), format.mime, format.label, '.' + format.value);
  if (!r.cancelled) logging.flash(`Driver saved as .${format.value}`);
}

useEscToClose(() => presentationState.editDriverInfo, cancel);
// Registered AFTER the editor on purpose: the Esc stack resolves last-registered first, so
// this makes the format picker the innermost dismissal. Otherwise Esc aimed at a two-option
// panel would close the whole editor and discard the session's edits.
useEscToClose(() => exportPickerOpen.value, () => { exportPickerOpen.value = false; });
useEscToClose(() => identityMsgOpen.value, dismissIdentityMsg);
useEscToClose(() => saveMyDialogOpen.value, () => { saveMyDialogOpen.value = false; });
</script>

<template>
  <div class="overlay on">
    <div class="modal de-modal" ref="modalRootEl">
      <h2>{{ editorTitle }}<button class="x" @click="cancel" title="Close without keeping changes">✕</button></h2>

      <div class="de-tabs">
        <button v-for="t in TABS" :key="t" class="de-tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      </div>

      <div class="body de-body" :class="{ 'labels-left': tab !== 'General' }" @click="handleBodyClickOrFocus" @focusin="handleBodyClickOrFocus">
        <!-- ============================= General ============================= -->
        <div v-if="tab === 'General'" class="de-general">
          <div class="de-row2">
            <div class="de-fld" data-field-key="manufacturer" :title="fieldHelp('manufacturer')">
              <label>Manufacturer</label>
              <input type="text" :value="driverRaw.manufacturer || ''" @input="setText('manufacturer', $event)">
            </div>
            <div class="de-fld" data-field-key="brand" :title="fieldHelp('brand')">
              <label>Brand</label>
              <input type="text" class="de-brand" :value="driverRaw.brand || ''" @input="setText('brand', $event)"
                     :class="{ 'de-input-mandatory': true, 'de-input-empty': !driverRaw.brand || !driverRaw.brand.trim() }">
            </div>
            <div class="de-fld" data-field-key="model" :title="fieldHelp('model')">
              <label>Model</label>
              <input type="text" class="de-model" :value="editorModelValue" @input="setText('model', $event)"
                     :class="{ 'de-input-mandatory': true, 'de-input-empty': !editorModelValue || !editorModelValue.trim() }">
            </div>
          </div>
          <div class="de-row2">
            <div class="de-fld" data-field-key="providedBy" :title="fieldHelp('providedBy')">
              <label>Data provided by</label>
              <input type="text" :value="driverRaw.providedBy || ''" @input="setText('providedBy', $event)">
            </div>
            <div class="de-fld" data-field-key="added" :title="fieldHelp('added')">
              <label>Date added</label>
              <input type="text" :value="driverRaw.added || ''" @input="setText('added', $event)">
            </div>
          </div>
          <div class="de-fld de-comment" data-field-key="comment" :title="fieldHelp('comment')">
            <label>Comment</label>
            <textarea :value="driverRaw.comment || ''" @input="setText('comment', $event)"></textarea>
          </div>
        </div>

        <!-- ============================= Parameters ============================= -->
        <div v-if="tab === 'Parameters'" class="de-params">
          <div class="de-group">
            <div class="de-hdr">Thiele/Small parameters</div>
            <div class="de-cols">
              <div class="de-fld" data-field-key="Qes" :style="getFieldStyle('Qes')" :title="fieldHelp('Qes')">
                <label>Qes</label>
                <NumInput :class="cellClass('Qes')" :mandatory="mandatory('Qes')" :model-value="cellVal('Qes')" :precision="3" @update:model-value="v => setNum('Qes', v)">
                </NumInput><span v-if="dqNote('Qes')" class="de-dq" :title="dqNote('Qes')">&#9888;</span>
              </div>
              <div class="de-fld" data-field-key="Qms" :style="getFieldStyle('Qms')" :title="fieldHelp('Qms')">
                <label>Qms</label>
                <NumInput :class="cellClass('Qms')" :mandatory="mandatory('Qms')" :model-value="cellVal('Qms')" :precision="3" @update:model-value="v => setNum('Qms', v)">
                </NumInput><span v-if="dqNote('Qms')" class="de-dq" :title="dqNote('Qms')">&#9888;</span>
              </div>
              <div class="de-fld" data-field-key="Qts" :style="getFieldStyle('Qts')" :title="fieldHelp('Qts')">
                <label>Qts</label>
                <NumInput :class="cellClass('Qts')" :mandatory="mandatory('Qts')" :model-value="cellVal('Qts')" :precision="3" @update:model-value="v => setNum('Qts', v)">
                </NumInput><span v-if="dqNote('Qts')" class="de-dq" :title="dqNote('Qts')">&#9888;</span>
              </div>
              <div class="de-fld" data-field-key="Fs" :style="getFieldStyle('Fs')" :title="fieldHelp('Fs')">
                <label>Fs</label>
                <NumInput :class="cellClass('Fs')" :mandatory="true" :model-value="cellVal('Fs')" field="Fs" group="freq" base="Hz" :precision="2" @update:model-value="v => setNum('Fs', v)">
                </NumInput><span v-if="dqNote('Fs')" class="de-dq" :title="dqNote('Fs')">&#9888;</span>
                <UnitToggle field="Fs" group="freq" base="Hz" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Vas" :style="getFieldStyle('Vas')" :title="fieldHelp('Vas')">
                <label>Vas</label>
                <NumInput :class="cellClass('Vas')" :mandatory="true" :model-value="cellVal('Vas')" field="Vas" group="volume" base="L" :precision="precision('Vas')" @update:model-value="v => setNum('Vas', v)">
                </NumInput><span v-if="dqNote('Vas')" class="de-dq" :title="dqNote('Vas')">&#9888;</span>
                <UnitToggle field="Vas" group="volume" base="L" unit-class="u" />
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Electro-Mechanical parameters</div>
            <div class="de-cols">
              <div class="de-fld" data-field-key="Mms" :style="getFieldStyle('Mms')" :title="fieldHelp('Mms')">
                <label>Mms</label>
                <NumInput :class="cellClass('Mms')" :model-value="cellVal('Mms')" field="Mms" group="mass" base="g" :precision="2" @update:model-value="v => setNum('Mms', v)">
                </NumInput><span v-if="dqNote('Mms')" class="de-dq" :title="dqNote('Mms')">&#9888;</span>
                <UnitToggle field="Mms" group="mass" base="g" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Cms" :style="getFieldStyle('Cms')" :title="fieldHelp('Cms')">
                <label>Cms</label>
                <NumInput :class="cellClass('Cms')" :model-value="cellVal('Cms')" field="Cms" group="compliance" base="mmPerN" :precision="4" @update:model-value="v => setNum('Cms', v)">
                </NumInput><span v-if="dqNote('Cms')" class="de-dq" :title="dqNote('Cms')">&#9888;</span>
                <UnitToggle field="Cms" group="compliance" base="mmPerN" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Rms" :style="getFieldStyle('Rms')" :title="fieldHelp('Rms')">
                <label>Rms</label>
                <NumInput :class="cellClass('Rms')" :model-value="cellVal('Rms')" field="Rms" group="resistance" base="nsPerM" :precision="4" @update:model-value="v => setNum('Rms', v)">
                </NumInput><span v-if="dqNote('Rms')" class="de-dq" :title="dqNote('Rms')">&#9888;</span>
                <UnitToggle field="Rms" group="resistance" base="nsPerM" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Re" :style="getFieldStyle('Re')" :title="fieldHelp('Re')">
                <label>Re</label>
                <NumInput :class="cellClass('Re')" :mandatory="true" :model-value="cellVal('Re')" :precision="3" @update:model-value="v => setNum('Re', v)">
                </NumInput><span v-if="dqNote('Re')" class="de-dq" :title="dqNote('Re')">&#9888;</span>
                <span class="u">ohm</span>
              </div>
              <div class="de-fld" data-field-key="BL" :style="getFieldStyle('BL')" :title="fieldHelp('BL')">
                <label>BL</label>
                <NumInput :class="cellClass('BL')" :model-value="cellVal('BL')" :precision="3" @update:model-value="v => setNum('BL', v)">
                </NumInput><span v-if="dqNote('BL')" class="de-dq" :title="dqNote('BL')">&#9888;</span>
                <span class="u">Tm</span>
              </div>
              <div class="de-fld" data-field-key="Dd" :style="getFieldStyle('Dd')" :title="fieldHelp('Dd')">
                <label>Dd</label>
                <NumInput :class="cellClass('Dd')" :model-value="cellVal('Dd')" field="Dd" group="length" base="mm" :precision="precision('Dd')" @update:model-value="v => setNum('Dd', v)"></NumInput><span v-if="dqNote('Dd')" class="de-dq" :title="dqNote('Dd')">&#9888;</span>
                <UnitToggle field="Dd" group="length" base="mm" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Le" :style="getFieldStyle('Le')" :title="fieldHelp('Le')">
                <label>Le</label>
                <NumInput :class="cellClass('Le')" :model-value="cellVal('Le')" field="Le" group="inductance" base="mH" :precision="3" @update:model-value="v => setNum('Le', v)">
                </NumInput><span v-if="dqNote('Le')" class="de-dq" :title="dqNote('Le')">&#9888;</span>
                <UnitToggle field="Le" group="inductance" base="mH" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Sd" :style="getFieldStyle('Sd')" :title="fieldHelp('Sd')">
                <label>Sd</label>
                <NumInput :class="cellClass('Sd')" :mandatory="true" :model-value="cellVal('Sd')" field="Sd" group="area" base="cm2" :precision="precision('Sd')" @update:model-value="v => setNum('Sd', v)">
                </NumInput><span v-if="dqNote('Sd')" class="de-dq" :title="dqNote('Sd')">&#9888;</span>
                <UnitToggle field="Sd" group="area" base="cm2" unit-class="u" />
              </div>
              <!-- fLe is STORED IN HERTZ (docs/design/WINISD_SCHEMA.md) and shown in kHz, so the
                   scale DIVIDES by 1000. NumInput renders `SI × scale`, so a ×1000 here read
                   Hz as kHz and put the field out by 1e6. -->
              <div class="de-fld" data-field-key="fLe" :style="getFieldStyle('fLe')" :title="fieldHelp('fLe')">
                <label>fLe</label>
                <NumInput :class="cellClass('fLe')" :model-value="cellVal('fLe')" field="fLe" group="freq" base="kHz" :precision="precision('fLe')" @update:model-value="v => setNum('fLe', v)"></NumInput><span v-if="dqNote('fLe')" class="de-dq" :title="dqNote('fLe')">&#9888;</span>
                <UnitToggle field="fLe" group="freq" base="kHz" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="KLe" :style="getFieldStyle('Le2')" :title="fieldHelp('KLe')">
                <label>KLe</label>
                <NumInput :class="cellClass('Le2')" :model-value="cellVal('Le2')" @update:model-value="v => setNum('Le2', v)"></NumInput><span v-if="dqNote('Le2')" class="de-dq" :title="dqNote('Le2')">&#9888;</span>
                <span class="u">H·√Hz</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Large-Signal parameters</div>
            <div class="de-cols">
              <div class="de-fld" data-field-key="Xmax" :style="getFieldStyle('Xmax')" :title="fieldHelp('Xmax')">
                <label>Xmax</label>
                <NumInput :class="cellClass('Xmax')" :model-value="cellVal('Xmax')" field="Xmax" group="length" base="mm" :precision="3" @update:model-value="v => setNum('Xmax', v)">
                </NumInput><span v-if="dqNote('Xmax')" class="de-dq" :title="dqNote('Xmax')">&#9888;</span>
                <UnitToggle field="Xmax" group="length" base="mm" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Hc" :style="getFieldStyle('Hc')" :title="fieldHelp('Hc')">
                <label>Hc</label>
                <NumInput :class="cellClass('Hc')" :model-value="cellVal('Hc')" field="Hc" group="length" base="mm" @update:model-value="v => setNum('Hc', v)"></NumInput><span v-if="dqNote('Hc')" class="de-dq" :title="dqNote('Hc')">&#9888;</span>
                <UnitToggle field="Hc" group="length" base="mm" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Hg" :style="getFieldStyle('Hg')" :title="fieldHelp('Hg')">
                <label>Hg</label>
                <NumInput :class="cellClass('Hg')" :model-value="cellVal('Hg')" field="Hg" group="length" base="mm" @update:model-value="v => setNum('Hg', v)"></NumInput><span v-if="dqNote('Hg')" class="de-dq" :title="dqNote('Hg')">&#9888;</span>
                <UnitToggle field="Hg" group="length" base="mm" unit-class="u" />
              </div>

              <div class="de-fld" data-field-key="Vd" :style="getFieldStyle('Vd')" :title="fieldHelp('Vd')">
                <label>Vd</label>
                <NumInput :class="cellClass('Vd')" :model-value="cellVal('Vd')" field="Vd" group="volume" base="cm3" @update:model-value="v => setNum('Vd', v)"></NumInput><span v-if="dqNote('Vd')" class="de-dq" :title="dqNote('Vd')">&#9888;</span>
                <UnitToggle field="Vd" group="volume" base="cm3" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Xlim" :style="getFieldStyle('Xlim')" :title="fieldHelp('Xlim')">
                <label>Xlim</label>
                <NumInput :class="cellClass('Xlim')" :model-value="cellVal('Xlim')" field="Xlim" group="length" base="mm" @update:model-value="v => setNum('Xlim', v)"></NumInput><span v-if="dqNote('Xlim')" class="de-dq" :title="dqNote('Xlim')">&#9888;</span>
                <UnitToggle field="Xlim" group="length" base="mm" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Pe" :style="getFieldStyle('Pe')" :title="fieldHelp('Pe')">
                <label>Pe</label>
                <NumInput :class="cellClass('Pe')" :model-value="cellVal('Pe')" :precision="2" @update:model-value="v => setNum('Pe', v)">
                </NumInput><span v-if="dqNote('Pe')" class="de-dq" :title="dqNote('Pe')">&#9888;</span>
                <span class="u">W</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Miscellaneous parameters</div>
            <div class="de-cols">
              <div class="de-fld" data-field-key="no" :style="getFieldStyle('no')" :title="fieldHelp('no')">
                <label>no</label>
                <NumInput :class="cellClass('no')" :model-value="cellVal('no')" field="no" group="percent" base="pct" @update:model-value="v => setNum('no', v)"></NumInput><span v-if="dqNote('no')" class="de-dq" :title="dqNote('no')">&#9888;</span>
                <UnitToggle field="no" group="percent" base="pct" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Znom" :style="getFieldStyle('Znom')" :title="fieldHelp('Znom')">
                <label>Znom</label>
                <NumInput :class="cellClass('Znom')" :model-value="cellVal('Znom')" :precision="3" @update:model-value="v => setNum('Znom', v)">
                </NumInput><span v-if="dqNote('Znom')" class="de-dq" :title="dqNote('Znom')">&#9888;</span>
                <span class="u">ohm</span>
              </div>
              <div class="de-fld" data-field-key="USPL" :style="getFieldStyle('USPL')" :title="fieldHelp('USPL')">
                <label>USPL</label>
                <NumInput :class="cellClass('USPL')" :model-value="cellVal('USPL')" @update:model-value="v => setNum('USPL', v)"></NumInput><span v-if="dqNote('USPL')" class="de-dq" :title="dqNote('USPL')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" data-field-key="SPL" :style="getFieldStyle('SPL')" :title="fieldHelp('SPL')">
                <label>SPL</label>
                <NumInput :class="cellClass('SPL')" :model-value="cellVal('SPL')" @update:model-value="v => setNum('SPL', v)"></NumInput><span v-if="dqNote('SPL')" class="de-dq" :title="dqNote('SPL')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" data-field-key="numVC" :style="getFieldStyle('numVC')" :title="fieldHelp('numVC')">
                <label>Voicecoils</label>
                <NumInput :class="cellClass('numVC')" :model-value="cellVal('numVC')" @update:model-value="v => setNum('numVC', v)"></NumInput><span v-if="dqNote('numVC')" class="de-dq" :title="dqNote('numVC')">&#9888;</span>
              </div>
              <div class="de-fld de-conn" data-field-key="VCCon" :title="fieldHelp('VCCon')">
                <label>Connection</label>
                <select class="de-conn-sel" :value="driverRaw.VCCon ?? 1" @change="e => setNum('VCCon', parseInt(selectValue(e)))"><option :value="1">Parallel</option><option :value="2">Series</option></select>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================= Advanced parameters ============================= -->
        <div v-if="tab === 'Advanced parameters'" class="de-params">
          <div class="de-group">
            <div class="de-hdr">Thermal parameters</div>
            <div class="de-cols">
              <div class="de-fld" data-field-key="alfaVC" :style="getFieldStyle('tc')" :title="fieldHelp('alfaVC')">
                <label>AlfaVC</label>
                <NumInput :class="cellClass('tc')" :model-value="cellVal('tc')" field="alfaVC" group="tempCoeff" base="perMilliK" @update:model-value="v => setNum('tc', v)"></NumInput><span v-if="dqNote('tc')" class="de-dq" :title="dqNote('tc')">&#9888;</span>
                <UnitToggle field="alfaVC" group="tempCoeff" base="perMilliK" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="Rt" :style="getFieldStyle('Rth')" :title="fieldHelp('Rt')">
                <label>R(t)</label>
                <NumInput :class="cellClass('Rth')" :model-value="cellVal('Rth')" @update:model-value="v => setNum('Rth', v)"></NumInput><span v-if="dqNote('Rth')" class="de-dq" :title="dqNote('Rth')">&#9888;</span>
                <span class="u">K/W</span>
              </div>
              <div class="de-fld" data-field-key="Ct" :style="getFieldStyle('Cth')" :title="fieldHelp('Ct')">
                <label>C(t)</label>
                <NumInput :class="cellClass('Cth')" :model-value="cellVal('Cth')" @update:model-value="v => setNum('Cth', v)"></NumInput><span v-if="dqNote('Cth')" class="de-dq" :title="dqNote('Cth')">&#9888;</span>
                <span class="u">J/K</span>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Figure of merits</div>
            <div class="de-cols">
              <div class="de-fld" data-field-key="SPLmaxLF" :style="getFieldStyle('SPLmaxLF')" :title="fieldHelp('SPLmaxLF')">
                <label>SPLmaxLF</label>
                <NumInput :class="cellClass('SPLmaxLF')" :model-value="cellVal('SPLmaxLF')" @update:model-value="v => setNum('SPLmaxLF', v)"></NumInput><span v-if="dqNote('SPLmaxLF')" class="de-dq" :title="dqNote('SPLmaxLF')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" data-field-key="SPLmax" :style="getFieldStyle('SPLmax')" :title="fieldHelp('SPLmax')">
                <label>SPLmax</label>
                <NumInput :class="cellClass('SPLmax')" :model-value="cellVal('SPLmax')" @update:model-value="v => setNum('SPLmax', v)"></NumInput><span v-if="dqNote('SPLmax')" class="de-dq" :title="dqNote('SPLmax')">&#9888;</span>
                <span class="u">dB</span>
              </div>
              <div class="de-fld" data-field-key="Rme" :style="getFieldStyle('Rme')" :title="fieldHelp('Rme')">
                <label>Rme</label>
                <NumInput :class="cellClass('Rme')" :model-value="cellVal('Rme')" field="Rme" group="resistance" base="nsPerM" @update:model-value="v => setNum('Rme', v)"></NumInput><span v-if="dqNote('Rme')" class="de-dq" :title="dqNote('Rme')">&#9888;</span>
                <UnitToggle field="Rme" group="resistance" base="nsPerM" unit-class="u" />
              </div>
              <div class="de-fld" data-field-key="gamma" :style="getFieldStyle('gamma')" :title="fieldHelp('gamma')">
                <label>gamma</label>
                <NumInput :class="cellClass('gamma')" :model-value="cellVal('gamma')" @update:model-value="v => setNum('gamma', v)"></NumInput><span v-if="dqNote('gamma')" class="de-dq" :title="dqNote('gamma')">&#9888;</span>
                <span class="u">N/(A·kg)</span>
              </div>
              <div class="de-fld" data-field-key="Mpow" :style="getFieldStyle('Mpow')" :title="fieldHelp('Mpow')">
                <label>Mpow</label>
                <NumInput :class="cellClass('Mpow')" :model-value="cellVal('Mpow')" @update:model-value="v => setNum('Mpow', v)"></NumInput><span v-if="dqNote('Mpow')" class="de-dq" :title="dqNote('Mpow')">&#9888;</span>
                <span class="u">N/√W</span>
              </div>
              <div class="de-fld" data-field-key="Mcost" :style="getFieldStyle('Mcost')" :title="fieldHelp('Mcost')">
                <label>Mcost</label>
                <NumInput :class="cellClass('Mcost')" :model-value="cellVal('Mcost')" field="Mcost" group="resistance" base="kgPerS" @update:model-value="v => setNum('Mcost', v)"></NumInput><span v-if="dqNote('Mcost')" class="de-dq" :title="dqNote('Mcost')">&#9888;</span>
                <UnitToggle field="Mcost" group="resistance" base="kgPerS" unit-class="u" />
              </div>
              <div class="de-fld value-c" data-field-key="EBP" :style="getFieldStyle('EBP')" :title="fieldHelp('EBP')">
                <label>EBP</label>
                <input type="text" readonly :value="ebpVal() != null ? formatInUnit(ebpVal(), 'EBP', 'freq', 'Hz', 1) : ''"><UnitToggle field="EBP" group="freq" base="Hz" unit-class="u" />
              </div>
              <!-- The model holds the FRACTION the .wdr carries; WinISD's pane prints a
                   percentage. The `percent` unit group is the ONE place that ×100 lives. -->
              <div class="de-fld" data-field-key="Gloss" :style="getFieldStyle('Gloss')" :title="fieldHelp('Gloss')">
                <label>Gloss</label>
                <NumInput :class="cellClass('Gloss')" :model-value="cellVal('Gloss')" field="Gloss" group="percent" base="pct" :precision="precision('Gloss')" @update:model-value="v => setNum('Gloss', v)"></NumInput><span v-if="dqNote('Gloss')" class="de-dq" :title="dqNote('Gloss')">&#9888;</span>
                <UnitToggle field="Gloss" group="percent" base="pct" unit-class="u" />
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Environment parameters</div>
            <div class="de-cols">
              <div class="de-fld value-c" data-field-key="c" :title="fieldHelp('c')">
                <label>c</label>
                <input type="text" readonly :value="formatInUnit(referenceC(), 'c', 'velocity', 'mps', 2)"><UnitToggle field="c" group="velocity" base="mps" unit-class="u" />
              </div>
              <div class="de-fld value-c" data-field-key="roo" :title="fieldHelp('roo')">
                <label>roo</label>
                <input type="text" readonly :value="formatInUnit(referenceRho(), 'roo', 'density', 'kgPerM3', 5)"><UnitToggle field="roo" group="density" base="kgPerM3" unit-class="u" />
              </div>
            </div>
          </div>
        </div>

        <!-- ============================= Dimensions ============================= -->
        <div v-if="tab === 'Dimensions'" class="de-dims">
          <div class="de-dimlist">
            <div class="de-hdr">Dimensions</div>
            <!-- Every length below is stored in METRES and shown in MILLIMETRES (the length unit group),
                 the same unit the Parameters tab uses for Xmax/Hc/Hg/Dd, and one of the units
                 WinISD offers on each of these fields. Unscaled, a 6.5" basket read "0.17";
                 Thick read a metre value under an inches label. -->
            <div class="de-fld" data-field-key="Thick" :title="fieldHelp('Thick')"><label>Basket Plate Thickness (Thick)</label><NumInput :class="cellClass('Thick')" :model-value="cellVal('Thick')" field="Thick" group="length" base="mm" :precision="precision('Thick')" @update:model-value="v => setNum('Thick', v)"></NumInput><span v-if="dqNote('Thick')" class="de-dq" :title="dqNote('Thick')">&#9888;</span><UnitToggle field="Thick" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="Depth" :style="getFieldStyle('Depth')" :title="fieldHelp('Depth')"><label>Driver Depth (Depth)</label><NumInput :class="cellClass('Depth')" :model-value="cellVal('Depth')" field="Depth" group="length" base="mm" :precision="precision('Depth')" @update:model-value="v => setNum('Depth', v)"></NumInput><span v-if="dqNote('Depth')" class="de-dq" :title="dqNote('Depth')">&#9888;</span><UnitToggle field="Depth" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="MagDepth" :style="getFieldStyle('MagDepth')" :title="fieldHelp('MagDepth')"><label>Magnet Depth (MagDepth)</label><NumInput :class="cellClass('MagDepth')" :model-value="cellVal('MagDepth')" field="MagDepth" group="length" base="mm" :precision="precision('MagDepth')" @update:model-value="v => setNum('MagDepth', v)"></NumInput><span v-if="dqNote('MagDepth')" class="de-dq" :title="dqNote('MagDepth')">&#9888;</span><UnitToggle field="MagDepth" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="Magnet" :style="getFieldStyle('Magnet')" :title="fieldHelp('Magnet')"><label>Magnet Diameter (Magnet)</label><NumInput :class="cellClass('Magnet')" :model-value="cellVal('Magnet')" field="Magnet" group="length" base="mm" :precision="precision('Magnet')" @update:model-value="v => setNum('Magnet', v)"></NumInput><span v-if="dqNote('Magnet')" class="de-dq" :title="dqNote('Magnet')">&#9888;</span><UnitToggle field="Magnet" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="Basket" :title="fieldHelp('Basket')"><label>Basket Diameter (Basket)</label><NumInput :class="cellClass('Basket')" :model-value="cellVal('Basket')" field="Basket" group="length" base="mm" :precision="precision('Basket')" @update:model-value="v => setNum('Basket', v)"></NumInput><span v-if="dqNote('Basket')" class="de-dq" :title="dqNote('Basket')">&#9888;</span><UnitToggle field="Basket" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="Outer" :title="fieldHelp('Outer')"><label>Outer Diameter (Outer)</label><NumInput :class="cellClass('Outer')" :model-value="cellVal('Outer')" field="Outer" group="length" base="mm" :precision="precision('Outer')" @update:model-value="v => setNum('Outer', v)"></NumInput><span v-if="dqNote('Outer')" class="de-dq" :title="dqNote('Outer')">&#9888;</span><UnitToggle field="Outer" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="Vcd" :title="fieldHelp('Vcd')"><label>Voice Coil Dia (Vcd)</label><NumInput :class="cellClass('Vcd')" :model-value="cellVal('Vcd')" field="Vcd" group="length" base="mm" :precision="precision('Vcd')" @update:model-value="v => setNum('Vcd', v)"></NumInput><span v-if="dqNote('Vcd')" class="de-dq" :title="dqNote('Vcd')">&#9888;</span><UnitToggle field="Vcd" group="length" base="mm" unit-class="u" /></div>
            <div class="de-fld" data-field-key="DVol" :style="getFieldStyle('DVol')" :title="fieldHelp('DVol')"><label>Driver Displacement Volume (DVol)</label><NumInput :class="cellClass('DVol')" :model-value="cellVal('DVol')" field="DVol" group="volume" base="cm3" :precision="precision('DVol')" @update:model-value="v => setNum('DVol', v)"></NumInput><span v-if="dqNote('DVol')" class="de-dq" :title="dqNote('DVol')">&#9888;</span><UnitToggle field="DVol" group="volume" base="cm3" unit-class="u" /></div>
          </div>

          <div class="de-diagram" aria-hidden="true" title="Driver cross-section (reference diagram — dimensions not modelled)">
            <DriverDimensionsDiagram />
          </div>
        </div>
      </div>

      <div class="de-toolbar">
        <label class="de-provenance-chk" title="Auto-calculate derived/unknown T/S fields when parameters change">
          <input type="checkbox" v-model="autoCalculate" />
          <span>Auto calculate unknowns</span>
        </label>
        <label class="de-provenance-chk" title="Auto-highlight calculation feeding paths and display equations overlay">
          <input type="checkbox" v-model="inspectProvenance" />
          <span>Inspect Provenance</span>
        </label>
      </div>

      <!-- What is missing, and what it actually costs. Saving is never blocked by either —
           the strip states the consequence instead, so the human keeps their typing. Two
           strips, not one, because a missing Brand does not blank a chart and a missing Fs
           does not stop the driver being filed. Per-field red borders stay. -->
      <div v-if="identityReasons.length" class="de-incomplete"
           :title="identityReasons.join('\n')">
        <span class="de-incomplete-hd">⚠ Saves fine, but can’t be filed under a name because:</span>
        <span class="de-incomplete-list">{{ identityReasons.join(' · ') }}</span>
      </div>
      <div v-if="chartBlockingReasons.length" class="de-incomplete"
           :title="chartBlockingReasons.join('\n')">
        <span class="de-incomplete-hd">⚠ Saves fine, but the charts stay blank because:</span>
        <span class="de-incomplete-list">{{ chartBlockingReasons.join(' · ') }}</span>
      </div>

      <div class="de-footer">
        <div class="de-legend2">
          <span class="de-sw value-e"></span>Entered
          <span class="de-sw value-c"></span>Calculated
          <span class="de-sw value-n"></span>Not entered
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

      <!-- Save to My Drivers prompt dialog -->
      <div v-if="renameQuestionOpen" class="fmt-scrim de-rename-panel">
        <div class="fmt-panel" role="dialog" aria-label="Rename or copy">
          <h3>This changes the driver's name</h3>
          <p class="fmt-note">
            You changed this saved driver's brand or model. Rename it in place, or keep the
            original and save your changes as a copy?
          </p>
          <div class="fmt-foot" style="margin-top: 14px;">
            <button class="pri rename-in-place-btn" @click="saveRenameInPlace">Rename this driver</button>
            <button class="save-as-copy-btn" @click="saveAsCopy">Save as a copy</button>
          </div>
        </div>
      </div>
      <div v-if="saveMyDialogOpen" class="fmt-scrim de-save-my-panel" @click.self="saveMyDialogOpen = false">
        <div class="fmt-panel" role="dialog" aria-label="Save to My Drivers">
          <h3>Save to My Drivers</h3>
          <p class="fmt-note">
            Confirm or update the Brand and Model to save this driver in My Drivers:
          </p>
          <div class="save-fld" style="margin-top: 10px;">
            <label>Brand</label>
            <input type="text" class="save-brand-input" v-model="saveBrand" placeholder="Brand name">
          </div>
          <div class="save-fld" style="margin-top: 8px;">
            <label>Model</label>
            <input type="text" class="save-model-input" v-model="saveModel" placeholder="Model slug (e.g. E150HE-44)">
          </div>
          <div class="fmt-foot" style="margin-top: 14px;">
            <button class="pri save-confirm-btn" :disabled="!saveBrand.trim() || !saveModel.trim()" @click="confirmSaveToMyDrivers">
              Save to My Drivers
            </button>
            <button class="save-cancel-btn" @click="saveMyDialogOpen = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
    <EquationInspectorModal
      :open="inspectProvenance && inspectedField !== null"
      :target-field="inspectedField"
      :provenance-info="provenanceInfo"
      :style="popupStyle"
      @close="inspectedField = null"
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
   the widest (748px of content) and Parameters the tallest. Both measured, not guessed. The
   vh caps are only a small-screen backstop. */
/* position: relative anchors the format picker's scrim to the editor, not the viewport. */
.de-modal { position: relative !important; display: flex !important; flex-direction: column !important; width: 770px !important; max-width: 96vw !important; min-height: 550px !important; max-height: 96vh !important; flex-shrink: 0 !important; overflow: hidden !important; }
.de-tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid var(--line); }
.de-tab { padding: 4px 10px; border: 1px solid var(--line); border-bottom: none; border-radius: 3px 3px 0 0; background: var(--panel2); color: var(--fg); cursor: pointer; font: inherit; font-size: 13px; }
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

.de-fld { display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px; width: fit-content; justify-self: start; }
.de-fld label { font-size: 11px; color: var(--mut); white-space: nowrap; }
.de-fld input, .de-fld select { padding: 2px 5px; border: 1px solid var(--line); border-radius: 3px; font: inherit; background: var(--panel); color: var(--fg); width: 90px; }
.de-fld .u, .u {
  font-size: 11px; color: var(--mut); white-space: nowrap !important; display: inline-block;
  /* FIXED width. A unit sized by its own text ("mm" 19px, "cm³" 21px) reflowed the whole
     panel every time it was cycled. Wide enough for the longest unit the editor shows. */
  width: 34px; text-align: left; box-sizing: border-box;
}
.de-fld.cl-dim input, .de-fld.cl-dim select { background: var(--panel2); color: var(--mut); }
.de-row2 { display: flex; gap: 16px; }
.de-row2 .de-fld { flex: 1; width: auto; }
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
   bugs/BUG_20260817_driver_editor_general_comment_box_renders_50px_wide.md */
.de-general .de-fld.de-comment {
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
.de-sw.value-e { background: var(--good); }
.de-sw.value-c { background: var(--acc); }
.de-sw.value-n { background: #333; }
.de-auto { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; opacity: .8; }

/* Provenance colouring — text colour on the value, matching the legend swatches.
   Two shapes: cellClass() lands directly on NumInput's root <input> (fallthrough
   attrs), or on a wrapping .de-fld for the read-only derived fields. */
input.value-e, .de-fld.value-e input { color: var(--good); }
input.value-c, .de-fld.value-c input { color: var(--acc); }
input.value-n, .de-fld.value-n input { color: var(--mut); }

/* ONE grid for the WHOLE tab, not one per section: WinISD's editor puts Qes, Mms, Xmax and
   `no` on the same column edge even though they live under four different headings, and a grid
   per section can only align the rows inside it. The section wrappers dissolve into it with
   `display: contents`, so every field on the tab sits in the same four columns and each heading
   spans the lot. The columns need no negotiation — every field component is the same width. */
.de-params {
  display: grid !important;
  /* 4 field-slots per row, 4 tracks each (label/value/unit/alert) = 16 tracks. A `.de-fld`
     subgrids across 4 of them (one field-slot); with only 4 tracks total here, every field
     spanned the whole row and the tab rendered as one field per line instead of four. */
  grid-template-columns: repeat(4, minmax(0, max-content) minmax(0, max-content) auto 34px) !important;
  gap: 3px 12px !important;
  align-items: center !important;
  align-content: start !important;
  justify-content: start !important;
}
.de-params > .de-group,
.de-params .de-cols { display: contents !important; }
.de-params .de-hdr { grid-column: 1 / -1 !important; margin: 2px 0 0 !important; }
.de-hdr { background: var(--panel2); text-align: center; font-size: 11px; padding: 1px 0; border-radius: 3px; margin-bottom: 2px; color: var(--mut); }
.de-col { display: flex; flex-direction: column; }

.de-dims { display: flex; gap: 24px; align-items: flex-start; }
.de-dimlist {
  /* Sized by its widest row, not a fixed 200px — the labels alone are wider than that, which
     is what forced them over their inputs. `max-content` on the label track keeps every row
     on one column edge. FOUR tracks: label, input, DQ marker, unit — the marker needs a track
     of its own or the row it appears on wraps and stops matching the rows around it. */
  display: grid;
  grid-template-columns: max-content max-content auto 34px;
  align-items: center;
  /* A tight row pitch: eight fields read as ONE list, as they do in WinISD's own Dimensions
     page. Row spacing lives HERE and nowhere else — a per-field margin on top of it stacked
     up to a 24px band between 24px inputs. */
  gap: 4px 6px;
  width: max-content;
  flex-shrink: 0;
}
.de-note { font-size: 11px; color: var(--mut); font-style: italic; margin-top: 4px; }
.de-diagram { flex: 1; display: flex; justify-content: center; padding-top: 0; }
.de-diagram :deep(.dd-dim-svg) { color: var(--fg); }
.de-diagram :deep(text) { fill: var(--fg); }

.de-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--line); }
.de-btns { display: flex; gap: 6px; }
.de-btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }

/* ONE FIELD = ONE COMPONENT, four parts: [label] [value] [unit] [alerts]. A unitless field
   keeps its unit track empty rather than collapsing it, and a field with no DQ mark keeps its
   alert track empty — every component in a column is therefore the SAME width, and same width
   is what makes the columns line up with no per-field negotiation. `subgrid` is how the width
   is shared: it takes the four tracks from the parent `.de-cols`/`.de-params` grid rather than
   sizing itself, so "same width" is enforced structurally, not by a guessed pixel number that
   fits one tab's labels and clips another's. The provenance highlight is painted on this box,
   so it wraps all four parts as one component. */
.de-fld {
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
/* Connection sits directly UNDER Voicecoils, not beside it: an explicit column-1 start pushes
   it past Voicecoils' own column-1 slot (already taken) into column 1 of the NEXT row. */
.de-conn { grid-column: 1 / span 4 !important; }
/* "Parallel"/"Series" plus the native select arrow do not fit the shared 75px input track —
   it read as "Paralle" with the last letter clipped. Widened just for this one field. */
.de-conn-sel { width: 96px !important; }
.de-fld label {
  display: block !important;
  /* Sized by the shared subgrid track, never by a fixed pixel width: the track is as wide as
     the column's longest label — Parameters/Advanced labels are short and the track shrinks to
     match; Dimensions labels are 3-4x longer ("Driver Displacement Volume (Dvol)") and the same
     mechanism gives them their own wider track. A hardcoded px width fits one and clips or
     wastes space on the other. Every field in a column is still the SAME width, because they
     all subgrid onto the same tracks — that sameness is what makes the columns line up and the
     provenance highlight (painted on `.de-fld`, wrapping all four parts) read as one component
     per field. bugs/BUG_20260817_driver_editor_labels_overflow_a_fixed_62px_column.md */
  width: auto !important;
  text-align: left !important;
  flex: 0 0 auto !important;
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

/* FOUR field columns, each of four parts: label, input, DQ marker, unit. The parts are real
   grid tracks so `.de-fld` can subgrid onto them — that is what puts every field in a column on
   ONE label edge, ONE input edge and ONE unit edge, the way WinISD's own editor reads
   (docs/winisd_screenshots/edit_driver_pg2_parameters.png). A field laid out inside a single wide track
   instead starts its input wherever its own label happens to end, which put "no" and
   "Voicecoils" 40px apart in the same column:
   bugs/BUG_20260817_driver_editor_columns_do_not_share_a_column_edge.md
   minmax(0, …) on the two content tracks: a bare max-content track refuses to shrink, and four
   columns of them overran the modal and forced a sideways scroll. */
.de-cols {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, max-content) minmax(0, max-content) auto 34px) !important;
  gap: 6px 12px !important;
  align-items: center !important;
}
/* Placement is EXPLICIT, never by document order: a field without a DQ marker would otherwise
   slide its unit into the marker's track and break the column it shares. */
.de-cols .de-fld > label,
.de-dimlist .de-fld > label { grid-column: 1 !important; }
.de-cols .de-fld > input, .de-cols .de-fld > select,
.de-dimlist .de-fld > input, .de-dimlist .de-fld > select { grid-column: 2 !important; }
.de-cols .de-fld > .de-dq,
.de-dimlist .de-fld > .de-dq {
  grid-column: 3 !important;
  /* The DQ track sits right against the input with no padding of its own, so the triangle
     glyph rendered flush on the input's edge. A small left margin only, so it does not also
     widen the label→input gap the alert-marker column has nothing to do with. */
  margin-left: 4px !important;
}
.de-cols .de-fld > .u,
.de-dimlist .de-fld > .u { grid-column: 4 !important; }

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

.de-save-my-panel .fmt-panel {
  width: 540px !important;
  max-width: 95% !important;
}
.de-save-my-panel .save-fld {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 10px !important;
  width: 100% !important;
  box-sizing: border-box !important;
}
.de-save-my-panel .save-fld label {
  width: 55px !important;
  flex: 0 0 55px !important;
  text-align: right !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  color: var(--mut);
}
.de-save-my-panel .save-brand-input,
.de-save-my-panel .save-model-input {
  flex: 1 1 auto !important;
  width: 100% !important;
  min-width: 320px !important;
  padding: 6px 10px !important;
  font-size: 13px !important;
  box-sizing: border-box !important;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--fg);
}

/* ── DQ indicators ──────────────────────────────────────────────────────────── */
/* Mandatory fields have bold border always, and red outline when empty. */
.de-input-mandatory {
  border-width: 2px !important;
}
.de-input-empty {
  border-color: #d9381e !important;
  box-shadow: 0 0 0 1px rgba(217, 56, 30, .25) !important;
}
/* `.de-dq`, the field-level DQ mark, is styled in style.css — Tune wears the same
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

