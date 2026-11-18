import type {DriveLoad} from '../../engine/index.js';
import {DEFAULT_ALFAVC_PER_K, DEFAULT_VC_TEMP_RISE_K} from '../../fields/defaults.js';

/** One standard driver with a new project's cold coil, driven through `Rs_ohm`: what a test that is not about the driver
 *  count or coil heating loads its driver with. */
export function oneDriver(Rs_ohm: number): DriveLoad {
  return {Rs_ohm, nDrivers: 1, loading: 'standard', alfaVC_per_K: DEFAULT_ALFAVC_PER_K, vcTempRise_K: DEFAULT_VC_TEMP_RISE_K};
}
