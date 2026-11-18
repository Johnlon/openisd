import type {DriveLoad} from '../../engine/index.js';

/** One standard driver, driven through `Rs_ohm`: what a test that is not about the driver count loads its driver with. */
export function oneDriver(Rs_ohm: number): DriveLoad {
  return {Rs_ohm, nDrivers: 1, loading: 'standard'};
}
