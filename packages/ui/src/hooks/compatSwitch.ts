/** The setter both skins' WinISD compatibility checkboxes call: sets the switch and counts its use. */
import type {SimpleField} from '@openisd/design';
import type {FeatureUse} from '../logic/telemetry/featureUse.js';

export type CompatSwitchSetter = (field: SimpleField<boolean>, on: boolean) => void;

export function compatSwitchSetter(featureUse: FeatureUse): CompatSwitchSetter {
  return (field, on) => {
    featureUse.feature('compat_switch');
    field.set(on);
  };
}
