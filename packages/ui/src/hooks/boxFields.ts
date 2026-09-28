/**
 * Box-tab field wiring shared by every shell: sealed/PR readouts, the box-type-generic rear
 * volume, and the selected-box state machine. `OriginalShell.vue`'s Box tab and
 * `MobileBoxTab.vue` both call these factories — one implementation of "what does the Box tab
 * do", asked by both shells.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed, ref, watch} from 'vue';
import type {Entered, OpenISDProject, Readable, Writable} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {BOX_TYPE_OPTIONS} from '@openisd/design/fields';
import {dqOfCell} from '../logic/cellDataQuality.js';

// ---- Sealed / PR readouts (unit-testable, real domain) ------------------------
// The fix this slice exists for: reading `project.value` ALONE does not invalidate these
// computeds on every project mutation — `changeTicks`-driven `projectChanged` MUST be read too,
// or the readout freezes at the value it had when the shell first mounted (the live-wire spec
// proved 54.81 stale while the domain computed 61.878). Every member below therefore reads
// BOTH `projectChanged` and `project`.
export interface SealedReadoutsDeps {
  project: ComputedRef<OpenISDProject>;
  selectedBox: Ref<BoxType>;
  projectChanged: Ref<number>;
}

export function createSealedReadouts({ project, selectedBox, projectChanged: changed }: SealedReadoutsDeps) {
  // Sealed-box (and PR rear-chamber) resonance + system Q via the selected loss model — the
  // WinISD lossy cubic by default. NOT the impedance-magnitude peak: that scan returns the
  // high-frequency voice-coil-inductance rise (≈20 kHz) as the GLOBAL |Z| maximum for any driver
  // with Le, which is not the system resonance (and yields Qtc=0).
  //
  // These computeds are only read from the Box tab, which the shell gates with `projectOpen`.
  // They require a real project — there is no box and no readout without one.
  const rearResonance = computed<number | null>(() => {
    void changed.value; void project.value;
    return project.value.box.sealed.resonance_hz.value;
  });
  const prFsMass_hz = computed<number | null>(() => {
    void changed.value;
    return project.value.box.passiveRadiator.resonanceWithAddedMass_hz.value;
  });
  // PR solved-pair DQ readouts, live: the editable added mass and target tuning (Fp), and the
  // two read-only outputs (system tuning, free-air resonance with mass). Each is a fresh
  // `DqReadout` per recompute — the field object itself never changes identity, so a computed
  // returning the field would not re-render its dependents.
  const prAddedMassDq = computed(() => { void changed.value; return dqOfCell(project.value.box.passiveRadiator.addedMass_kg); });
  const prTuningDq = computed(() => { void changed.value; return dqOfCell(project.value.box.passiveRadiator.tuning_goal_hz); });
  const prSystemTuningDq = computed(() => { void changed.value; return dqOfCell(project.value.box.passiveRadiator.systemTuning_hz); });
  const prResonanceMassDq = computed(() => { void changed.value; return dqOfCell(project.value.box.passiveRadiator.resonanceWithAddedMass_hz); });
  // box.sealed.resonance_hz / q_tc are the domain's own readouts under the selected loss mode:
  // engine.sealedResonance returns {Fsc, Qtc} together, fed the driver's SOLVED Vas and Qts as
  // sourceLoadedQts(Rs) loads it (winisd-parity-functional.test.ts "Box.Fr" pins that feed) —
  // never an inline Cms·Sd²·ρc² reconstruction and never bare Qts.
  const rearQtc = computed<number | null>(() => {
    void changed.value;
    void project.value;
    if (selectedBox.value !== 'sealed') return null;
    return project.value.box.sealed.q_tc.value;
  });
  // WinISD's "Fh" for a PR box is the PASSIVE RADIATOR system tuning — the box compliance in
  // series with the PR's own, against the PR's moving mass — NOT the sealed Fc above, which
  // ignores the PR entirely. winisd_research/GAPS.md §A3.
  /** The Box pane's rear-chamber readout: the PR system tuning for a PR box, else sealed Fc. */
  const boxResonance = computed<number | null>(() => {
    void changed.value; void project.value;
    return selectedBox.value === 'box-passive-radiator' ? project.value.box.passiveRadiator.systemTuning_hz.value : rearResonance.value;
  });

  return { rearResonance, rearQtc, boxResonance, prAddedMassDq, prTuningDq, prSystemTuningDq, prResonanceMassDq, prFsMass_hz };
}

// ---- Box-type-generic rear-chamber volume (unit-testable, real domain) --------
// WinISD's single "Vb" field — every box type keeps its own volume field under its own
// `box.<type>` slice, so this dispatches on `selectedBox` to the type currently shown.
export interface BoxVolumeDeps {
  project: ComputedRef<OpenISDProject>;
  selectedBox: Ref<BoxType>;
  projectChanged: Ref<number>;
}

// A presentation fact with no domain counterpart: these three draw two chambers. Also read
// directly by `OriginalShell-hooks.ts`'s own `frontChamberTuningLabel`.
export const DUAL_CHAMBER = new Set<BoxType>(['bandpass4', 'bandpass6', 'abc']);

/** The active box type's own volume FIELD — never just its `.value`, so both the number and its
 *  `.dq` (BUG_20260927_box-volume-validity-decided-in-ui.md: the domain judges validity for
 *  every box type, this dispatches to whichever one is showing) come from the one field. */
function activeVolumeField(project: OpenISDProject, selectedBox: BoxType): (Readable<number> & Entered & Writable<number>) | null {
  const box = project.box;
  switch (selectedBox) {
    case 'sealed': return box.sealed.volume_m3;
    case 'vented': return box.vented.volume_m3;
    case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3;
    case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3;
    case 'abc': return box.abc.chambers.rear.volume_m3;
    case 'box-passive-radiator': return box.passiveRadiator.volume_m3;
  }
}

export function createBoxVolume({ project, selectedBox, projectChanged: changed }: BoxVolumeDeps) {
  const boxVolume_m3 = computed<number | null>(() => {
    void changed.value;
    void project.value;
    return activeVolumeField(project.value, selectedBox.value)?.value ?? null;
  });
  const boxVolumeDqNote = computed<string>(() => {
    void changed.value;
    void project.value;
    const field = activeVolumeField(project.value, selectedBox.value);
    return field ? field.dq.map((issue) => issue.text).join(' ') : '';
  });
  function setBoxVolume_m3(v: number): void {
    activeVolumeField(project.value, selectedBox.value)?.set(v);
  }
  return { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 };
}

export interface SelectedBoxDeps {
  focusedProject: () => OpenISDProject | null;
  projectChanged: Ref<number>;
  isSimulatable: (b: BoxType) => boolean;
}

// selectedBox is the Box tab's source of truth: it can hold types the solver refuses. Its
// initial value comes from the focused project when one is open — the shell renders, with
// empty placeholders, without one, and `useFocusedProject()` must not be evaluated then.
export function createSelectedBox({ focusedProject, projectChanged: changed, isSimulatable }: SelectedBoxDeps) {
  const selectedBox = ref<BoxType>(focusedProject()?.box.boxType.value ?? 'sealed');
  watch(selectedBox, (b) => {
    const p = focusedProject();
    if (isSimulatable(b) && p && p.box.boxType.value !== b) p.box.boxType.set(b);
  });
  watch(
    () => { void changed.value; return focusedProject()?.box.boxType.value; },
    (b) => { if (b != null && selectedBox.value !== b) selectedBox.value = b; },
  );

  const pending = computed(() => !isSimulatable(selectedBox.value));
  const isDual = computed(() => DUAL_CHAMBER.has(selectedBox.value));
  const boxLabel = computed(() => BOX_TYPE_OPTIONS.find(o => o.value === selectedBox.value)?.label ?? 'Box');
  const showEnclosureTab = computed(() => selectedBox.value !== 'sealed');
  return { selectedBox, pending, isDual, boxLabel, showEnclosureTab };
}
