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
import {CompatSwitch} from '@openisd/design';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createEnvironmentAir} from './OriginalShell-hooks.js';
import {createErrorSwitches} from './errorSwitches.js';

export function useMobileAdvancedTab() {
  const {projectChanged} = useApp().appState;
  const project = useFocusedProject();

  const {
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    envSoundVelocityStored, envAirDensityStored, envSoundVelocityDq, envAirDensityDq,
    advTemp, advHumidity, advPressure, advSoundVelocity, advAirDensity,
    resetAirToAppDefaults, advAir,
  } = createEnvironmentAir({ project, projectChanged });


  const errorSwitches = createErrorSwitches({project, projectChanged});
  /** Whether an option switch acts on the open box (the ABC velocity one acts on an ABC box only). */
  const optionApplies = (option: CompatSwitch): boolean => {
    void projectChanged.value;
    return option.appliesTo(project.value);
  };

  return {
    project,
    setCompatSwitch: compatSwitchSetter(useFeatureUse()),
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    envSoundVelocityStored, envAirDensityStored, envSoundVelocityDq, envAirDensityDq,
    advTemp, advHumidity, advPressure, advSoundVelocity, advAirDensity,
    resetAirToAppDefaults, advAir,
    compatOptions: CompatSwitch.OPTIONS, optionApplies, errorSwitches,
  };
}
