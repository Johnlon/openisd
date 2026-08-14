# Harness cannot detect/dismiss the FP-exception dialog on `solve-from-mms-cms`, so its golden was never captured

**Found** 2026-08-13, capturing the nine missing WinISD parity goldens.
**Severity** one of 16 parity scenarios has no oracle. 29 rows of
`packages/winisd/test/winisd-parity.test.ts` stay RED, plus the two guard tests that count
goldens and provenance rows.
**Status** OPEN, reclassified 2026-08-14 (see "Reclassified 2026-08-14" below): this is a
**harness bug** (the automation cannot see or dismiss a modal dialog during initial attach),
not an "unknown WinISD limitation" or "WinISD will not open this project." WinISD DOES open it
— a human confirmed this manually. **Left failing deliberately** — a golden is only ever
WinISD's own output, and a missing measurement is reported as missing, never substituted.

## Symptom

`python3 scripts/qo8_parity_generator.py --only solve-from-mms-cms` (winisd_research) fails on
every attempt. WinISD's process starts; its main window never becomes usable:

    attempt 1 failed: RuntimeError: agent op attach failed:
        RuntimeError: no ready window titled 'WinISD'* within 30.0s (found=True)
    attempt 2 failed: RuntimeError: no WinISD X window found (expect=(0, 0, 0, 0))

**Six attempts, three separate runs** (20:12, 20:32, 20:38 on 2026-08-13). Never once succeeded.
`found=True` on the first shape means the window exists and never reaches a ready state — the
program is hung on load, not absent.

Not a harness fault and not load-related: in the same batch, on the same wine prefix and the
same `winisd.exe` (0.7.0.0, sha256 `a7dab233…6df386ae`), the other eight scenarios captured
first-attempt in 15–23 s each, including `solve-from-q-pair`, `gap-geometry` and
`inconsistent-fs`.

## What is distinctive about this input

`packages/winisd/test/fixtures/winisd-parity/scenarios.json`, scenario `solve-from-mms-cms`:
the consistency solver in REVERSE — `Fs`, `Qes`, `Qts`, `Rms` and `Vas` are all OMITTED and
must be derived from `Mms`, `Cms`, `BL`, `Re`, `Qms` and `Sd`. It is the only scenario that
leaves `Fs` absent.

Its twin `solve-from-q-pair` — the FORWARD direction, `Qts`/`Cms`/`Mms`/`Rms`/`BL` omitted with
`Fs` present — captured cleanly at 15.4 s. So the difference between "opens" and "hangs" is
which side of the group is missing, and the absent `Fs` is the obvious suspect.

⚠ **Unverified hypothesis:** that WinISD's project loader requires `Fs` and hangs rather than
solving for it. Nothing here observed WinISD's internals — only that six loads of this file
never produced a ready window while eight loads of its siblings did. Settling it means one
probe: the same scenario with `Fs` supplied and everything else unchanged.

## Consequence for the parity suite

| | |
| --- | --- |
| goldens present | **15 of 16** |
| rows red from this cause | 29 scenario rows + `every scenario has a golden` + `provenance … covers every scenario` |

The two guard tests are doing exactly their job: they exist so a missing measurement is loud
rather than silently skipped. Neither is loosened.

## Next step, when someone picks this up

1. Author the same scenario with `Fs` present and confirm it opens — that isolates the trigger.
2. If confirmed, the reverse-solve direction is still worth an oracle: find an input shape
   WinISD will open that still leaves the reverse routes to it (e.g. omit `Vas` and `Rms` only,
   keeping `Fs`), and add it as a scenario alongside — not instead of — this one.

## Reverified 2026-08-14

Two more attempts, both against a healthy harness (confirmed by a control regeneration of
`sealed-small`, which succeeded first-attempt in 20.4s in the same session): the scenario as
committed fails identically to the six 2026-08-13 attempts. A third attempt added `Vas` back
(keeping `Fs` omitted, everything else unchanged) to test whether sparseness alone — not `Fs`
specifically — was the trigger; it failed with the same `no ready window titled 'WinISD'*
within 30.0s (found=True)` signature. This does not overturn the `Fs`-absence hypothesis (the
`Vas`-added variant still omits `Fs`), but rules out "any five-of-eleven-field input hangs
WinISD" as a broader alternative explanation. The experimental edit was reverted; `scenarios.json`
is unchanged from what this bug file already describes.

## Reclassified 2026-08-14 — WinISD opens this project; the harness cannot see the dialog

**Manual reproduction (human, interactive session, tonight):**

    wine winisd/winisd.exe runs/qo8_parity/solve-from-mms-cms.wpr

produced an **"Invalid floating point operation"** dialog with two buttons, OK and Cancel,
reading (per the human): *"Press OK to ignore and risk corruption, Cancel to kill the
program."* This is the same dialog text already logged for `BUG-002`/`BUG-004` in
`winisd_research/DISCOVERIES.md` — a Delphi/VCL floating-point trap, not something specific
to this scenario file. The human pressed **OK**. WinISD did not crash: it recovered, the
project finished loading and recalculating normally, and a subsequent **Save Project**
(toolbar Save, project already had a path so it wrote in place, no Save-As dialog) produced a
complete project file inside the wine prefix.

**This overturns the original diagnosis.** WinISD opens `solve-from-mms-cms.wpr` and produces
a normal, working state — it never "hangs" in the sense of being unresponsive. What actually
happened in all eight automated attempts (six on 2026-08-13, two more on 2026-08-14) is that
`lib/wine_control.py`'s `WineWinISD._start()` → agent `op_attach()`
(`winisd_research/lib/wine_agent.py:161`) polls only for the MAIN window's title and a stable,
populated Edit control. It never looks for a modal dialog during that initial wait. The FP
dialog is a *separate* top-level window that blocks the main form from finishing its layout
(no visible Edit control appears until it is dismissed), so `op_attach` polls forever and
times out at 30 s with `found=True` — window found, dialog blocking it, nobody ever clicking
OK. `WinISDDialog`/`require_clean()` in `wine_control.py` already detects and reports exactly
this class of modal (`#32770`/`TMessageForm`/`TForm`, see `op_dialogs()` at
`wine_agent.py:267`) — but only for actions taken AFTER a successful attach. The gap is
specifically the attach phase, which has no dialog awareness at all. The
`WinISDDied`/`WinISDDialog` docstrings' assumption that "an FP exception in a recalc is fatal
rather than a message box" is disproven for THIS trigger (a project-load recalc): here it is a
message box, and it is fully recoverable.

**The hand-captured file was located, and it is BROKEN — corrected 2026-08-14, do not use it.**
It is not inside the wine prefix at all: it is real Windows, reached via WSL2 interop at
`/mnt/c/tmp/solve-from-mms-cms1.wpr` (this repo's wine prefix fakes `C:` under
`~/.wine/drive_c`; `/mnt/c` is the actual Windows filesystem — a search of `~/.wine`,
`~/.wine32` and the rest of the Linux-side filesystem correctly found nothing, because the
file was never there). Reading it directly: only `Vas=0.0291887297703274` was computed by
WinISD (confirmed against `roo*c²*Sd²*Cms` — `roo=1.20095217714682`, `c=343.684120962153`,
`Sd=0.0132`, `Cms=0.00118092600256716` — matches to 12 significant digits). **Every other
"Computed by WinISD" field is still `0`**: `Fs=0`, `Qts=0`, `Qes=0`, `Rms=0`, `no=0`, `Dd=0`,
`EBP=0`, `SPLmax=0`, `SPLmaxLF=0`, `USPL=0`, `gamma=0`, `Rme=0`, `Mpow=0`, `Gloss=0`. And
`ParState` reads uniformly `E` across all 49 positions — including the fields sitting at `0`,
which is nonsense bookkeeping for a driver whose scenario definition never entered them.

**Reading:** this is not a completed recalc that WinISD then saved — it is a recalc
INTERRUPTED mid-pass by the FP trap, right after `Vas` succeeded and before `Fs` and
everything downstream of `Fs` was computed, saved anyway with the `ParState` marks never
corrected to reflect the incomplete state. Using this file as a golden would teach the parity
suite to expect zeros for fields that have real non-zero values in a healthy computation —
strictly worse than no golden, because it would look like a real one. **It is not used as a
golden or a fallback anywhere in this fix; it is evidence of the crash mechanism only, kept
untouched at its own path.**

**Narrowed hypothesis for the trap site** (inference from the saved state, not a confirmed
stack trace — stated as a hypothesis, not settled fact): `Vas` needs only `Sd`+`Cms` and
completed. `Fs` needs only `Mms`+`Cms` — a plain square root of two positive numbers, which
should not itself trap — and did not complete. The strongest single candidate is a field that
divides by `Fs` or `Qes` before either has been assigned a real value in WinISD's own internal
solve order: `EBP = Fs/Qes` with both still `0` is `0/0`, a genuine invalid operation under
IEEE 754 that a runtime with FP exceptions unmasked traps on rather than silently returning
NaN. This is consistent with, but does not by itself prove, why the trap fires between `Vas`
and `Fs` in this specific reverse-solve ordering.

**No hand-captured fallback is available for Task 4 under any reading of "land the golden."**
The only path to a golden is the automated harness, fixed — and only if the fixed run produces
a CLEAN, fully-computed file: every "Computed by WinISD" field genuinely non-zero and
consistent with the other 15 goldens' shape, `ParState` showing a real mix of `E`/`C`/`N`. A
partial/interrupted save is not acceptable, from either source.

**New evidence: reproduction of this scenario today was NOT consistent across attempts —
record this plainly rather than smoothing it over.** Re-running the exact same launch command
today produced THREE different outcomes across four attempts, none identical to the human's
recoverable-dialog outcome and none identical to each other:

1. `python3 scripts/qo8_parity_generator.py --only solve-from-mms-cms --force` (today,
   pre-fix baseline): both attempts failed with `RuntimeError: no WinISD X window found
   (expect=(0, 0, 0, 0))` — a different signature from the 8 previously-logged `found=True`
   timeouts. This traces to `op_attach` treating a window whose rect is genuinely `[0,0,0,0]`
   (a real edge case, not a parsing bug) as "stable," so it hands back a degenerate geometry
   that a later screenshot call then fails on.
2. Two direct launches (`wine winisd/winisd.exe runs/qo8_parity/solve-from-mms-cms.wpr`, one
   through the automation agent, one bare) both ended with the **process exiting outright**
   (`rc=40`), log tail `err:seh:dispatch_user_callback ignoring exception c000008e` /
   `err:seh:NtRaiseException Exception frame is not in stack limits => unable to dispatch
   exception.` — the exact SEH signature `wine_agent.py`'s own module docstring already
   documents as a WINE CONSTRAINT (an exception raised inside a nested/cross-process callback
   stack that wine cannot unwind, contrasted there with the same fault surviving as a message
   box on real Windows). This is the `WinISDDied` case, already handled by the harness's
   existing 2-attempt retry — but it is a THIRD distinct failure mode for the identical launch
   command, not the modal-dialog case Task 3 targets.

Read together with the human's dialog outcome and the original 8 `found=True` timeouts, this
scenario's FP trap is **racy under wine**, landing in at least three different observable
states (silent process death, a genuinely zero-sized main-window rect, or a recoverable modal)
depending on exactly when in the load sequence the floating-point trap fires relative to the
window's own layout/message pump. The dialog-detection fix below closes the specific gap Task
3 was scoped to (the modal-blocks-attach case, which is what all 8 originally-logged failures'
signature is consistent with) and adds a stale/degenerate-rect guard for outcome (1); it does
not and cannot make outcome (2) — a wine-level SEH failure, not a harness detection gap —
non-fatal, and the existing 2-attempt retry is the correct, already-in-place handling for it.
