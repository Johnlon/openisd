# ParState findings — from sample WDR experiments

> **WARNING — position data in this file is OUTDATED and WRONG.**
>
> The per-field positions listed in the "fixed slots" tables below were derived from
> multi-parameter comparisons and the WinISD.exe binary string table. That analysis
> had multiple errors. The correct position map is in **README.md** and was confirmed
> via single-parameter probe files (`s_*.wdr`) in this directory.
>
> The _behavioural_ findings (E/C/N semantics, cascade rules, ParState length,
> ParState ≠ WDR key order) are still correct and are preserved below.

---

Original files used in the first phase of analysis:

| File                               | Scenario                                                                        |
|------------------------------------|---------------------------------------------------------------------------------|
| `john all defaults.wdr`            | Nothing entered — only Brand/Model/Comment set                                  |
| `John all-manu-populated.wdr`      | All fields that showed black (enterable) were manually filled with dummy values |
| `John all-manu-populated-init.wdr` | Same as above (intermediate save)                                               |
| `John all-manu-populated-ex.wdr`   | Same as above, then Fs and Qms knocked out, Xmax and xlim deleted               |
| `john all set.wdr`                 | User typed sequential values (1…n) into every field visible in WinISD's UI      |

## What the three characters mean

| Char  | Meaning |
|-------|---------|
| **E** | User explicitly entered this value in WinISD |
| **C** | WinISD calculated/derived this from other entered (E) fields |
| **N** | Not in play — field was never entered, was explicitly cleared, or was cascade-disabled |

## Key findings

### Zero does NOT imply N, and N does NOT imply zero

- `Fs=0, ParState[Fs]=E` — user "knocked out" Fs by entering 0; WinISD still considers it entered.
- `Cms=0, ParState[Cms]=C` — WinISD computed 0 because its inputs were broken; still C.
- `Znom=8, ParState[Znom]=N` — Znom retained its value (8) but was cascade-disabled when Fs was
  knocked out.
- `c=343.684, ParState[c]=N` — speed of sound is always non-zero but always N; it is a constant,
  not an active parameter.

### ParState is a fixed 49-slot table mapped to WinISD's internal parameter list

Checked across all collections in this repo:

| Collection      | Fields written to file | ParState length |
| --------------- | ----------------------- | ---------------- |
| winisd, sample  | 48                      | 49                |
| matt            | 18–20                   | 49                |

ParState is **always exactly 49 chars**, but different WDR sources write very different
numbers of Key=Value fields. This means ParState does **not** map 1:1 to the lines in the
file — it maps to **WinISD's fixed internal 49-parameter list**, which is the same
regardless of what is in the file.

The WDR file writes a Key=Value line for each parameter it knows about. A `matt` file writing
18 fields still produces a 49-char ParState because WinISD fills in the state for all 49
internal slots. The 31 slots with no corresponding Key=Value line in the file are still
accounted for in ParState — they just have no persisted value.

The earlier per-position analysis (field 1 → ParState[0], field 2 → ParState[1], …)
was approximately correct for full winisd-format files because those files write fields
in the same order as WinISD's internal list and cover 48 of the 49 slots. It would give
wrong mappings for short files.

### Blank driver (nothing entered)

Nearly all fields are N. The three exceptions:

- **`numVC` (position 24) = E** — always E even in a blank file, value defaulting to 1. However,
  the WinISD UI shows the Voicecoils field as **grey / not available** even when you type into it
  — it never turns green (entered) or blue (calculated). The help file confirms it is a purely
  descriptive parameter ("it just tells how many voicecoils there are") that plays no role in the
  simulation. Its E state in ParState therefore does **not** mean "user entered via the normal
  T/S workflow" — it appears to be a hardcoded initialisation. ⚠ Contradicts the simple
  E=entered model; treat numVC's E as a special case.
- **`DVol` (position 48) = C** — permanently treated as a calculated output.
- **`Vcd` (position 47) = N always** — still N even when user types a value; permanently
  display-only like `no`.
- **Position 49 = C in blank/populated drivers, E when user fills everything** — the full WDR
  format writes 48 fields as key=value lines; position 49 has no corresponding line. WinISD
  tracks this 49th parameter internally but never serialises its value to disk. ⚠ Unverified —
  the true identity of this slot is unknown.

### Permanently fixed slots (regardless of driver data)

Two fields are **permanently N no matter what value is entered** — WinISD accepts and stores
values for both, but never promotes either to E or C:

| Position | Field | Why always N |
|----------|-------|--------------|
| 21       | `no`  | Reference efficiency η₀ — **UI accepts input in %**, stored in WDR as a fraction (÷100): entering 123% stores 1.23. Despite this, ParState position 21 is **always N** even when explicitly entered — WinISD stores the value but never promotes it to E or C. It sits permanently outside the dependency graph. |
| 47       | `Vcd` | Voice coil displacement volume — still N even when explicitly set to 77; display-only |

**`c` and `roo` are conditionally N** — they remain N when only T/S parameters are entered,
but flip to E when the physical dimensions block (Thick, Depth, MagDepth, Magnet, Basket,
Outer) is populated. They become active only when the full geometry model is engaged.
Note that their *values* did not change when they flipped — the flip was triggered by the
presence of the other geometry fields, not by typing new values into `c`/`roo` themselves.

**Physical dimensions (Thick, Depth, MagDepth, Magnet, Basket, Outer)** are N when zero /
unpopulated, and flip to E when the user enters values — normal enterable fields.

Other permanent behaviours (when nothing is entered):

| Position | Field       | Always                                                      |
|----------|-------------|-------------------------------------------------------------|
| 24       | `numVC`     | E — WinISD initialises to 1 and marks it entered by default |
| 48       | `DVol`      | C when calculated, E if user touches it                     |
| 49       | *(phantom)* | C when nothing entered; E when user fills everything        |

`alfaVC`, `Rt`, `Ct` (thermal params) default to N but become E if the user explicitly enters
them. `VCCon` defaults to N, becomes C when WinISD populates it alongside other fields, becomes
E when explicitly set.

### E→N cascade when a dependency is knocked out

When Fs was disabled, `Znom` flipped from E to N even though its stored value (8) did not change.
WinISD propagates the "not active" state through its dependency graph.

### E→C when a field switches from entered to calculated

When Qms was "knocked out", WinISD recalculated it as −1.5 and changed its ParState from E to C.
The field went from being a primary input to a derived output.

### ParState char is the *intent*, not a guarantee the value is the one you typed

In `john all set.wdr`, many fields show E even though WinISD silently replaced the typed value
with its own calculated result (e.g. Vas stayed at 0.141… despite the user typing a different
number; Re became 6084 from WinISD's internal maths). The E flag records that the user *attempted*
to enter the field — not that WinISD accepted the typed value unchanged.

## Implication for scraped / exported files

The `ParState` in WDR files from loudspeakerdatabase.com and other scrapers is a fixed
template string copied from a reference file. It does **not** reflect the actual
entry/calculation state of the parameters in that specific driver. This is harmless for
OpenISD (which re-derives all T/S parameters from scratch on import), but means the
ParState in scraped files carries no information about which values were measured vs derived.

## WinISD save bugs

Defects in WinISD's own writer, established by probe. They matter because OpenISD writes `.wdr`
files WinISD must read, so each one is a behaviour to REPRODUCE, not to improve on: a "fix" on
our side produces a file WinISD does not.

### Xlim is offered in the UI and never written to the file

WinISD's driver panel accepts Xlim. Saving sets its ParState slot and **discards the value**.

Probe pair, differing in exactly one respect:

| file                            | what was done          | key written | slot 10 |
|---------------------------------|------------------------|-------------|---------|
| `winisd/s-xlim-not-entered.wdr` | nothing entered        | none        | `N`     |
| `winisd/s-xlim-123.wdr`         | Xlim set to 123, saved | **none**    | `E`     |

Every numeric line in `s-xlim-123.wdr` is still `0`, and no `Xlim=` line exists anywhere in it.
Its own comment records the observation: *"Xlim Entered = 123 but does not save to file - it may
set the ParState flag"*.

Compare `s-fs.wdr`, the same experiment on a field that works: Fs typed in gives `Fs=123` AND
slot 1 = `E`. So the mark is written for Xlim exactly as for any other field; only the value
line is missing.

Slot 10 therefore claims a value was entered that the file does not contain, and any reader —
WinISD included — sees `E` with nothing to back it.

**What OpenISD does:** writes no `Xlim=` line, and round-trips the slot-10 mark. `.wdr` has no
extension mechanism, so inventing the line would produce a key WinISD cannot read: dropped the
moment WinISD saves over the file, while the mark goes on claiming a value. It would also break
the byte comparison against WinISD's own output that the projection work is checked by.
`openisd.yml` holds Xlim's value, and is not lossy.

Gated by `packages/winisd/test/wdr-round-trip.test.ts` §"an Xlim= line is not part of the
format".

### Number formatting is renormalised on save

`inconsistency-test.wdr` (hand-authored) states `Qts=0.500` and `Dd=0.200`.
`inconsistency-test-saved.wdr` is that file after a WinISD load-and-save: `Qts=0.5`, `Dd=0.2`,
everything else byte-identical including the full ParState. Not a bug, but it is why a
comparison of entered values must be NUMERIC — a byte comparison fails on WinISD's own
formatting while catching no actual loss.

### Slots 20 and 46 are `Dia` and `VCCon`, and they survive a save untouched

The same load-and-save preserved `E` in both. They were long unidentified because black-box
probing cannot reach either — `Dia`'s control is invisible, and **no instruction anywhere in
`.text` writes slot 46 at all**, so it only ever holds the `N` from a blank driver's `FillChar`
or whatever a loaded file supplied. Both were recovered by decompiling `winisd.exe`
(`winisd_research/PARSTATE_DECOMPILED.md`).

They are ordinary mapped keys now: `POS_TO_WDRKEY` names them, `fromWdr` reads each mark from
its own slot, and `toWdr` writes it back from the cell. The as-read ParState no longer has to be
retained to echo them.

### `c` and `roo` are DRIVER fields, and `.wpr` confirms it

WinISD offers the speed of sound and air density for editing on the driver and saves what is
typed. They are not constants it stamps on the way out.

`docs/winisd/sample_project_Epique15_-_pr.wpr` puts them at lines 53-54 — **inside the
`[Driver]` section** (lines 7-64), not in `[ProjectInfo]`, `[SimulatorOptions]` or any other
project-level section. So both file formats agree they belong to the driver.

What they MEAN per-driver is not documented in anything held here. The plausible reading is the
conditions that driver's figures were measured or computed at, which would make them provenance
rather than simulation input — but that is a hypothesis, and nothing in the WinISD material in
`docs/winisd/` states it. Not resolved.

OpenISD holds them on the driver record (`SpecSection.c` / `.roo`) because that is where the
formats put them, and separately on `OpenISDEnvironment` for the PROJECT, which is what a
simulation actually runs on.

### The Xlim save bug is not `.wdr`-specific

`sample_project_Epique15_-_pr.wpr` carries no `Xlim=` key in its `[Driver]` section either. That
sample's ParState has slot 10 = `N`, so Xlim was never entered in it and this is not a positive
test of the `.wpr` writer — but the key is absent from both formats, and no probe yet exists
that enters Xlim and saves a PROJECT. Worth running if the `.wpr` path ever needs to carry it.

### `Dia` cannot be entered in the UI, but WinISD preserves one that is already there

`Dia` is written to every `.wdr` — as `0`, because WinISD's driver panel offers no field for it.
So under normal use the key exists and can never be anything but zero.

It is NOT inert, though. `s-dia-roundtrip-123.wdr` carries `Dia=123`, put there by hand and then
run through a WinISD **load and save**: WinISD read it, kept it, and wrote it back. Its own
comment records the experiment — *"Dia is not enterable from the WinIsd UI (bug) but if its
present then WinIsd preserves in in a Load/Save cycle"*. `s-dia-natural.wdr` is the same driver
without it, noting that the condition cannot be produced through the UI at all.

**`Dia` and `Xlim` each have a slot and a control — they fail in opposite halves:**

|        | ParState slot | editor control                 | `.wdr` key | net effect |
|--------|---------------|--------------------------------|------------|------------|
| `Xlim` | 10            | `edXlim`, visible and editable | **none**   | the value is discarded on save; only the mark survives |
| `Dia`  | 20            | `eddia`, `Visible = False`     | `Dia=`     | the value is preserved on save; the mark is always `N` because nobody can type one |

One is a live control with nowhere to write; the other is a writable key with no reachable
control.

**What OpenISD does:** treats `Dia` as any other field — `SpecSection.Dia`, mapped in
`SPEC_TO_WDR`, written back byte-identical. A non-zero `Dia` survives a cycle because WinISD
preserves one, and preserving what WinISD preserves is the whole contract. Gated by
`wdr-round-trip.test.ts` (byte equality, `s-dia-roundtrip-123.wdr` included) and
`wdr-model-coverage.test.ts` (every `.wdr` key has a home).
