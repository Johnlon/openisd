/**
 * Signal-tab drive wiring shared by every shell: whether P is locked and the Rs value. V is the
 * project's own cell, bound by a `UIField` row.
 *
 * V is never absent. While Re is known, P = V²/Re and the one typed last is entered. Without Re,
 * P is blank and locked; its dq says why.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed} from 'vue';
import type {OpenISDProject} from '@openisd/design';

export interface DriveSignalDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
}

export function createDriveSignal({ project, projectChanged: changed }: DriveSignalDeps) {
  /** P is blank exactly when the driver has no usable Re, and cannot be typed then. */
  const powerLocked = computed<boolean>(() => {
    void changed.value;
    return project.value.powerDrive_W.value === null;
  });
  /** Rs as a number, re-read when the project changes: the Rs row (`UIFixedField`) takes a number, not the cell. */
  const rsOhm = computed<number>(() => { void changed.value; return project.value.Rs_ohm.value; });
  return { powerLocked, rsOhm };
}
