import type {FeatureUse} from '../logic/telemetry/featureUse.js';
import {shallowRef} from 'vue';
import type {PhoneHelpSection} from '@openisd/design/fields';
import {useEscToClose} from '../logic/useEscToClose.js';
import type {OpenISDDriver, OpenISDDriverStandalone} from '@openisd/design';
import type {MyDriverRepo} from '@openisd/persistence';

/**
 * Plain-function reads and writes for the driver editor (DriverEditorModal.vue), parameterised on
 * the draft driver rather than closing over component state, plus the editor’s help-popup state.
 * A field's own DQ reason is `UIField`'s (`dqReason`); the chart-blocking and inconsistent-input
 * lists are the driver's own (`OpenISDDriver.chartBlockingReasons()`).
 */

export function ebpVal(driver: OpenISDDriver): number | null {
  return driver.specs.EBP_hz.value;
}

/** Save `driver` to My Drivers: over the row `replacesUuid` names, or as a new row when it is
 *  ''. False = My Drivers refused (read-only). A save that worked is counted. */
export function commitMyDriver(myDrivers: MyDriverRepo, featureUse: FeatureUse, driver: OpenISDDriverStandalone, replacesUuid: string): boolean {
  const saved = myDrivers.upsert(driver, replacesUuid === '' ? undefined : replacesUuid) !== null;
  if (saved) featureUse.feature('save_my_driver');
  return saved;
}


export function useDriverEditorHelp() {
  const helpSection = shallowRef<PhoneHelpSection | null>(null);
  const showHelp = (section: PhoneHelpSection): void => { helpSection.value = section; };
  const closeHelp = (): void => { helpSection.value = null; };
  useEscToClose(() => helpSection.value !== null, closeHelp);
  return {helpSection, showHelp, closeHelp};
}
