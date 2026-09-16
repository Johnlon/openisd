import { describe, it, expect } from 'vitest';
import { computeCpuPercent, matchesProcess } from '../../scripts/telemetry-utils.mjs';

describe('computeCpuPercent', () => {
  const ticksPerSec = 100;
  const numCpus = 10;

  it('returns 0% when ticks are unchanged', () => {
    const r = computeCpuPercent({ utime: 1000, stime: 200 }, { utime: 1000, stime: 200 }, 5, numCpus, ticksPerSec);
    expect(r.totalPct).toBe(0);
    expect(r.userPct).toBe(0);
    expect(r.sysPct).toBe(0);
  });

  it('reports 100% on a single CPU for one full-second tick delta', () => {
    // 100 ticks/sec × 1 sec = 100 ticks user delta on 10 CPUs → 10% total (uses all CPUs)
    const r = computeCpuPercent({ utime: 0, stime: 0 }, { utime: 100, stime: 0 }, 1, numCpus, ticksPerSec);
    expect(r.userPct).toBe(10);
    expect(r.sysPct).toBe(0);
    expect(r.totalPct).toBe(10);
  });

  it('reports 100% on one CPU if ticks = numCpus × ticksPerSec × seconds', () => {
    // 10 CPUs × 100 ticks/s × 5s = 5000 ticks → 100% across all CPUs
    const r = computeCpuPercent({ utime: 0, stime: 0 }, { utime: 5000, stime: 0 }, 5, numCpus, ticksPerSec);
    expect(r.totalPct).toBe(100);
    expect(r.userPct).toBe(100);
  });

  it('splits user and system CPU correctly', () => {
    // 2500 user + 2500 sys = 5000 total on 10 CPUs over 5s → 50% user, 50% sys
    const r = computeCpuPercent({ utime: 100, stime: 50 }, { utime: 2600, stime: 2550 }, 5, numCpus, ticksPerSec);
    expect(r.userPct).toBe(50);
    expect(r.sysPct).toBe(50);
    expect(r.totalPct).toBe(100);
  });

  it('clamps to 0 if prev > cur (counter wrap or sampling glitch)', () => {
    const r = computeCpuPercent({ utime: 999, stime: 999 }, { utime: 500, stime: 500 }, 5, numCpus, ticksPerSec);
    expect(r.totalPct).toBe(0);
  });
});

describe('matchesProcess', () => {
  const ourSession = 1000;

  it('matches process in our session', () => {
    expect(matchesProcess(1000, 500, ourSession)).toBe(true);
  });

  it('matches process whose parent is in our session (handles setsid)', () => {
    // Process session = 2000 (its own setsid), parent session = ours
    expect(matchesProcess(2000, 1000, ourSession)).toBe(true);
  });

  it('rejects process not in our session and not child of our session', () => {
    expect(matchesProcess(3000, 3001, ourSession)).toBe(false);
  });
});
