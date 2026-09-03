# BUG — `WinISDDriver.fromWdr(text).toWdr()` is not byte-identical: line endings lost, and Xlim's ParState mark downgraded

# Status
RESOLVED — `WinISDDriver.toWdr()` joins with `\r\n` (`winisdDriver.ts:232`), writes no `Xlim=`
line, and carries slot 10's mark via the dedicated `Xlim` cell (`winisdDriver.ts:188-189,244`).
Covered by `packages/winisd/test/wdr-round-trip.test.ts`'s byte-for-byte assertion over every
`drivers/sample/winisd/*.wdr` file — verified 2026-08-21,
`npx vitest run packages/winisd/test/wdr-round-trip.test.ts` → 85/85.

## Symptom

```
WinISDDriver.fromWdr(text).toWdr() !== text
```

for every file in `drivers/sample/winisd/` — files WinISD itself wrote.

Found by running the obvious assertion the human proposed, after an earlier version of
`wdr-carried-keys.test.ts` compared only a hand-listed subset of keys and passed.

## Evidence

`drivers/sample/winisd/John-all-manu-populated.wdr`, read then written:

- 58 lines in, 58 lines out. **Key order identical. Key set identical** — nothing added, nothing
  dropped.
- Every value identical **except one line**.

```
src CRLF? true    out CRLF? false
line 56:
  ParState=CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC
  ParState=CEECEEECCENCEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC
                    ^ slot 10
```

The whole 57-byte length difference (1011 → 954) is accounted for by 57 line endings: the
source is CRLF, the writer emits LF.

## Two independent causes

### 1. The writer emits LF; WinISD writes CRLF

`.wdr` is a Windows INI. Every file in the sample corpus is CRLF. The writer joins with `\n`,
so a file OpenISD writes differs from a file WinISD writes in every single line, even when
every value is right.

This is not cosmetic. It makes byte-comparison against a WinISD-written oracle impossible —
which is exactly the comparison Plan 2 depends on when `winisd_tools` starts producing `.wdr`
through the bundle and every record must be checked byte-identical against the committed one.

### 2. ParState slot 10 (`Xlim`) is downgraded from `E` to `N`

The source states `E`: WinISD marked Xlim entered. The writer emits `N`.

Slot 10 is `Xlim`, which is **ParState-only — it has no `.wdr` key** (`parstate.ts`:
`null,     // 10 Xlim — ParState-only, no WDR key`). So the value survives round-trip
trivially (there is no line to carry), but its MARK does not: nothing reads slot 10 on import,
so nothing can write it back on export, and it defaults to `N`.

`N` does not mean "we do not know" — it means "not in play". So this writes a positive claim
that WinISD's own file contradicts.

## Fix

1. Join with `\r\n` in `WinISDDriver.toWdr()`.
2. Carry the source ParState's slot-10 mark through `fromWdr` → record → `toWdrIni`. It has no
   `.wdr` key, so it needs somewhere to live on the record, or `WinISDDriver` must retain the
   as-read ParState for the slots it cannot otherwise reconstruct.

## Verification

The test that found it, and the one that must pass:

```ts
assert.equal(WinISDDriver.fromWdr(text).toWdr(), text);
```

over every `.wdr` in `drivers/sample/winisd/`. Not a subset of keys — the whole file, byte for
byte. A subset test passed while both of these were broken.

## Note on the test this replaces

`wdr-carried-keys.test.ts` listed a `CARRIED` set of "fields WinISD stores but OpenISD does not
simulate" and compared only those. Two faults, both the human's:

- The list was **wrong**: `Hc`/`Hg` ARE simulated (they map to the engine as `Hc`/`Hg` and
  `Mcost` derives from them), and `Gloss` is engine-derived. The comment asserting otherwise was
  false.
- The comparison only looked at keys present in the SOURCE, so a key the writer INVENTED would
  not have been caught at all.

Neither matters once the assertion is the whole file.

---

## Cause 3 — the writer emits an `Xlim=` line, which WinISD never writes

`winisdDriver.ts` (export path) does:

```ts
if (xlimEntered != null) cells.set('Xlim', { value: fmt(xlimEntered), state: 'E' });
…
// Xlim: openisd's own extension line (never a real WinISD key …)
if (xlim) lines.push(`Xlim=${xlim.value}`);
```

**Evidence that this is wrong:**

- `grep -l "^Xlim=" drivers/sample/winisd/*.wdr` → **0 files**. Not one file WinISD wrote
  contains an `Xlim=` line.
- `drivers/sample/winisd/s-xlim.wdr` — a single-parameter probe, Xlim typed into WinISD and
  saved — carries `ParState=NNNNNNNNNNE…`, i.e. **slot 10 = `E`**, and still no `Xlim=` line.

So WinISD tracks Xlim's MARK in ParState and does not persist its VALUE to the file at all.

`parstate.ts` already said this correctly: `null,     // 10 Xlim — ParState-only, no WDR key`.
The "openisd's own extension" framing was invented and is false — **there is no extension
mechanism in `.wdr`**. A `.wdr` OpenISD writes with an `Xlim=` line is a file with a key WinISD
does not read, so the value is silently dropped the first time WinISD saves over it, while the
ParState slot claims a value was entered.

**Fix:** never write an `Xlim=` line. Carry slot 10's MARK through the round trip, and nothing
else — there is no value to carry, because WinISD does not keep one.
