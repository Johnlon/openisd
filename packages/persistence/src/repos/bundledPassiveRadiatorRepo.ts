/** REPO: the read-only passive radiators that ship in the build's driver bundle.
 *
 *  The radiator half of the bundle, kept as its OWN collection so neither browser scans the
 *  other's rows. A radiator row carries the same `BundleRecord` shape a driver row does — a
 *  radiator record is a record — and is read here through the SAME `OpenISDDriver` reader the
 *  driver rows use, which handles a `passive-radiator` specs section natively
 *  (`openisdDriver.ts::sectionFor`). One shape, one reader, two collections. */
import { OpenISDDriver } from '@openisd/model';
import type { BundleRecord } from './driverRepo.js';

/** One bundled radiator, as the PR browser and the PR editor need it.
 *
 *  Every field is read off the record, and a field the datasheet does not publish stays null —
 *  never zero, which would read as a measured value. */
export interface BundledPassiveRadiator {
  /** Path within the source, forward-slashed — the row's identity. */
  path: string;
  name: string;
  brand: string;
  model: string;
  Sd: number | null;
  Cms: number | null;
  Vas: number | null;
  Fs: number | null;
  Mms: number | null;
  Qms: number | null;
  Rms: number | null;
  Xmax: number | null;
  datasheet: string;
  manupage: string;
}

export interface BundledPassiveRadiatorRepo {
  /** Every radiator in the bundle. No network, no file parsing. */
  list(): BundledPassiveRadiator[];
}

export function createBundledPassiveRadiatorRepo(
  bundle: { passiveRadiators?: BundleRecord[] },
): BundledPassiveRadiatorRepo {
  const rows = (bundle.passiveRadiators ?? []).map((f): BundledPassiveRadiator => {
    const pr = OpenISDDriver.fromJsonRecord(f.record);
    return {
      path: f.path,
      name: f.name,
      brand: pr.brand(),
      model: pr.model(),
      Sd: pr.Sd(), Cms: pr.Cms(), Vas: pr.Vas(), Fs: pr.Fs(),
      Mms: pr.Mms(), Qms: pr.Qms(), Rms: pr.Rms(), Xmax: pr.Xmax(),
      datasheet: pr.dataSourceUrl('manufacturer_datasheet'),
      manupage: pr.dataSourceUrl('manufacturer_product_page'),
    };
  });
  return { list: () => rows };
}
