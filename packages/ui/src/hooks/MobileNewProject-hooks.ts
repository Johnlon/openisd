/**
 * The mobile New Project wizard's footer on the driver step. The wizard hook
 * (`OriginalNewProject-hooks.ts`) knows only a chosen driver; on a phone the driver being READ in
 * the library is what Next acts on — it chooses that driver (which moves the wizard to step 2),
 * so the preview needs no Use/Cancel pair of its own. Desktop's wizard is unchanged.
 */
import {computed, type ComputedRef} from 'vue';
import type {DriverBrowsingState} from '../logic/driverBrowsingState.js';
import type {OriginalNewProjectAPI} from './OriginalNewProject-hooks.js';

export interface MobileNewProjectFooter {
  /** Next is enabled: on step 1 a driver is chosen or being read; later, the wizard's own rule. */
  readonly canGoNext: ComputedRef<boolean>;
  /** Next was pressed. */
  goNext(): Promise<void>;
}

export function createMobileNewProjectFooter(
  wizard: Pick<OriginalNewProjectAPI, 'step' | 'canNext' | 'next'>,
  driverBrowsing: Pick<DriverBrowsingState, 'previewDriver' | 'chooseDriver'>,
): MobileNewProjectFooter {
  const canGoNext = computed(() =>
    wizard.step.value === 1 ? driverBrowsing.previewDriver.value !== null || wizard.canNext.value : wizard.canNext.value);

  async function goNext(): Promise<void> {
    const reading = driverBrowsing.previewDriver.value;
    if (wizard.step.value === 1 && reading !== null) {
      await driverBrowsing.chooseDriver(reading);   // hands the driver to the wizard, which moves on
      return;
    }
    wizard.next();
  }

  return {canGoNext, goNext};
}
