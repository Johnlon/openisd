/**
 * Seed the "My Drivers" browser-storage bucket in the shape the app CURRENTLY writes.
 *
 * The bucket is a versioned envelope owned by `packages/persistence/src/repos/savedEntries.ts`:
 *
 *     { schema: 1, entries: [ { uuid: string, record: <OpenISDDeviceJson> } ] }
 *
 * and every `record` is opened through `OpenISDDriver.fromConformingRecord`. A flat
 * `{ brand, model, Fs }` literal — the pre-migration seed shape — is not a conforming record, so
 * seeding one leaves My Drivers empty and every test that needs a saved row on screen fails.
 * bugs/BUG_20260909_my_drivers_specs_seed_the_pre_migration_localstorage_shape.md
 *
 * This module owns ONLY the mechanism: the envelope shape and the record skeleton. Each spec
 * still declares its own driver values inline and passes them in — the values the assertions
 * depend on are never shared (openisd AGENTS.md "tests construct their own data").
 *
 * Use it in a spec's `page.addInitScript`:
 *
 *     await page.addInitScript((json) => {
 *       localStorage.setItem('openisd_my_drivers', json);
 *     }, myDriversJson([{ brand: 'Scope Test', model: 'Alpha', specs: { Fs_hz: 40, Re_ohm: 6.2, Sd_m2: 0.02 } }]));
 */

export const MY_DRIVERS_KEY = 'openisd_my_drivers';

/** A driver a test wants in the My Drivers list. `specs` keys are the schema's unit-suffixed
 *  names the record uses (`Fs_hz`, `Qts`, `Vas_m3`, `Sd_m2`, `Re_ohm`, `Le_H`, `Xmax_m`,
 *  `Pe_W`, `Znom_ohm`, `Qes`, `Qms`, …). */
export interface SeedDriver {
  brand: string;
  model: string;
  /** Defaults to `'woofer'`. */
  driverType?: 'woofer';
  /** Optional stable identity. A fresh uuid is generated when absent. */
  uuid?: string;
  specs: Record<string, number>;
}

/** One spec field as the record stores it: an entered reading, no derivation. */
function enteredField(value: number): unknown {
  return { origin: 'entered', readings: { entered: { read_value: value } } };
}

/** A conforming `OpenISDDeviceJson` for one seed driver — the same shape
 *  `packages/ui/test/fixtures/sample-project.owpr` carries, which the domain itself wrote.
 *  `recordUuid` is the record's own identity; the envelope slot's uuid (which the repo adopts)
 *  is passed the SAME value by `myDriversJson` so a seeded row has one id, not two.
 *  Exported for tests that hand-build a bucket around it (e.g. the storage-failure specs). */
export function deviceRecord(d: SeedDriver, recordUuid: string): unknown {
  const section = 'woofer';
  const specEntries: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(d.specs)) specEntries[key] = enteredField(value);

  return {
    uuid: { value: recordUuid },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [],
      invalid: [], parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: '' },
    brand: { value: d.brand },
    model: {value: d.model },
    sku: { value: '', grounds: [{ origin: 'manual', reading: '' }] },
    driver_type: { value: section },
    data_sources: { value: {} },
    authoritative: { value: 'openisd' },
    specs: { woofer: specEntries },
  };
}

/** A v4-shaped random id. `crypto.randomUUID` is not always present in a Playwright init
 *  script's scope, so build one from `Math.random` — a fixture id needs no cryptographic
 *  strength, only distinctness within one test. */
function cryptoRandomId(): string {
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`;
}

/** The bucket's JSON string, ready for `localStorage.setItem(MY_DRIVERS_KEY, …)`. */
export function myDriversJson(drivers: SeedDriver[]): string {
  return JSON.stringify({
    schema: 1,
    entries: drivers.map(d => {
      const id = d.uuid ?? cryptoRandomId();
      return { uuid: id, record: deviceRecord(d, id) };
    }),
  });
}
