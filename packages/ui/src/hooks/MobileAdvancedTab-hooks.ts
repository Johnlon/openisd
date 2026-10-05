/**
 * `MobileAdvancedTab.vue`'s hook — environment temp/humidity/pressure overrides, the resolved
 * sound-velocity/air-density readouts, the reset button, sealed loss mode, and the WinISD-
 * compatibility switches. Calls the SAME field-wiring factory `OriginalShell-hooks.ts` exports —
 * one implementation of "what does the Advanced tab do", asked by both shells. The checkbox
 * column (`AdvancedOptions.vue`) is reused unchanged — it's already presentation-only with its
 * own hook, so it needs no mobile-specific copy.
 */
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

  function applyWinisdSettings(): void { project.value.applyWinisdSettings(); }

  const errorSwitches = createErrorSwitches({project, projectChanged});

  return {
    project,
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure,
    resetAirToAppDefaults, advAir,
    applyWinisdSettings, errorSwitches,
  };
}
