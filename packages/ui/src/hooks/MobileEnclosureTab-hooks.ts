/**
 * `MobileEnclosureTab.vue`'s hook — the vent (port) fields for vented/bandpass4, the passive-
 * radiator fields for box-passive-radiator, and the bandpass6/abc placeholder. Calls the SAME
 * field-wiring factories `OriginalShell-hooks.ts` exports — one implementation of "what does the
 * Enclosure tab do", asked by both shells.
 */
import {boxTypeIsSimulatable, envDefaults, focusedProject, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {VentMember} from '../logic/ventGroup.js';
import {createEnvironmentAir} from './OriginalShell-hooks.js';
import {createSealedReadouts, createSelectedBox} from './boxFields.js';
import {createVentReadouts, FB_TARGET_TIP, VENT_GEOMETRY_TIP} from './ventReadouts.js';
import {createPassiveRadiatorActions} from './passiveRadiatorActions.js';
import {END_CORRECTION_OPTIONS, NumberField, VENT_SHAPE_OPTIONS} from '@openisd/design/fields';

const VENT_COUNT_OPTIONS = NumberField.VENT_COUNT.countOptions();
const PR_COUNT_OPTIONS = NumberField.PR_NUM.countOptions();

export function useMobileEnclosureTab() {
  const project = useFocusedProject();
  const { engine, myPassiveRadiators, bundledPassiveRadiators } = useApp();

  const { selectedBox } = createSelectedBox({ focusedProject, projectChanged, isSimulatable: boxTypeIsSimulatable });
  const { advAir } = createEnvironmentAir({ project, projectChanged, envDefaults, environment: engine.environment });
  const {
    activeVent, activeTuning, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel, setFbTarget,
  } = createVentReadouts({ project, projectChanged, selectedBox, air: advAir, vent: engine.vent });
  const { prResonanceMassDq, prFsMass_hz, prNaturalFh } =
    createSealedReadouts({ project, selectedBox, projectChanged });
  const { prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave } =
    createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators });

  // Same field-id dispatch the desktop template uses inline — kept here so both shells share one
  // "what does typing/clearing a vent field do" answer.
  function setVentLength(v: number | null): void {
    if (v == null || Number.isNaN(v) || v <= 0) VentMember.LENGTH.clear(project.value);
    else VentMember.LENGTH.enter(project.value, v);
  }

  return {
    project, selectedBox,
    activeVent, activeTuning, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel,
    prResonanceMassDq, prFsMass_hz, prNaturalFh,
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
    setVentLength, setFbTarget,
    VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS,
    FB_TARGET_TIP, VENT_GEOMETRY_TIP,
  };
}
