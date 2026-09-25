# drivers/myprobes — WinISD experiment files

> ⚠️ **Disclaimer — nothing in this tree is a real driver.**
> Every file here is a probing experiment against WinISD 0.7.0.950 itself, not a record of an
> actual loudspeaker. Each one was produced by one or more of:
> - typing a deliberately recognisable "tell-tale" value (`123`, `400`, `999`, sequential
>   `1..n`, …) into a single field via the WinISD UI, to see where it turns up in the saved file;
> - hand-editing a value directly in the `.wdr` text and then loading it into WinISD to see
>   what survives;
> - loading a file and re-saving it unchanged, to see what WinISD itself rewrites.
>
> **Do not use any value in this directory as a representative or realistic example.** `c`,
> `roo`, `Pe`, `Rt`, `Ct`, and most other fields are routinely set to nonsense like `123`,
> `400`, or `999` purely because that makes the field easy to spot in a diff — not because
> those are plausible physical values. Every file's actual purpose is documented either in
> the tables below or in its own `Comment=` field (see the
> [index of embedded comments](#index-of-embedded-comments-and-manual-edits)).

This directory contains WDR files used to reverse-engineer WinISD 0.7.0.950's internal
behaviour. **Not real drivers** — dummy/sentinel values only.

Most files were created directly in WinISD and are genuine captures of its behaviour. A
handful are **hand-fabricated fixtures** that were never loaded into WinISD at all (used to
exercise OpenISD's own consistency checks), and a few genuine captures were then hand-edited
after the fact. Every file in that second and third category says so in its own `Comment=`
field — see the [index of embedded comments](#index-of-embedded-comments-and-manual-edits)
below rather than assuming a file is a clean WinISD capture just because it lives next to
ones that are.

---

## Directory layout

| Path                  | Contents                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `per_field_and_misc/` | 73 files — the single-parameter `s-*.wdr` probes, the `john-*`/`John-*` whole-form fixtures, and the `s-connection-*` / `s-dia-*` / `s-roo-*` special-case probes |
| `inconsistencies/`     | 8 files — hand-fabricated and WinISD-resaved fixtures that deliberately violate T/S group relationships, for exercising OpenISD's DQ/consistency checks |
| `text/`                | 4 files — character-set, multi-line comment, and INI-escaping fixtures                                     |
| `PARSTATE-FINDINGS.md` | Earlier-phase ParState analysis. Its per-field position tables are superseded by this README, but its behavioural findings (E/C/N semantics, cascade rules, the WinISD save bugs, and the decompiled identities of slots 20/46) are current and are cross-referenced below |
| `RENAME_MAP.txt`       | A **proposed, not-yet-applied** rename/cleanup plan for this directory. Its factual observations (byte-identical duplicates, misnamed files) were re-verified while writing this README and are folded in below; its proposed target filenames have not been acted on |

Two stray files sit at the top level and are editor artefacts, not fixtures:
`.s-connection-serial-2vc.wdr.un~` and `.s-connection-serial.wdr.un~` (Vim persistent-undo
binaries). They carry no WDR content and are candidates for deletion — see
[Known duplicates, misnamed files, and clutter](#known-duplicates-misnamed-files-and-clutter).

---

## ⚠ Known issue: the test-suite oracle path does not exist

Several tests in `packages/design/test/winisd/` (`wdr-round-trip.test.ts`,
`openisdToWdr.test.ts`, and others) read every file out of a single flat directory,
`drivers/mysamples/winisd/`, and treat it as *the* WDR-fidelity oracle:

```
packages/design/test/winisd/wdr-round-trip.test.ts:
  const SAMPLES = join(here, '..', '..', '..', '..', 'drivers', 'mysamples', 'winisd');
```

That directory does not exist in this working tree, and the mismatch is now two layers deep:
this directory itself is `drivers/myprobes/` (renamed from `drivers/mysamples/`, itself never
committed under either name), and its content was split into `per_field_and_misc/`,
`inconsistencies/`, and `text/` rather than kept as a single `winisd/` folder. The last
committed layout in git history was `drivers/sample/winisd/`, singular "sample". Until the
test paths are updated to point at the current subdirectories under `drivers/myprobes/` (or a
`winisd/` symlink/alias is restored), `readdirSync` on `SAMPLES` throws and every test in that
file fails to even collect its cases. Fixing this is a code change outside this README's
scope, but it's recorded here because it directly affects whether the fixtures below are
actually exercised.

---

## Single-parameter probe files (`per_field_and_misc/s-*.wdr`)

Each file has exactly one T/S field set to a non-zero value (unless noted). Comparing
its `ParState=` string against the blank file isolates the ParState index for that field.

| File                                          | Field set | ParState pos | Notes                                                                                            |
| ---------------------------------------------- | --------- | :----------: | ------------------------------------------------------------------------------------------------ |
| `per_field_and_misc/s-znom.wdr`               | Znom      |      0       |                                                                                                    |
| `per_field_and_misc/s-fs.wdr`                 | Fs        |      1       |                                                                                                    |
| `per_field_and_misc/s-pe.wdr`                 | Pe        |      2       | Pe=123; SPL=0; WinISD marks only Pe as E                                                          |
| `per_field_and_misc/s-spl.wdr`                | SPL       |      3       | SPL can be directly entered; normally C when T/S present                                          |
| `per_field_and_misc/s-re.wdr`                 | Re        |      4       |                                                                                                    |
| `per_field_and_misc/s-le.wdr`                 | Le        |      5       |                                                                                                    |
| `per_field_and_misc/s-fle.wdr`                | fLe       |      6       |                                                                                                    |
| `per_field_and_misc/s-kle.wdr`                | KLe       |      7       |                                                                                                    |
| `per_field_and_misc/s-bl.wdr`                 | BL        |      8       |                                                                                                    |
| `per_field_and_misc/s-xmax.wdr`               | Xmax      |      9       |                                                                                                    |
| `per_field_and_misc/s-xlim-123.wdr`           | Xlim      |      10      | ParState-only — WinISD does not write `Xlim=` as a WDR key. Comment: *"Xlim Entered = 123 but does not save to file - it may set the ParState flag"* |
| `per_field_and_misc/s-xlim-not-entered.wdr`   | Xlim (control) |  10      | Control for the above: Xlim left blank, slot 10 stays `N`                                         |
| `per_field_and_misc/s-cms.wdr`                | Cms       |      11      |                                                                                                    |
| `per_field_and_misc/s-qms.wdr`                | Qms       |      12      |                                                                                                    |
| `per_field_and_misc/s-qes.wdr`                | Qes       |      13      |                                                                                                    |
| `per_field_and_misc/s-qts.wdr`                | Qts       |      14      | WDR writes Qts first but ParState puts it at 14, after Qms/Qes                                    |
| `per_field_and_misc/s-rms.wdr`                | Rms       |      15      |                                                                                                    |
| `per_field_and_misc/s-mms.wdr`                | Mms       |      16      |                                                                                                    |
| `per_field_and_misc/s-sd.wdr`                 | Sd        |      17      |                                                                                                    |
| `per_field_and_misc/s-vd.wdr`                 | Vd        |      18      |                                                                                                    |
| `per_field_and_misc/s-vas.wdr`                | Vas       |      19      | Entered in ft³ in UI; stored as m³ in WDR                                                         |
| `per_field_and_misc/s-dia-natural.wdr`, `s-dia-roundtrip-123.wdr` | Dia | 20  | Resolved (see [ParState position map](#confirmed-parstate-position-map)) — always `N`; no UI control reaches it |
| `per_field_and_misc/s-dd.wdr`                 | Dd        |      21      | Effective cone diameter                                                                           |
| `per_field_and_misc/s-no.wdr`                 | no        |      22      | η₀ efficiency; E when typed, C when computed from T/S, N when nothing set                         |
| `per_field_and_misc/s-voicecoils.wdr`         | numVC     |      23      | Already E in blank (defaults to 1); probe shows no new E but field identity confirmed             |
| `per_field_and_misc/s-hc.wdr`                 | Hc        |      24      |                                                                                                    |
| `per_field_and_misc/s-hg.wdr`                 | Hg        |      25      |                                                                                                    |
| `per_field_and_misc/s-splmax.wdr`             | SPLmax    |      26      |                                                                                                    |
| `per_field_and_misc/s-splmaxlf.wdr`           | SPLmaxLF  |      27      | **Dirty probe** — also has Pe=E at pos 2 (Pe was accidentally set); SPLmaxLF=27 is still correct   |
| `per_field_and_misc/s-uspl.wdr`               | USPL      |      28      |                                                                                                    |
| `per_field_and_misc/s-alfavc.wdr`             | alfaVC    |      29      |                                                                                                    |
| `per_field_and_misc/s-r-t.wdr`                | Rt        |      30      | Stray hyphen in the filename splits the key name (`Rt`, not `R-t`)                                 |
| `per_field_and_misc/s-c-t.wdr`                | Ct        |      31      | Same stray-hyphen naming issue for `Ct`                                                            |
| `per_field_and_misc/s-gamma.wdr`              | gamma     |      32      |                                                                                                    |
| `per_field_and_misc/s-ebp.wdr`                | EBP       |      33      | **Surprise:** EBP is at 33, not adjacent to Rme/Mpow/Mcost in WDR write order                      |
| `per_field_and_misc/s-rme.wdr`                | Rme       |      34      |                                                                                                    |
| `per_field_and_misc/s-mpow.wdr`               | Mpow      |      35      |                                                                                                    |
| `per_field_and_misc/s-mcost.wdr`              | Mcost     |      36      |                                                                                                    |
| `per_field_and_misc/s-gloss.wdr`              | Gloss     |      37      |                                                                                                    |
| `per_field_and_misc/s-thick.wdr`              | Thick     |      38      |                                                                                                    |
| `per_field_and_misc/s-depth.wdr`              | Depth     |      39      |                                                                                                    |
| `per_field_and_misc/s-magnetdepth.wdr`        | MagDepth  |      40      | Two byte-identical duplicates exist — see below                                                    |
| `per_field_and_misc/s_magnet.wdr`             | Magnet    |      41      | **Underscore, not hyphen** — the only single-field probe that actually sets `Magnet=123`            |
| `per_field_and_misc/s-basket.wdr`             | Basket    |      42      |                                                                                                    |
| `per_field_and_misc/s-outer.wdr`              | Outer     |      43      |                                                                                                    |
| `per_field_and_misc/s-vcd.wdr`                | Vcd       |      44      |                                                                                                    |
| `per_field_and_misc/s-dvol.wdr`               | DVol      |      45      |                                                                                                    |
| `per_field_and_misc/s-connection-*.wdr`       | VCCon     | 46 (resolved, never flips to E — see below) | See [VCCon](#vccon--resolved-slot-46-behaviour-still-only-partly-understood) |
| `per_field_and_misc/s-c.wdr`                  | c         |      47      | Speed of sound; C at standard conditions, E when explicitly entered                                |
| `per_field_and_misc/s-roo.wdr`                | roo       |      48      | Air density; same behaviour as c                                                                   |

### Magnet / MagDepth naming trap

Three files hold `MagDepth=123, Magnet=0` and are **byte-identical**:
`s-magnetdepth.wdr`, `s_magdepth.wdr`, and — despite its name — `s-magnet.wdr`. Only
`s_magnet.wdr` (underscore) actually sets `Magnet=123`. `s_magnet_and__magdepth.wdr` sets
both (`Magnet=123`, `MagDepth=456`) and confirms slots 40 and 41 are independent. Do not
trust the `s-magnet.wdr` filename — read the file.

`s-driver-12345678.wdr` also confirms slot 41: it sets all eight dimension fields to
`Thick=1 … DVol=8` (the "12345678" in the name encodes those values, not a driver id), and
`Magnet=4` lights up slot 41 alongside the rest.

### VCCon — resolved slot (46), behaviour still only partly understood

`VCCon` (1=parallel, 2=serial) is a WDR field. Six connection probes exist; only two of them
are trustworthy single-variable captures:

| File                                  | VCCon | Correct for its name? |
| -------------------------------------- | :---: | ---------------------- |
| `s-connection-parallel.wdr`            |   1   | ✅ (comment: "conn changed to serial then back to parallel") |
| `s-connection-parallel-2vc.wdr`        |   1   | ✅                      |
| `s-connection-serial.wdr`              |   2   | ✅                      |
| `s-connection-serial-3vc.wdr`          |   2   | ✅                      |
| `s-connection-serial-2vc.wdr`          |   1   | ❌ named serial, stores parallel — byte-identical to `s-connection-parallel-2vc.wdr` |
| `s-connection-serial-a.wdr`            |   1   | ❌ no field is actually set — byte-identical to the blank baseline `s_autocalc-no.wdr` |

**This supersedes an earlier claim in this README that "WinISD always writes `VCCon=1`
regardless of the UI setting."** That conclusion was drawn from the two mislabeled files
above; the two correctly-captured pairs (`s-connection-serial.wdr` / `s-connection-parallel.wdr`,
and the `*-2vc`/`*-3vc` variants) show VCCon saves correctly in both directions. Reading is
also correct — a hand-edited `VCCon=2` file does display as serial.

What genuinely is unresolved: **no connection probe, correct or not, ever shows a new `E` in
ParState.** All six are byte-for-byte identical to the blank driver in their `ParState=`
string. Black-box probing therefore still supports "VCCon has no observable ParState
transition via the connection UI." `PARSTATE-FINDINGS.md` (via decompiling `winisd.exe`)
separately identifies ParState **slot 46 as WinISD's internal VCCon slot** — so the slot's
*identity* is known, but why the UI never marks it `E` is not explained by anything held here.

---

## Confirmed ParState position map

```
Pos  Field       Source
---  -----       ------
  0  Znom        s-znom
  1  Fs          s-fs
  2  Pe          s-pe
  3  SPL         s-spl
  4  Re          s-re
  5  Le          s-le
  6  fLe         s-fle
  7  KLe         s-kle
  8  BL          s-bl
  9  Xmax        s-xmax
 10  Xlim        s-xlim-123 / s-xlim-not-entered  (ParState-only; no WDR key)
 11  Cms         s-cms
 12  Qms         s-qms
 13  Qes         s-qes
 14  Qts         s-qts
 15  Rms         s-rms
 16  Mms         s-mms
 17  Sd          s-sd
 18  Vd          s-vd
 19  Vas         s-vas
 20  Dia         s-dia-natural / s-dia-roundtrip-123 (identity via decompile; mark is always N)
 21  Dd          s-dd
 22  no          s-no
 23  numVC       s-voicecoils (already E in blank)
 24  Hc          s-hc
 25  Hg          s-hg
 26  SPLmax      s-splmax
 27  SPLmaxLF    s-splmaxlf (dirty probe — also has Pe=E)
 28  USPL        s-uspl
 29  alfaVC      s-alfavc
 30  Rt          s-r-t
 31  Ct          s-c-t
 32  gamma       s-gamma
 33  EBP         s-ebp
 34  Rme         s-rme
 35  Mpow        s-mpow
 36  Mcost       s-mcost
 37  Gloss       s-gloss
 38  Thick       s-thick
 39  Depth       s-depth
 40  MagDepth    s-magnetdepth (also s_magdepth, s-magnet — byte-identical, see naming trap above)
 41  Magnet      s_magnet (underscore); also s-driver-12345678 (Magnet=4 → pos 41=E)
 42  Basket      s-basket
 43  Outer       s-outer
 44  Vcd         s-vcd
 45  DVol        s-dvol
 46  VCCon       identity via decompile (PARSTATE-FINDINGS.md); mark never observed as E in any probe here
 47  c           s-c
 48  roo         s-roo
```

**Coverage: 49/49 identified.** Positions 20 (`Dia`) and 46 (`VCCon`) were the two
unresolved slots as of the black-box probing phase; both were subsequently identified by
decompiling `winisd.exe` (recorded in `PARSTATE-FINDINGS.md`). Both remain **behaviourally
always `N`** in every file in this directory — decompilation tells you *which* field a slot
belongs to, not that the UI ever exercises it. The strongest evidence that a hand-set `E` at
either slot actually survives real WinISD I/O comes from the `inconsistencies/` fixtures
(see below): `inconsistency-test.wdr` (hand-authored, `E` at both 20 and 46) round-tripped
through a real WinISD load-and-save as `inconsistency-test-saved.wdr`, with both marks still
`E` afterwards. That is evidence the marks survive a save untouched, not that the WinISD UI
ever produces them itself.

---

## Multi-parameter scenario files (`per_field_and_misc/`)

| File                                            | Scenario                                                                                  | ParState                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `john-all-defaults.wdr`                        | Blank driver — nothing entered                                                             | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC`                                                |
| `john-all-set-then-cleared.wdr`                 | All fields set, then Clear button hit                                                      | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC` — identical to blank; Clear resets all state   |
| `john-all-set-to-sequential-values.wdr`         | Every Parameters-tab field typed 1…n; physical dimensions at 0 (formerly `john-all-set.wdr`) | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEENNNNNNNNNEE`                                                |
| `john-all-entered-driver-dims.wdr`              | Same as above plus all Dimensions-tab fields entered                                        | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEEEEEEEEEENEE`                                                |
| `john-all-entered-driver-dim123s.wdr`           | Same with sequential dim values                                                             | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEEEEEEEEEENEE` — identical ParState to the dims file          |
| `john-all-noncalc-fields-manually-entered.wdr`  | All black (enterable) fields filled; 57-field format                                        | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC`                                                |
| `John-all-manu-populated-init.wdr`              | All enterable fields with sequential values                                                 | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC`                                                |
| `John-all-manu-populated.wdr`                   | Resaved version of the above — **byte-identical** to `John-all-manu-populated-init.wdr`     | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC`                                                |
| `John-all-manu-populated-ex.wdr`                | Full set, then Fs and Qms removed, Xmax/Xlim deleted                                        | `CNECEEECCNNCCEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` — Fs→N, Znom and others cascade-invalidated    |
| `s-driver-12345678.wdr`                         | Dims-only probe: Thick=1, Depth=2, MagDepth=3, Magnet=4, Basket=5, Outer=6, Vcd=7, DVol=8    | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNEEEEEEEENCC` — confirms pos 38–45; pos 46 stays N           |

---

## Key findings

### WDR write order ≠ ParState internal order

WinISD writes WDR fields in one order but numbers its internal parameters differently.
Notable mismatches:

- **Qts** is written first in WDR but is at ParState pos 14 (after Qms=12, Qes=13)
- **EBP** appears in WDR near the dims block but is at ParState pos 33 (thermal group)
- **VCCon** appears in WDR between Gloss and c, and its ParState slot (46, per decompile) is
  never observed to flip via the UI

### `no` (η₀) is at pos 22 and IS enterable

`no` can be E when typed directly, C when computed from T/S, or N when nothing is set.
The `s-no.wdr` probe confirms pos 22.

### Clear == blank

`john-all-set-then-cleared.wdr` ParState is byte-for-byte identical to
`john-all-defaults.wdr`. The Clear button resets every param to N; numVC returns to
E=1; c/roo return to C.

### Pos 20 (`Dia`) and 46 (`VCCon`) are permanently N through any UI path tried here

Neither position has ever been observed as anything other than N in a file produced through
the WinISD UI, including `john-all-set-to-sequential-values.wdr` where every visible UI field
was entered. Both fields have a *reason* they can't be marked E through the UI — `Dia` has no
visible control (`eddia`, `Visible = False`), and `VCCon`'s combo box apparently doesn't route
through whatever marks a field entered — but neither reason is confirmed by anything short of
decompilation.

---

## Index of embedded comments and manual edits

Every WDR file has a `Comment=` field. Most are empty. The 16 below are not — each one
explains, in the author's own words, why that specific file exists or what was done to it.
Files marked **NOT A GOLDEN** were stated by their own author as hand-fabricated and never
loaded into real WinISD; treat their `ParState` and derived values as synthetic, not as
observed WinISD behaviour.

| File | Role | Comment (as written in the file) |
| ---- | ---- | --------------------------------- |
| `per_field_and_misc/john-all-defaults.wdr` | Blank baseline, genuine capture | "no fields set by human" |
| `per_field_and_misc/John-all-manu-populated.wdr`, `John-all-manu-populated-init.wdr` | Whole-form fixture, genuine capture | "all fields that were black we manually populated with 1,2,3... so that all fields were either manual or calculated" |
| `per_field_and_misc/john-all-set-to-sequential-values.wdr` | Whole-form fixture, genuine capture (formerly `john-all-set.wdr`) | "I just typed 1..n on all fields and the app has recalculated some fields" |
| `per_field_and_misc/john-all-entered-driver-dims.wdr`, `john-all-entered-driver-dim123s.wdr` | Whole-form + dims fixture, genuine capture | "I just typed 1..n on all fields and ignored the fact that the app then may have recalculated some. I had previously omitted in other files to set the dimensions of the driver - fixed in this sample" |
| `per_field_and_misc/john-all-set-then-cleared.wdr` | Clear-button probe, genuine capture | "this file had every field filled in then saved and reloaded. then the clear button was hit." |
| `per_field_and_misc/s-c.wdr` | Single-field probe, genuine capture | "Only C set and to a recognisable value 123" |
| `per_field_and_misc/s-xlim-123.wdr` | Single-field probe, genuine capture | "Xlim Entered = 123 but does not save to file - it may set the ParState flag" |
| `per_field_and_misc/s-xlim-not-entered.wdr` | Control for the above, genuine capture | "Xlim not entered - we know that Xlim does not save to file - it may set the ParState flag to N" |
| `per_field_and_misc/s-dia-natural.wdr` | Negative-result probe, genuine capture | "Dia cannot be entered on WinISD UI so this example is really just a note of that condition - it may be in parstate but we have no way to know" |
| `per_field_and_misc/s-dia-roundtrip-123.wdr` | Hand-edited-then-reloaded probe | **NOT A GOLDEN** — "Dia=123 was hand-inserted into this file's text; WinISD's UI has no control to enter Dia so this state cannot arise from real WinISD use... but if its present then WinIsd preserves it in a Load/Save cycle" |
| `per_field_and_misc/s-connection-parallel.wdr` | Connection probe, genuine capture | "conn changed to serial then back to parallel" |
| `per_field_and_misc/s-roo-set400-and-c-set2.wdr` | Hand-edited probe | "c=400 roo=2 manually edited by JL in the driver editor to crazy inconsistent values" |
| `inconsistencies/inconsistency-test.wdr` | Consistency-check fixture | **NOT A GOLDEN** — "hand-fabricated, never loaded into real WinISD. Deliberate group violations: Qts wrong (group 5), Vd wrong (group 20), Dd wrong (group 6)" |
| `inconsistencies/inconsistency-test-saved.wdr` | Same fixture, allegedly resaved by WinISD | **NOT A GOLDEN (provenance unclear)** — "provenance unclear (ProvidedBy names the same hand-fabricated experiment as inconsistency-test.wdr; the reformatted decimals suggest a WinISD re-save but this is not confirmed)" |
| `inconsistencies/inconsistency-test-qts-C.wdr` | ParState-vs-value mismatch fixture | **NOT A GOLDEN** — "Qts=0.500 stored but ParState marks it C (calculated). Correct value ~0.358. Does WinISD recalculate on load?" |
| `inconsistencies/inconsistency-test-qts-N.wdr` | ParState-vs-value mismatch fixture | **NOT A GOLDEN** — same as above, with ParState marking Qts `N` instead of `C` |
| `text/driver-with-semicolons-and-hash.wdr` | INI-escaping research fixture, genuine capture | A multi-paragraph note (see below) |

### `driver-with-semicolons-and-hash.wdr` deserves its own note

Its `Brand`/`Model`/`Manufacturer`/`ProvidedBy` fields are literally `hello;there#again` —
testing whether WinISD's INI writer treats `;` and `#` as comment starts mid-value (per the
GetPrivateProfileString convention, it should not, since those only start a comment on a line
by themselves). Its `Comment=` field is a full research note explaining the hypothesis and
citing the INI-file Wikipedia page. That note itself demonstrates an anomaly worth recording
separately: it was written with real line breaks, and on disk every line break inside the
`Comment=` value has come back as three UTF-8 bytes (`EF BF BD`, the U+FFFD replacement
character) instead of a preserved newline or an escape sequence. That is a live, observed
WinISD text-encoding behaviour on multi-line `Comment` content — worth treating as a data
point for anyone relying on `Comment=` round-tripping arbitrary text, not as file corruption
in this repo.

---

## `inconsistencies/` — consistency-check fixtures

Everything in this directory was purpose-built to violate the T/S parameter group
relationships documented in `WDR_SCHEMA.md`, for exercising OpenISD's own DQ/consistency
checks. Four files (`inconsistency-test.wdr`, its two `-qts-C`/`-qts-N` ParState variants,
and `inconsistency-test-saved.wdr`) are explicitly **NOT A GOLDEN** per their own comments —
see the index above. The other four (`inconsistency-test-saved-q.wdr`,
`-saved-q-1.wdr`, `-saved-q-2.wdr`, `-saved-q-3.wdr`) carry no comment and explore the
Qts/Qms/Qes triangle:

| File | Qms | Qes (via Rme route) | Qts stored | ParState slot 14 |
| ---- | --- | --- | --- | --- |
| `inconsistency-test-saved-q-1.wdr` | 334 | — | 1.98809523809524 = 334·2/336 | C |
| `inconsistency-test-saved-q-2.wdr` | 334 | — | 99 (entered, inconsistent with Qms=334) | E |
| `inconsistency-test-saved-q-3.wdr` | 334 | — | 0.997014925373134 = 334/335 | C |
| `inconsistency-test-saved-q.wdr` | 334 | — | 0.997014925373134 | C — **byte-identical to `-q-3.wdr`** |

Only `inconsistency-test.wdr` / `inconsistency-test-saved.wdr` demonstrate WinISD's own
number renormalisation on save (`Qts=0.500` → `0.5`, `Dd=0.200` → `0.2`, otherwise
byte-identical including the full ParState) — a reminder that comparing WDR files for
"did anything change" must be numeric, not byte-for-byte, since WinISD's own formatting
isn't stable across a load/save cycle.

---

## `text/` — character-set and formatting fixtures

| File | Tests |
| ---- | ----- |
| `driver-with-latin-text.wdr` | A multi-line plain-ASCII comment ("multi line / comment / in plain ascii") |
| `driver-with-unicode-text.wdr` | Euro (€) and Kanji (漢字) in Brand/Model/Manufacturer/Comment |
| `driver with Euro € Kanji 漢字 driver with unicode text Euro € Kanji 漢字.wdr` | **Byte-identical** to `driver-with-unicode-text.wdr` — here the filename itself (with the phrase doubled) is the test, not the content |
| `driver-with-semicolons-and-hash.wdr` | INI comment-character escaping — see the note above |

---

## Known duplicates, misnamed files, and clutter

Re-verified while writing this README (all still true on disk):

**Byte-identical groups**
- `s-magnet.wdr` = `s-magnetdepth.wdr` = `s_magdepth.wdr` (all set `MagDepth`, none set `Magnet`)
- `s_autocalc-no.wdr` = `s-connection-serial-a.wdr` = `s-connection-serial.wdr~`
- `s-connection-parallel-2vc.wdr` = `s-connection-serial-2vc.wdr` = `s-connection-serial-2vc.wdr~`
- `John-all-manu-populated.wdr` = `John-all-manu-populated-init.wdr`
- `inconsistency-test-saved-q.wdr` = `inconsistency-test-saved-q-3.wdr`
- `driver-with-unicode-text.wdr` = `"driver with Euro … Kanji ….wdr"`

**Names that contradict their content**
- `s-magnet.wdr` sets `MagDepth`, not `Magnet` — the real Magnet probe is `s_magnet.wdr` (underscore)
- `s-connection-serial-2vc.wdr` stores `VCCon=1`, which is parallel
- `s-connection-serial-a.wdr` stores `VCCon=1` and sets no field at all
- `s-splmaxlf.wdr` sets `Pe` as well as `SPLmaxLF`
- `s-driver-12345678.wdr` — the digits are the eight dimension values (`Thick=1…DVol=8`), not a driver id
- `s_autocalc-no.wdr` — no key or ParState slot in the file actually records an "autocalc" setting

**Editor/VCS clutter (not WDR content)**
- `.s-connection-serial-2vc.wdr.un~`, `.s-connection-serial.wdr.un~` (top level) — Vim persistent-undo binaries
- `per_field_and_misc/s-connection-serial-2vc.wdr~`, `s-connection-serial.wdr~` — editor backup files, both byte-identical to real fixtures listed above

`RENAME_MAP.txt` proposes a full kebab-case rename plus deletion of the above duplicates and
clutter, and lists which test files would need updating in the same commit. None of that has
been applied — the files above still use their original names.

---

## Authoritative sources

Only two sources are authoritative for WinISD behaviour:

1. **WinISD.exe itself** — behaviour observed by running the application.
2. **WinISD help files** — `docs/winisd_helpfiles/help/`.

Do not infer WinISD behaviour from OpenISD source code, forum posts, or third-party
documentation without cross-checking against one of these two sources. This is also why the
`inconsistencies/` fixtures marked **NOT A GOLDEN** above must never be treated as evidence of
WinISD behaviour, however useful they are for testing OpenISD's own checks.

---

## Archived: `beyma-8BR40N-cms-vas-inconsistency.wdr` (no longer in this corpus)

This file is **not present in this directory** and should not be searched for. It lived at
`drivers/sample/beyma-8BR40N-cms-vas-inconsistency.wdr`, sourced from
`loudspeakerdatabase.com`, and was deliberately deleted in commit `b498881` ("WinISD write
fidelity, one efficiency/air model, Advanced formulas, and rule-config consolidation") along
with the rest of `drivers/sample/other/`, because **third-party database exports are not
WinISD output** — their `ParState` strings are a fixed template copied by the scraper, not a
real record of what was entered vs. calculated, and they were masking write-fidelity bugs in
OpenISD's own WDR writer at the time. Its content is fully recoverable from git history
(`git show b498881^:drivers/sample/beyma-8BR40N-cms-vas-inconsistency.wdr`) if needed again.

The analysis below is preserved for its mathematical content — every finding is a relationship
between the file's own numbers, verifiable from the values quoted, independent of whether the
file itself still exists on disk.

**ParState decode** — entered: `Fs` `BL` `Cms` `Qms` `Qts` `Sd` `Vas` `Vd` `Dd`. Calculated by
WinISD: `Re` `Qes` `Rms` `Mms` `no` `gamma` `EBP` `Rme` `Mpow`.

### What it established

**1. `Rme = 2π·Fs·Mms/Qes` is exact; `Rme = BL²/Re` is not.** The first reproduces the stored
value to all 16 digits, the second is out by −0.17385 %. `WINISD_SCHEMA.md` §4 rows 3 and 4 present
these as one relation group; they are not equivalent in WinISD data.

**2. The cause is inconsistent INPUT, not a wrong formula.** The same −0.17385 % appears in three
independent places:

| comparison                                               | deviation  |
| --------------------------------------------------------- | ---------- |
| `Rme = BL²/Re` vs stored `Rme`                            | −0.17385 % |
| stored `Re` vs the `Qes = 2π·Fs·Mms·Re/BL²` identity      | −0.17385 % |
| `Cms` implied by entered `Vas` and `Sd` vs entered `Cms`  | −0.17385 % |
| entered `Vas` vs `ρc²Sd²·Cms`                             | +0.17415 % |

Entered `Cms = 0.0013` and entered `Vas = 0.0891` disagree by 0.174 % given `Sd`. WinISD derives
`Mms` through the `Cms` chain and `Re` through the `Vas` chain and never reconciles them, so the
two `Rme` expressions land in different places. `BL²/Re` is a correct formula fed by an `Re` that
came from a different input.

**Consequence:** computing `Rme` both ways is a live consistency check on `Vas` against `Cms`.
A DQ tolerance wider than the entry disagreement cannot see it.

**3. The SPL/η₀ constant is derived, not a literal.**

    SPL = K + 10·log10(η₀)        K = 10·log10(ρ·c / (2π·p_ref²))        p_ref = 20e-6 Pa

Back-solved from this file, `K = 112.154453213`; the expression gives `112.154453213` — agreement
1.4e-13 dB. Reconstructing SPL from first principles (`p² = ρ·c·η₀/(2π)`, r = 1 m, half space)
reproduces the stored `SPL` to all 12 printed digits.

`K` therefore moves with `ρ` and `c`, and so with temperature, humidity and pressure:
112.1545 at WinISD's 20 °C/30 % RH defaults, 112.1593 for textbook dry-air constants, 112.0818 at
30 °C.

**4. `no` is the textbook η₀.** Both `4π²/c³ · Fs³·Vas/Qes` and `ρ/(2πc) · Bl²Sd²/(Re·Mms²)`
reproduce the stored value to 10+ digits.

### Caveat

The parameter values are not a real driver — fields were cleared to force recomputation, so
`η₀ = 0.18` is physically implausible. That does not affect any finding above: every one is a
relationship between the file's own numbers, and WinISD computed them from what it was given.
It is also, per the deletion rationale above, a third-party scraped file rather than a direct
WinISD capture — a further reason to treat its `ParState` groupings as illustrative, not as
ground truth for what WinISD itself marks E/C/N.
