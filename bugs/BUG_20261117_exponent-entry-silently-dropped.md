# BUG_20261117_exponent-entry-silently-dropped

**Status:** CLOSED by John's ruling (T868, the fix that stops the Driver Editor silently dropping refused entries): the 'e' key keeps doing nothing.

## Symptom
Typing `1e9` into any number box: the `e` never appears (the box shows `19`), no mark, no note.

## Ruling
John, 18 Nov 2026 00:01 UTC, on the board card exponent-entry: "Remove the e: key does nothing, as today". Earlier (17 Nov 2026 23:58 UTC) on whether to accept 1e9 or refuse it with a mark: "asked for it or even know how to use that? noone will use it imho".

So number boxes do not accept exponent entries and show no note for them; the key `e` is ignored as before, and pasted text is read as before. The earlier change that accepted exponents was removed.
