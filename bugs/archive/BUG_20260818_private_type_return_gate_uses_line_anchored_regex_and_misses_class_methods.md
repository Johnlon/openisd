# The "export typed as private _Name must be _-prefixed" arch gate misses class methods entirely

# Status
FIXED

The gate (`packages/ui/test/ui/architecture.test.ts`, describe block `'an export typed as a
private _Name must itself be _-prefixed'`) is now a `ts-morph` AST walk over
`getFunctions()`/`getVariableStatements()`/`getClasses()` (including `getMethods()` and
`getGetAccessors()`), not a regex. It fires for `OpenISDDriver.toRecord` and for
`ManagedOpenISDProject.snapshot`/`recordToPersist`/`groundRecord`. Class-method coverage is
fixed; see `BUG_20260819_private_type_return_gate_has_no_same_file_owner_exemption.md` for
the follow-on gap this surfaced.

## Symptom

`packages/ui/test/ui/architecture.test.ts`'s `describe('an export typed as a private _Name must
itself be _-prefixed', ...)` gate is meant to catch any exported symbol whose declared return type
names a private `_Name` type without the symbol itself being `_`-prefixed. It never fires for a
CLASS METHOD returning a private type — `OpenISDDriver.toRecord(): _OpenISDDriverJson` in
`packages/model/src/openisdDriver.ts:290` returns the private `_OpenISDDriverJson` type and is not
`_`-prefixed, and the gate does not flag it.

(`toRecord()` itself is legitimate — `OpenISDDriver` is the class that declares `_OpenISDDriverJson`
in the same file, so it is the designated owner exposing its own shape, matching the file's own
documented contract at lines 41/49: "the bytes `toRecord()` hands back" / "RECORDS cross
boundaries, INSTANCES do not." This bug is about the GATE's coverage, not about `toRecord()` being
wrong.)

## Evidence

```
packages/ui/test/ui/architecture.test.ts:594-595:
    const fnDecl = /^\s*export\s+function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*:\s*([^{;]+)/gm;
    const constDecl = /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*:\s*([^=]+)=/gm;
```
Both patterns are anchored on `^\s*export\s+function` / `^\s*export\s+const` — line-start text
requiring the literal keywords `export function`/`export const`. A class method is written
`  toRecord(): _OpenISDDriverJson { ... }` with no `export`/`function` keyword and is indented
inside `class OpenISDDriver { ... }` — neither regex's anchor ever matches it. Running the gate
with `toRecord` present produces zero offences; it was never wired to look inside a class body.

This is the SAME class of bug the entire "leading-underscore exports are class-private" gate
mechanism and its sibling "returns a private type" gate exist to prevent — text-pattern matching
standing in for the actual TypeScript AST, silently blind to any shape the hand-written regex
wasn't written to anticipate.

## Cause

The gate (and its siblings in this file — `privateDeclarationSites`, `namedImportsOf`,
`valueImportsOf`, `topLevelExportsOf`) are all hand-rolled regexes over raw file text, not an AST
walk. This is architecture.test.ts's own established pattern throughout the file (not unique to
this gate), but it means every one of these checks has an unknown-until-hit blind spot for any
TypeScript syntax the regex author didn't enumerate — class methods, getters, arrow-function
consts assigned inside an object literal, etc.

## Fix

Not applied — reported per bug-first rule. `ts-morph` was installed as a devDependency in this
session (2026-08-18, at the repo root) specifically to replace hand-rolled regex/sed-based code
analysis and transforms with real AST operations (per the updated rule in
`~/.claude/behavioral_instructions.md` §"Code Navigation Guidelines"). The correct fix is to
rewrite this gate (and ideally its siblings) using `ts-morph`'s `Project`/`SourceFile` API to walk
every `ClassDeclaration` → `MethodDeclaration`/`GetAccessorDeclaration`, not just top-level
function/const declarations, so it catches both syntactic shapes uniformly instead of the
current two-pattern-only regex.

## Verification

Not yet — no fix applied.
