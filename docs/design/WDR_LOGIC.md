# `.wdr` load and save logic

Which values cross between `.wdr` INI text and an OpenISD record, and what provenance they carry.
The format itself is `WINISD_SCHEMA.md`.

OpenISD never stores a calculated value.

## Background

VCCon and numVC are calculable fields in OpenISD, but remain E/N for WinISD.
So that if no value is entered by a human into OpenISD or if no value is found in the .wdr when loading it into OpenISD 
then no value is added to OpenISD state. 
Therefore naturally 
OpenISD allows a calculated (default) to flow into the getter in OpenISD
with that calculated value being Parallel and 1 (the WinISD screen defaults).

WinISD does NOT support these as calculated fields at all so when writing to WinISD these become
E values, and when read back from a .wdr file they remain E values.

## Loading `.wdr` INI text into OpenISD

Per key:

```
key not stated in the file   -> nothing

with a ParState row:
    C  -> mark C, no value
    E  -> mark E, value
    N  -> nothing

without a ParState row:
    zero and calculable by WinISD  -> mark C, no value
    zero                 -> nothing
    otherwise            -> mark E, value

```

"Calculable by WinISD" is the "Calculated by" column of
[WINISD_SCHEMA.md §3 Field reference](WINISD_SCHEMA.md#3-field-reference): a field with a formula
there is calculable, a field reading "never — entered or absent" is not.



## Converting OpenISD to `.wdr` INI text

All 55 fields are written every time, in WinISD's order, plus the ParState row. Per key:

The 55 fields split two ways: 48 ParState fields and 7 non-ParState fields.

- ParState fields

```
VCCon (calculated in OpenISD) -> value, E
numVC (calculated in OpenISD) -> value, E

entered   -> value, mark E
derivable -> calculated value, mark C
otherwise -> 0, mark N
```

For ParState fields, OpenISD only needs present fields that are E or C values, never N.

`Xlim` has no key.
Even though Xlim cannot be written into a .wdr file, ParState slot 10 tracks the E/N value in OpenISD.
Writing OpenISD to .wdr (and classic WinISD itself) discards its value on save.

- Non-ParState fields

All strings.
A value present in OpenISD is written to the .wdr as is.
A cell missing from OpenISD is written as an empty value.


