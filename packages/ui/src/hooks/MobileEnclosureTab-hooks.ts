/**
 * `MobileEnclosureTab.vue`'s hook — the vent (port) fields for vented/bandpass4, the passive-
 * radiator fields for box-passive-radiator, and the bandpass6/abc placeholder. Calls the SAME
 * field-wiring factories `OriginalShell-hooks.ts` exports — one implementation of "what does the
 * Enclosure tab do", asked by both shells.
 */
import {boxTypeIsSimulatable, envDefaults, focusedProject, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {clearVentField as clearVentFieldOn, enterVentField as enterVentFieldOn} from '../logic/useVentGroup.js';
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
  const { prAddedMassDq, prTuningDq, prResonanceMassDq, prFsMass_hz } =
    createSealedReadouts({ project, selectedBox, projectChanged });
  const { prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry } =
    createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators });

  // Same field-id dispatch the desktop template uses inline — kept here so both shells share one
  // "what does typing/clearing a vent field do" answer.
  function setVentWidth(v: number | null): void { enterVentFieldOn(project.value, 'ventW', v ?? 0); }
  function setVentHeight(v: number | null): void { enterVentFieldOn(project.value, 'ventH', v ?? 0); }
  function setVentDiameter(v: number | null): void { enterVentFieldOn(project.value, 'ventD', v ?? 0); }
  function setVentLength(v: number | null): void {
    if (v == null || Number.isNaN(v) || v <= 0) clearVentFieldOn(project.value, 'ventL');
    else enterVentFieldOn(project.value, 'ventL', v);
  }

  return {
    project, selectedBox,
    activeVent, activeTuning, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel,
    prAddedMassDq, prTuningDq, prResonanceMassDq, prFsMass_hz,
    prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    setVentWidth, setVentHeight, setVentDiameter, setVentLength, setFbTarget,
    VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS,
    FB_TARGET_TIP, VENT_GEOMETRY_TIP,
  };
}
