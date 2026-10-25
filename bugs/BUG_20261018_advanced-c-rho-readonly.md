# BUG_20261018_advanced-c-rho-readonly

**Status:** RESOLVED (T420, 18 Oct 2026)

Recorded 18 Oct 2026. John, 17 Oct: "win isd has c and roo, these must be C or E values in openisd"; "who decided to make c roo ReadonlyField".

## Symptom
On the Advanced tab (desktop and phone), Sound velocity and Air density are grey read-only boxes. The user cannot type a value for either. Temperature, humidity and pressure beside them can be typed.

## Evidence
- `OriginalShell.vue` and `MobileAdvancedTab.vue` render both as `UIFixedField ... readonly` fed from `advAir.c` / `advAir.rho` (T361, d3dcc245).
- Since T375 (3b5bafe6) the project holds five air fields, each Entered or Calculated (`envC_m_per_s`, `envRoo_kg_per_m3` are the same `AirField` as `envTempK`), so a typed c or rho is supported by the model.
- WinISD lets the user enter c and rho.

## Cause
T361 turned the two rows into read-only readouts before T375 made c and rho entered-or-calculated fields. The rows were never switched back to the editable field row used by the other air fields.

## Fix
Done: render c and rho on the Advanced tab (both shells) with the same editable settling field row as temperature, humidity and pressure, wired to the project's c and rho air fields (typed = Entered, cleared = Calculated).

## Verification
- Done, red before / green after: browser specs (desktop and phone): type a Sound velocity and an Air density; each shows as Entered and the other derived values follow; clearing returns it to Calculated. `original-advanced-tab` and `mobile-advanced-tab` specs pass; the old "two read-only inputs" assertion now expects none.
- Baselines retaken: desktop-tab-advanced, mobile-tab-advanced.
