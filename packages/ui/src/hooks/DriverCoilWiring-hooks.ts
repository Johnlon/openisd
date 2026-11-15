/**
 * `DriverCoilWiring.vue`'s hook — the Driver tab's "Measured wiring" line and "My wiring" choice
 * for a multi-coil driver (QO907, issue 512). Reads and writes the focused project's
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

  /** Only a driver with more than one coil has a wiring to show. */
  const shown = computed(() => coil.value.measuredText !== null);
  const measuredText = computed(() => coil.value.measuredText ?? '');
  /** Where an inferred wiring came from; empty when it was stated or is not known. */
  const measuredTitle = computed(() => coil.value.inferredReason ?? '');
  const options = computed(() => coil.value.options);
  /** The wiring in force, '' where the choice is not available. */
  const mine = computed<string>(() => coil.value.mine ?? '');
  const disabled = computed(() => !coil.value.canChoose);
  const reason = computed(() => coil.value.unavailableReason ?? '');
  const publishedFigures = computed(() => coil.value.publishedFigures);
  const mineFigures = computed(() => coil.value.mineFigures);

  function choose(wiring: Wiring): void { coil.value.choose(wiring); }
  function onSelect(e: Event): void {
    const wiring = selectedOption(e, coil.value.options);
    if (wiring !== null) choose(wiring);
  }

  return {shown, measuredText, measuredTitle, options, mine, disabled, reason, publishedFigures, mineFigures, choose, onSelect};
}
