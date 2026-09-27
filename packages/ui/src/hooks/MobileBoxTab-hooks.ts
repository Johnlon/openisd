/**
 * `MobileBoxTab.vue`'s hook — box type, volume, and the calculated resonance/Qtc readout. Calls
 * the SAME field-wiring factories `OriginalShell-hooks.ts` exports — one implementation of
 * "what does the Box tab's Volume field do", asked by both shells.
 */
import {boxTypeIsSimulatable, focusedProject, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createBoxVolume, createSealedReadouts, createSelectedBox} from './OriginalShell-hooks.js';
import {BOX_TYPE_OPTIONS} from '@openisd/design/fields';
import {precision as fieldDp} from '../logic/fields/uiFields.js';

export function useMobileBoxTab() {
  const project = useFocusedProject();
  const { engine } = useApp();
  const isSimulatable = boxTypeIsSimulatable;

  const { selectedBox, pending, boxLabel, showEnclosureTab } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable });
  const { boxResonance, rearQtc } = createSealedReadouts({ project, selectedBox, projectChanged, engine });
  const { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 } = createBoxVolume({ project, selectedBox, projectChanged, engine });

  function selectBoxType(value: string): void {
    const opt = BOX_TYPE_OPTIONS.find(o => o.value === value);
    if (opt) selectedBox.value = opt.value;
  }

  return {
    project, selectedBox, pending, boxLabel, showEnclosureTab,
    boxResonance, rearQtc, boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3,
    selectBoxType, fieldDp, BOX_TYPE_OPTIONS,
  };
}
