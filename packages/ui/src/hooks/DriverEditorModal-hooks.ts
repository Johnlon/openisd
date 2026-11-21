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

interface DimensionLabel {
  readonly label: string;
  readonly figure: string;
}

export interface DriverDimensionLabels {
  readonly outer: DimensionLabel;
  readonly basket: DimensionLabel;
  readonly magnet: DimensionLabel;
  readonly thick: DimensionLabel;
  readonly magnetDepth: DimensionLabel;
  readonly depth: DimensionLabel;
}

export function useDriverDimensionLabels(
  readField: (key: NumSpecField) => Readable<number | null> & Precise,
  readTokens: () => Readonly<Record<string, string>>,
) {
  return computed<DriverDimensionLabels>(() => {
    const tokens = readTokens();
    function dimension(key: NumSpecField, field: NumberField): DimensionLabel {
      const {value, precision} = readField(key);
      const quantity = value === null ? null : {valueSI: value, halfWidthSI: precision};
      return {label: field.label, figure: formatFieldWithUnit(field, quantity, tokens, PHONE_MAX_SIGNIFICANT)};
    }
    return {
      outer: dimension('Outer_m', NumberField.OUTER_M),
      basket: dimension('Basket_m', NumberField.BASKET_M),
      magnet: dimension('Magnet_m', NumberField.MAGNET_M),
      thick: dimension('Thick_m', NumberField.THICK_M),
      magnetDepth: dimension('MagDepth_m', NumberField.MAGDEPTH_M),
      depth: dimension('Depth_m', NumberField.DEPTH_M),
    };
  });
}
