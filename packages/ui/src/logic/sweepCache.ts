/**
 * Each project's last sweep and max curves, re-run only when that project's sweep job changes.
 * The chart overlays read every open project on every edit of the focused one; an unchanged
 * project answers from here instead of sweeping again.
 */
import type {FrequencyGrid, OpenISDProject} from '@openisd/design';
import type {SweepComputer, SweepReply} from './sweepRequest.js';

interface CachedSweep {
  /** The job as JSON: equal text, equal job (numbers round-trip exactly). */
  readonly key: string;
  readonly reply: SweepReply;
}

export class SweepCache {
  private readonly last = new WeakMap<OpenISDProject, CachedSweep>();

  constructor(private readonly computer: SweepComputer) {}

  /** null when the project's sweep is blocked. */
  sweep(project: OpenISDProject, grid: FrequencyGrid): SweepReply | null {
    const plan = project.sweepPlan(grid);
    if (plan.kind === 'blocked') {
      this.last.delete(project);
      return null;
    }
    const key = JSON.stringify(plan.job);
    const hit = this.last.get(project);
    if (hit !== undefined && hit.key === key) return hit.reply;
    const reply = this.computer.run({ id: 0, job: plan.job, withMax: true });
    this.last.set(project, { key, reply });
    return reply;
  }
}
