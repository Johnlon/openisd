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

  /** The tuning row that heads a vent section (vented: Fb; 4th order bandpass: Ffc); the other types keep theirs in the chamber. */
  const tuningLabel = computed(() => tuningField.value === NumberField.BOX_FFC_HZ ? PhoneLabels.FFC : PhoneLabels.FB);
  const tuningHeadsVents = computed(() => selectedBox.value === 'vented' || selectedBox.value === 'bandpass4');
  /** One section per vent the box draws, each with its own help sheet. */
  const ventSections = computed(() => ventPorts.value.map(port => ({...port, help: PhoneHelp.ventSection(port.name)})));

  return {
    tuningLabel, tuningHeadsVents, ventSections,
    project, selectedBox,
    activeVent, activeTuning, ventPorts, portPipeResonance_hz, fbUnreachable, fbUnreachableMsg, tuningField,
    prResonanceMassDq, prFsMass_hz, prNaturalFh,
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
    VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS,
    FB_TARGET_TIP, VENT_GEOMETRY_TIP,
  };
}
