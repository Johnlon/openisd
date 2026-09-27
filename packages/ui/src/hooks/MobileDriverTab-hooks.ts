/**
 * `MobileDriverTab.vue`'s hook — the driver identity readout, num-drivers, and wiring. Reads/writes
 * the focused project's own fields directly (`nDrivers`/`wiring` are plain domain setters — no
 * decision made here); browsing/editing a driver reuses the app's existing global overlays
 * (`DriverBrowser`, `DriverEditorModal`), reached the same way the desktop shell reaches them.
 */
import {computed} from 'vue';
import {driverName, projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {presentationState} from '../logic/presentationState.js';
import {useApp} from '../logic/app.js';
import {ARRAY_WIRING_OPTIONS} from '@openisd/design/fields';
import {countOptions} from '../logic/fields/uiFields.js';
import {selectedOption} from '../logic/domEvents.js';

const N_DRIVERS_OPTIONS = countOptions('driver_nDrivers');

export function useMobileDriverTab() {
  const project = useFocusedProject();
  const { selection } = useApp();

  const brand = computed(() => { void projectChanged.value; return project.value.driver.brand.value; });
  const model = computed(() => { void projectChanged.value; return project.value.driver.model.value || driverName.value; });

  function browseDrivers(): void { presentationState.browseOpen = true; }
  function editDriver(): void { selection.editProjectDriver(); }

  return {
    project, brand, model, browseDrivers, editDriver,
    N_DRIVERS_OPTIONS, ARRAY_WIRING_OPTIONS, selectedOption,
  };
}
