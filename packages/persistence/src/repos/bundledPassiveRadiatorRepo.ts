// COMMENTED OUT — John Lonergan, 2026-08-31: "also evil - comment it".
//
// TWO defects, both structural:
//
// 1. It reads a PASSIVE RADIATOR through `OpenISDDriver` — a class carrying `Re`, `BL`, `Qes`,
//    `Znom`, `Pe` and the whole motor surface a radiator does not have. Those accessors answer
//    null forever, indistinguishable from a radiator whose datasheet omitted them. A radiator is
//    its own concept, and `packages/design` already says so: `passiveRadiatorFromConformingRecord`
//    returns `OpenISDPassiveRadiatorStandalone | string[]`, refusing a record the other's type
//    could never model.
//
// 2. `BundledPassiveRadiator` flattens the record into eight bare `number | null` fields. It opens
//    a record into a domain object, reads values off it, throws the object away, and hands back
//    strictly less — losing the provenance every `Cell` carries.
//
// The replacement reads the bundle's radiator records through the design seam and hands back the
// radiator itself, with the bundle-level facts (`path`, `name`) beside it rather than inside it.
// See docs/plans/PLAN_DELETE_PACKAGES_MODEL.md.

// /** REPO: the read-only passive radiators that ship in the build's driver bundle.
//  *
//  *  The radiator half of the bundle, kept as its OWN collection so neither browser scans the
//  *  other's rows. A radiator row carries the same `BundleRecord` shape a driver row does — a
//  *  radiator record is a record — and is read here through the SAME `OpenISDDriver` reader the
//  *  driver rows use, which handles a `passive-radiator` specs section natively
//  *  (`openisdDriver.ts::sectionFor`). One shape, one reader, two collections. */
// import { OpenISDDriver } from '@openisd/model';
// import type { BundleRecord } from './driverRepo.js';
//
// /** One bundled radiator, as the PR browser and the PR editor need it.
//  *
//  *  Every field is read off the record, and a field the datasheet does not publish stays null —
//  *  never zero, which would read as a measured value. */
// export interface BundledPassiveRadiator {
//   /** Path within the source, forward-slashed — the row's identity. */
//   path: string;
//   name: string;
//   brand: string;
//   model: string;
//   Sd: number | null;
//   Cms: number | null;
//   Vas: number | null;
//   Fs: number | null;
//   Mms: number | null;
//   Qms: number | null;
//   Rms: number | null;
//   Xmax: number | null;
//   datasheet: string;
//   manupage: string;
// }
//
// export interface BundledPassiveRadiatorRepo {
//   /** Every radiator in the bundle. No network, no file parsing. */
//   list(): BundledPassiveRadiator[];
// }
//
// export function createBundledPassiveRadiatorRepo(
//   bundle: { passiveRadiators?: BundleRecord[] },
// ): BundledPassiveRadiatorRepo {
//   const rows = (bundle.passiveRadiators ?? []).map((f): BundledPassiveRadiator => {
//     const pr = OpenISDDriver.fromJsonRecord(f.record);
//     return {
//       path: f.path,
//       name: f.name,
//       brand: pr.brand(),
//       model: pr.model(),
//       Sd: pr.Sd(), Cms: pr.Cms(), Vas: pr.Vas(), Fs: pr.Fs(),
//       Mms: pr.Mms(), Qms: pr.Qms(), Rms: pr.Rms(), Xmax: pr.Xmax(),
//       datasheet: pr.dataSourceUrl('manufacturer_datasheet'),
//       manupage: pr.dataSourceUrl('manufacturer_product_page'),
//     };
//   });
//   return { list: () => rows };
// }
//