/**
 * Display and search logic for one driver — what it is called, and what classification chips
 * it gets. Neither is a domain fact: `OpenISDDriver` states T/S parameters and a stated
 * `driver_type`, never a display string or a chip set, so this logic lives here rather than on
 * the driver itself (John, 2026-09-05: "this facade... it's not domain logic it's display and
 * search logic").
 */
import type { OpenISDDriver } from '@openisd/design';
import { DriverType, Chip } from '@openisd/design/filter';

/** What this driver is called on screen: `<brand> <model>`, or `'Driver'` when it states
 *  neither. Single-driver contexts (the editor, a preview pane) — a list across many drivers
 *  reads this per row, not a separate flattened field. */
export function displayNameOf(driver: OpenISDDriver): string {
  const brand = driver.brand.get().value ?? '';
  const model = driver.model.get().value ?? '';
  return [brand, model].filter(s => s.length > 0).join(' ').trim() || 'Driver';
}

// Name-based matching takes priority over T/S params.
//   sub ⊂ woofer ⊂ bass · mid-bass ⊂ woofer + mid · full-range = woofer + mid + tweet + bass
//   BMR = mid + tweet · PR = orthogonal
const TWEET_PAT     = /\btweet(er)?\b|dome.tweeter|ribbon.tweeter|\bplanar\b|\bAMT\b|air.motion/i;
const SUB_PAT       = /\bsub(woofer)?\b|sub[-_ ]/i;
const WOOFER_PAT    = /\bwoofer\b/i;
const MIDBASS_PAT   = /\bmid[-_ ]?(bass|woof(er)?)\b|\bmidbass\b/i;
const MIDRANGE_PAT  = /\bmid[-_ ]?range\b|\bmidrange\b/i;
const FULLRANGE_PAT = /\bfull[-_ ]?range\b|\bfullrange\b/i;
const BMR_PAT       = /\bBMR\b|balanced.mode/i;
const PR_PAT        = /\bpassive.radiator\b|\bP\.?R\.?\b/i;
const COAX_PAT      = /\bcoax(ial)?\b|coaxial/i;

/**
 * Classification chips for one driver — the scraper-stated `driver_type` when it names a
 * canonical `DriverType`, else the display name, else T/S parameters.
 *
 * Returns chip `.value` strings, not `Chip` members: the result is stored in a Vue ref, and the
 * reactive proxy would break `===` identity on a member held there. `.value` is the serialised
 * form, exactly as for the `driver_type` wire string.
 */
export function chipsOf(driver: OpenISDDriver): { types: string[]; canonical: string } {
  const nm = displayNameOf(driver);
  const spec = driver.spec[driver.section];
  const Fs = spec.Fs_hz.get().value;
  const Sd = spec.Sd_m2.get().value;
  const driverType = driver.recordToPersist().driver_type.value;

  const of = (t: DriverType) => ({ types: t.chips.map(c => c.value), canonical: t.display });

  // 1. The scraper-written `driver_type` is authoritative when it is a canonical
  //    DriverType — project it onto the chips the member itself carries and stop.
  //    Never compare against a bare string; DriverType.parse is the one boundary.
  const dt = DriverType.parse(driverType);
  if (dt !== null && dt !== DriverType.Unclassified) return of(dt);

  // 2. No usable driver_type — most bundled records carry `driver_type: null` — so
  //    fall back to the product name, then to T/S parameters.
  const types = new Set<Chip>();
  const canonical: string[] = [];

  if (PR_PAT.test(nm))   return of(DriverType.PassiveRadiator);
  if (COAX_PAT.test(nm)) return of(DriverType.Coaxial);

  if (TWEET_PAT.test(nm)) {
    types.add(Chip.Tweet);
    // Name-only refinement: the wire contract has no ribbon/planar member, so these
    // labels are display detail the enum deliberately does not carry.
    if (/\bAMT\b|air.motion/i.test(nm))  canonical.push(DriverType.Amt.display);
    else if (/\bribbon\b/i.test(nm))     canonical.push('Ribbon Tweeter');
    else if (/\bplanar\b/i.test(nm))     canonical.push('Planar Tweeter');
    else                                 canonical.push(DriverType.Tweeter.display);
  }
  const add = (t: DriverType) => {
    for (const c of t.chips) types.add(c);
    canonical.push(t.display);
  };
  if (SUB_PAT.test(nm))                              add(DriverType.Subwoofer);
  if (MIDBASS_PAT.test(nm))                          add(DriverType.MidBass);
  if (WOOFER_PAT.test(nm) && !MIDBASS_PAT.test(nm))  add(DriverType.Woofer);
  if (MIDRANGE_PAT.test(nm))                         add(DriverType.Midrange);
  if (FULLRANGE_PAT.test(nm))                        add(DriverType.FullRange);
  if (BMR_PAT.test(nm))                              add(DriverType.Bmr);

  if (types.size > 0) return { types: [...types].map(c => c.value), canonical: canonical.join(' / ') };

  const SdCm2 = Sd != null ? Sd * 1e4 : null;
  if (SdCm2 != null && SdCm2 < 12) return of(DriverType.Tweeter);
  if (Fs != null && Fs < 40)       return of(DriverType.Subwoofer);
  return { types: [], canonical: DriverType.Unclassified.display };
}
