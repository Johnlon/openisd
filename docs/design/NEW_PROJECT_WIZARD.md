# New Project wizard — 5-step rebuild

Status: DESIGN, not yet built. Replaces the current 3-step `OgNewProject.vue`
(name → box type → manual volume) to match real WinISD's flow (screenshots in
`docs/winisd_screenshots/new_project_wizard_*.png`).

Shape ruled by John (2026-08-24): one modal, all 5 steps' controls fit inside
it, Back/Next buttons at the bottom, sequential only — no tab bar, no free
jump between steps (later steps depend on earlier answers: box-type
recommendation needs the driver's EBP; alignment needs the driver's Qts/Vas).

## Step 1 — Select driver

Embed the EXISTING driver picker (`DriverBrowserWinisd.vue` +
`driverBrowsingState.ts`) inline as this step's content — filter chips,
search, favourites, My Drivers scope, all as today. Not a tree, not a
separate modal hop-off (both ruled out — the manufacturer-tree grouping
built for this was reverted, `f1b41b6`).

- "Add New" → opens `DriverEditorModal.vue` in its existing `'myDriver'`
  create-mode (`selection.openNewDriver()`).
- "Load" → the existing `loadFromDisk()` path in `driverBrowsingState.ts:408`
  (OWDR/WDR sniffed by extension, lands in My Drivers).
- Selection held locally in the wizard's own step state until Next; the
  driver isn't committed into the live project until step 5's Create.

## Step 2 — Number of drivers + placement

- Driver count dropdown → existing domain field, `managedProject.setDriverCount()`.
- Placement radio: Normal | Iso-Barik (Compound). Iso-Barik currently has
  NO acoustic model anywhere in the engine — being probed against real
  WinISD now (does WinISD itself even compute anything different for
  Isobarik=1, or is the flag decorative?). Radio ships disabled with a
  "not yet modelled" note if the probe comes back empty/inconclusive;
  enabled once the transform is derived and implemented.

## Step 3 — Box type

- Reuse the existing box-type `<select>` (4 engine-modelled options, same
  `BOX_OPTIONS` list `OgNewProject.vue` already has).
- Illustration: `<BoxTypeDiagram :box-type="boxType" />` (`fb89bbc`, already
  landed).
- New: a "Recommended box type: <X>" label (readonly, `.opt-greyed`-style
  pattern from `OptionsModal.vue`) computed from the chosen driver's EBP
  (`ebp()`, `packages/engine/src/alignments.ts:41` — `EBP < 50` → sealed,
  `EBP > 100` → vented; the thresholds exist only as a code comment today,
  the recommendation function itself is net-new).

## Step 4 — box-type-conditional (NOT one dropdown)

Verified against real WinISD screenshots (`new_project_wizard_4_*.png`) —
step 4's content depends entirely on step 3's box type choice:

| Box type | Step 4 content | Math status |
|---|---|---|
| Sealed | Alignment dropdown: 0.577 Max flat delay response, 0.707 Max flat amplitude response *(default)*, 0.800–1.500 in 0.1 steps ("Equal ripple response") | `sealedFromQtc()` exists (`alignments.ts:48`, `Vb = Vas / ((Qtc/Qts)² − 1)`) — the named-label lookup table (Qtc → label string) is net-new but trivial |
| Vented | Alignment dropdown: **QB3 Quasi-butterworth, BB4/SBB4 (Super-)boom-box, C4/SC4 (Sub-)Chebyshev, EBS3 extended bass shelf -3dB, EBS6 extended bass shelf -6dB** | One vented formula exists (`ventedAlignment()`, `alignments.ts:74`, `Vb = 15·Vas·Qts^2.87`) — **unverified whether this IS QB3** or a generic approximation. The other 4 named alignments have no formula anywhere. All 5 need deriving/verifying against real WinISD output (same method as the isobaric probe) before this ships |
| 4th-order bandpass | Alignment dropdown: 8 combinations, passband ripple {0.00, 0.35, 1.25, 2.70} dB × passband gain {0, -3} dB | Fully net-new — a two-chamber bandpass filter-alignment table, no existing formula. Needs the same probe-and-derive treatment, likely the largest single piece of new math in this feature |
| 6th-order bandpass | **No alignment offering** — WinISD itself shows `<None available>` / "Current version of WinISD can't calculate alignments for chosen box-type". openisd matches this: step 4 shows the same disabled state, no math to build | N/A — WinISD doesn't compute this either |
| ABC | Same as 6th-order — **no alignment offering**, `<None available>` in real WinISD, openisd matches | N/A |
| Passive radiator | **Not an alignment step.** Embeds the EXISTING shared PR picker (`PRBrowser.vue` + `PREditModal.vue`) — pick a bundled/library PR, or "Add New" opens `PREditModal.vue`'s existing entry form, which already collects exactly Vas, Fs, Qms, Sd, Xmax in WinISD's own labels/units (verified: `PREditModal.vue:75-110`, converts internally to canonical Sd/Cms/Mmd/Rms via `setPrField`). Pure reuse, same pattern as step 1's driver picker — no new form | Reuse only, no new math |

**Sequencing**: ship the wizard with sealed alignment + the PR-picker variant
first (both low-risk, math/components already exist). Vented's 5 named
alignments and bandpass4's 8-combination table are their own scoped,
probe-verified follow-on work — each needs a real-WinISD probe (known
driver → each alignment choice → capture actual computed volume/tuning →
derive/confirm the formula), the same rigor already applied to the
isobaric-placement question. Until each is verified, that box type's step 4
falls back to today's manual volume entry (`OgNewProject.vue`'s existing
step-3 behaviour) rather than shipping a guessed formula.

## Step 5 — Project name + description

- `projName` (existing) + new `description` field. `state.project` already
  carries a `description` slot in its meta shape (`ProjectMeta`/
  `OpenISDProjectMeta`) — this step just exposes it, no new domain field.
- Create commits everything: `newProject()` extended to take driver,
  numDrivers, placement, computed/entered volume, name, description in one
  call — replacing today's 3-call sequence (`loadEmpty` → `setBoxVolume_m3`
  → separate driver attach after modal close) with everything set before
  the modal closes, since the driver is now chosen in-wizard (step 1)
  rather than handed off afterward.

## Build order (dependencies)

1. ~~Box-type diagram extraction~~ — done, `fb89bbc`.
2. WinISD isobaric probe — running now (`winisd_research`); gates step 2's
   real placement math.
3. Isobaric engine transform (if the probe finds a real one) + named
   alignment lookup table + EBP box-type recommendation — engine-only,
   `packages/engine/src`, no UI.
4. The wizard itself: rebuilt `OgNewProject.vue`, extended `NewProjectSpec`
   in `appState.ts`, `managedProject` wiring for driver+placement+alignment
   in one Create call.
