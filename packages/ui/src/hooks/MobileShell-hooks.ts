/**
 * `MobileShell.vue`'s hook — currently just the manual, persisted skin switch (the "Switch to
 * Desktop view" affordance). Phase 1 replaces the placeholder template around this with the
 * real bottom tab bar / Design / Graph navigation; this hook grows with it.
 */
import {setSkinOverride} from '../logic/presentationState.js';

export interface MobileShellApi {
  switchToDesktop: () => void;
}

export function useMobileShell(): MobileShellApi {
  // The Info menu's manual skin switch — the auto-by-viewport half lives in `App.vue`'s
  // `activeSkin` (`presentationState.narrowViewport`), which this override beats. Symmetric with
  // `OriginalShell-hooks.ts`'s `switchToMobile`.
  function switchToDesktop(): void { setSkinOverride('original'); }

  return { switchToDesktop };
}
