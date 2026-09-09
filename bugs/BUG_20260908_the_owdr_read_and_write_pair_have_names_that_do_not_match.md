# The .owdr read and write methods have names that do not match, and one implies any YAML

Status: OPEN

## Symptom

One file format, two method names that do not look like a pair:

```ts
openisdDomain.ts:1163  static fromYml(text: string, engine: Engine): OpenISDDriver | string[]
openisdDomain.ts:1418  toOwdrText(): string
```

A reader looking for how `.owdr` is read finds `toOwdrText` and no `fromOwdrText`, and has to
open `fromYml` to discover it is the same format.

`fromYml` also reads as "accepts any YAML". It does not — it accepts `.owdr` driver YAML only.

## Evidence

They are exact inverses over the same serialisation, read 2026-09-08:

| Method | Delegates to |
|---|---|
| `toOwdrText()` | `OpenISDDeviceJson.toOpenisdDriverYml(this.record.get())` |
| `fromYml()` | `OpenISDDeviceJson.fromOpenisdDriverYml(text)` |

`toOwdrText`'s own docstring already states the pairing:

```
/** This driver as `.owdr` text — openisd driver YAML, the form `OpenISDDriver.fromYml` reads
 *  back. ... */
```

so the file itself has to explain in prose what matching names would have said.

## Cause

The write side was named for the FILE FORMAT (`.owdr`) and the read side for the ENCODING
(YAML). Both are true of the same bytes, so neither name is wrong on its own — but together they
hide that the two are one pair, and `Yml` claims a wider input than the method accepts.

## Fix

Rename `fromYml` to `fromOwdrText`, matching `toOwdrText`.

Callers to update (searched 2026-09-08):

- `packages/ui/src/logic/fileImportExport.ts:59` — `owdrTextToDriver`, the only application
  caller.

## Verification

None yet — recorded, not fixed.
