/**
 * `DriverWiring.vue`'s hook: the project's "Driver wiring", how its several drivers are wired to the amplifier (ticket 519, plan
 * section 3.1) and the placement and compatibility controls for Iso-Barik.
 * The words, the options and the physics come from `@openisd/design`.
 */
import {computed} from 'vue';
import type {DriverWiring} from '@openisd/design/engine';
import {DRIVER_WIRING_OPTIONS, EnumField} from '@openisd/design/fields';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {inputChecked, selectedOption} from '../logic/domEvents.js';
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

  const loading = computed(() => { void appState.projectChanged.value; return project.value.loading.value; });
  const winisdIsobarik = computed(() => { void appState.projectChanged.value; return project.value.winisdIsobarik.value; });

  function selectLoading(value: string | number): void {
    if (value === 'standard' || value === 'isobaric') project.value.loading.set(value);
  }

  function selectWinisdIsobarik(e: Event): void {
    project.value.winisdIsobarik.set(inputChecked(e));
  }

  return {shown, mine, options, choose, onSelect, loading, winisdIsobarik, selectLoading, selectWinisdIsobarik, loadingField: EnumField.PROJECT_LOADING};
}
