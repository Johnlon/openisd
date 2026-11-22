/**
 * The toast that tells the user what opening a stored project, a backup or a share link repaired
 * (a series resistance below 0 Ω set to 0 Ω): one line per repair, under the project's name (QO953.c31). File > Open shows its own repairs under
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
