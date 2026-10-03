import {computed} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';

/** The project's error switches (which controls carry the warning look, whether each applies,
 *  whether it is reproducing the error), re-read when the project changes. Both shells' Advanced
 *  panes read the same one. */
export function createErrorSwitches(d: {
  project: Readonly<Ref<OpenISDProject>>;
  projectChanged: Readonly<Ref<number>>;
}): ComputedRef<OpenISDProject['errorSwitches']> {
  return computed(() => {
    void d.projectChanged.value;
    return d.project.value.errorSwitches;
  });
}

/** The Loss model drop-down's tooltip: the sealed-box models, then the passive-radiator note. Both
 *  shells show it. */
export const LOSS_MODE_TIP = `Sealed box loss model: sets the box resonance (Fsc) and system Q (Qtc).\nWinISD lossy model (default): WinISD's own lossy model; Fsc rises as Ql falls, matching WinISD's readout.\nLossless model: no box losses; Fsc = Fs·√(1 + Vas/Vb).\nConventional lossy model: Ql and Qa lower Qtc only; Fsc stays put (Small/Thiele).`;
