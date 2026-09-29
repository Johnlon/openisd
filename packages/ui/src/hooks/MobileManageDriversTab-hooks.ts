/**
 * `MobileManageDriversTab.vue`'s hook — hosts DriverLibrary.vue (shared, presentation-only) as a
 * full pane instead of the desktop `DriverBrowser` overlay it's normally reached through. Bug
 * (John, live on his phone, 2026-09-29): "manage drivers appears as an overlay pop-up... should
 * be a regular pane." The Driver tab's own "Select driver" still opens the global overlay
 * unchanged — this is only the hamburger menu's "Manage Drivers" entry.
 *
 * `driverBrowsing.embedLibrary(cb)` is the same seam `useOgNewProject()` uses to make DriverLibrary's
 * "Use" hand the driver to a caller instead of the desktop overlay's own default (embed into the
 * focused project, then close via `presentationState.browseOpen = false` — a flag this pane
 * never sets true, so nothing here depends on it). This callback does the same embed the default
 * path would, then tells the host (via `onChosen`) a driver was picked, so it can navigate away —
 * a plain callback, not the destination ref itself: a template-level `ref` can't cross a prop
 * boundary by reference (Vue auto-unwraps it first), so the host passes a setter instead.
 */
import {onBeforeUnmount} from 'vue';
import {useApp} from '../logic/app.js';

export function useMobileManageDriversTab(onChosen: () => void) {
  const { driverBrowsing, selection } = useApp();

  driverBrowsing.embedLibrary(driver => {
    void selection.selectDriver(driver);
    onChosen();
  });
  onBeforeUnmount(() => driverBrowsing.closeLibrary());
}
