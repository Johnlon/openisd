# persist.test.ts's driver fixture is stale and misnamed, so 10 of its 11 tests cannot run

Status: RESOLVED

## Symptom

`packages/ui/test/logic/persist.test.ts` fails 10 of 11 tests, in two groups:

```
Error: Bad driver                          (8 tests)
SyntaxError: "[object Object]" is not valid JSON   (2 tests)
```

Nothing about persistence is being proven: the file-save round trip, the QO90 "no view on the
wire" rule, the share-link contents and the V1→V2 schema upgrade all have no working coverage.

## Evidence

`sampleDriverText()` (line 99) returns a record missing four keys the schema requires:

```ts
function sampleDriverText(): any {
  return {
    brand: {value: 'test'}, model: {value: 'test'}, manufacturer: {value: 'test'},
    uuid: {value: '00000000-0000-4000-8000-000000000000'}, driver_type: {value: 'woofer'},
    specs: { woofer: { Fs: { origin: 'entered', readings: { manual: { read_value: 30 } } } } }
  };
}
```

`quality`, `sku`, `data_sources` and `authoritative` are absent, so
`OpenISDDriver.fromConformingRecord` returns the problem list and both call sites discard it:

```ts
const driver = OpenISDDriver.fromConformingRecord(driverRecord, new Engine());
if (Array.isArray(driver)) throw new Error('Bad driver');
```

The thrown message names no field, which is why the failure reads as a mystery rather than as the
four missing keys.

The second group is a separate defect in the same function: it is named `...Text()` and documented
as returning "the driver's own persisted TEXT", but returns an OBJECT. Two tests take it at its
word:

```ts
driver: JSON.parse(sampleDriverText()),
```

`JSON.parse` stringifies its argument first, so the object becomes `"[object Object]"` and the
parse throws.

## Cause

The fixture predates the current record schema; `quality`/`sku`/`data_sources`/`authoritative`
became required and this literal was not updated — the same stale-record family already fixed in
`bundle-drivers-disposition.test.ts` and in the `blankDriverRecord()` copies in
`managedProjectBoxFields`/`managedProjectFilters`/`vent-group`.

The name is residue of QO73, when a serialised driver genuinely was text. When the payload moved
back to a record the body changed and the name, doc comment and two `JSON.parse` call sites did
not.

Both were hidden by the discarded error list: `throw new Error('Bad driver')` drops the schema's
own explanation, so ten failures reported one uninformative string between them.

## Fix

- `sampleDriverText()` renamed `sampleDriverRecord()`, with the four required keys added and the
  doc comment corrected to say it returns a record.
- The two `JSON.parse(sampleDriverText())` call sites take the record directly.
- Both "Bad driver" throws now include the schema's problem list, so the next stale fixture names
  its own missing fields.

## Verification

`npx vitest run packages/ui/test/logic/persist.test.ts` — watched failing with `Bad driver` and
`"[object Object]" is not valid JSON`, then 11/11 passing.
