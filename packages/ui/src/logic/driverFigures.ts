/**
 * Small, named wrappers around single-purpose engine figures-of-merit — so a component reads
 * `computeEbp(engineDriver())`, not `ebp(engineDriver())` off `@openisd/engine` directly. Each
 * function here is a real call, not a re-export: the ui/** architecture gate bans the engine
 * import itself, and this is where that one function's logic actually lives for the UI.
 */
import { ebp } from '@openisd/engine';
import type { EngineDriver } from '@openisd/engine';

/** Efficiency Bandwidth Product (Fs/Qes) — null when the driver has no Fs/Qes to compute it from. */
export function computeEbp(driver: EngineDriver | null): number | null {
  return driver ? ebp(driver) : null;
}
