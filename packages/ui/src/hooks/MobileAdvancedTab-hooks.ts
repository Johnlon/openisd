/**
 * `MobileAdvancedTab.vue`'s hook — environment temp/humidity/pressure overrides, the resolved
 * sound-velocity/air-density readouts, the reset button, sealed loss mode, and the WinISD-
 * compatibility switches. Calls the SAME field-wiring factory `OriginalShell-hooks.ts` exports —
 * one implementation of "what does the Advanced tab do", asked by both shells. The checkbox
 * column (`AdvancedOptions.vue`) is reused unchanged — it's already presentation-only with its
 * own hook, so it needs no mobile-specific copy.
 */
import {compatSwitchSetter} from './compatSwitch.js';
import {useFeatureUse} from './telemetryContext.js';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createEnvironmentAir} from './OriginalShell-hooks.js';
import {createErrorSwitches} from './errorSwitches.js';

export function useMobileAdvancedTab() {
  const {projectChanged} = useApp().appState;
  const project = useFocusedProject();

  /** The air fields and readouts, as `createEnvironmentAir` names them (the desktop shell's own). */
  const air = createEnvironmentAir({ project, projectChanged });

  const errorSwitches = createErrorSwitches({project, projectChanged});
  /** "Simplified ABC intra-port velocity" acts on the open box. */
  const abcVelocityApplies = computed(() => {
    void projectChanged.value;
    return project.value.winisdAbcIntraPortVelocityApplies;
  });
  /** "Impedance of one driver" acts with 2 or more drivers. */
  const oneDriverImpedanceApplies = computed(() => {
    void projectChanged.value;
    return project.value.winisdOneDriverImpedanceApplies;
  });

  return {
    project,
    setCompatSwitch: compatSwitchSetter(useFeatureUse()),
    ...air,
    abcVelocityApplies, oneDriverImpedanceApplies, errorSwitches,
  };
}
