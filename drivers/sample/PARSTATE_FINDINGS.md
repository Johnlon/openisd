# ParState findings — from sample WDR experiments

Four WDR files in this directory were created directly in WinISD to reverse-engineer
what the `ParState=` string means.

## Files and their scenarios

| File | Scenario |
|------|----------|
| `john all defaults.wdr` | Nothing entered — only Brand/Model/Comment set |
| `John all-manu-populated.wdr` | All fields that showed black (enterable) were manually filled with dummy values |
| `John all-manu-populated-init.wdr` | Same as above (intermediate save) |
| `John all-manu-populated-ex.wdr` | Same as above, then Fs and Qms knocked out, Xmax and xlim deleted |
| `john all set.wdr` | User typed sequential values (1…n) into every field visible in WinISD's UI |

## What the three characters mean

| Char | Meaning |
|------|---------|
| **E** | User explicitly entered this value in WinISD |
| **C** | WinISD calculated/derived this from other entered (E) fields |
| **N** | Not in play — field was never entered, was explicitly cleared, or was cascade-disabled |

## Key findings

### Zero does NOT imply N, and N does NOT imply zero

- `Fs=0, ParState[Fs]=E` — user "knocked out" Fs by entering 0; WinISD still considers it entered.
- `Cms=0, ParState[Cms]=C` — WinISD computed 0 because its inputs were broken; still C.
- `Znom=8, ParState[Znom]=N` — Znom retained its value (8) but was cascade-disabled when Fs was knocked out.
- `c=343.684, ParState[c]=N` — speed of sound is always non-zero but always N; it is a constant, not an active parameter.

### ParState is a fixed 49-slot table mapped to WinISD's internal parameter list

Checked across all collections in this repo:

| Collection | Fields written to file | ParState length |
|------------|----------------------|----------------|
| winisd, sample | 48 | 49 |
| loudspeakerdatabase (old scraped) | 19–21 | 49 |
| matt | 18–20 | 49 |

ParState is **always exactly 49 chars**, but different WDR sources write very different
numbers of Key=Value fields. This means ParState does **not** map 1:1 to the lines in
the file — it maps to **WinISD's fixed internal 49-parameter list**, which is the same
regardless of what is in the file.

The WDR file writes a Key=Value line for each parameter it knows about. A simple
loudspeakerdatabase file writing 21 fields still produces a 49-char ParState because
WinISD fills in the state for all 49 internal slots. The 28 slots with no corresponding
Key=Value line in the file are still accounted for in ParState — they just have no
persisted value.

The earlier per-position analysis (field 1 → ParState[0], field 2 → ParState[1], …)
was approximately correct for full winisd-format files because those files write fields
in the same order as WinISD's internal list and cover 48 of the 49 slots. It would give
wrong mappings for short files.

### Blank driver (nothing entered)

Nearly all fields are N. The three exceptions:
- **`numVC` (position 24) = E** — always E even in a blank file, value defaulting to 1. However, the WinISD UI shows the Voicecoils field as **grey / not available** even when you type into it — it never turns green (entered) or blue (calculated). The help file confirms it is a purely descriptive parameter ("it just tells how many voicecoils there are") that plays no role in the simulation. Its E state in ParState therefore does **not** mean "user entered via the normal T/S workflow" — it appears to be a hardcoded initialisation. ⚠ Contradicts the simple E=entered model; treat numVC's E as a special case.
- **`DVol` (position 48) = C** — permanently treated as a calculated output.
- **`Vcd` (position 47) = N always** — still N even when user types a value; permanently display-only like `no`.
- **Position 49 = C in blank/populated drivers, E when user fills everything** — the full WDR format writes 48 fields as key=value lines; position 49 has no corresponding line. WinISD tracks this 49th parameter internally but never serialises its value to disk. ⚠ Unverified — the true identity of this slot is unknown.

### Permanently fixed slots (regardless of driver data)

Two fields are **permanently N no matter what value is stored or typed**:

| Position | Field | Why always N |
|----------|-------|--------------|
| 21 | `no` | Reference efficiency η₀ in **% (percent)** per WinISD help — display-only output, never enterable |
| 47 | `Vcd` | Voice coil displacement volume — still N even when explicitly set to 77; display-only |

**`c` and `roo` are conditionally N** — they remain N when only T/S parameters are entered,
but flip to E when the physical dimensions block (Thick, Depth, MagDepth, Magnet, Basket,
Outer) is populated. They become active only when the full geometry model is engaged.
Note that their *values* did not change when they flipped — the flip was triggered by the
presence of the other geometry fields, not by typing new values into `c`/`roo` themselves.

**Physical dimensions (Thick, Depth, MagDepth, Magnet, Basket, Outer)** are N when zero /
unpopulated, and flip to E when the user enters values — normal enterable fields.

Other permanent behaviours (when nothing is entered):

| Position | Field | Always |
|----------|-------|--------|
| 24 | `numVC` | E — WinISD initialises to 1 and marks it entered by default |
| 48 | `DVol` | C when calculated, E if user touches it |
| 49 | *(phantom)* | C when nothing entered; E when user fills everything |

`alfaVC`, `Rt`, `Ct` (thermal params) default to N but become E if the user explicitly enters them.
`VCCon` defaults to N, becomes C when WinISD populates it alongside other fields, becomes E when explicitly set.

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
Resonate (which re-derives all T/S parameters from scratch on import), but means the
ParState in scraped files carries no information about which values were measured vs derived.
