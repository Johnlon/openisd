/**
 * `MobileEnclosureTab.vue`'s hook — the vent (port) fields for vented/bandpass4, the passive-
 * radiator fields for box-passive-radiator, and the bandpass6/abc placeholder. Calls the SAME
 * field-wiring factories `OriginalShell-hooks.ts` exports — one implementation of "what does the
 * Enclosure tab do", asked by both shells.
 */
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createSealedReadouts, createSelectedBox} from './boxFields.js';
import {createVentReadouts, FB_TARGET_TIP, VENT_GEOMETRY_TIP} from './ventReadouts.js';
import {createPassiveRadiatorActions} from './passiveRadiatorActions.js';
import {computed} from 'vue';
import type {TuningField, VentPort} from '@openisd/design';
import {END_CORRECTION_OPTIONS, NumberField, PhoneHelp, PhoneLabels, VENT_SHAPE_OPTIONS} from '@openisd/design/fields';

const VENT_COUNT_OPTIONS = NumberField.VENT_COUNT.countOptions();
const PR_COUNT_OPTIONS = NumberField.PR_NUM.countOptions();

export function useMobileEnclosureTab() {
  const {boxTypeIsSimulatable, definePassiveRadiator, focusedProject, projectChanged} = useApp().appState;
  const project = useFocusedProject();
  const { engine, myPassiveRadiators, bundledPassiveRadiators } = useApp();

  const { selectedBox } = createSelectedBox({ focusedProject, projectChanged, isSimulatable: boxTypeIsSimulatable });
  const {
    activeVent, activeTuning, ventPorts, portPipeResonance_hz, fbUnreachable, fbUnreachableMsg, tuningField,
  } = createVentReadouts({ project, projectChanged, selectedBox, vent: engine.vent });
  const { prResonanceMassDq, prFsMass_hz, prNaturalFh } =
    createSealedReadouts({ project, selectedBox, projectChanged });
  const { prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave } =
    createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators, definePassiveRadiator });

  /** The tuning row that heads a vent section (Fb in Vents, Frc in Rear vent, Ffc in Front vent); the Intra vent has none. */
  function tuningRowOf(port: VentPort): {field: NumberField; label: string; cell: TuningField} | null {
    if (port.tuning_goal_hz === null) return null;
    switch (port.name) {
      case 'Vent': return {field: NumberField.BOX_FB_HZ, label: PhoneLabels.FB, cell: port.tuning_goal_hz};
      case 'Rear': return {field: NumberField.BOX_FRC_HZ, label: PhoneLabels.FRC, cell: port.tuning_goal_hz};
      case 'Front': return {field: NumberField.BOX_FFC_HZ, label: PhoneLabels.FFC, cell: port.tuning_goal_hz};
      case 'Intra': return null;
    }
  }
  /** The box types whose unreachable-tuning sentence also shows as a note under the vent; ABC and the 6th order bandpass show it once, in the warning mark's popup. */
  const tuningNoteShown = computed(() => selectedBox.value === 'vented' || selectedBox.value === 'bandpass4');
  /** One section per vent the box draws, each with its own help sheet and the tuning row that heads it. */
  const ventSections = computed(() => ventPorts.value.map(port => ({...port, help: PhoneHelp.ventSection(port.name), tuning: tuningRowOf(port)})));

  return {
    ventSections, tuningNoteShown,
    project, selectedBox,
    activeVent, activeTuning, ventPorts, portPipeResonance_hz, fbUnreachable, fbUnreachableMsg, tuningField,
    prResonanceMassDq, prFsMass_hz, prNaturalFh,
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
    VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS,
    FB_TARGET_TIP, VENT_GEOMETRY_TIP,
  };
}
