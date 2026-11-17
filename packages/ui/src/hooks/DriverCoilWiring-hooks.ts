/**
 * `DriverCoilWiring.vue`'s hook: the project's one wiring control, "Coil wiring" on both skins (John, QO942.c12).
 * (QO941). It reads and writes the focused project's `VCCon`; the words and the
 * conversion come from `@openisd/design`. Its default is the driver's measured wiring, which is not shown.
 *
 * - A driver with more than one coil whose measured wiring is known: enabled, on both skins.
 * - A driver that cannot be wired (one coil, or measured wiring not stated): the desktop shows it greyed, as WinISD does, and a click
 *   says why (John, QO942.c88-c91): the select is disabled and a catcher over it takes the click; the phone omits it
 *   ("only desktop needs to match WinISD UI").
 */
import {computed, ref, watch} from 'vue';
import type {Wiring} from '@openisd/design/engine';
import {WinisdDeviation} from '@openisd/design/fields';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {selectedOption} from '../logic/domEvents.js';

export function useDriverCoilWiring(phone: boolean) {
  const {appState} = useApp();
  const project = useFocusedProject();
  const coil = computed(() => { void appState.projectChanged.value; return project.value.coilWiring; });

  const enabled = computed(() => coil.value.canChoose);
  const shown = computed(() => enabled.value || !phone);
  const disabled = computed(() => !enabled.value);
  const options = computed(() => coil.value.options);
  /** The wiring in force; a greyed control reads Parallel, as WinISD's does with one coil. */
  const mine = computed<string>(() => coil.value.mine ?? 'parallel');
  /** The ≠W cue by the control: WinISD converts Re and BL only; the yellow switch "Coil wiring: Re and BL only" is off (QO942.c62). */
  const deviationShown = computed(() => { void appState.projectChanged.value; return enabled.value && WinisdDeviation.COIL_WIRING_RE_BL_ONLY.cueShown(project.value.errorSwitches); });

  /** The greyed desktop control was clicked: what it says (one coil, or the measured wiring not stated). */
  const message = ref<string | null>(null);
  function explain(): void { message.value = coil.value.greyedMessage; }

  watch(() => coil.value.greyedMessage, () => { message.value = null; });

  function choose(wiring: Wiring): void { coil.value.choose(wiring); }
  function onSelect(e: Event): void {
    const wiring = selectedOption(e, coil.value.options);
    if (wiring !== null) choose(wiring);
  }

  return {shown, message, explain, disabled, options, mine, deviationShown, choose, onSelect};
}
