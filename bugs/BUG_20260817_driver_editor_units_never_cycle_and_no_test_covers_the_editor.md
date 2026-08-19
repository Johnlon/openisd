# Driver editor unit labels never cycle, and no test covers them

# Status
OPEN

## Symptom

In the driver editor (Driver tab → Edit), clicking a unit label does nothing. Every unit on
every tab is fixed text: `mm` stays `mm`, `cm³` stays `cm³`, `L` stays `L`. In the Original
shell's own panes the same click rotates the unit and converts the value.

## Evidence

Live probe against the running app (chromium, `localhost:4100`), clicking the unit span of
every `.de-fld` on each editor tab and comparing the label before/after:

| tab | fields with a unit span | cycled |
|---|---|---|
| Parameters | 22 (Fs, Vas, Mms, Cms, Rms, Re, BL, Dd, Le, Sd, fLe, KLe, Xmax, Hc, Hg, Vd, Xlim, Pe, no, Znom, USPL, SPL) | 0 |
| Advanced parameters | 13 (AlfaVC, R(t), C(t), SPLmaxLF, SPLmax, Rme, gamma, Mpow, Mcost, EBP, Gloss, c, roo) | 0 |
| Dimensions | 8 (Thick, Depth, Magnet Depth, Magnet, Basket, Outer, VCd, Dvol) | 0 |

The same probe over the Original shell's tabs: Vb `L → cu ft → cu in`, Fb `Hz → kHz`, vent
diameter/length `cm → mm`, cross area `m² → in²`, temp `K → °C`, pressure `Pa → kPa`, added
mass `g → kg`, AlfaVC `1000/K → %/K` — all cycle and all convert.

## Cause

The editor never adopted the unit system. `packages/ui/src/ui/components/DriverEditorModal.vue`
renders each unit as a plain `<span class="u">mm</span>` with a hardcoded `:scale` on the paired
`NumInput` (e.g. `:scale="1000"` at line 621 for Hc, `:scale="1e6"` at line 785 for Dvol). No
`UnitToggle` is imported anywhere in the file, and `NumInput`'s unit binding (`group` + `field` +
`base`, `NumInput.vue:35`) is never supplied, so the component stays on its fixed-`scale` path.

`git log -S UnitToggle -- packages/ui/src/ui/components/DriverEditorModal.vue` is empty: the
conversion work in `9506df0` ("real per-field unit conversion (Original skin)") wired the
Original shell only.

The same holds for `PREditModal.vue` (lines 73-98) and `PRDefineModal.vue` (lines 68-93).

## Why no test caught it

`original-skin.browser.spec.ts` covers cycling for four Original-shell fields (Vb L→cu ft, port
resonance Hz→kHz, added mass g→kg, temperature K→°C). Nothing asserts anything about a unit
label inside the editor, and no test asserts a field's DEFAULT unit anywhere — a field could
silently open in the wrong unit and every suite would stay green.

## Fix

1. Bind the editor's unit-bearing fields to the unit registry (`group` + `field` + `base` on
   `NumInput`, paired `UnitToggle`), so the label rotates and the value converts while the store
   stays SI.
2. Defaults are pinned, not inherited from the group: every length on the mechanical/dimensions
   fields opens in **mm** (the `length` group's canonical default is cm), and Dvol opens in
   **cm³** (the `volume` group's canonical default is L). Requires a `cm3` unit in the `volume`
   group of `packages/ui/src/logic/fields/units.ts`, which currently offers L / cu ft / cu in only.
3. A browser spec that asserts, per field, the default unit AND that one click converts the
   displayed value by exactly the registry factor while the stored SI value is unchanged.

## Verification

`packages/ui/test/ui/driver-editor-unit-cycling.browser.spec.ts` — red before the change (the
label does not rotate), green after.
