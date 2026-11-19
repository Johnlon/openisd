/**
 * `DriverWiring.vue`'s hook: the project's "Driver wiring", how its several drivers are wired to the amplifier (ticket 519, plan
 * section 3.1). Drawn only with 2 or more drivers; the choice is the project's own and is kept when the count drops to 1.
 * The words, the options and the physics come from `@openisd/design`.
 */
import {computed} from 'vue';
import type {DriverWiring} from '@openisd/design/engine';
import {DRIVER_WIRING_OPTIONS} from '@openisd/design/fields';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {selectedOption} from '../logic/domEvents.js';
import {useFeatureUse} from './telemetryContext.js';

export function useDriverWiring() {
  const {appState} = useApp();
  const project = useFocusedProject();
  const featureUse = useFeatureUse();

  const shown = computed(() => { void appState.projectChanged.value; return project.value.driverWiringApplies; });
  const mine = computed<DriverWiring>(() => { void appState.projectChanged.value; return project.value.driverWiring.value; });
  const options = DRIVER_WIRING_OPTIONS;

  function choose(wiring: DriverWiring): void { project.value.driverWiring.set(wiring); featureUse.feature('multi_driver_wiring_changed'); }
  function onSelect(e: Event): void {
    const wiring = selectedOption(e, options);
    if (wiring !== null) choose(wiring);
  }

  return {shown, mine, options, choose, onSelect};
}
