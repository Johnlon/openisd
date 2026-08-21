# `WinISDDriver.fromOpenISDRecord` is called in 9 places and does not exist — build is broken

# Status
RESOLVED — neither `fromOpenISDRecord` nor `fromOpenISDDriver` exists on `WinISDDriver` any
more (`grep -n "static from" packages/winisd/src/winisdDriver.ts` → only `fromWdrIni`). The
QO55 rewrite replaced the whole seam with `OpenISDDriver.toWinISDDriver()`
(`packages/winisd/test/winisdDriver-diff.test.ts:34-37`), a pure getter/setter projection with
no `.toRecord()` call inside `winisdDriver.ts`.

## Symptom

`npx tsc`/`vue-tsc` report `Property 'fromOpenISDRecord' does not exist on type 'typeof
WinISDDriver'. Did you mean 'fromOpenISDDriver'?` at every one of 9 call sites. Not a false
positive — `fromOpenISDRecord` is genuinely undeclared; only `fromOpenISDDriver` exists.
Encountered multiple times already this session and wrongly dismissed as "pre-existing,
unrelated" without root-causing it — recording properly now instead.

## Evidence

`grep -n "static from" packages/winisd/src/winisdDriver.ts` — only one static factory of this
shape exists:
```
261:  static fromOpenISDDriver(driver: OpenISDDriver): Result<WinISDDriver> {
```

Every call site actually used in the tree, `fromOpenISDRecord` (undeclared):
```
packages/ui/src/logic/winIsdDriverFileIo.ts:35
  WinISDDriver.fromOpenISDRecord(driver.toRecord(), { ebp: driver.ebp() });
packages/winisd/src/winisdDriver.ts:385   (INSIDE the class's own toWdr()/similar method)
  return WinISDDriver.fromOpenISDRecord(record);
packages/winisd/test/wdr-import-fidelity.test.ts:76,107
packages/winisd/test/winisd-parity.test.ts:364
packages/winisd/test/wdr-openisd-round-trip.test.ts:123
packages/winisd/test/wdr-to-openisd-record.test.ts:77
packages/winisd/test/winisdDriver-diff.test.ts:8   (doc comment describing the test seam)
```
Plus two more doc-comment mentions inside `winisdDriver.ts` (lines 454, 548) describing
`fromOpenISDRecord(record)` as the correct call shape.

## Cause

`fromOpenISDDriver(driver: OpenISDDriver)` is the real, correctly-encapsulated factory — it
takes the live `OpenISDDriver` object and extracts `.toRecord()`/`.ebp()` internally, matching
the no-calc-logic rule already documented right above it (citing
`BUG_20260817_wdr_writer_computes_ebp_itself_violating_its_own_no-calc-logic_rule.md`). Every
call site instead calls a similarly-named `fromOpenISDRecord`, passing `driver.toRecord()`
(and, at the production call site, a separately-computed `{ ebp: driver.ebp() }`) — the OLDER,
encapsulation-violating shape this method was presumably renamed away from. The rename to
`fromOpenISDDriver` landed for the method's own declaration and its internal self-call
(`winisdDriver.ts:385`, which ALSO still calls the old name — even the class's own internal
code wasn't updated), but none of the 9 external call sites were updated to match.

## Fix

**SUPERSEDED (human ruling, 2026-08-18) — NOT a rename to `fromOpenISDDriver`.** `driver
.toRecord()` being called ANYWHERE inside `winisdDriver.ts` is absolutely forbidden — the raw
JSON record is confidential and off-limits outside its owner. `fromOpenISDDriver`'s own current
body calls `driver.toRecord()` internally (`winisdDriver.ts:262`) and reads raw record fields
directly (`section[specKey]`, `entry.readings`, `entry.origin`) — so it is ALSO in violation,
not a safe target to repoint the 9 broken call sites at as-is. This bug is subsumed by QO55
(questions.yml, open since 2026-08-17, restated 2026-08-18): the full fix is rewriting
`WinISDDriver`'s construction as a pure getter/setter sequence — every field read through
`OpenISDDriver`'s own getters (value AND E/C/N state), zero internal derivation, zero
`.toRecord()` call anywhere in `winisdDriver.ts`. Do not fix this bug narrowly (renaming call
sites) without doing that rewrite — see QO55 for the full ruling and scope.

## Verification

Fixed. `grep -rn "fromOpenISDRecord\|fromOpenISDDriver" packages --include="*.ts"` (excluding
`node_modules`) returns exactly one hit, a stale doc-comment sentence in
`winisdDriver-diff.test.ts:8` — not a call site. Every former call site
(`winIsdDriverFileIo.ts`, the test files listed above) now goes through
`OpenISDDriver.toWinISDDriver()` / `OpenISDDriver.fromWinISDDriver()`
(`packages/model/src/openisdDriver.ts:370,439`). `WinISDDriver` itself declares no
`fromOpenISDRecord`/`fromOpenISDDriver` static factory at all — only `fromWdrIni`.
