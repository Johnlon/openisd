import type {BoxType} from '../../engine/index.js';

/** The starting volume of a passive-radiator box and of a bandpass4 rear chamber, m³ (7 L). */
export const STARTING_SHARED_VOLUME_M3 = 0.007;

/** A dual-chamber box's starting chambers: volumes in m³, tunings in Hz (null: that chamber is sealed). */
export interface StartingChambers {
  readonly rearVolume_m3: number;
  readonly frontVolume_m3: number;
  readonly rearTuning_hz: number | null;
  readonly frontTuning_hz: number;
}

/** The one source of the starting chambers of a dual-chamber box type, as WinISD's wizard gives
 *  them: bandpass4 a sealed 7 L rear and a 10 L front at 35 Hz; bandpass6 and ABC a 30 L rear at
 *  35 Hz and a 20 L front at 25 Hz. */
export function startingChambersOf(type: 'bandpass4' | 'bandpass6' | 'abc'): StartingChambers {
  switch (type) {
    case 'bandpass4':
      return {rearVolume_m3: STARTING_SHARED_VOLUME_M3, frontVolume_m3: 0.01, rearTuning_hz: null, frontTuning_hz: 35};
    case 'bandpass6':
    case 'abc':
      return {rearVolume_m3: 0.03, frontVolume_m3: 0.02, rearTuning_hz: 35, frontTuning_hz: 25};
  }
}

/** True when the box type has a tuning for its rear chamber as well as its front (bandpass6, ABC). */
export function takesChamberTunings(type: BoxType): boolean {
  switch (type) {
    case 'bandpass6':
    case 'abc':
      return true;
    case 'sealed':
    case 'vented':
    case 'box-passive-radiator':
    case 'bandpass4':
      return false;
  }
}
