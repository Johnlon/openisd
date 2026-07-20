/**
 * UI-facing closed-form derivations — pure functions shared by every skin and panel so the
 * physics lives in ONE place instead of being copy-pasted per component (PR Vas/Fs/Qms, drive
 * voltage, sound velocity previously duplicated 3–5× across the UI).
 *
 * These are ADDITIONS: they consolidate formulas that already existed identically in the UI.
 * The engine's own derivations (circuit/sweep/alignments) are untouched.
 */
import { RHO, C } from './constants.js';

/**
 * Passive-radiator compliance-equivalent volume Vas, in LITRES.
 * Vas = Cms · Sd² · ρ · c²  (×1000 converts the m³ result to litres).
 */
export function prVas(prCms: number, prSd: number): number {
  return prCms * prSd * prSd * RHO * C * C * 1000;
}

/**
 * Passive-radiator free-air resonance from moving mass + compliance:
 * Fs = 1 / (2π·√(Mmd·Cms)). Returns 0 when either input is non-positive (undefined resonance).
 */
export function prFs(prMmd: number, prCms: number): number {
  return prMmd > 0 && prCms > 0 ? 1 / (2 * Math.PI * Math.sqrt(prMmd * prCms)) : 0;
}

/**
 * Passive-radiator resonance loaded with added cone mass: same form using (Mmd + Madd).
 * Returns 0 when the total mass or compliance is non-positive.
 */
export function prFsWithMass(prMmd: number, prMadd: number, prCms: number): number {
  const m = prMmd + prMadd;
  return m > 0 && prCms > 0 ? 1 / (2 * Math.PI * Math.sqrt(m * prCms)) : 0;
}

/**
 * Passive-radiator mechanical Q: Qms = √(Mmd/Cms) / Rms. Returns 0 when Rms is non-positive.
 */
export function prQms(prMmd: number, prCms: number, prRms: number): number {
  return prRms > 0 ? Math.sqrt(prMmd / prCms) / prRms : 0;
}

/**
 * Drive voltage from reference (system) power and voice-coil resistance: V = √(Pin · Re).
 * Matches WinISD's reference-power convention.
 */
export function driveVoltage(pin: number, re: number): number {
  return Math.sqrt(pin * re);
}

/**
 * Speed of sound in air from absolute temperature: c = 20.05 · √(T[K]) m/s.
 * (20.05 = √(γ·R/M) for dry air.) At 293.15 K this is ≈ 343.3 m/s.
 */
export function soundVelocity(tempKelvin: number): number {
  return 20.05 * Math.sqrt(tempKelvin);
}
