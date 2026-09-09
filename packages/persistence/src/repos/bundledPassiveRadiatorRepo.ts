/** REPO: the read-only passive radiators that ship in the build's driver bundle.
 *
 *  The radiator half of the bundle, kept as its OWN collection so neither browser scans the
 *  other's rows. Read through `OpenISDPassiveRadiatorStandalone.fromConformingRecord` — the one
 *  seam for a passive-radiator record, refusing anything with a driver's woofer/tweeter section
 *  instead of quietly reading it as if it were a radiator.
 *
 *  THE REPO NEVER READS A RADIATOR FIELD (John, 2026-09-05 ruling, as it already binds
 *  `driverRepo.bundledDrivers()`). It constructs the radiator and hands it out; any summary
 *  column a caller needs — a display name, `Fs`, `Sd` — is that caller's job, reading the SAME
 *  domain object this function returns. */
import { OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';
import type { BundleRecord } from './driverRepo.js';

export interface BundledPassiveRadiatorRepo {
  /** Every radiator in the bundle, as domain objects. No network, no file parsing. */
  list(): OpenISDPassiveRadiatorStandalone[];
}

export function createBundledPassiveRadiatorRepo(
  bundle: { passiveRadiators?: readonly BundleRecord[] },
  engine: Engine,
): BundledPassiveRadiatorRepo {
  const rows = (bundle.passiveRadiators ?? []).flatMap((f): OpenISDPassiveRadiatorStandalone[] => {
    const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(f.record, engine);
    // A record the seam refuses is dropped, not surfaced broken — the bundle is build-time,
    // already validated by the codemod that produced it.
    return Array.isArray(pr) ? [] : [pr];
  });
  return { list: () => rows };
}
