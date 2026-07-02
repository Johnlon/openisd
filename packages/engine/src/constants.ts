/**
 * Physical constants.
 *
 * Air density and speed of sound at 20 °C, 1 atm:
 *   https://en.wikipedia.org/wiki/Speed_of_sound#Speed_of_sound_in_ideal_gases_and_air
 *
 * Reference sound pressure (0 dB SPL = 20 µPa):
 *   https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
 */

export const RHO = 1.184;  // air density        kg/m³   (20 °C)
export const C   = 345.0;  // speed of sound      m/s     (20 °C)
export const P0  = 20e-6;  // SPL reference       Pa RMS  (0 dB SPL)
