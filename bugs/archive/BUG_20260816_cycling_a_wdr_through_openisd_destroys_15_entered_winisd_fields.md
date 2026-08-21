# BUG — cycling a `.wdr` through `OpenISDDriver` destroys 15 fields the user entered

# Status
- 15-field silent drop: FIXED
- KLe never computed: OPEN

## Symptom

`.wdr` → `WinISDDriver` → `OpenISDDriver` → `WinISDDriver` → `.wdr` silently loses the value of
15 keys, including ones the source file marks `E` — a value a human typed into WinISD.

Measured over `drivers/sample/winisd/`, source value → value after one cycle:

| key | source (E) | after cycle |
|---|---|---|
| `USPL` | 24 | 0 |
| `alfaVC` | 27 | 0 |
| `Rt` | 28 | 0 |
| `Ct` | 29 | 0 |
| `no` | 0.22 | 0.000008812026456079414 |
| `SPLmax` | 31 | 35.222192947339195 |
| `SPLmaxLF` | 30 | 66.9256782990961 |
| `Rme` | 32 | 0.15079644737231007 |
| `gamma` | 33 | 43333.333333333336 |
| `Mpow` | 34 | 3.3333333333333335 |
| `Mcost` | 35 | 0.15093837344042518 |
| `Gloss` | 0.37 | 0.9703333843419254 |
| `c` | 38 | 343.684120962152 |
| `roo` | 39 | 1.20095217714682 |
| `Vd` | 0.0002 | 0.00017280000000000003 |

(The ordinal-looking sources are `john-all-set.wdr` and the `john-all-entered-driver-dim*.wdr`
probes, where each field was given its slot number so a slot could be identified by its value.
`Vd`'s row is from `inconsistency-test-saved.wdr`, where `Vd` is deliberately inconsistent —
and the cycle "corrects" it, destroying the very inconsistency the file exists to carry.)

## Cause — an entered value that cannot be represented is dropped SILENTLY

`winisdDriver.ts`, `toOpenISDRecord()`:

```ts
for (const [wdrKey, cell] of this.#cells) {
  if (cell.state !== 'E') continue;          // 1
  const mapped = WDR_TO_SPEC.get(wdrKey);
  if (!mapped) continue;                     // 2  <- the value ends here
  const [specKey, inv] = mapped;
  const v = Number(cell.value);
  if (!isFinite(v)) continue;                // 3
  woofer[specKey] = { origin: 'manual', readings: { manual: { read_value: v * inv } }, dq: [] };
}
```

**What `mapped` tests.** Every key in `#cells` is ALREADY a WinISD `.wdr` field — they are keyed
by `NUMERIC_DEFAULTS` and come from the file. So `mapped` is not "is this a WinISD field"; that
is true of every key before the test runs. `WDR_TO_SPEC` is `SPEC_TO_WDR` inverted, so `mapped`
answers: **does OpenISD's own `SpecSection` have a slot for this field, and what is the unit
scale?** `!mapped` means "our record type has nowhere to put this".

So line 2 reads: *when we cannot represent the value the user entered, discard it and say
nothing.*

**Three `continue`s, one of them legitimate:**

| # | fires when | verdict |
|---|---|---|
| 1 | the cell is C or N | **legitimate**, and documented on the method: a C value is WinISD's arithmetic and is re-derived; an N slot has no value |
| 2 | the record has no slot | **silent data loss** |
| 3 | the file's number is malformed | **silent data loss** — corrupt input swallowed without a mark. Measured: no E cell in either corpus (846 files) is non-finite, so this one has never fired. It is a latent drop, not an active one. |

Lines 2 and 3 are the banned tolerance pattern: a record is VALID or INVALID against the one
model, and an input that does not conform is a build-blocking failure, never something to skip.
Neither leaves a DQ mark, a log line, or an error — the caller cannot tell the difference
between "the file did not state Gloss" and "the file stated Gloss and we binned it".

**This is a defect in its own right, whatever QO48 decides.** Where the 15 fields should live
determines whether line 2 ever fires again; it does not make dropping the right thing to do
when it does. Once every representable field has a home, line 2 guards a genuine impossibility
and must FAIL rather than continue.

**Not a naming problem.** `mapped` reads as a routine lookup miss rather than "throw away what
the human typed", which is plausibly why the `continue` survived review — but renaming it would
change no behaviour and destroy nothing but the evidence. The fix is the drop.

## The comment on that map asserts the opposite of what the code does

```ts
/** … A WDR-tracked key with no `SpecEntry` home (`Vd`, `Dia`, `no`, `Gloss`, `Mpow`,
 *  `Mcost`, `Rme`, …) is simply absent from this map — the migration plan's own Step 8
 *  table calls these "WDR-only carried pass-through" … */
```

Nothing carries them and nothing passes them through. `continue` drops them on the floor. This
is the same `CARRIED` idea whose earlier statement in `wdr-carried-keys.test.ts` was already
found to be false about which fields OpenISD simulates (see
`BUG_20260816_wdr-round-trip-is-not-byte-identical…md` §"Note on the test this replaces") —
here it is false about the carrying itself.

**This answers QO45 ("eliminate CARRIED unless you can justify it") with evidence:** the
concept is justified — without it a cycle destroys 15 real fields — but the implementation
named after it does not exist. What was labelled a pass-through is a drop.

## Not in scope of the fix without a ruling

The obvious repair — give all 15 keys a `SpecSection` slot — is wrong as stated.
`SpecSection` is the DRIVER CATALOGUE schema, declared to match `CANONICAL_SPEC_FIELDS` in
`record_registries.py`. `c` (speed of sound) and `roo` (air density) are ENVIRONMENT constants,
not properties of a driver; `Mpow`/`Mcost` are WinISD's costing scratch-pad. Putting them in the
driver record would assert that a driver in the catalogue has a speed of sound.

Raised as a ledger question — see QO48.

## Verification

`packages/winisd/test/wdr-openisd-round-trip.test.ts`, the second loop:

```
WinISDDriver.fromWdr(text) → toOpenISDRecord() → OpenISDDriver.fromRecord()
  → toRecord() → WinISDDriver.fromOpenISDRecord() → toWdr()
```

with three assertions per file: every `E` value survives, every `C` value agrees numerically
with WinISD's own arithmetic, every `N` slot stays `N`.

FIXED. All 16 unplaceable keys were given a home on `SpecSection` — `Dia`, `Vd`, `no`,
`SPLmax`, `SPLmaxLF`, `USPL`, `alfaVC`, `Rt`, `Ct`, `gamma`, `Rme`, `Mpow`, `Mcost`, `Gloss`,
`c`, `roo` — and mapped in `SPEC_TO_WDR`, which carries them in both directions. Measured loss
over `drivers/sample/winisd/` is now ZERO, and the E assertion above is what holds it there:
nothing is excluded from it, so any field that starts being lost fails the suite by name.

The requirement is stated in ARCHITECTURE.md §"The same rule binds the DRIVER" and gated by
`packages/winisd/test/wdr-model-coverage.test.ts`, which fails on any `.wdr` key with no home
and carries NO exemption list. That gate also caught `Dia`, which the round-trip suite could
not: no sample marks `Dia` as `E`, so nothing was ever observed being lost.

## Two further findings from the same suite, separate from this bug

1. **`KLe` is never computed.** `John-all-manu-populated*.wdr` states `KLe=49.6287078253544`
   marked `C`; our cycle returns `0`. WinISD derives it, we do not.
2. **`inconsistency-test-qts-C.wdr` is a deliberately-wrong oracle.** It states `Qts=0.500`
   marked `C` while its own comment records the true value as "~0.358"; our cycle returns
   `0.35805471124620064`. **Our answer is right and the file is intentionally wrong** — this
   file must be excluded from the C-parity assertion by name, with that reason stated, never
   by loosening the tolerance.

---

## Third finding — every `N` -> `C` promotion is a real derivation

An `N` slot in the source comes back `C` in four files. Each file has exactly ONE such slot,
and in every case a derivation genuinely ran from inputs that were present:

| file | slot | source | after cycle | |
|---|---|---|---|---|
| `s-re.wdr` | `Znom` | 0 (N) | 184 | from the entered `Re=123` |
| `s-dd.wdr` | `Sd` | 0 (N) | 11882.288814039995 | = pi*(123/2)^2 from the entered `Dd=123` |
| `s-sd.wdr` | `Dd` | 0 (N) | 0.12514330345744634 | = 2*sqrt(0.0123/pi) from the entered `Sd` |
| `inconsistency-test-qts-N.wdr` | `Qts` | 0.500 (N) | 0.35805471124620064 | = Qes*Qms/(Qes+Qms), correct |

WinISD declined to derive these; we do. **That is a deliberate difference in completeness, not
a defect** — the inputs were present and the answers are right. The consequence to be aware of
is narrower than it first looks: a `.wdr` OpenISD writes can carry a `C` where WinISD's carries
an `N`, so ParState is the one line where our output may legitimately differ from WinISD's.

The suite still forbids the shape that WOULD be a defect: `N` -> `C` where the value is
unchanged, which would be a computation claimed but never run, and `N` -> `E`, which would be a
human statement invented out of a blank. Nothing in the corpus does either today; the rule is
there so nothing starts.
