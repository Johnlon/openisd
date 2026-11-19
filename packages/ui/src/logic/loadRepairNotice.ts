/**
 * The toast that tells the user what opening a stored project, a backup or a share link repaired
 * (a drive level below 10 mV set to 10 mV): one line per repair, under the project's name. John,
 * 18 Nov 2026 (QO953.c31): "all you can do is show a toast". File > Open shows its own repairs under
 * "Project imported from X" (`applicationIO.ts`).
 *
 * Several projects opened together (the open session at start-up) give one toast: the reports made in
 * one turn are gathered and shown once.
 */
import type {LoadRepairReport} from '@openisd/persistence';

/** The handler `createProjectRepo` calls for each project the load repaired. `schedule` runs the
 *  gathered toast once the current turn is done (`queueMicrotask` in the app). */
export function createLoadRepairNotice(flash: (msg: string) => void, schedule: (show: () => void) => void): (report: LoadRepairReport) => void {
  let pending: string[] = [];
  return report => {
    if (pending.length === 0) {
      schedule(() => {
        const lines = pending;
        pending = [];
        flash(lines.join('\n'));
      });
    }
    pending.push(`Project opened: ${report.projectName}`, ...report.lines);
  };
}
