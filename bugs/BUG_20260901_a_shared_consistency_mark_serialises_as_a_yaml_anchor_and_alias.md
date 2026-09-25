# A shared consistency mark serialises as a YAML anchor and alias

**Status:** FIXED
**Found:** 2026-09-01, running the bridge over 400 real corpus records.

## Symptom

A `calc` mark goes on every member of the group it names (John, 2026-09-01). The bridge attaches
the SAME JavaScript object to each member, so the YAML writer emits it once with an anchor and
refers to it everywhere else with an alias.

`../winisd_drivers/db/datasheets/grs/8pf-8/driver.yml` through
`driverYmlToOpenisdAndWdr()` produces this `openisd.yml`:

```yaml
    Vas:
      dq_calculated:
        - &a1
          kind: calc
          severity: error
          rule: vas-consistency
          params:
            computed: 0.028958597209363716
            stored: 0.02690096
            off_pct: 7.1
          detail: Vas from ρ·c²·Sd²·Cms = 0.02896 vs stored 0.0269 — 7.1% apart
    Sd:
      dq_calculated:
        - *a1
    Cms:
      dq_calculated:
        - *a1
```

## Evidence

- 400 corpus `driver.yml` through the bridge: 400 produced an `openisd.yml`, 108 carried
  `dq_calculated`, and the anchor/alias form appears in every multi-member group among them.
- The Python side LOADS it: `yaml.safe_load` resolves `*a1`, and both entries come back holding
  the same dict, which pydantic then validates into two independent `DqMark` models. So this is
  not a load failure.

## Why it is a defect

- **A reader of `specs.woofer.Sd` cannot see its own mark.** The entry says `*a1` and nothing
  else; the finding lives under a different field further up the file. A corpus file is read by
  people, and an entry that has to be cross-referenced to be understood is not readable.
- **The anchor NAME is the writer's, not ours.** A YAML anchor is a name, and `a1` carries no
  meaning about the finding it labels. Nothing in the emitter chooses it.

Naming the anchor was considered and rejected (John, 2026-09-01: "just forget anchors — add the
same dq to all the fields and don't attempt any anchoring at all"). Every entry states its finding
in full.

## Cause

`dqCalculated()` in `packages/design/winisd/dqCalculated.ts` calls `calcMark(issue)` once per
issue and pushes the SAME `DqMarkJson` reference onto every member's list. The `yaml` package
emits an anchor for any object reached more than once, which is correct behaviour for a writer
handed a shared reference.

## Fix

Give each member its own mark object, so nothing in the emitted tree is reachable twice.

## Verification

Re-run the 400-record scan: no `&a` or `*a` in any emitted `openisd.yml`, and every member of a
group carries the mark's full text.
