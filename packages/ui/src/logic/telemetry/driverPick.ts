import type {OpenISDDriver} from '@openisd/design';
import type {BundledDriverRepo} from '@openisd/persistence';
import type {Telemetry} from './telemetry.js';

/** Records `driver_pick` for a driver the user chose: `bundled` with its catalogue id and name when the
 *  catalogue lists it, else `mine` (a saved or imported driver all live in My Drivers). */
export function driverPickRecorder(telemetry: Telemetry, catalogue: BundledDriverRepo): (driver: OpenISDDriver) => void {
  return driver => {
    void catalogue.index().then(rows => {
      const row = rows.find(r => r.uuid === driver.uuid());
      telemetry.record(row ? {kind: 'driver_pick', source: 'bundled', id: row.uuid, name: row.name} : {kind: 'driver_pick', source: 'mine', id: '', name: ''});
    }, () => {
      telemetry.record({kind: 'driver_pick', source: 'mine', id: '', name: ''});
    });
  };
}
