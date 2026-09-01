# The JS emitter writes YAML 1.2 and PyYAML reads YAML 1.1, so bare scalars change type

**Status:** OPEN — needs a ruling on the fix
**Found:** 2026-09-01, validating the regenerated corpus against the Python models.

## Symptom

Two different values written by the bridge come back to Python as the wrong TYPE.

**1. `added`, on every record.** `openisd.yml` states an unquoted date; the model wants a string:

```
E       added.value
E         Input should be a valid string [type=string_type,
E         input_value=datetime.date(2026, 8, 31), input_type=date]
```

**2. `params.field` when the field is `no`.** The model wants a string; it gets a boolean:

```
E       field
E         Input should be a valid string [type=string_type, input_value=False, input_type=bool]
```

## Evidence

The bytes on disk (`wavecor/wf118wa07/openisd.yml`):

```yaml
added:
  value: 2026-08-31
  origin: openisd
```

and what PyYAML makes of the emitter's output:

```
>>> yaml.safe_load('added:\n  value: 2026-08-31\n')
{'added': {'value': datetime.date(2026, 8, 31)}}
>>> yaml.safe_load('field: no')
{'field': False}
>>> yaml.safe_load('a: on')
{'a': True}
```

Counts over the 2064 regenerated records: **2064** carry the `added.value` date coercion;
**4** carry the `field: no` boolean coercion (`morel/tsct-1044`, `morel/tsct-1104`).

The spec-KEY path was measured, not assumed, and is clean: 0 spec keys spelled `no`, 0 boolean
keys of any kind, across all 2064 records.

## Cause

ONE cause, two symptoms: the two halves of the pipeline implement different versions of YAML.

The `yaml` package (JS) implements **YAML 1.2**, whose core schema resolves only `true`/`false`
as booleans and does not resolve timestamps at all — so `no` and `2026-08-31` are strings, and
emitting them unquoted is correct by its rules. PyYAML implements **YAML 1.1**, whose implicit
resolvers include `yes`/`no`/`on`/`off` as booleans and an ISO date as `timestamp`. The same
bytes therefore mean different things on each side.

`no` is a real field name (reference efficiency) and a date is a real value, so neither writer is
doing anything wrong on its own terms.

## Fix

Not applied — this needs a ruling.

1. **Make the emitter write scalars a YAML 1.1 reader agrees with.** Fixes the whole class:
   `added`, `field: no`, and anything added later that collides (`on`, `off`, `yes`, `n`).
2. **Quote the two known values only.** Smallest change; leaves the class open for the next
   colliding name to reintroduce silently.

Option 1 is the honest fix. The defect is the version mismatch itself, and only option 1
addresses it; option 2 fixes today's two instances and guarantees a recurrence.

## Verification

Re-run the corpus validation: 2064 records validate, 2594 marks accepted, 0 rejected, and no
value round-trips into a non-string type on the Python side.
