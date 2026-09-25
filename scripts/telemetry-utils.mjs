/**
 * telemetry-utils.mjs — pure functions for telemetry-sampler.mjs, importable and testable.
 */

/**
 * Compute CPU % for a process over a sampling interval.
 * @param {{ utime: number, stime: number }} prev — previous /proc/<pid>/stat tick counts
 * @param {{ utime: number, stime: number }} cur  — current tick counts
 * @param {number} deltaSec   — wall-clock seconds between samples
 * @param {number} numCpus    — os.cpus().length
 * @param {number} ticksPerSec — CLK_TCK (usually 100)
 * @returns {{ userPct: number, sysPct: number, totalPct: number }}
 */
export function computeCpuPercent(prev, cur, deltaSec, numCpus, ticksPerSec) {
  // stub — will be filled in after test confirms the red
  return { userPct: 0, sysPct: 0, totalPct: 0 };
}

/**
 * Decide whether a /proc process belongs to this run.
 * Chromium calls setsid(), making its own session != ours, but its parent (the Playwright
 * node process) stays in our session.  Match either case.
 * @param {number} procSession  — session field of the process being checked
 * @param {number} parentSession — session field of its parent (ppid's session)
 * @param {number} ourSession   — the sampler's own session id
 * @returns {boolean}
 */
export function matchesProcess(procSession, parentSession, ourSession) {
  // stub
  return procSession === ourSession;
}
