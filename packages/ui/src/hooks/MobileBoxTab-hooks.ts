/**
 * `MobileBoxTab.vue`'s hook — box type, volume, and the calculated resonance/Qtc readout. Calls
 * the SAME field-wiring factories `boxFields.ts` exports — one implementation of
 * "what does the Box tab's Volume field do", asked by both shells.
 */
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

  const { selectedBox, pending, boxLabel, showEnclosureTab } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable });
  const { boxResonance, rearQtc } = createSealedReadouts({ project, selectedBox, projectChanged });
  const { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 } = createBoxVolume({ project, selectedBox, projectChanged });

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
    project, selectedBox, pending, boxLabel, showEnclosureTab,
    boxResonance, rearQtc, boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3,
    selectBoxType, BOX_TYPE_OPTIONS,
    sealedAlignmentEditor, sealedAlignmentOpen, sealedAlignmentOptions, sealedAlignmentSelected,
    sealedAlignmentVolume_L, sealedAlignmentEbp, sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
  };
}
