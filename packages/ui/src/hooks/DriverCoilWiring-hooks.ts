/**
 * `DriverCoilWiring.vue`'s hook — the Driver tab's "My wiring" choice and the figures under it.
 * for a multi-coil driver (QO907, issue 512). The measured wiring is not shown (John, 2026-11-15, QO941). Reads and writes the focused project's
 * `coilWiring`; the words and the conversion come from `@openisd/design`.
 */
import {computed} from 'vue';
import type {Wiring} from '@openisd/design/engine';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {selectedOption} from '../logic/domEvents.js';

export function useDriverCoilWiring() {
  const {appState} = useApp();
  const project = useFocusedProject();
  const coil = computed(() => { void appState.projectChanged.value; return project.value.coilWiring; });

  /** Shown only where My wiring can be chosen: a driver with several coils whose measured wiring is
   *  known. For one coil, or a wiring that is not stated, nothing is drawn: the unstated wiring is a
   *  data-quality mark in the Driver editor (John, 2026-11-15, QO941). */
  const shown = computed(() => coil.value.canChoose);
  const options = computed(() => coil.value.options);
  /** The wiring in force, '' where the choice is not available. */
  const mine = computed<string>(() => coil.value.mine ?? '');
  const publishedFigures = computed(() => coil.value.publishedFigures);
  const mineFigures = computed(() => coil.value.mineFigures);
  /** The published figures are worth a line only where My wiring changes them. */
  const showPublished = computed(() => publishedFigures.value !== mineFigures.value);

  function choose(wiring: Wiring): void { coil.value.choose(wiring); }
  function onSelect(e: Event): void {
    const wiring = selectedOption(e, coil.value.options);
    if (wiring !== null) choose(wiring);
  }

  return {shown, options, mine, publishedFigures, mineFigures, showPublished, choose, onSelect};
}
