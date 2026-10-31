import {NumberField} from './field.js';

/**
 * The short names a save keyed its unit choices by before the store was keyed by the field
 * itself (`NumberField.value`). Legacy input format only: the load boundary reads it, nothing
 * writes it. A short name that already equals its field's `value` (`Fs_hz`, `EBP_hz`, ...) needs
 * no entry; a fixed-unit field has no choice to carry.
 */
const LEGACY_ROTATION_KEYS: Readonly<Record<string, NumberField>> = Object.freeze({
  Vb: NumberField.BOX_VB_L,
  Vf: NumberField.BOX_VF_L,
  Fb: NumberField.BOX_FB_HZ,
  Frc: NumberField.BOX_FRC_HZ,
  Fp: NumberField.PR_FP_HZ,
  boxResonance: NumberField.BOX_RESONANCE_HZ,
  rearResonance: NumberField.BOX_REARRESONANCE_HZ,
  portResonance: NumberField.VENT_1STPORTRESONANCE_HZ,
  ventCrossArea: NumberField.VENT_CROSSAREA_M2,
  ventD: NumberField.VENT_D_CM,
  ventH: NumberField.VENT_H_CM,
  ventL: NumberField.VENT_L_CM,
  ventW: NumberField.VENT_W_CM,
  prFs: NumberField.PR_FS_HZ,
  prFsMass: NumberField.PR_FSMASS_HZ,
  prMadd: NumberField.PR_MADD_G,
  prSd: NumberField.PR_SD_CM2,
  prVas: NumberField.PR_VAS_L,
  prXmax: NumberField.PR_XMAX_MM,
  advPressure: NumberField.ADV_PRESSURE_KPA,
  advTemp: NumberField.ADV_TEMP_K,
  driverAddedMass: NumberField.DRIVER_ADDEDMASS_G,
  vcTempRise: NumberField.DRIVER_VCTEMPRISE_K,
});

/**
 * The stored unit choices as a rotation keyed by the field itself. A choice saved under a
 * legacy short name moves to its field's key; a choice already under the field's key wins over
 * a legacy one. An unknown key, a unit the field does not rotate to, or a value that is not a
 * string is dropped: a bad entry costs that one choice, never the rest.
 */
export function parseUnitRotation(stored: unknown): Readonly<Record<string, string>> {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  const rotation: Record<string, string> = {};
  const entries = Object.entries(stored);
  for (const [key, token] of entries) {
    const field = NumberField.named(key);
    if (field !== undefined && field.rotatesTo(token)) rotation[field.value] = token;
  }
  for (const [key, token] of entries) {
    const field = Object.hasOwn(LEGACY_ROTATION_KEYS, key) ? LEGACY_ROTATION_KEYS[key] : undefined;
    if (field !== undefined && !(field.value in rotation) && field.rotatesTo(token)) rotation[field.value] = token;
  }
  return rotation;
}
