/**
 * `MobileSignalTab.vue`'s hook — input power, drive voltage, series resistance. Calls the SAME
 * `createDriveSignal` factory `OriginalShell-hooks.ts` exports.
 */
import {computed} from 'vue';
import {projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {createDriveSignal, dqOfCell} from './OriginalShell-hooks.js';

export function useMobileSignalTab() {
  const project = useFocusedProject();
  const { driveV, reconcileDriveV, powerLocked, rsOhm } = createDriveSignal({ project, projectChanged });

  const powerDq = computed(() => { void projectChanged.value; return dqOfCell(project.value.powerDrive_W); });
  const voltageDq = computed(() => { void projectChanged.value; return dqOfCell(project.value.driveVoltage_V); });
  const power_W = computed(() => { void projectChanged.value; return project.value.powerDrive_W.value; });
  function setPower(v: number | null): void {
    if (v == null) project.value.powerDrive_W.clear();
    else project.value.powerDrive_W.set(v);
  }

  return { driveV, reconcileDriveV, powerLocked, rsOhm, powerDq, voltageDq, power_W, setPower };
}
