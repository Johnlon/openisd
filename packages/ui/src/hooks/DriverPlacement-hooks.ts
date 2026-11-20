/**
 * `DriverPlacement.vue`'s hook: the project's driver placement, WinISD's Driver tab "Standard" / "Iso-Barik" choice (T919, QO953.c38),
 * and the three arrangement pictures beside it (John, 20 Nov 2026: the Iso-Barik pictures go on the Driver tab, "keep the box tab as
 * the classic simple box view"). It reads and writes the project's `loading`; the engine does the Iso-Barik maths (half the Vas, the
 * pair's impedance). Which Iso-Barik arrangement is pictured (clamshell or back to front) is this tab's own state only: the project
 * does not record it, and both give the same loading. The options and the words come from `@openisd/design`.
 */
import {computed, shallowRef} from 'vue';
import {DRIVER_PLACEMENT_OPTIONS, PlacementChoice} from '@openisd/design/fields';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {selectedOption} from '../logic/domEvents.js';

export function useDriverPlacement() {
  const {appState} = useApp();
  const project = useFocusedProject();

  const mine = computed(() => { void appState.projectChanged.value; return project.value.loading.value; });
  const nDrivers = computed(() => { void appState.projectChanged.value; return project.value.nDrivers.value; });
  const options = DRIVER_PLACEMENT_OPTIONS;
  const choices = PlacementChoice.ALL;

  /** The Iso-Barik arrangement last picked here; the clamshell, WinISD's own Iso-Barik picture, until one is clicked. */
  const isobarikArrangement = shallowRef<PlacementChoice>(PlacementChoice.CLAMSHELL);
  const picked = computed(() => mine.value === 'standard' ? PlacementChoice.STANDARD : isobarikArrangement.value);
  const driverCountNote = computed(() => picked.value.driverCountNote(nDrivers.value));

  function choose(loading: 'standard' | 'isobaric'): void { project.value.loading.set(loading); }
  function pick(choice: PlacementChoice): void {
    if (choice.loading === 'isobaric') isobarikArrangement.value = choice;
    choose(choice.loading);
  }
  function onSelect(e: Event): void {
    const loading = selectedOption(e, options);
    if (loading !== null) choose(loading);
  }

  return {mine, options, choices, picked, driverCountNote, choose, pick, onSelect};
}
