# BUG_20261115_multi-coil-znom-stored-per-coil

**Status:** FIXED in T794 (`packages/design/domain/driverRecordConverter.ts`, test `packages/design/test/domain/multi-coil-goldens.test.ts`).

## Symptom
A multi-coil driver whose sheet prints the nominal impedance per coil is stored with one coil's figure, beside an Re stored for the
measured wiring. Dayton Audio MX6-22 (sheet: "All specifications measured with voice coils wired in series"): Znom printed
"2 + 2 ohms *", stored Znom 2 Ω beside Re 4.7 Ω; the product page prints 4 ohms. SB Acoustics SB34SWPL76-3-DV: Znom "2 x 3 Ω",
stored 3 Ω beside Re 5 Ω (Re "2 x 2.5 Ω" already stored for series, QO915). The catalogue health scan flags "Re above Znom".

Records (winisd_drivers snapshot, Znom readings in the per-coil form, measured wiring stated):
dayton-audio ls10-44 ("4+4 ohms"), mx10-22, mx12-22, mx15-22 ("2+2 ohms"), mx5-22, mx6-22, ss8-22, ss10-22, ss12-22, ss15-22,
ss18-22, umii8-22, umii10-22, umii12-22, umii15-22, umii18-22 ("2 + 2 ohms"), rss315ho-44 ("4+4 ohms");
sb-acoustics sb34swpl76-3-dv, sw26dac76-3-dv, sw26dbac76-3-dv ("2 x 3 Ω").
dayton-audio sd215a-88 ("8+8 ohms") has no stated wiring, so it stays as printed with the "measured wiring not stated" warning.

## Cause
`withPerCoilReForWiring` (QO915/QO919) stated only Re for the measured wiring, and recognised only the "N x r" form. Znom scales
with the wiring exactly as Re does (series N·r, parallel r/N), and the per-coil form "r + r" was not recognised for either field.

## Fix
The bridge states Re and Znom printed per coil ("N x r", or "r + r" with equal terms) for the measured wiring: series N·r,
parallel r/N, the read precision scaled the same way. Unchanged rules: numVC of 2 or more and VCCon naming the wiring are needed;
with the wiring unstated the figure stays as printed.

## Verification
`bash scripts/test.sh packages/design/test/domain/multi-coil-goldens.test.ts`: MX6-22 Znom 4 E; SB34SWPL76-3-DV Znom 6 E.
Catalogue health scan before/after over the re-projected snapshot.
