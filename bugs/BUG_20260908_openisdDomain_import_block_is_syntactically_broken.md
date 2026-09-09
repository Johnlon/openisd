# openisdDomain.ts has an import statement nested inside another, so the file cannot parse

Status: RESOLVED

## Symptom

`packages/ui/test/ui/architecture.test.ts` aborts mid-scan:

```
Error: Expected the module specifier to be a string literal.
 ❯ ImportDeclaration.getModuleSpecifier
 ❯ importsOf test/ui/architecture.test.ts:90:22
```

The gate stops at the first file it cannot read, so every layering offence after that point goes
unreported — including the unruled `winisd->engine` edge, which was visible before this file
entered the scan and silently vanished afterwards.

## Evidence

`packages/design/domain/openisdDomain.ts:8`:

```ts
import {
import { _openISDProjectJsonSchema, OpenISDDeviceJson, type SpecEntryJson, ... } from './openisdSchema.js';
    OpenISDDeviceJson,
    type SpecEntryJson,
    ...
} from './openisdSchema.js';
```

A single-line `import` was pasted between `import {` and its closing brace. TypeScript parses
the outer statement's specifier as the inner `import` keyword rather than a string, which is
what `getModuleSpecifierValue()` reports.

The two statements name overlapping bindings, and the inner one additionally imports
`_openISDProjectJsonSchema`, which the outer does not.

## Cause

An editing accident in an uncommitted change, not a migration artefact — the file is one of the
four modified in the working tree at the time.

## Fix

Keep one import statement. The union of the two binding lists is the outer list plus
`_openISDProjectJsonSchema`, so the outer multi-line statement absorbs that one name and the
pasted line is removed.

## Verification

`npx tsc -p packages/design --noEmit` parses the file, and
`npx vitest run packages/ui/test/ui/architecture.test.ts` completes its scan instead of throwing
at `importsOf`.
