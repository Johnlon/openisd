# The three-fields gate loads the whole program and times out, so it checks nothing

Status: RESOLVED 2026-09-09

## Symptom

```
FAIL |design| test/architecture-project-has-three-fields.test.ts
  > OpenISDProject holds only #saved/#edited/#engine as stored fields
  > declares no property beyond the allowed set
Error: Test timed out in 5000ms.
```

The assertion never runs. The gate is red on every `npm run test:unit`, and the rule it exists to
enforce — John, 2026-09-06: "OpenISDProject should have ONLY three fields the json saved and the
json edited and then engine" — is unenforced.

## Example

```ts
const project = new Project({ tsConfigFilePath: path.join(packageRoot, 'tsconfig.json') });
const sourceFile = project.getSourceFileOrThrow(path.join(packageRoot, 'domain', 'openisdDomain.ts'));
```

Without `skipAddingFilesFromTsConfig`, ts-morph adds and parses every file the tsconfig names,
then type-checks the program. The gate then reads exactly one class out of exactly one file.

The two `packages/ui` architecture gates construct theirs the other way:

```ts
new TsProject({ tsConfigFilePath: ..., skipAddingFilesFromTsConfig: true });
```

## Impact

A stored fourth field could be added to `OpenISDProject` today and no gate would report it — the
timeout looks identical to a genuine failure, and a red that is always red is a red nobody reads.

## Fix

`skipAddingFilesFromTsConfig: true` plus `addSourceFileAtPath` for the one file the gate reads —
the same construction the two `packages/ui` architecture gates already use.

## Verification

```
npx vitest run packages/design/test/architecture-project-has-three-fields.test.ts
  1 passed, 693ms (was: timed out at 5000ms)
```

Broken on purpose and watched go red: adding `#fourthStoredField = 1;` to `OpenISDProject` was
reported by name, then restored.
