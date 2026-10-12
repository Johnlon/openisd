/**
 * `MobileSignalTab.vue`'s hook — the focused project and whether input power is locked. Calls the
 * SAME `createDriveSignal` factory `driveSignal.ts` exports.
 */
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {createDriveSignal} from './driveSignal.js';

export function useMobileSignalTab() {
  const {projectChanged} = useApp().appState;
  const project = useFocusedProject();
  const { powerLocked, rsOhm } = createDriveSignal({ project, projectChanged });
  return { project, powerLocked, rsOhm };
}
