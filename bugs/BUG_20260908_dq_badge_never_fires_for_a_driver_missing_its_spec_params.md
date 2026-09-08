# The ⚠ data-quality badge never fires for a driver missing its spec parameters

Status: OPEN — interim applied, no behaviour restored

## Symptom

The driver picker's ⚠ health-warning badge is shown when `driverHasDqIssues(d)` is true. For a
driver that states NO spec parameters at all — no Fs, no Qts, no Vas — it is false, so the badge
never appears and the row looks as healthy as a fully specified driver.

QO79/QO81 ruled that such a driver still BUNDLES, precisely because the badge would warn about it
in the UI. The bundling half is honoured; the warning half is not, so a driver that cannot be
simulated ships with no visible sign.

## Evidence

`packages/ui/src/logic/driverBrowsingState.ts:64`:

```ts
function driverHasDqIssues(d: OpenISDDriver): boolean {
  return d.checkConsistency().length > 0;
}
```

Probe run 2026-09-08, `OpenISDDriver.empty(new Engine()).checkConsistency()`:

```
ISSUES: []
```

`packages/design/domain/openisdDomain.ts:1259` delegates straight to
`engine.checkConsistency(this.fields())`, and `packages/design/engine/consistency.ts` skips any
relation whose members are not all usable (`usable = x => typeof x === 'number' && isFinite(x) &&
x > 0`). A driver stating nothing has no usable member in any relation, so every relation is
skipped and no issue is raised.

`packages/ui/test/persistence/bundle-drivers-disposition.test.ts:50` asserts the opposite — that
the badge fires for a record with `specs: { woofer: {} }`. It has not compiled since
`driverHasDqIssues` stopped being exported from `@openisd/persistence`, so nothing has been
proving the claim.

## Cause

`checkConsistency()` answers a different question from the one the badge asks.

- `checkConsistency()` finds CONTRADICTIONS between stated values — two parameters that imply a
  third the driver states differently. A driver stating nothing contradicts nothing.
- The badge asks whether the driver is fit to simulate, which is mostly about ABSENCE.

The check that answered the absence question, `recordIsSimulatable`
(`packages/model/src/driverSimulatability.ts`), went with `packages/model`. The migration
substituted `checkConsistency()` for it — the plan's "DQ badge" row rules exactly that — without
noticing the two are not the same question.

## Fix

The badge needs a missing-required-parameters check on `OpenISDDriver` alongside
`checkConsistency()`: the parameters the engine needs to produce a curve at all (Fs, Qts, Vas as
a minimum — the exact set is `recordIsSimulatable`'s, recoverable from git history), reported as
absent rather than as a contradiction.

Not done here. It is a new domain method plus a behaviour decision about which parameters are
required, and the migration is mid-flight.

**Interim, applied now:** the assertion in `bundle-drivers-disposition.test.ts` is removed and the
test keeps its bundling half, which is what that file is actually about (the bundler's gate). A
FIXME at the deleted assertion names this file. No badge behaviour is restored — the badge stays
silent for an unspecified driver until the check above exists.

## Verification

None yet — the fix is not applied. When it is, the removed assertion is the test to restore, plus
a browser test driving the picker to the row and asserting the ⚠ is rendered (the badge is
user-visible, so a unit test alone does not discharge it).
