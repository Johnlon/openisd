Status: RESOLVED

# `[DQ]` lines vanish because the test seam round-trips the driver through `.wdr` TEXT

## Symptom

`packages/winisd/test/openisdToWdr.test.ts` → "a record with N marks produces N `[DQ]` lines"
fails. The record carries two DQ marks; the exported `Comment=` block carries none.

```
+ actual - expected
+ 'a driver'
- 'a driver\n[DQ] Qts=1.5: Qts=1.5 above max 0.8\n[DQ] Vas=140: Vas=140 above max 60 L'
```

## Evidence

The projection itself is fine. Driven directly off a record, `dqMarks()` returns both marks:

```
dqMarks: [{"field":"Qts","value":1.5,"mark":{...,"detail":"Qts=1.5 above max 0.8"}}]
```

The loss is in the test's own seam helper, `openisdToWdr.test.ts:36-49`:

```ts
const { value: text, errors } = OpenISDDriver.fromJsonRecord(record as never).toWdrText();
return { value: text == null ? null : WinISDDriver.fromWdrIni(text), errors };
```

It builds the `.wdr` TEXT and then re-parses it back into a `WinISDDriver`. `toWdr()` writes
the DQ marks as additional PHYSICAL LINES beneath `Comment=` (`winisdDriver.ts:203`,
`commentWithDq`), and `fromWdrIni` (`winisdDriver.ts:153`) skips every line beginning `[`:

```ts
if (i < 0 || line[0] === '[') continue;
```

A `[DQ] Qts=1.5: …` line starts with `[`, so it is discarded. The re-parsed driver's comment
is the first physical line alone.

## Cause

The helper takes a lossy detour. The seam the test names in its own header is
`fromYaml(yamlText) -> Result<WinISDDriver>`; a `WinISDDriver` is available directly from
`OpenISDDriver.toWinISDDriver()`, which is public. Serialising to text and parsing it back adds
a second, narrower boundary the test never intended to exercise — and `.wdr` text is not a
lossless carrier for a multi-line `Comment=`.

## Fix

`fromYaml` asks the driver for its `WinISDDriver` instead of round-tripping through text:

```ts
return OpenISDDriver.fromJsonRecord(record as never).toWinISDDriver();
```

Not fixed by relaxing the assertion: the two `[DQ]` lines are real output the writer produces
and the test was right to demand them.

## The separate, real finding this exposed — CORRECTED

An earlier version of this record concluded that `.wdr` text cannot carry `[DQ]` marks back in
"because WinISD's format has no multi-line value syntax". **That is wrong.** It has one: an
embedded newline in a string field is the single byte `0xA4`, so `Comment=` stays on ONE
physical line. 134 WinISD-written `.wdr` files in this repo use it, and
`winisd_tools/scrapers/scrapers/lib/wdr_ini_file.py` implements it on both sides.

OpenISD's TypeScript boundary implements neither side, which corrupts every multi-line comment
in both directions and is a far more serious defect than the test-seam issue above. Recorded
separately: `bugs/BUG_20260821_wdr_boundary_ignores_winisds_0xa4_newline_sentinel_in_string_fields.md`.

The fix above — routing the test seam off the lossy text round-trip — remains correct and
independent of it.

## Verification

`npx vitest run packages/winisd` → 1242/1242 passing, including the DQ test.
