import type {OpenISDDriver} from '@openisd/design';

/** Driver identity for project telemetry. User-owned and imported names stay private. */
export function projectDriverTelemetry(driver: OpenISDDriver): {readonly driverId?: string; readonly driverName?: string} {
  if (driver.providedBy.value !== 'OpenIsd') return {};
  return {
    driverName: `${driver.brand.value} ${driver.model.value}`.trim(),
  };
}

/** What a usage event may say of a driver: a bundled (catalogue) driver's catalogue name (a project's embedded driver has no id of its own); 'own' for any other, whose identity stays private. */
export function driverTelemetryId(driver: OpenISDDriver): string {
  return driver.providedBy.value === 'OpenIsd' ? `${driver.brand.value} ${driver.model.value}`.trim() : 'own';
}
