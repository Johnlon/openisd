/**
 * `MobileBoxTab.vue`'s hook — box type, volume, and the calculated resonance/Qtc readout. Calls
 * the SAME field-wiring factories `boxFields.ts` exports — one implementation of
 * "what does the Box tab's Volume field do", asked by both shells.
 */
import {IMPLEMENTED_BOX_TYPES, boxTypeIsSimulatable, envDefaults, focusedProject, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createEnvironmentAir} from './OriginalShell-hooks.js';
import {createVentReadouts, FB_TARGET_TIP} from './ventReadouts.js';
import {createBoxLosses, createBoxVolume, createChamberFields, createSealedReadouts, createSelectedBox} from './boxFields.js';
import {SealedAlignmentEditor} from './SealedAlignment-hooks.js';
import {VentedAlignmentEditor} from './VentedAlignment-hooks.js';
import {BOX_TYPE_OPTIONS} from '@openisd/design/fields';

export function useMobileBoxTab() {
  const project = useFocusedProject();
  const { engine } = useApp();
  const isSimulatable = boxTypeIsSimulatable;

  const { selectedBox, pending, isDual, boxLabel, showEnclosureTab, enclosureNavLabel } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable });
  const { boxResonance, rearQtc } = createSealedReadouts({ project, selectedBox, projectChanged });
  const { advAir } = createEnvironmentAir({ project, projectChanged, envDefaults, environment: engine.environment });
  const { activeTuning } = createVentReadouts({ project, projectChanged, selectedBox, air: advAir, vent: engine.vent });
  const { boxVolumeCell } = createBoxVolume({ project, selectedBox, projectChanged });
  const { frontVolumeCell, rearTuningCell } = createChamberFields({ project, selectedBox, projectChanged });
  // Box losses popup: one row set per chamber, the same hook the desktop shell uses.
  const { lossesOpen, openLossGroups, resetBoxLosses } = createBoxLosses({ project, selectedBox, projectChanged, focusedProject });

  // Same skin-neutral class the desktop shell uses (SealedAlignment-hooks.ts) — one editor, not
  // a mobile copy. It takes only the two engine areas it needs (sealed, driver), never the
  // aggregate.
  const sealedAlignmentEditor = new SealedAlignmentEditor(project, projectChanged, engine.sealed, engine.driver);
  const sealedAlignmentOpen = sealedAlignmentEditor.open;
  const sealedAlignmentOptions = sealedAlignmentEditor.options;
  const sealedAlignmentSelected = sealedAlignmentEditor.selectedOption;
  const sealedAlignmentVolume_m3 = sealedAlignmentEditor.volume_m3;
  const sealedAlignmentEbp = sealedAlignmentEditor.ebp;
  const sealedAlignmentSuitability = sealedAlignmentEditor.ebpSuitability;
  const sealedAlignmentSuitabilityLabel = sealedAlignmentEditor.ebpSuitabilityLabel;

  // Same class the desktop shell will drive too (engine, 2026-09-29: "go, and add the desktop
  // button too since it is the same class") — one implementation, both shells' pickers.
  const ventedAlignmentEditor = new VentedAlignmentEditor(project, projectChanged, engine.driver);
  const ventedAlignmentOpen = ventedAlignmentEditor.open;
  const ventedAlignmentOptions = ventedAlignmentEditor.options;
  const ventedAlignmentSelected = ventedAlignmentEditor.selectedAlignment;
  const ventedAlignmentVolume_L = ventedAlignmentEditor.volume_L;
  const ventedAlignmentTuning_hz = ventedAlignmentEditor.tuning_hz;
  const ventedAlignmentEbp = ventedAlignmentEditor.ebp;
  const ventedAlignmentSuitability = ventedAlignmentEditor.ebpSuitability;
  const ventedAlignmentSuitabilityLabel = ventedAlignmentEditor.ebpSuitabilityLabel;

  function selectBoxType(value: string): void {
    const opt = BOX_TYPE_OPTIONS.find(o => o.value === value);
    if (opt) selectedBox.value = opt.value;
  }

  return {
    project, selectedBox, pending, isDual, boxLabel, frontVolumeCell, rearTuningCell, showEnclosureTab, enclosureNavLabel,
    boxResonance, rearQtc, boxVolumeCell,
    activeTuning, FB_TARGET_TIP,
    selectBoxType, BOX_TYPE_OPTIONS, IMPLEMENTED_BOX_TYPES,
    sealedAlignmentEditor, sealedAlignmentOpen, sealedAlignmentOptions, sealedAlignmentSelected,
    sealedAlignmentVolume_m3, sealedAlignmentEbp, sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
    ventedAlignmentEditor, ventedAlignmentOpen, ventedAlignmentOptions, ventedAlignmentSelected,
    ventedAlignmentVolume_L, ventedAlignmentTuning_hz, ventedAlignmentEbp, ventedAlignmentSuitability,
    ventedAlignmentSuitabilityLabel,
    lossesOpen, openLossGroups, resetBoxLosses,
  };
}
