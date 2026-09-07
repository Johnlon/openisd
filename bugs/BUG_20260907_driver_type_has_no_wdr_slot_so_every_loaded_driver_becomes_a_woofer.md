# A driver's `driverType` has no `.wdr` slot, so loading any `.wdr` always yields `woofer`

**Status:** OPEN — not fixed.
**Found:** 2026-09-07, John.

## Symptom

Writing an OID driver record to `.wdr` and reading it back always produces `driverType: 'woofer'`,
regardless of the original record's type. A tweeter written out and read back becomes a woofer.

## Cause

The WinISD `.wdr` INI format has no field for driver type. `packages/design/winisd/winisdDriver.ts`
declares no `Type=`/`DriverType=`-style header key, and neither does the reader in
`packages/design/domain/openisdRecordSchema.ts` (`winISDDriverToOpenISDDeviceJson`). The value is
simply not representable in the file, so on read there is nothing to set it from, and it falls
back to whatever default the record schema assigns unrepresented fields — `woofer`.

## Impact

Every `.wdr` round trip involving a non-woofer driver silently corrupts its type. There is no
error, no DQ mark, no visible sign of loss — the record just becomes a different kind of driver.

## Fix direction

`driverType` is one of possibly several OID fields with no `.wdr` counterpart. The file already
has a proven mechanism for carrying data through fields real WinISD preserves verbatim on its own
write: `Comment=` already appends `[DQ]`-tagged lines via `commentWithDq()`
(`packages/design/winisd/winisdDriver.ts:151-274`), and real WinISD round-trips `Comment=` content
unchanged because it treats it as opaque text.

Extend that mechanism: on OID→WDR write, append every otherwise-unrepresentable field (starting
with `driverType`) into `Comment=` in a parseable form; on WDR→OID read, parse it back out. A file
without this tag falls back to today's default (`woofer`), which is why the fix must be additive
to old files, not a required key.

**Why not a fake INI field instead:** a fabricated key (e.g. an invented `DriverType=` line) would
not survive a write from the real WinISD application — WinISD writes only its own known keys and
drops anything it doesn't recognize. `Comment=` is the only field genuinely opaque to WinISD, so
it is the only field that survives a real-WinISD-mediated round trip (OID write → WinISD load →
WinISD save → OID read).

## Verification when fixed

A round trip test: build an OID record with `driverType: 'tweeter'`, write to `.wdr`, read it back,
assert `driverType === 'tweeter'`. Add a second case for a `.wdr` with no such comment tag,
asserting it still falls back to `'woofer'` rather than erroring.

## Related gap: `#driverSection` has no production populator

`WinISDProject` (`packages/design/winisd/winisdProject.ts:69`) holds the `[Driver]` block as
opaque `.wdr` text in `#driverSection`, marked with a standing `// FIXME: why is this here?`. It
is set two ways: `fromWprIni()` (line 111), which extracts it by parsing a `.wpr` file already
read from disk, and `build()` (line 97), which takes it as a caller-supplied string parameter.

`build()` has no production caller. Every call site outside `winisdProject.ts` itself is a test
(`test/winisd/winisdProject.test.ts`, `winisdProjectParse.test.ts`,
`unknownKeyCarryThrough.test.ts`). There is no code path in the app that assembles a
`WinISDDriver`'s `.wdr` text and passes it to `WinISDProject.build()` to produce a `.wpr` carrying
a populated `[Driver]` section — the only way `#driverSection` is ever non-empty today is reading
a `.wpr` someone else already wrote.

This matters here because the `driverType`-in-`Comment=` fix above only round-trips through a real
`.wpr` write if something actually calls `build()` with the driver's own `.wdr` text as
`driverSection`. If OpenISD's `.wpr` export path never does that, the fix works for `.wdr` files
but not for the `[Driver]` section of an OID-authored `.wpr` project file.
