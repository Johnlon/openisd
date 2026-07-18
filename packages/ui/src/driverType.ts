// CANONICAL driver_type value set for the OpenISD UI.
//
// This enum's VALUES (the kebab-case wire strings) MUST stay identical to the
// Python `DriverType` enum in the sibling winisd_tools repo
// (`scrapers/scrapers/driver_type.py`). Parity is enforced by winisd_tools'
// `scrapers/tests/test_driver_type_enum_parity.py`, which reads this file and
// hard-fails if the value set differs. Editing either enum REQUIRES editing the
// other in the same change (see CLAUDE.md "driver-type enum parity").
//
// The values are the on-disk `driver_type` written to `_meta.yml`; the member
// NAMES (PascalCase) are a TS convenience and are NOT part of the contract. The
// UI chip set (bass/sub/woofer/mid/tweet/…) is a SEPARATE, many-to-many
// projection of these — see classifyTypes() in DriverBrowser.vue and
// drivers/DRIVER_TYPES.md.
export enum DriverType {
  Woofer = 'woofer',
  Subwoofer = 'subwoofer',
  Midrange = 'midrange',
  MidBass = 'mid-bass',
  MidWoofer = 'mid-woofer',
  FullRange = 'full-range',
  Bmr = 'bmr',
  Coaxial = 'coaxial',
  Tweeter = 'tweeter',
  Amt = 'amt',
  PassiveRadiator = 'passive-radiator',
  // NOTE: `compression`, `horn`, `waveguide` are deliberately absent — compression
  // (horn-loaded) drivers are not box/T-S-modellable and bare horns/waveguides are
  // passive accessories. All are filtered out at discovery. See
  // drivers/DRIVER_TYPES.md "NOT drivers — accessories". Keep in sync with the
  // Python enum (parity test).
  Unclassified = 'unclassified',
}
