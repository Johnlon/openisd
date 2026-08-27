/**
 * Physical constants.
 *
 * Reference sound pressure (0 dB SPL = 20 µPa):
 *   https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
 */

export const P0 = 20e-6;  // SPL reference, Pa RMS (0 dB SPL)

// Standard acceleration of gravity, CGPM 1901 — the exact defined value, m/s².
// WinISD's `Gloss` (static cone sag as a fraction of Xmax) is g/((2π·Fs)²·Xmax), and 41
// probe samples fit that to 3.6e-15 relative only at this figure, not at 9.81 or 9.8.
export const G_STANDARD = 9.80665;

// Default ceiling on the force-flat auto-EQ boost (WinISD Advanced: "Force flat response").
// A vented box rolls off at 24 dB/oct, so an unbounded inverse filter would demand 40+ dB of
// boost an octave below Fb — physically absurd (the excursion it implies exceeds any driver's
// Xmax by orders of magnitude). 20 dB is a 10× voltage boost: enough to flatten a realistic
// passband ripple, small enough that the result stays a design a real amplifier could drive.
export const FLAT_MAX_BOOST_DB = 20;
