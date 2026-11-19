/**
 * `DriverPlacement.vue`'s hook: the project's driver placement, WinISD's Driver tab "Standard" / "Iso-Barik" choice (T919, QO953.c38).
 * It reads and writes the project's `loading`; the engine does the Iso-Barik maths (half the Vas, the pair's impedance). The options
 * come from `@openisd/design`.
 */
import {computed} from 'vue';
import {DRIVER_PLACEMENT_OPTIONS} from '@openisd/design/fields';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {selectedOption} from '../logic/domEvents.js';

export function useDriverPlacement() {
  const {appState} = useApp();
  const project = useFocusedProject();

  const mine = computed(() => { void appState.projectChanged.value; return project.value.loading.value; });
  const options = DRIVER_PLACEMENT_OPTIONS;

  function choose(loading: 'standard' | 'isobaric'): void { project.value.loading.set(loading); }
  function onSelect(e: Event): void {
    const loading = selectedOption(e, options);
    if (loading !== null) choose(loading);
  }

  const mineLabel = computed(() => options.find((o) => o.value === mine.value)?.label ?? '');

  return {mine, mineLabel, options, choose, onSelect};
}
