# BUG_20260824 — box losses (Ql/Qa/Qp) are one shared triple, not per-chamber like WinISD

Status: SUPERSEDED by the `packages/design` rebuild (2026-08-26) — not fixed in place, and
deliberately so. `packages/model` is being REPLACED by `packages/design`, not repaired, so
patching this defect in the old model would be work thrown away. The replacement does not carry
the defect: `packages/design` stores a `LossesJson` PER CHAMBER, and each chamber exposes only the
loss factors its own shape allows — `SealedLosses`/`VentedLosses`/`CoupledSealedLosses`/
`CoupledVentedLosses`, exactly the four live-confirmed sets below. `Qicl` has a real home.

The record below is kept for its EVIDENCE, which is not superseded — it is the only account of
what those field shapes actually are, gathered by live probe. ABC's connecting-port losses were never evidenced at all, and `packages/design` no longer
claims they exist. An early cut of it carried an `abc.intraLosses` field INFERRED from the
`Qiclfr`/`Qiclfc`/`Qiclcr` names in the `.wpr` format — but no WinISD screen shows losses for
that port, and this probe never captured an Advanced popup for it (if one exists at all). John
pointed that out on review, 2026-08-26; the field is removed. Inference from a file-format name
is not evidence that a UI field exists, and a modelled field with nothing behind it is a
fabrication. If a probe ever finds one, add it then.

## Symptom

`OpenISDBox` (`packages/model/src/openisdProject.ts:204-218`) stores exactly ONE `Ql`/`Qa`/`Qp`
triple, shared across every chamber and every alignment. WinISD's own model is per-chamber, not
shared: `packages/winisd/src/winisdProject.ts`'s `.wpr` template has separate `Qlf`/`Qaf`/`Qpf`
(front chamber) and `Qlr`/`Qar`/`Qpr` (rear chamber) triples, plus `Qiclfr`/`Qiclfc`/`Qiclcr`
(inter-chamber coupling losses) that OpenISD's model has no field for at all. A live WinISD
screenshot confirms the UI itself: the Box tab's "Advanced->" popup is headed **"Rear chamber"**
and shows `Ql`/`Qa`/`Qp`/`Qicl` scoped to that one chamber — a bandpass box would show a second,
independent popup for the front chamber.

The existing code already half-admits the simplification — a comment at
`openisdProject.ts` (`toWinISDProject()`, near the `.wpr` `Box` section assembly):
*"ONE loss triple describes the enclosure; the file wants one per chamber, so both chambers are
written from it rather than one discarding the user's losses."* That's a deliberate workaround,
not a fix — it means a bandpass4 project's front and rear chambers are FORCED to share identical
loss values on export, when WinISD itself lets them differ, and there is no way to state
`Qicl` (inter-chamber coupling) at all.

John, confirming mid-conversation: "it depends on box type and chamber" — i.e. losses are not a
box-level or even alignment-level concept, they're per-CHAMBER, and which chambers exist depends
on the box type (sealed/vented/PR have one chamber; bandpass4 has two, rear and front, plus the
coupling between them).

## Why it matters

- A bandpass4 (or future bandpass6/ABC) project cannot currently express different damping in its
  two chambers, even though that's a real, common design choice WinISD supports.
- `.wpr` export currently writes the SAME Ql/Qa/Qp into both `Qlf/Qaf/Qpf` and `Qlr/Qar/Qpr` —
  correct only by coincidence when a user hasn't set them differently in WinISD; a `.wpr` IMPORTED
  from WinISD with genuinely different front/rear losses would lose that distinction on the way
  in (need to verify the import path's actual behavior — not yet checked as part of this bug).
- `Qicl` (inter-chamber coupling loss) has no home in the model at all — not a missing UI control,
  a missing FIELD.

## Scope of the fix

Not yet executed. `OpenISDBox`'s single `Ql`/`Qa`/`Qp` needs to become per-chamber, matching which
chambers each alignment actually has: sealed/vented/passive-radiator each have one chamber (their
own loss triple); bandpass4 needs a rear triple, a front triple, and an inter-chamber coupling
value. This affects the model (`OpenISDProject`), the `.wpr` writer/reader (`packages/winisd`),
and the target `ManagedOpenISDProject` API design in `docs/design/ENCAPSULATION_AND_LAYERING.md`
(currently sketching a single `losses` namespace, which this bug supersedes — losses need to nest
per-chamber inside each alignment, not sit as one project-wide triple).

## Evidence — CONFIRMED, live-captured against real WinISD 0.7.0.950 under wine (2026-08-24/25)

Driven end-to-end via `winisd_research/lib/wine_control.py`'s `WineWinISD` harness against
each of the four golden `.wpr` fixtures in
`packages/winisd/test/fixtures/winisd-parity/goldens/`. Screenshots filed at
`docs/winisd_screenshots/box_advanced_*.png`. The complete, definitive per-chamber loss shape:

| box type              | chamber | fields                    |
| ---------------------- | ------- | -------------------------- |
| sealed                 | rear    | `Ql`, `Qa`                 |
| vented                 | rear    | `Ql`, `Qa`, `Qp`           |
| passive-radiator       | rear    | `Ql`, `Qa`                 |
| bandpass4              | rear    | `Ql`, `Qa`, `Qicl`         |
| bandpass4              | front   | `Ql`, `Qa`, `Qp`, `Qicl`   |
| 6th-order bandpass     | rear    | `Ql`, `Qa`, `Qp`, `Qicl`   |
| 6th-order bandpass     | front   | `Ql`, `Qa`, `Qp`, `Qicl`   |
| ABC                    | rear    | `Ql`, `Qa`, `Qp`, `Qicl`   |
| ABC                    | front   | `Ql`, `Qa`, `Qp`, `Qicl`   |
| ABC                    | intra   | not directly captured — see below |

### 6th-order bandpass and ABC (2026-08-25) — driven live through the New Project wizard

Neither has a golden `.wpr` fixture in this repo (confirmed: `openisdProject.ts`'s own comment
already said "6th-order bandpass and ABC are not here: neither exists in the codebase"), so both
were built from scratch via the wizard: `toolbar('new')` → Load a real `.wdr`
(`docs/winisd_screenshots/sample_drive_Dayton_Audio_Epique_E150HE-44.wdr`) → the box-type combo
(`LCLComboBox`, items `['Closed', 'Vented', '4th order bandpass', '6th order bandpass',
'Passive Radiator', 'ABC']`, selected via click + Home + Down×N + Enter, NOT by typing — this
combo does not respond to `set_field_by_typing`) → Next → name → Create.

**WinISD's own wizard says, for 6th-order (and presumably ABC): "Current version of WinISD can't
calculate alignments for chosen box-type."** Clicking Next past that warning anyway still creates
a working project with a real, sane transfer-function graph — the warning means no ONE-CLICK
alignment SUGGESTION exists for this box type (the QB3-style helper), not that the box type is
unusable.

**6th-order bandpass has TWO independently-tunable VENTED chambers** — unlike 4th-order, where
the rear chamber is sealed (no `Tuning freq.` field, just a read-only `Frc`), 6th-order's Box tab
shows "Tuning freq." as a live blue (Entered) field on BOTH rear and front
(`docs/winisd_screenshots/box_tab_bandpass6.png`). Confirmed both chambers carry the full
4-field loss set (`Ql`, `Qa`, `Qp`, `Qicl`) — `Qp` now applies to rear too, since it has a real
port in this alignment.

**ABC has THREE vents, not two — confirmed directly, resolving QO85's "how many ports" question.**
The Box tab itself looks identical to 6th-order's (Rear chamber / Front chamber, same
volumes/tunings, no third volume field anywhere), but the **Vents tab**
(`docs/winisd_screenshots/vents_tab_abc_three_ports.png`) shows THREE columns: "Rear chamber",
"Front chamber", AND **"Intrachamber"** — each with its own Number/Shape/Vent diameter/Vent
length/End Correction/Cross area/1st port resonance. Intrachamber's vent is notably short
(length 0.050m vs rear's 0.591m / front's 1.881m) — consistent with a coupling port between two
adjacent spaces, but that alone doesn't prove or disprove a separate third air volume.

**RESOLVED, authoritatively (John, 2026-08-25): TWO chambers, not three.** "Aperiodic
BI-Chamber" — the name itself says two. ABC has rear and front chambers only (same as
bandpass6), plus a THIRD PORT connecting the two chambers directly — "Intrachamber" in the
Vents tab UI names that connecting port, not a third air volume. So: rear has its own port to
outside air, front has its own port to outside air, and a third port joins rear to front
directly. This matches the earlier observation that no Box-tab volume field for an "intra"
space was ever found — there isn't one, because there's no third chamber to have one.

Still open: the connecting port's own loss shape. A port CONNECTING two chambers isn't itself
an enclosed air volume the way rear/front are, so whether it genuinely has `Qa` (absorption —
a property of a volume) alongside `Ql`/`Qp`/`Qicl`, or a narrower set, is unconfirmed — its own
Advanced-style popup (if one exists) was not captured before this session's time budget ran out.

The pattern is exactly "does this chamber have a port": sealed and PR have no port on their one
chamber → no `Qp`. Vented's one chamber has a port → `Qp`. Bandpass4's rear chamber is sealed
(no port) but coupled to the front → `Ql`/`Qa`/`Qicl`, no `Qp`. Bandpass4's front chamber has
the port AND the coupling → all four fields. `Qicl` appears on BOTH bandpass4 popups (same
value, read/written from either chamber's popup — not independently observed which one is
authoritative in the `.wpr`, matches `packages/winisd/src/winisdProject.ts`'s `Qiclfr`/`Qiclfc`/
`Qiclcr` naming, which suggests up to three distinct coupling terms exist in the file format
beyond what a 4th-order box's two-chamber UI exposes — 6th-order/ABC territory, not resolved
here).

Also confirmed live: the official WinISD help image
(`docs/winisd_helpfiles/help/boxdes05.png`, a vented box) shows BOTH "Rear chamber" and "Front
chamber" buttons even on a single-chamber vented box — front sits present-but-inert in the UI,
matching `OpenISDBox`'s own already-dormant-storage pattern. Bandpass4 is different again: BOTH
chambers' full field sets (Volume, Tuning, Advanced->) render simultaneously with no chamber
selector needed — confirmed via a direct client-area capture at
`docs/winisd_screenshots/box_advanced_bandpass4_front.png`'s companion full-panel shot.

**Harness gotchas hit and fixed while gathering this** (now documented in
`winisd_research/WINE_HARNESS.md` for the next probe): `scrot`/any composited-desktop capture
tool produces a pure black image on this RDP-backed X display — `xwd` (already used by the
harness's own `wine_screen.py`) is the only capture path that works here. A manual `pkill -f`
combining two process-name patterns can self-match its own invocation and get refused by a
safety wrapper, silently aborting the whole calling script — not needed anyway, since
`WineWinISD`'s own `_kill_stale_processes()` already handles this internally. The untitled
Advanced popup menu isn't found by `wine_screen`'s normal title-based lookup — it has to be
located via `xwininfo -root -tree`, matched by SIZE (144-146px wide) not title, and its exact X
window id passed straight to `Capture.grab(window_id=...)`. The main window has to be
`move_window()`ed to the screen's top-left before any of this — left at its default off-screen
position, popup menus render (and get reported) past the visible/capturable screen area
entirely.

## Also fixed while probing: the harness's Options/Environment setter is now file-based, not UI-driven

`WineWinISD._start()` previously drove the Options dialog (open, wait, type T/RH/AP, read a
live-computed `c` label, click OK) on every single session launch — slow, and the exact UI path
that produced a flaky mid-typing failure during this probe (2026-08-24, a `set_field_by_typing`
character-confirmation timeout). Replaced with `write_environment_settings()`, which writes
`~/.wine32/drive_c/users/john/Documents/WinISD/settings/settings.ini`'s
`[Settings.Environment]` section directly before launch — the file winisd.exe actually reads at
process start (confirmed: `Humidy` is WinISD's own spelling, and is stored as a FRACTION there,
unlike the harness's own percent-based `Options`/`set_options_via_ui`). The old UI-driven
methods are kept as `set_options_via_ui()`/`reset_options_to_factory_via_ui()` for the one case
that still needs them: a probe wanting WinISD's own live-read `c` at NON-reference conditions,
where no closed-form reproduction of WinISD's internal calculation is known to exist (matches
`packages/engine/src/air.ts`'s own docstring on this point exactly — `_start()`'s new default
uses the same anchored-ratio approximation that file's `winisdAir()` uses, exact only at the
factory reference point).

## Origin

Found 2026-08-24 while designing `ManagedOpenISDProject`'s target API and checking a live WinISD
screenshot to verify where `Ql`/`Qa`/`Qp` belong.
