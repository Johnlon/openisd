import type { DriverRaw } from '@openisd/engine';

// "My Drivers" — the user's own saved drivers, a bucket of its own in browser storage.
// THE one place that knows the storage key and its shape, and THE one write path: every
// route that creates a user driver (Add new, Clone, Load File, Save-and-reload) ends in
// `upsertMyDriver`, so there is exactly one rule for what saving means.
//
// IDENTITY is `<brand>/<model-slug>` — the same scheme the driver database uses on disk
// (`dayton-audio/pro-8`), so a saved driver and a database driver are named the same way.
// Brand, not manufacturer: WinISD's Save-Driver defaults to `<brand> <model>.wdr`, and
// brand is what the user recognises. `manufacturer` is second-order, descriptive only.
//
// A rename IS a new identity. Editing a driver's brand or model and saving therefore writes
// a DIFFERENT driver, which is what makes Clone ("Copy of …") the deliberate way to fork one.
// Nothing here is written by editing a project: a project embeds its own copy of a driver,
// so only an explicit save reaches this bucket.

export const MY_DRIVERS_KEY = 'openisd_my_drivers';

/**
 * A driver's identity: `<brand>/<model>`, lowercased and slugged. Empty when the driver
 * carries neither a brand nor a model — an unidentifiable driver, which callers must not
 * treat as equal to any other.
 */
export function driverId(d: DriverRaw): string {
  const slug = (s: string | undefined) =>
    (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const brand = slug(d.brand);
  const model = slug(d.model);
  if (!brand && !model) return '';
  return `${brand}/${model}`;
}

export function loadMyDrivers(): DriverRaw[] {
  try { return JSON.parse(localStorage.getItem(MY_DRIVERS_KEY) ?? '[]'); } catch { return []; }
}

export function saveMyDrivers(list: DriverRaw[]): void {
  try { localStorage.setItem(MY_DRIVERS_KEY, JSON.stringify(list)); } catch { /* storage disabled/full — non-fatal */ }
}

/**
 * Save one driver into My Drivers. It overwrites the entry already holding the resulting
 * `<brand>/<model>` identity, and adds one when none does — a driver IS its identity, so
 * saving under a name that is already taken means saving THAT driver, not a twin of it.
 *
 * Returns true when an existing entry was overwritten, false when one was added.
 */
export function upsertMyDriver(d: DriverRaw): boolean {
  const entry = { ...d };
  const id = driverId(entry);
  const list = loadMyDrivers();
  const idx = id ? list.findIndex(x => driverId(x) === id) : -1;
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveMyDrivers(list);
  return idx >= 0;
}

/** Remove the saved driver with this identity. Returns true when one was removed. */
export function removeMyDriver(id: string): boolean {
  if (!id) return false;   // unidentifiable driver: refuse rather than delete an arbitrary row
  const list = loadMyDrivers();
  const kept = list.filter(d => driverId(d) !== id);
  if (kept.length === list.length) return false;
  saveMyDrivers(kept);
  return true;
}
