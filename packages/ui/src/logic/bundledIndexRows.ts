/**
 * The writer side of the bundled catalogue's indexes — docs/design/BUNDLED_CATALOGUE_API.md
 * "Writer side".
 *
 * `scripts/bundle-drivers.mjs` (under vite-node) opens each corpus record as a domain object and
 * calls these to produce the row `drivers-index.json` / `passive-radiators-index.json` carry for
 * it. The row is composed from the app's own functions — `displayNameOf`, `chipsOf`,
 * `driverHasDqIssues`, `radiatorHasDqIssues`, `dataSource`, the spec fields — so the picker lists
 * off the index exactly what it would have computed from the record, and the bundler restates
 * none of it. A staleness gate holds the rows the bundler wrote against these functions.
 *
 * Figures are `.get().value` — the value the app shows, stated or solved — matching what
 * `specSummaryOf` gave the filter when the picker held domain objects. Absent stays null.
 */
import type { OpenISDDriver, OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import type { BundledDriverIndexRow, BundledPassiveRadiatorIndexRow } from '@openisd/persistence';
import { chipsOf, displayNameOf, driverHasDqIssues, radiatorHasDqIssues } from './driverDisplay.js';

export function bundledDriverIndexRowOf(driver: OpenISDDriver, path: string): BundledDriverIndexRow {
  const s = driver.spec[driver.section];
  const chips = chipsOf(driver);
  return {
    uuid: driver.uuid(),
    path,
    name: displayNameOf(driver),
    dq: driverHasDqIssues(driver),
    datasheet: driver.dataSource('manufacturer_datasheet'),
    productPage: driver.dataSource('manufacturer_product_page'),
    listingPage: driver.dataSource('manufacturer_listing_page'),
    chips: chips.types,
    canonical: chips.canonical,
    Fs_hz: s.Fs_hz.get().value,
    Sd_m2: s.Sd_m2.get().value,
    Xmax_m: s.Xmax_m.get().value,
    Vd_m3: s.Vd_m3.get().value,
    Znom_ohm: s.Znom_ohm.get().value,
  };
}

export function bundledPassiveRadiatorIndexRowOf(radiator: OpenISDPassiveRadiatorStandalone, path: string): BundledPassiveRadiatorIndexRow {
  const s = radiator.spec;
  return {
    uuid: radiator.uuid(),
    path,
    name: displayNameOf(radiator),
    dq: radiatorHasDqIssues(radiator),
    datasheet: radiator.dataSource('manufacturer_datasheet'),
    productPage: radiator.dataSource('manufacturer_product_page'),
    listingPage: radiator.dataSource('manufacturer_listing_page'),
    Fs_hz: s.Fs_hz.get().value,
    Sd_m2: s.Sd_m2.get().value,
    Xmax_m: s.Xmax_m.get().value,
    Vd_m3: s.Vd_m3.get().value,
    Mms_kg: s.Mms_kg.get().value,
    Cms_m_per_N: s.Cms_m_per_N.get().value,
    Vas_m3: s.Vas_m3.get().value,
    Qms: s.Qms.get().value,
  };
}
