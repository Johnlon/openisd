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
import {LossMode} from '@openisd/design/fields';

export function useMobileAdvancedTab() {
  const project = useFocusedProject();
  const { engine } = useApp();

  const {
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure, commitAirTemp, commitAirHumidity, commitAirPressure,
    resetAirToAppDefaults, advAir,
  } = createEnvironmentAir({ project, projectChanged, envDefaults, environment: engine.environment });

  const LOSS_MODE_OPTIONS = LossMode.OPTIONS;
  const lossMode = computed<string>({
    get: () => { void projectChanged.value; return project.value.lossMode.value.value; },
    set: (v: string) => { project.value.lossMode.set(LossMode.parse(v)); },
  });

  function applyWinisdSettings(): void { project.value.applyWinisdSettings(); }

  return {
    project,
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure, commitAirTemp, commitAirHumidity, commitAirPressure,
    resetAirToAppDefaults, advAir,
    LOSS_MODE_OPTIONS, lossMode, applyWinisdSettings,
  };
}
