# Two `window` registries typed `any` — one behind a file-wide eslint suppression, one a test backdoor that ships

Status: OPEN

## Symptom

Every piece of application state in `packages/ui` is stored on a `window` property, reached through
a function that returns an unchecked value. Nothing that reads it is type-checked, and a key
collision hands one module another module's object with no error at compile time or run time.

## Evidence

`packages/ui/src/logic/hmrSingleton.ts`, the whole mechanism:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const globalCtx = (typeof window !== 'undefined') ? (window as any) : null;
if (globalCtx && !globalCtx.__hmr_singletons) {
  globalCtx.__hmr_singletons = {};
}
const ctx = globalCtx ? globalCtx.__hmr_singletons : {};

export function getOrInit<T>(namespace: string, key: string, init: () => T): T {
  const fullKey = `${namespace}:${key}`;
  if (!(fullKey in ctx)) {
    ctx[fullKey] = init();
  }
  return ctx[fullKey];
}
```

**11 call sites**, across `packages/ui/src/logic/appState.ts` and
`packages/ui/src/logic/presentationState.ts`. This is not a corner of the app — it is how the app's
state exists at all.

## Cause — four separate defects in twenty-five lines

**1. `window.__hmr_singletons` is a mutable global registry.** A module-level object, written at
import time, indexed by a runtime string key, shared by every caller. That is the definition the
project's own rule gives for a forbidden global ("GLOBAL VARIABLES ARE FORBIDDEN — a high crime
against software", `AGENTS.md`): install order becomes part of the API without any signature saying
so, a second instance is impossible, and "what is the current value" has no single answer.

**2. `window as any` erases the type.** `ctx` is therefore `any`, so `ctx[fullKey]` is `any`, so
`getOrInit<T>` returns `any` in the shape of a `T`. **The generic checks nothing.** If two callers
collide on a key, the second receives the first's object typed as its own, and neither the compiler
nor the runtime objects.

The docstring says the namespace makes a collision "structurally impossible instead of relying on
every module picking a unique-enough key by convention". It does not: `${namespace}:${key}` is
string concatenation, so the namespace is exactly the same kind of convention it claims to replace.
Nothing enforces that two modules pick different namespaces.

**3. A file-wide `eslint-disable`.** `AGENTS.md` §Linting: "Never add `// eslint-disable`,
`/* eslint-disable */`, or any per-line/per-file ESLint suppression." This one is per-FILE, so it
also silences any future `any` added anywhere in the file.

**4. The non-browser path silently differs.** With no `window`, `ctx` is a fresh `{}` per module
evaluation, so "one instance per key" holds in a browser and does not hold anywhere else. A test
and the app therefore exercise different lifetimes of the same state, and nothing says so.

## A SECOND registry, in `appState.ts`, and this one exists only for a test

`packages/ui/src/logic/appState.ts:298-303`:

```ts
if (typeof window !== 'undefined') {
  if (!(window as any).__store_instances) (window as any).__store_instances = [];
  if (!(window as any).__store_instances.includes(state)) {
    (window as any).__store_instances.push(state);
  }
}
```

**Its only reader is a test** — `packages/ui/test/ui/original-skin.browser.spec.ts:891`:

```ts
return (window as any).__store_instances[0].P.driverAddedMass;
```

Nothing in `packages/ui/src` reads it. So a global array is built and maintained in production code
for the sole purpose of letting a browser test reach the app's internals from outside.

**It does NOT leak, and `[0]` IS the live store** — the `.includes(state)` guard sees to that.
`state` is itself `getOrInit('appState', 'state', ...)` (`appState.ts:249`), so it is the SAME
object across hot reloads; `includes` is therefore true on every reload after the first and nothing
is pushed. The array stays at length one.

That is worth stating because it is the obvious wrong reading: an array on `window` that is only
ever pushed to LOOKS like an accumulator, and is not one.

What remains wrong is narrower and still real: a global array is built and maintained in PRODUCTION
code whose only reader is a browser test. That is the failure the project's own no-globals rule
predicts in as many words — "tests need a reset backdoor that then ships in production code" — with
the backdoor being the production code itself.

**A third `as any` in the same file**, `appState.ts:672`, carries one inside the assertion:

```ts
const g = JSON.parse(currentGround()) as { box: BoxType; P: UiParams; driver: string; project?: any };
```

`JSON.parse` returns `any` already; the assertion re-types it and keeps `project?: any`, so the
ground snapshot's project metadata is unchecked on the path that restores a design.

## What it costs

The `any` does not stay in this file. It is the return type of the only accessor, so it flows into
every consumer: `appState.ts`'s `seedProject`, `projects`, `state`, `groundByProject`, and
`presentationState`'s stores are all reached through it. The app's entire state layer is untyped at
the point of access.

## Fix

NOT APPLIED — needs John's ruling, and it is entangled with a larger decision.

Three defects have contained fixes:

- **the erasure** — declare the property instead of asserting it away:
  `declare global { interface Window { __hmr_singletons?: Record<string, unknown> } }`, then read
  it with a guard. `unknown` per entry, narrowed by the caller, rather than `any` flowing outward.
- **the suppression** — deletes with the `any`.
- **the non-browser path** — say which lifetime is intended, and make both do it.

The global itself does not have a contained fix. It exists to survive a Vite hot-reload, which a
module-scoped value cannot do. Whether it stays is bound up with the decision on `ManagedProject`
and `appState`, both of which John has already called defunct — if that layer is replaced by the
domain's own state, the registry may go with it rather than needing repair.

## How it was found

John, reading the cast list from `packages/design/test/architecture-no-casts.test.ts`:
"this looks highly suspect". The cast was one of 28 the gate reports; the global, the suppression
and the untyped generic were behind it.
