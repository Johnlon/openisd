/**
 * `MobileEnclosureTab.vue`'s hook — the vent (port) fields for vented/bandpass4, the passive-
 * radiator fields for box-passive-radiator, and the bandpass6/abc placeholder. Calls the SAME
 * field-wiring factories `OriginalShell-hooks.ts` exports — one implementation of "what does the
 * Enclosure tab do", asked by both shells.
 */
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useFeatureUse} from './telemetryContext.js';
import {useApp} from '../logic/app.js';
import {appPassiveRadiatorFiles} from './passiveRadiatorEditor.js';
import {createSealedReadouts, createSelectedBox} from './boxFields.js';
import {createVentReadouts, FB_TARGET_TIP, VENT_GEOMETRY_TIP} from './ventReadouts.js';
import {createPassiveRadiatorActions} from './passiveRadiatorActions.js';
import {useRadiatorPicks} from './telemetryContext.js';
import {computed} from 'vue';
import {END_CORRECTION_OPTIONS, PhoneBoxText, PhoneHelp, VENT_SHAPE_OPTIONS} from '@openisd/design/fields';


/** The radiator's Key figures on the phone Box tab. */
export interface PassiveRadiatorKeyFigures {
  readonly Fs_hz: number | null;
  readonly Mms_kg: number | null;
  readonly Sd_m2: number | null;
  readonly Xmax_m: number | null;
  /** Displacement, Sd × Xmax, from the engine. */
  readonly Vd_m3: number | null;
}

export function useMobileEnclosureTab() {
  const {boxTypeIsSimulatable, focusedProject, projectChanged} = useApp().appState;
  const project = useFocusedProject();
  const { engine, myPassiveRadiators, bundledPassiveRadiators } = useApp();

  const { selectedBox } = createSelectedBox({ focusedProject, projectChanged, isSimulatable: boxTypeIsSimulatable, featureUse: useFeatureUse() });
  const {
    activeVent, activeTuning, ventPorts, portPipeResonance_hz, fbUnreachable, fbUnreachableMsg, tuningField,
  } = createVentReadouts({ project, projectChanged, selectedBox, vent: engine.vent });
  const { prResonanceMassDq, prFsMass_hz, prNaturalFh } =
    createSealedReadouts({ project, selectedBox, projectChanged });
  const { prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, prEditor, startEditPR, defineNewPREntry, prInfoOpen, prInfo, openPRInfo } =
    createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators, radiatorPicks: useRadiatorPicks(), engine,
      files: appPassiveRadiatorFiles(useApp()) });

  /** The radiator's Key figures (John, 16 Nov 2026 12:57, 12:58): its own Fs, Mms, Sd, Xmax and its displacement Vd, which
   *  the engine works out. Read only; tapping one opens the editor. */
  const prKeyFigures = computed<PassiveRadiatorKeyFigures>(() => {
    void projectChanged.value;
    const spec = project.value.box.passiveRadiator.radiator.spec;
    return {
      Fs_hz: spec.Fs_hz.value, Mms_kg: spec.Mms_kg.value, Sd_m2: spec.Sd_m2.value, Xmax_m: spec.Xmax_m.value,
      Vd_m3: engine.pr.displacement(spec.Sd_m2.value, spec.Xmax_m.value),
    };
  });

  /** The "2×" rule line under the radiator's Key figures (John, 16 Nov 2026 13:00): what the radiators need and how many of
   *  this radiator give it, from the engine; null when a displacement is missing. */
  const prTwoTimesRule = computed<string | null>(() => {
    void projectChanged.value;
    const p = project.value;
    const driverVd = p.driver.specs.Vd_m3.value;
    const n = p.nDrivers.value;
    const required = engine.pr.twiceDriverDisplacement(driverVd, n);
    const count = engine.pr.countForTwiceDisplacement(prKeyFigures.value.Vd_m3, driverVd, n);
    return required === null || count === null ? null : PhoneBoxText.twoTimesRule(required, count);
  });

  /** The box types whose unreachable-tuning sentence also shows as a note under the vent; ABC and the 6th order bandpass show it once, in the warning mark's popup. */
  const tuningNoteShown = computed(() => selectedBox.value === 'vented' || selectedBox.value === 'bandpass4');
  /** One section per vent the box draws, each with its own help sheet and the tuning row that heads it. */
  const ventSections = computed(() => ventPorts.value.map(port => ({...port, help: PhoneHelp.ventSection(port.name)})));

  return {
    ventSections, tuningNoteShown,
    project, selectedBox,
    activeVent, activeTuning, ventPorts, portPipeResonance_hz, fbUnreachable, fbUnreachableMsg, tuningField,
    prResonanceMassDq, prFsMass_hz, prNaturalFh,
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, prEditor, startEditPR, defineNewPREntry, prInfoOpen, prInfo, openPRInfo, prKeyFigures, prTwoTimesRule,
    VENT_SHAPE_OPTIONS, END_CORRECTION_OPTIONS,
    FB_TARGET_TIP, VENT_GEOMETRY_TIP,
  };
}
