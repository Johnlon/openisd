# The engine is missing two of WinISD's Fs routes, and has one WinISD does not

# Status
OPEN 2026-08-17 — ruled (QO50, closed), not yet implemented

## Symptom

Three layers, three different answers to "how is `Fs` calculated": **WinISD has 5 routes, the
engine has 4, and the provenance panel shows 2.** No two of the three agree.

| WinISD relation | form | engine | provenance panel |
| --- | --- | --- | --- |
| 11 | `Fs = 1 / (2π·√(Mms·Cms))` | ✔ `driver.ts:167` | ✔ "Primary" |
| 14 | `Fs = ∛(no·c³·Qes / (4π²·Vas))` | ✔ `driver.ts:229` | ✘ |
| 2 | `Fs = Qes·BL² / (2π·Mms·Re)` | ✔ `driver.ts:188` | ✘ |
| 4 | `Fs = Rme·Qes / (2π·Mms)` | ✘ **missing** | ✘ |
| 12 | `Fs = EBP·Qes` | ✘ **missing** | ✘ |
| none | `Fs = Rms·Qms / (2π·Mms)` | ✔ `driver.ts:181` | ✘ |
| none | `Fs = 1/(2π·√(Vas·Mms/(ρ·c²·Sd²)))` | ✘ | ✔ "Alternative" |

Read the bottom two rows together: the engine runs a route WinISD does not have, and the panel
advertises a route NEITHER of them has. Only one row of seven — relation 11 — is agreed on by
all three.

**The ORDER differs too**, which matters because the first route whose inputs are all present
wins (§4.3 of `WINISD_SCHEMA.md`):

| try | WinISD | openisd engine |
| --- | --- | --- |
| 1 | rel 11 `1/(2π·√(Mms·Cms))` | rel 11 `1/(2π·√(Mms·Cms))` |
| 2 | rel 14 `∛(no·c³·Qes/(4π²·Vas))` | **the extra route** `Rms·Qms/(2π·Mms)` |
| 3 | rel 2 `Qes·BL²/(2π·Mms·Re)` | rel 2 `Qes·BL²/(2π·Mms·Re)` |
| 4 | rel 4 `Rme·Qes/(2π·Mms)` | rel 14 `∛(no·c³·Qes/(4π²·Vas))` |
| 5 | rel 12 `EBP·Qes` | — |

The route WinISD does not have runs SECOND, ahead of both routes WinISD would have reached
first. On a driver whose fields disagree with each other, that produces a different NUMBER, not
merely a different explanation of the same number. Relations 14 and 2 are also swapped.

The panel half of this is a separate defect with its own record (see Related). This one is
about the engine column.

**Two drivers that get an `Fs` in WinISD get a blank in openisd:**

| entered | WinISD | openisd |
| --- | --- | --- |
| `EBP` 207.77, `Qes` 0.1925 | `Fs` = 40 | **blank** |
| `Rme` 2.54371, `Qes` 0.1925, `Mms` 0.00195 | `Fs` = 40 | **blank** |

**And one driver gets an `Fs` in openisd that WinISD would leave blank:**

| entered | WinISD | openisd |
| --- | --- | --- |
| `Rms` 0.2332, `Qms` 2.1, `Mms` 0.00195 | blank | **`Fs` = 40** |

The second kind is the more damaging of the two. A `.wdr` round-tripped through openisd comes
back carrying an `Fs` WinISD never produced, marked `C` at ParState position 2 — a claim that
WinISD calculated something it did not.

## Evidence

Measured against the calculation engine in `winisd.exe` — 75 compute sites, five of which write
`Fs` (`winisd_research/scripts/relation_routes.py`):

| WinISD relation | form | `driver.ts` |
| --- | --- | --- |
| 11 | `Fs = 1 / (2π·√(Mms·Cms))` | :167 |
| 14 | `Fs = ∛(no·c³·Qes / (4π²·Vas))` | :229 |
| 2 | `Fs = Qes·BL² / (2π·Mms·Re)` | :188 |
| 4 | `Fs = Rme·Qes / (2π·Mms)` | **absent** |
| 12 | `Fs = EBP·Qes` | **absent** |
| — | `Fs = Rms·Qms / (2π·Mms)` | :181 — **no WinISD equivalent** |

WinISD's relation 1 (`Qms`, `Fs`, `Cms`, `Rms`) does have `Fs` as a member, but its only two
compute sites write `Qms` and `Rms`. Nothing in the binary writes `Fs` from `Rms`/`Qms`/`Mms`.

Reproduced by running `solveConsistencyGroup` on each input set:

```
rel 12  EBP=207.77, Qes=0.1925       openisd Fs = null (NOT derived)   equation gives 39.999
rel 4   Rme=2.5437, Qes=0.1925, Mms  openisd Fs = null (NOT derived)   equation gives 40.000
extra   Rms=0.2332, Qms=2.1, Mms     openisd Fs = 40.000              equation gives 40.000
```

## Cause

The engine's routes were written from the textbook relations rather than from what WinISD
computes. `Fs = Rms·Qms/(2π·Mms)` is the correct rearrangement of the standard
`Rms = 2π·Fs·Mms/Qms`, so it looks right — WinISD simply does not run that direction. In the
other direction, `EBP` and `Rme` are WinISD-specific figures of merit, and it is easy to treat
them as outputs only.

## Fix

**Ruled 2026-08-17 (QO50, closed): match WinISD exactly.** Add relations 4 and 12, remove the
`Rms·Qms` route, and put all five in WinISD's priority order — 11 > 14 > 2 > 4 > 12, proven both
from the guard chain and live against the binary
(`winisd_research/RE_GHIDRA_FINDINGS.md` "Fs priority settled STATICALLY" / "CONFIRMED in the
UI"). This is the only option that makes a `.wdr` round trip through openisd without inventing a
`C`; the other two options considered before the ruling are superseded.

**Not yet implemented.** `driver.ts:167,181,188,229` still has the old four routes, unordered
relative to WinISD. `provenance.ts`'s `Fs` entry was corrected 2026-08-17 to accurately describe
that CURRENT code (see the sibling provenance bug) — it still needs a second update, in the same
change that fixes `driver.ts`, to the WinISD-matching order.

## Scope — the route list and its order must reach four places

They are four separate consumers of the same fact, and today all four disagree:

| where | what it needs | state today |
| --- | --- | --- |
| engine `driver.ts` | the routes, in WinISD's order | 4 routes, wrong order, one route WinISD lacks |
| `WINISD_SCHEMA.md` §3 field table | every route for `Fs`, numbered in firing order | correct — generated from the measured engine |
| `WINISD_SCHEMA.md` §4.3 catalogue | the same, per relation | correct — same source |
| provenance popup `provenance.ts` | the routes the ENGINE runs, in engine order | 2 routes, one of which nothing runs |

The two documents are generated from `winisd_research/scripts/relation_routes.py`, so they are
already right and will stay right. The two code sites are hand-maintained and drift. Any fix
should make the popup derive from the engine rather than restate it.

## Verification

For whichever option is chosen:

- `Fs` derives from `EBP`+`Qes`, and from `Rme`+`Qes`+`Mms`;
- under option 1, `Rms`+`Qms`+`Mms` alone leaves `Fs` blank;
- with several routes available at once, the winner is WinISD's — test a driver where relations
  14 and 2 disagree and assert 14 wins;
- the popup lists exactly the engine's routes, in the engine's order.

**Automated test:** the `Xmax` campaign is the model — `winisd_research/runs/xmax_route.jsonl`
holds seven recorded WinISD runs, and replaying each through `solveConsistencyGroup` is a
direct parity assertion. An equivalent `Fs` campaign over the five routes, run under wine with
`toys/campaign_*.py`, would give the same footing. No such fixture exists for `Fs` today, which
is why this drifted unnoticed.

## Related

The provenance panel shows two `Fs` paths, one of which the engine never runs — separate defect,
recorded in
`BUG_20260817_provenance_panel_fs_shows_a_formula_the_engine_never_uses_and_hides_two_it_does.md`.
