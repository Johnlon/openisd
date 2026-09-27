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

/** `query` defaults to the mobile-skin breakpoint (600px — see the plan: comfortably below
 *  `original-narrow.browser.spec.ts`'s 780px floor and Playwright's default 1280×720 viewport,
 *  so no existing desktop spec crosses it). */
export function createViewportWatch(query = '(max-width: 600px)'): ViewportWatch {
  const mql = window.matchMedia(query);
  const narrow = ref(mql.matches);
  const onChange = (e: MediaQueryListEvent) => { narrow.value = e.matches; };
  mql.addEventListener('change', onChange);
  return { narrow, stop: () => mql.removeEventListener('change', onChange) };
}
