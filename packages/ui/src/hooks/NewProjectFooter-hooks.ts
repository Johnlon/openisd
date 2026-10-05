/**
 * The New Project wizard's footer, shared by both skins (OriginalNewProject.vue and
 * MobileNewProject.vue): Back, the green lead (Next, or Create on the last step), Cancel.
 * On the driver step the driver being READ in the embedded library is what Next acts on — it
 * chooses that driver (which moves the wizard to step 2), so the preview needs no Use/Cancel pair.
 */
import {computed, type ComputedRef} from 'vue';
import type {DriverBrowsingState} from '../logic/driverBrowsingState.js';
import type {OriginalNewProjectAPI} from './OriginalNewProject-hooks.js';

export interface NewProjectFooter {
  /** Next is enabled: on step 1 a driver is chosen or being read; later, the wizard's own rule. */
  readonly canGoNext: ComputedRef<boolean>;
  /** The lead is Create, not Next: the wizard is on its last step. */
  readonly leadIsCreate: ComputedRef<boolean>;
  /** Next was pressed. */
  goNext(): Promise<void>;
}

export function createNewProjectFooter(
  wizard: Pick<OriginalNewProjectAPI, 'step' | 'currentStepNumber' | 'totalSteps' | 'canNext' | 'next'>,
  driverBrowsing: Pick<DriverBrowsingState, 'previewDriver' | 'chooseDriver'>,
): NewProjectFooter {
  const canGoNext = computed(() =>
    wizard.step.value === 1 ? driverBrowsing.previewDriver.value !== null || wizard.canNext.value : wizard.canNext.value);

  const leadIsCreate = computed(() => wizard.currentStepNumber.value === wizard.totalSteps.value);

  async function goNext(): Promise<void> {
    const reading = driverBrowsing.previewDriver.value;
    if (wizard.step.value === 1 && reading !== null) {
      await driverBrowsing.chooseDriver(reading);   // hands the driver to the wizard, which moves on
      return;
    }
    wizard.next();
  }

  return {canGoNext, leadIsCreate, goNext};
}
