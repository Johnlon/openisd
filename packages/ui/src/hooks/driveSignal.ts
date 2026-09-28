/**
 * Signal-tab drive wiring shared by every shell: drive voltage/power reconciliation and series
 * resistance. `OriginalShell.vue`'s Signal tab and `MobileSignalTab.vue` both call this factory.
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
  // A deleted V goes back to its default through the domain's clear.
  function commitDriveV(v: number | null): void {
    if (v == null) project.value.driveVoltage_V.clear();
    else project.value.driveVoltage_V.set(v);
  }
  const driveV = computed<number | null>({
    get: () => {
      void changed.value; void project.value;
      return project.value.driveVoltage_V.value;
    },
    set: commitDriveV,
  });
  /** The blur-notify consumer for the drive trio's V cell: NumInput only reports "the cell was
   *  modified since entry", so the commit rule above runs again here. */
  function reconcileDriveV(committed: number | null): void {
    commitDriveV(committed);
  }
  /** P is blank exactly when the driver has no usable Re, and cannot be typed then. */
  const powerLocked = computed<boolean>(() => {
    void changed.value;
    return project.value.powerDrive_W.value === null;
  });
  // Series resistance — read through `projectChanged` so a typed value sticks.
  const rsOhm = computed<number>({
    get: () => { void changed.value; void project.value; return project.value.Rs_ohm.value; },
    set: (v) => { project.value.Rs_ohm.set(v ?? 0); },
  });
  return { driveV, reconcileDriveV, powerLocked, rsOhm };
}
