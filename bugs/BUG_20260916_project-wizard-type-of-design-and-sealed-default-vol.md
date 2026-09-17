# BUG 20260916 — project wizard does not walk the WinISD "Type of Design" flow (nor ask driver count/EBP vs isobaric); and it ships a typed default volume instead of deriving one for sealed

Status: OPEN — record only, no fix this pass (human: "just record the bug for now")
Raised: 2026-09-16
Human term correction applied: WinISD calls the step **"Type of Design"**, NOT "alignment".
WinISD's "Type of Design" step shows (verbatim human observation): the **box type dropdown**,
the **EBP recommendation bar graph** — **Vented/BP6th at top → Closed/BP4th at the bottom** — and
a bar graph on the right. Use "Type of Design" and "EBP bar" in every future test/locator.

## The WinISD wizard walk (human verbatim intent, the parity target)

1. **pick the driver** (browser / Favorites / driver list)
2. **pick number of drivers and normal vs isobaric**
3. **"Type of Design"** — default offered is *vented*; the human overrode to **closed / sealed**
4. the sealed flow then asked the **alignment** with default **0.707**
5. **OK** → lands in the project showing **vol 4.9L, Fs 45, Qtc 0.704**

openisd's wizard (`packages/ui/src/ui/shells/original/OgNewProject.vue`) does not walk that
multi-step sequence and shows no EBP bar; today it also ships a **typed default volume**. The human
ruled: for a **sealed** enclosure the volume is a derived OUTPUT of the alignment (`Qtc ≈ 0.707`),
never a typed default. Same blunder class as BUG_20260916_signal-pane-blur-must-notify: presenting
a DERIVED quantity as an entered one.

## Verified against your existing sealed golden (the numbers AGREE — the bug is the FLOW, not the math)

| Human saw (sealed, driver = w5-1138smf, size 6L) | openisd golden (sealed-readout-wine golden) | match |
|---|---|---|
| Qtc `0.704` | Qtc `0.704` | ✔ same law law mLawBuild: alignment → sealed → 0.707 → derive vol |
| vol `4.9 L` | `4.899 L` | ✔ 4.9 → 4.899 |
| Fs `45` | Fs `45` | ✔ |

The sealed pane then derives P from V and Re via `P = V²/Re` (and V from P and Re via `V = √(P·Re)`).
Default 1 W lives behind the scene — the blank readout is the Signal-pane blur notification defect,
bug site §2 of BUG_20260916_signal-pane-blur-must-notify. That bug file and this one are separate
files; they share the drive-law excerpt, deliberately cross-referenced.

## Test truth — is there a test asserting per-tab display values for a new sealed project today?

**NO.** The only new-project specs on disk assert *structure* — `wizard-defaults.browser.spec.ts`
asserts "builds a chart for every simulatable box type" and "the PR project has a radiator / the
vented has a diameter and tuning". NO spec asserts the per-tab DISPLAY VALUES on the sealed tab
for w5-1138smf + 6L (the display assertion the human asks about does not exist). This is the gap;
the creed: a test may assert a default only if it states explicitly that it verifies the default.
No display-value spec to repair — but the sealed-tab display assertion is MISSING and must be the
next red test.

## Notes

- 2026-09-16: recorded per human "just record the bug for now" (no fix, no source change).
- The wizard's EBP bar is a REAL WinISD feature the human described (Vented/BP6th top,
  Closed/BP4th bottom + right-side bar graph). openisd has neither the EBP bar nor the
  driver-count / normal-vs-isobaric step — record-only this pass.

## Next action (exactly one)

Add the red display-value test: after wizard-sealed project for w5-1138smf + size 6L, switch to
the Sealed tab, assert Qtc = 0.704 (not assumption) and V derives from P and Re on the sealed
pane (blur notify). Run it against the CURRENT code — it must FAIL (red). No source change yet.
