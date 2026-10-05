/**
 * The "Reset to WinISD" button, in both shells. Display only: the label, the tooltip and what the
 * reset sets live in `packages/design` (`CompatSwitchGroup.RESET`, `OpenISDProject.resetToWinisd`).
 */
import {CompatSwitchGroup} from '@openisd/design/fields';
import {useFocusedProject} from '../logic/focusedProjectContext.js';

export interface ResetToWinisdAPI {
  readonly label: string;
  readonly tooltip: string;
  reset(): void;
}

export function useResetToWinisd(): ResetToWinisdAPI {
  const project = useFocusedProject();
  return {
    label: CompatSwitchGroup.RESET.heading,
    tooltip: CompatSwitchGroup.RESET.tooltip,
    reset: () => project.value.resetToWinisd(),
  };
}
