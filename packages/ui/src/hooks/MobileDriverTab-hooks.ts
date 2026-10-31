/**
 * `MobileDriverTab.vue`'s hook — the driver identity readout, num-drivers, and wiring. Reads/writes
 * the focused project's own fields directly (`nDrivers`/`wiring` are plain domain setters — no
 * decision made here); browsing/editing a driver reuses the app's existing global overlays
 * (`DriverBrowser`, `DriverEditorModal`), reached the same way the desktop shell reaches them.
 */
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {ARRAY_WIRING_OPTIONS, NumberField} from '@openisd/design/fields';
import {selectedOption} from '../logic/domEvents.js';
import {unknownVoiceCoilReading} from '../logic/unknownVoiceCoilReading.js';

const N_DRIVERS_OPTIONS = NumberField.DRIVER_NDRIVERS.countOptions();

export function useMobileDriverTab() {
  const {appState, driverBrowsing, presentation: presentationState} = useApp();
  const {driverName, projectChanged} = appState;
  const project = useFocusedProject();
  const { selection } = useApp();

  const brand = computed(() => { void projectChanged.value; return project.value.driver.brand.value; });
  const model = computed(() => { void projectChanged.value; return project.value.driver.model.value || driverName.value; });

  /** Brand and model on one line, for the name box. */
  const fullName = computed(() => [brand.value, model.value].filter(part => part !== '').join(' '));

  /** The driver's key figures, read off its spec (SI; the field formats them). */
  const keyFigures = computed(() => {
    void projectChanged.value;
    const spec = project.value.driver.specs;
    return {Fs: spec.Fs_hz.value, Qts: spec.Qts.value, Vas: spec.Vas_m3.value, Re: spec.Re_ohm.value, Xmax: spec.Xmax_m.value};
  });
  const keyFigureDq = computed(() => {
    void projectChanged.value;
    const device = project.value.driver.toOpenIsdDeviceJson();
    return {Re: unknownVoiceCoilReading(device, 'Re_ohm')};
  });

  function browseDrivers(): void { presentationState.browseOpen = true; }
  function editDriver(): void { selection.editProjectDriver(); }

  return {
    project, brand, model, fullName, keyFigures, keyFigureDq, browseDrivers, editDriver,
    showDriverInfo: driverBrowsing.showProjectDriverInfo,
    N_DRIVERS_OPTIONS, ARRAY_WIRING_OPTIONS, selectedOption,
  };
}
