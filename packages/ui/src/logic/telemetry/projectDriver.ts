import type {OpenISDDriver} from '@openisd/design';

/** Driver identity for project telemetry. User-owned and imported names stay private. */
export function projectDriverTelemetry(driver: OpenISDDriver): {readonly driverId?: string; readonly driverName?: string} {
  if (driver.providedBy.value !== 'OpenIsd') return {};
  return {
    driverName: `${driver.brand.value} ${driver.model.value}`.trim(),
  };
}
