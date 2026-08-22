# The app-state module carries a file-scope `no-explicit-any` disable

## Status
OPEN

## Symptom

`packages/ui/src/logic/appState.ts:14`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
```

A file-scope disable turns the rule off for every line below it, including lines added later that
nobody chose to exempt. The module is the app's live reactive state and is edited constantly, so
the exemption widens with every change.

## Cause

`window` casts in the hot-reload singleton plumbing need `any`. Disabling the rule for the whole
file was the cheapest way to allow them, and it silently covers everything else.

## Fix

Delete the file-scope disable. Type the `window` accesses properly, or scope the exemption to the
individual lines that genuinely need it so a new `any` elsewhere in the file fails lint.

## Verification

`packages/ui/src/logic/appState.ts` carries no file-scope `eslint-disable`, and lint passes.
