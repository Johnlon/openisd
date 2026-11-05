/**
 * Live viewport-width observation — the automatic half of the skin switch. The persisted,
 * manual half is `presentationState.ui.skinOverride`; `App.vue` combines the two into
 * `activeSkin`. A factory, not a module-level singleton: `ref()` is called inside the function
 * body, which keeps this module outside the "only 3 stores hold state" gate
 * (`architecture.test.ts`) while still handing every caller a live, reactive signal.
 */
import {ref, type Ref} from 'vue';

export interface ViewportWatch {
  /** Whether the viewport currently matches the query — reactive, updates on resize. */
  narrow: Ref<boolean>;
  /** Detaches the `matchMedia` listener. Call on unmount; nothing here holds module state, so a
   *  caller that never stops leaks one listener per call, not a growing singleton. */
  stop: () => void;
}

/** When the phone layout applies: a narrow window, or a touch screen with a short window (a phone
 *  turned sideways, QO418). A mouse-driven short window and tablets (iPad 1024x768) stay desktop. */
export const PHONE_LAYOUT_QUERY = '(max-width: 600px), (pointer: coarse) and (max-height: 500px)';

/** `query` defaults to PHONE_LAYOUT_QUERY (narrow part: 600px — see the plan: comfortably below
 *  `original-shell-layout.browser.spec.ts`'s 780px floor and Playwright's default 1280×720 viewport,
 *  so no existing desktop spec crosses it). */
export function createViewportWatch(query = PHONE_LAYOUT_QUERY): ViewportWatch {
  const mql = window.matchMedia(query);
  const narrow = ref(mql.matches);
  const onChange = (e: MediaQueryListEvent) => { narrow.value = e.matches; };
  mql.addEventListener('change', onChange);
  return { narrow, stop: () => mql.removeEventListener('change', onChange) };
}
