# A record with no `specs` key reaches `OpenISDDriver` and throws

## Status
OPEN — producer not identified.

## Symptom

The app throws on load and three reactive computations die together — `toDriver`, `cell` and
`errors` — so the driver panel, the charts and the error list all fail at once:

```
TypeError: Cannot read properties of undefined (reading 'woofer')
    at #specs      (openisdDriver.ts)
    at #effective  (managedProject.ts)
    at toDriver / cell / errors
```

## Cause

```ts
#specs(): SpecSection {
  const s = this.#record.specs[this.#section] ?? {};
```

The `?? {}` guards a missing SECTION. It does not guard a missing `specs` key, and the record
reaching this line has none, so indexing `undefined` throws before the fallback applies.

`OpenISDDriver.empty()` sets `specs: { woofer: {} }`, so a record the app authored in-session
always has the key. The offending record arrives from outside: restored state, browser storage, or
a bundled record.

## What is not yet known

Which producer emits a record with no `specs` key. That is the substance of this fix — the guard
is one line, but adding it without finding the producer would convert a loud failure into a
silently empty driver panel.

## Fix

Identify the producer and make it emit a conforming record, or refuse the record at the seam that
reads it, so a non-conforming record is rejected where it enters rather than throwing deep in a
getter.

## Verification

A record with no `specs` key is refused at the reading seam with a named error, and no code path
reaches `#specs()` with one.
