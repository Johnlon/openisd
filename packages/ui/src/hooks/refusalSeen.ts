import {inject, provide, type InjectionKey} from 'vue';
import type {OpenISDDriver} from '@openisd/design';
import {useApp} from '../logic/app.js';
import {driverTelemetryId} from '../logic/telemetry/projectDriver.js';
import {useFeatureUse} from './telemetryContext.js';

/** The driver the boxes under the Driver Editor belong to (its draft); without one, the focused project's driver. */
const EDITED_DRIVER: InjectionKey<() => OpenISDDriver> = Symbol('openisd.editedDriver');

export function provideEditedDriver(driver: () => OpenISDDriver): void { provide(EDITED_DRIVER, driver); }

/** Tells usage statistics that a number box refused an entry: the field's id and the driver's (a bundled driver's catalogue name, else 'own'). */
export function useRefusalSeen(): (fieldId: string) => void {
  const featureUse = useFeatureUse();
  const {appState} = useApp();
  const edited = inject(EDITED_DRIVER, null);
  return fieldId => {
    const driver = edited?.() ?? appState.focusedProject()?.driver ?? null;
    if (driver === null) return;
    featureUse.valuesProblemSeen({kind: 'values_problem_seen', problem: 'refused', field: fieldId, driver: driverTelemetryId(driver)});
  };
}
