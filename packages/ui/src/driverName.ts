import type { DriverRaw } from '@openisd/engine';

/**
 * What a driver is CALLED on screen: `<brand> <model>`.
 *
 * A pure function of the record, so it sits below every layer that displays one — the
 * repository naming a bundled row and the shell naming the open project reach the same
 * answer because they ask the same function, not because two copies happen to agree.
 *
 * Brand leads, not manufacturer — a driver is sold, identified and filed under its brand
 * (`driverId()` and the driver database's folders both key on it), and WinISD's Save-Driver
 * defaults its filename to `<brand> <model>.wdr` for the same reason. `manufacturer` is
 * second-order: it only appears when it says something the brand does not, which means when
 * the two differ, and then it trails as context rather than leading the name.
 *
 * An explicit `name` always wins — that is the user's own label for the driver.
 */
export function driverShort(raw: DriverRaw | null | undefined): string {
  if (!raw) return 'Driver';
  const { brand, model, manufacturer, series, sku } = raw as Record<string, unknown>;

  const lead = (brand as string) || (manufacturer as string);
  const trailer = brand && manufacturer && manufacturer !== brand ? `(${manufacturer})` : '';
  const itemSku = sku ? String(sku).toUpperCase() : (model as string);

  let displayName = '';
  if (series) {
    displayName = [lead, series as string, itemSku].filter(Boolean).join(' - ').trim();
    if (trailer) displayName += ` ${trailer}`;
  } else {
    displayName = [lead, itemSku, trailer].filter(Boolean).join(' ').trim();
  }

  return ((raw.name as string) || displayName || 'Driver').replace(/\.wdr$/i, '');
}
