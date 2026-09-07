/** REPO: the read-only passive radiators that ship in the build's driver bundle.
 *
 *  The radiator half of the bundle, kept as its OWN collection so neither browser scans the
 *  other's rows. Read through `conformingRecordToPassiveRadiator` — the one seam for a
 *  passive-radiator record, refusing anything with a driver's woofer/tweeter section instead
 *  of quietly reading it as if it were a radiator. */
import { OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';
import type { BundleRecord } from './driverRepo.js';

/** One bundled radiator, as the PR browser and the PR editor need it.
 *
 *  Every field is read off the record, and a field the datasheet does not publish stays null —
 *  never zero, which would read as a measured value. SI units throughout, matching
 *  `PassiveRadiatorSpec`'s own field names. */
export interface BundledPassiveRadiator {
  /** Path within the source, forward-slashed — the row's identity. */
  path: string;
  name: string;
  brand: string;
  model: string;
  Sd_m2: number | null;
  Cms_m_per_N: number | null;
  Vas_m3: number | null;
  Fs_hz: number | null;
  Mms_kg: number | null;
  Qms: number | null;
  Rms_kg_per_s: number | null;
  Xmax_m: number | null;
}

export interface BundledPassiveRadiatorRepo {
  /** Every radiator in the bundle. No network, no file parsing. */
  list(): BundledPassiveRadiator[];
}

export function createBundledPassiveRadiatorRepo(
  bundle: { passiveRadiators?: readonly BundleRecord[] },
  engine: Engine,
): BundledPassiveRadiatorRepo {
  const rows = (bundle.passiveRadiators ?? []).flatMap((f): BundledPassiveRadiator[] => {
    const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(f.record, engine);
    if (Array.isArray(pr)) return []; // a record the seam refuses is dropped, not surfaced broken — the bundle is build-time, already validated by the codemod that produced it
    return [{
      path: f.path,
      name: f.name,
      brand: pr.brand.get().value ?? '',
      model: pr.model.get().value ?? '',
      Sd_m2: pr.spec.Sd_m2.get().value,
      Cms_m_per_N: pr.spec.Cms_m_per_N.get().value,
      Vas_m3: pr.spec.Vas_m3.get().value,
      Fs_hz: pr.spec.Fs_hz.get().value,
      Mms_kg: pr.spec.Mms_kg.get().value,
      Qms: pr.spec.Qms.get().value,
      Rms_kg_per_s: pr.spec.Rms_kg_per_s.get().value,
      Xmax_m: pr.spec.Xmax_m.get().value,
    }];
  });
  return { list: () => rows };
}
