/**
 * Physical constants.
 *
 * Air density and speed of sound at 20 °C, 1 atm:
 *   https://en.wikipedia.org/wiki/Speed_of_sound#Speed_of_sound_in_ideal_gases_and_air
 *
 * Reference sound pressure (0 dB SPL = 20 µPa):
 *   https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
 */

// 20 °C, 30 % RH, 101325 Pa — WinISD's own derived values (Advanced pane), so
// OpenISD matches WinISD instead of the old ~24 °C figures that were mislabelled 20 °C.
export const RHO = 1.20095;  // air density        kg/m³   (20 °C — WinISD)
export const C   = 343.68;   // speed of sound      m/s     (20 °C — WinISD)
export const P0  = 20e-6;    // SPL reference       Pa RMS  (0 dB SPL)
