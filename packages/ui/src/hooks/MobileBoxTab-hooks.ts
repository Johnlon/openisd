/**
 * `MobileBoxTab.vue`'s hook — box type, volume, and the calculated resonance/Qtc readout. Calls
 * the SAME field-wiring factories `boxFields.ts` exports — one implementation of
 * "what does the Box tab's Volume field do", asked by both shells.
 */
import {computed, ref} from 'vue';
import {boxTypeIsSimulatable, focusedProject, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createBoxVolume, createSealedReadouts, createSelectedBox} from './boxFields.js';
import {SealedAlignmentEditor} from './SealedAlignment-hooks.js';
import {BOX_TYPE_OPTIONS} from '@openisd/design/fields';

export function useMobileBoxTab() {
  const project = useFocusedProject();
  const { engine } = useApp();
  const isSimulatable = boxTypeIsSimulatable;

  const { selectedBox, pending, boxLabel, showEnclosureTab, enclosureNavLabel } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable });
  const { boxResonance, rearQtc } = createSealedReadouts({ project, selectedBox, projectChanged });
  const { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 } = createBoxVolume({ project, selectedBox, projectChanged });
  // Box-losses (Ql/Qa/Qp) — the per-box-type dispatch now lives in the domain
  // (OpenISDBox.lossesOf, beside volumeOf/frontVolumeOf/rearTuningOf), so this is a one-liner
  // each, mirroring OriginalShell-hooks.ts's own boxQl/boxQa/boxQp: never switch on box type in a
  // mobile hook. null means the type has no such field; Qp null means no port.
  //
  // `void projectChanged.value` in each getter: reading `focusedProject()` alone does not
  // register a dependency on the project's OWN field mutations (only on focus changing), so
  // without this the readout freezes at whatever it was on mount instead of updating after
  // `setBoxQl`/etc — the same staleness class the file's own top comment on `changeTicks`
  // documents elsewhere. Desktop's current boxQl/boxQa/boxQp lack this too (same bug, not fixed
  // here — flagged to engine, that file's in flux).
  const boxQl = computed<number | null>(() => { void projectChanged.value; return focusedProject()?.box.lossesOf(selectedBox.value)?.Ql.value ?? null; });
  function setBoxQl(v: number): void { project.value.box.lossesOf(selectedBox.value)?.Ql.set(v); }
  const boxQa = computed<number | null>(() => { void projectChanged.value; return focusedProject()?.box.lossesOf(selectedBox.value)?.Qa.value ?? null; });
  function setBoxQa(v: number): void { project.value.box.lossesOf(selectedBox.value)?.Qa.set(v); }
  const boxQp = computed<number | null>(() => { void projectChanged.value; return focusedProject()?.box.lossesOf(selectedBox.value)?.Qp?.value ?? null; });
  function setBoxQp(v: number): void { project.value.box.lossesOf(selectedBox.value)?.Qp?.set(v); }
  const boxLossesOpen = ref(false);

  // Same skin-neutral class the desktop shell uses (SealedAlignment-hooks.ts) — one editor, not
  // a mobile copy. It takes only the two engine areas it needs (sealed, driver), never the
  // aggregate.
  const sealedAlignmentEditor = new SealedAlignmentEditor(project, projectChanged, engine.sealed, engine.driver);
  const sealedAlignmentOpen = sealedAlignmentEditor.open;
  const sealedAlignmentOptions = sealedAlignmentEditor.options;
  const sealedAlignmentSelected = sealedAlignmentEditor.selectedOption;
  const sealedAlignmentVolume_L = sealedAlignmentEditor.volume_L;
  const sealedAlignmentEbp = sealedAlignmentEditor.ebp;
  const sealedAlignmentSuitability = sealedAlignmentEditor.ebpSuitability;
  const sealedAlignmentSuitabilityLabel = sealedAlignmentEditor.ebpSuitabilityLabel;

  function selectBoxType(value: string): void {
    const opt = BOX_TYPE_OPTIONS.find(o => o.value === value);
    if (opt) selectedBox.value = opt.value;
  }

  return {
    project, selectedBox, pending, boxLabel, showEnclosureTab, enclosureNavLabel,
    boxResonance, rearQtc, boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3,
    selectBoxType, BOX_TYPE_OPTIONS,
    sealedAlignmentEditor, sealedAlignmentOpen, sealedAlignmentOptions, sealedAlignmentSelected,
    sealedAlignmentVolume_L, sealedAlignmentEbp, sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
    boxQl, setBoxQl, boxQa, setBoxQa, boxQp, setBoxQp, boxLossesOpen,
  };
}
