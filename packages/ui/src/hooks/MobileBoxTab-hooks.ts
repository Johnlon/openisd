/**
 * `MobileBoxTab.vue`'s hook — box type, volume, and the calculated resonance/Qtc readout. Calls
 * the SAME field-wiring factories `OriginalShell-hooks.ts` exports — one implementation of
 * "what does the Box tab's Volume field do", asked by both shells.
 */
import {boxTypeIsSimulatable, focusedProject, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {createBoxVolume, createSealedReadouts, createSelectedBox} from './OriginalShell-hooks.js';
import {BOX_TYPE_OPTIONS} from '@openisd/design/fields';

export function useMobileBoxTab() {
  const project = useFocusedProject();
  const isSimulatable = boxTypeIsSimulatable;

  const { selectedBox, pending, boxLabel, showEnclosureTab } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable });
  const { boxResonance, rearQtc } = createSealedReadouts({ project, selectedBox, projectChanged });
  const { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 } = createBoxVolume({ project, selectedBox, projectChanged });

  function selectBoxType(value: string): void {
    const opt = BOX_TYPE_OPTIONS.find(o => o.value === value);
    if (opt) selectedBox.value = opt.value;
  }

  return {
    project, selectedBox, pending, boxLabel, showEnclosureTab,
    boxResonance, rearQtc, boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3,
    selectBoxType, BOX_TYPE_OPTIONS,
  };
}
