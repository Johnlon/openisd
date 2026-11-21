import type {FeatureUse} from '../logic/telemetry/featureUse.js';
import {computed, shallowRef} from 'vue';
import {NumberField, PHONE_MAX_SIGNIFICANT, type PhoneHelpSection} from '@openisd/design/fields';
import {useEscToClose} from '../logic/useEscToClose.js';
import type {OpenISDDriver, OpenISDDriverStandalone, Precise, Readable} from '@openisd/design';
import type {MyDriverRepo} from '@openisd/persistence';
import type {NumSpecField} from '../logic/appState.js';
import {formatFieldWithUnit} from './useUnitReadouts.js';

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

export interface DriverDimensionFigures {
  readonly outer: string;
  readonly basket: string;
  readonly magnet: string;
  readonly thick: string;
  readonly magnetDepth: string;
  readonly depth: string;
}

export function useDriverDimensionFigures(
  readField: (key: NumSpecField) => Readable<number | null> & Precise,
  readTokens: () => Readonly<Record<string, string>>,
) {
  return computed<DriverDimensionFigures>(() => {
    const tokens = readTokens();
    function figure(key: NumSpecField, field: NumberField): string {
      const {value, precision} = readField(key);
      const quantity = value === null ? null : {valueSI: value, halfWidthSI: precision};
      // The drawing has to fit its longest label on the phone as well as the desktop.
      return formatFieldWithUnit(field, quantity, tokens, PHONE_MAX_SIGNIFICANT);
    }
    return {
      outer: figure('Outer_m', NumberField.OUTER_M),
      basket: figure('Basket_m', NumberField.BASKET_M),
      magnet: figure('Magnet_m', NumberField.MAGNET_M),
      thick: figure('Thick_m', NumberField.THICK_M),
      magnetDepth: figure('MagDepth_m', NumberField.MAGDEPTH_M),
      depth: figure('Depth_m', NumberField.DEPTH_M),
    };
  });
}
