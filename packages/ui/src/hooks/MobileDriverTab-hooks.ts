/**
 * `MobileDriverTab.vue`'s hook — the driver identity readout, num-drivers, and wiring. Reads/writes
 * the focused project's own fields directly (`nDrivers`/`wiring` are plain domain setters — no
 * decision made here); browsing/editing a driver reuses the app's existing global overlays
 * (`DriverBrowser`, `DriverEditorModal`), reached the same way the desktop shell reaches them.
 */
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {useFeatureUse} from './telemetryContext.js';
import {ARRAY_WIRING_OPTIONS} from '@openisd/design/fields';
import {selectedOption} from '../logic/domEvents.js';


export function useMobileDriverTab() {
  const {appState, driverBrowsing, presentation: presentationState} = useApp();
  const {driverName, projectChanged} = appState;
  const project = useFocusedProject();
  const { selection } = useApp();
  const featureUse = useFeatureUse();

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
  /** The stated values that disagree with each other, as the Driver Editor lists them. */
  const consistencyReasons = computed(() => {
    void projectChanged.value;
    return project.value.driver.inconsistentInputReasons();
  });

  function browseDrivers(): void { presentationState.browseOpen = true; }
  function editDriver(): void { featureUse.feature('driver_editor'); selection.editProjectDriver(); }
  /** The "N values disagree" link: the same editor, with its disagreement list showing. */
  function showDisagreements(): void { featureUse.feature('driver_editor'); selection.editProjectDriver(true); }

  return {
    project, brand, model, fullName, keyFigures, consistencyReasons, browseDrivers, editDriver, showDisagreements,
    showDriverInfo: driverBrowsing.showProjectDriverInfo,
    ARRAY_WIRING_OPTIONS, selectedOption,
  };
}
