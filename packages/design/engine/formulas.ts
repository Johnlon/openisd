/**
 * UI-facing closed-form derivations — pure functions shared by every panel so the
 * physics lives in ONE place instead of being copy-pasted per component (PR Vas/Fs/Qms, drive
 * voltage).
 *
 * Air properties (ρ, c) are NOT here: they belong to `air.ts`, which the UI, the sweep and
 * the circuit all call through `airFor`.
 */
import { T_REF_K, RH_REF_PCT, P_REF_PA, moistAirDensity, moistAirSoundVelocity } from './air.js';

/**
 * Passive-radiator compliance-equivalent volume Vas, in LITRES.
 * Vas = Cms · Sd² · ρ · c²  (×1000 converts the m³ result to litres). No environment reaches
 * this call site, so ρ/c are computed live at the reference environment — never a stored
 * constant.
 */
export function prVas(prCms: number, prSd: number): number {
  const rho = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
  const c = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
  return prCms * prSd * prSd * rho * c * c * 1000;
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
 * Passive-radiator compliance from Vas (litres) and Sd — the inverse of `prVas`:
 * Cms = (Vas/1000) / (Sd² · ρ · c²). Returns 0 when Sd is non-positive (undefined compliance).
 */
export function prCmsFromVas(prVasL: number, prSd: number): number {
  if (!(prSd > 0)) return 0;
  const rho = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
  const c = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
  return (prVasL / 1000) / (prSd * prSd * rho * c * c);
}

/**
 * Passive-radiator moving mass from free-air Fs and compliance — the inverse of `prFs`:
 * Mmd = 1 / ((2π·Fs)² · Cms). Returns 0 when Fs or Cms is non-positive.
 */
export function prMmdFromFs(prFsHz: number, prCms: number): number {
  return prFsHz > 0 && prCms > 0 ? 1 / ((2 * Math.PI * prFsHz) ** 2 * prCms) : 0;
}

/**
 * Passive-radiator mechanical resistance from Qms/Mmd/Cms — the inverse of `prQms`:
 * Rms = √(Mmd/Cms) / Qms. Returns 0 when Qms is non-positive.
 */
export function prRmsFromQms(prQmsValue: number, prMmd: number, prCms: number): number {
  return prQmsValue > 0 ? Math.sqrt(prMmd / prCms) / prQmsValue : 0;
}

