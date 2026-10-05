/**
 * `MobileAdvancedTab.vue`'s hook — environment temp/humidity/pressure overrides, the resolved
 * sound-velocity/air-density readouts, the reset button, sealed loss mode, and the WinISD-
 * compatibility switches. Calls the SAME field-wiring factory `OriginalShell-hooks.ts` exports —
 * one implementation of "what does the Advanced tab do", asked by both shells. The checkbox
 * column (`AdvancedOptions.vue`) is reused unchanged — it's already presentation-only with its
 * own hook, so it needs no mobile-specific copy.
 */
import {computed} from 'vue';
import {envDefaults, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createEnvironmentAir} from './OriginalShell-hooks.js';
import {createErrorSwitches} from './errorSwitches.js';

export function useMobileAdvancedTab() {
  const project = useFocusedProject();
  const { engine } = useApp();

  const {
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure,
    resetAirToAppDefaults, advAir,
  } = createEnvironmentAir({ project, projectChanged, envDefaults, environment: engine.environment });


  const errorSwitches = createErrorSwitches({project, projectChanged});
  /** "Simplified ABC intra-port velocity" acts on the open box. */
  const abcVelocityApplies = computed(() => {
    void projectChanged.value;
    return project.value.winisdAbcIntraPortVelocityApplies;
  });

  return {
    project,
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure,
    resetAirToAppDefaults, advAir,
    abcVelocityApplies, errorSwitches,
  };
}
