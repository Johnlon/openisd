// A number box inside a phone Graph sheet (Tune, What-if) shows the keyboard's Done key, and that
// key closes the keyboard: the box loses focus, which keeps the typed value. While typing there the
// sheet hides its Auto Y / Close bar, so Done is the way out (QO427 (b), John 8 Nov 2026).

import type {InjectionKey} from 'vue';

/** Provided as true by a container whose number boxes close the keyboard on Enter. */
export const ENTER_CLOSES_KEYBOARD: InjectionKey<boolean> = Symbol('enterClosesKeyboard');
