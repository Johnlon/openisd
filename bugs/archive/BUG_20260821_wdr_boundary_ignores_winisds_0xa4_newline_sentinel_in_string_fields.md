Status: RESOLVED

# The `.wdr` boundary ignores WinISD's `0xA4` newline sentinel — multi-line `Comment=` is corrupted in BOTH directions

## Symptom

A `.wdr` string field may contain embedded newlines. WinISD encodes each one as the single
byte **`0xA4`**, keeping `Comment=` on ONE physical line. OpenISD's TypeScript `.wdr` boundary
knows nothing about it:

- **EXPORT** — `WinISDDriver.toWdr()` writes real `\n` line breaks inside `Comment=`
  (`commentWithDq`, `winisdDriver.ts:90-93`). The result is a `.wdr` WinISD cannot read as
  written: everything after the first newline becomes stray lines in the `[Driver]` section.
- **IMPORT** — the file is read with `FileReader.readAsText()` (`useDesignIO.ts:376`,
  `driverLibrary.ts:363`), i.e. UTF-8. `0xA4` is not valid UTF-8 on its own, so it decodes to
  U+FFFD and the newline is **unrecoverable** — the byte is gone before `fromWdrIni` ever sees
  the string.

## Evidence

**The format, from the reference implementation** — `winisd_tools/scrapers/scrapers/lib/wdr_ini_file.py:6-9`:

```python
# Sentinel character to represent embedded newlines during string serialization.
# Decoded UTF-8 representation of  is replaced by b"\xa4" in final byte serialization.
_SENTINEL_NL = ""
_SENTINEL_BYTES = _SENTINEL_NL.encode("utf-8")
```

Write (`:28`, `:83-84`) — encode UTF-8, then collapse the sentinel to one byte:

```python
return val_str.replace("\r\n", "\n").replace("\r", "\n").replace("\n", _SENTINEL_NL)
...
text = "\r\n".join(lines) + "\r\n"
return text.encode("utf-8").replace(_SENTINEL_BYTES, b"\xa4")
```

Read (`:46-55`) — split on BYTES, substitute, and only then decode:

```python
for line in data.split(b"\n"):
    ...
    val_bytes_fixed = val_bytes.strip(b" \t\r").replace(b"\xa4", b"\n")
    val = val_bytes_fixed.decode("utf-8", errors="replace")
```

**WinISD's own files use it — 134 of them** in this repo:

```
drivers/sample/winisd/driver-with-latin-text.wdr
  b'Comment=multi line \xa4comment \xa4in plain ascii'
drivers/sample/winisd/john-all-entered-driver-dim123s.wdr
  b'Comment=I just typed 1..n on all fields and ignored the fact that the app then mayu have recalculated some\xa4I had previously omitted…'
files containing 0xA4: 134
```

**Nothing in the TS packages mentions it** — `grep -rn "a4\|A4\|F8A4\|¤" packages/winisd/src packages/model/src` returns one unrelated hit (`GAPS.md §A4` in a comment).

## Cause

The `.wdr` boundary was built as a TEXT boundary. `toWdr()` returns a `string` and
`fromWdrIni()` takes one, so there is no place in the current shape where a byte-level
substitution can happen — and `0xA4` is defined at the byte level, deliberately, because it is
illegal UTF-8 and therefore cannot collide with real content.

This is also the true cause of the `[DQ]`-marks loss recorded in
`bugs/BUG_20260821_dq_marks_lost_because_the_test_seam_round_trips_through_wdr_text.md`. That
bug's stated finding — "`.wdr` text cannot carry `[DQ]` marks back in… WinISD's format has no
multi-line value syntax" — is **WRONG**. The format has exactly such a syntax; this code does
not implement it. That file's fix (routing the test off the text round-trip) is still correct
and still needed; its concluding claim about the format is not.

## Fix

The `.wdr` boundary is now a BYTE boundary, and `packages/winisd/src/wdrBytes.ts` is the only
code that knows the encoding:

- `wdrBytesToText(bytes)` — file bytes to text, with each sentinel becoming
  `WDR_NEWLINE_SENTINEL` (`U+F8A4`, private-use, matching the reference implementation).
- `wdrTextToBytes(text)` — text to file bytes, collapsing the sentinel back to one `0xA4`.
- `WinISDDriver.fromWdrIni` turns the sentinel into a real `\n` PER VALUE, after the line
  split, so a comment's newlines can never be mistaken for line structure.
- `WinISDDriver.toWdr` runs every string field through `oneLine()`, so each stays on one
  physical line.

**One deliberate difference from the Python, LATENT on today's corpus.** `wdr_ini_file.py:53`
does `val_bytes.replace(b"\xa4", b"\n")` — every `0xA4` byte, including one that is a legal
UTF-8 CONTINUATION byte. Demonstrated: the value `cost ¤5\nx` (where `¤` is `C2 A4`) encodes to
`b'cost \xc2\xa45\xa4x'`, and Python reads it back as `'cost \ufffd\n5\nx'` — the character is
destroyed and a phantom newline appears. `wdrBytesToText` walks UTF-8 sequences and treats
`0xA4` as the sentinel only in LEAD position, so it returns `cost ¤5\nx`.

**Measured, so the scale is not overstated: the two algorithms DISAGREE on 0 of 86,448 values
across all 1,626 `.wdr` files in the repo.** No file currently holds a character whose UTF-8
carries `0xA4` as a continuation byte, so this is a latent difference, not a live corruption.
It is implemented the strict way because the cost is nil and the failure would be silent.

App wiring, so the fix actually reaches the user:

- `logic/driverFileText.ts` — new `readDriverFileText(file)`: `readAsArrayBuffer` then
  `wdrBytesToText`. Replaces `readAsText` in `driverLibrary.ts`, `useDesignIO.ts` and
  `DriverEditorModal.vue`. Applied to EVERY driver/project file, not just `.wdr`, because a
  `.wpr` embeds its `[Driver]` block verbatim and carries sentinels too; for a file with none
  the decode is the identity.
- `persist.ts` `download()` and `fileSave.ts` `saveTextAs()`/`writeToHandle()` accept
  `string | Uint8Array`; the `.wdr` and `.wpr` producers call `wdrTextToBytes` first. `.owdr`
  and `.owpr` stay text — they are JSON.

## Out of scope, recorded here so it is not lost

**29 of 1626 `.wdr` files in the repo are not valid UTF-8 even with the sentinel removed**, so
the corpus is mixed UTF-8 / CP1252. `wdrBytesToText` decodes UTF-8, so those files lose their
non-ASCII characters to replacement characters. That is a CHARSET question, separate from the
sentinel, and needs its own decision (sniff? assume CP1252 on decode failure? ask WinISD what
it writes?). Not addressed by this fix.

## Verification

`packages/winisd/test/wdrBytes.test.ts` — 5 tests, all passing, oracle
`drivers/sample/winisd/driver-with-unicode-text.wdr` (WinISD-written; its `Comment=` holds a
Euro sign, Kanji and two sentinels on one physical line):

- the sample decodes with both sentinels intact and the multi-byte characters around them whole
- a `0xA4` inside a multi-byte sequence is treated as data
- bytes to text to bytes is the IDENTITY on that file, byte for byte
- a multi-line comment survives a full `WinISDDriver` round trip and comes back out on one line
- appended `[DQ]` lines are encoded the same way, being newlines in the comment like any other
