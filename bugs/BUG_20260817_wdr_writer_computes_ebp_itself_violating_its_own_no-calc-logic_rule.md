# BUG — `WinISDDriver.fromOpenISDRecord` computes EBP itself, violating its own documented "no calculation logic" rule

## Symptom

`packages/winisd/src/winisdDriver.ts:341`:

```ts
if (computed.EBP == null && computed.Fs > 0 && computed.Qes > 0) computed.EBP = computed.Fs / computed.Qes;
```

`WinISDDriver` performs arithmetic — Fs/Qes — on its own, inline, at export time.

## Cause

`ARCHITECTURE.md:815-818` ("`WinISDDriver` is solely a serialisation device") already states the rule
this line breaks:

> A strongly-typed, validating class carrying **no application or calculation logic at all**. It does
> not derive, hold live state, or persist between calls.

The rest of `fromOpenISDRecord` honours this — every other field in `computed` comes from
`deriveOpenISDFields()` (`@openisd/model`), never computed by `winisdDriver.ts` itself. EBP is
the one exception: because EBP is not a real `SpecField` (no entry in `SpecSection`, no
`setVal('EBP', ...)` anywhere in the engine — see `bugs/...ebp...` context from the same session),
`deriveOpenISDFields()` never produces it, and a fallback formula was bolted directly onto the
writer instead of being routed through the domain object that owns it.

Human ruling (2026-08-17), the second half of which this bug also violates: EBP (and any
calculated driver value) is reachable **only** via a getter on an `OpenISDDriver` instance —
`driver.ebp()` — never computed inline anywhere else, and `WinISDDriver`/`winisdDriver.ts`
specifically must never construct or reference `OpenISDDriver`, nor perform any calculation of
its own; it is a pure value object used only for serialisation in and out.

## Fix

- Delete the inline formula from `winisdDriver.ts`.
- `OpenISDDriver.ebp()` (`packages/model/src/openisdDriver.ts`) is the one place this formula
  lives — already added this session.
- `packages/ui/src/logic/winIsdDriverFileIo.ts` — the ONE module allowed to construct a
  `WinISDDriver` at all — is where the derivation belongs: construct
  `OpenISDDriver.fromRecord(record)`, read `.ebp()`, and pass it into
  `WinISDDriver.fromOpenISDRecord` as an explicit pre-computed input (a new optional parameter),
  never inferred inside the writer.

## Verification

Not yet run — fix landing in the same change as this record.
