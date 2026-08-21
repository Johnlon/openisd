# SPLmax's documented formula omits the −3 dB derating the engine actually applies

# Status
FIXED 2026-08-17

## Symptom

Three places state `SPLmax = SPL + 10·log₁₀(Pe)`. The engine computes
`SPL + 10·log₁₀(Pe) − 3`. Anyone implementing from either statement lands 3 dB high on every
driver.

- `docs/design/WINISD_SCHEMA.md` §4, relation 16 — `SPLmax = SPL + 10·log₁₀(Pe)`
- `packages/ui/src/logic/fields/fieldRegistry.ts:413` —
  `formula: 'SPLmax = SPL + 10·log₁₀(Pe)'`
- `packages/ui/src/logic/provenance.ts:149` —
  `formulaText: 'SPLmax = SPL + 10 × log₁₀(Pe)'`

The two UI strings are the worse of the three: it is rendered to the user in the driver editor,
so the app displays a formula that contradicts the number printed beside it.

## Evidence

`packages/engine/src/driver.ts:312` and `:430` both apply the derating:

```ts
setVal('SPLmax', uSplBase + 10 * Math.log10(r.Pe) - 3);
```

The engine's own comment attributes the `−3` to the `winisd-parity` goldens, which back out a
derating of precisely 3 dB. So the code was right and only the prose was wrong.

Independently confirmed in `winisd.exe` itself. The `SPLmax` computation site stores at VA
`0x460018`, and the arithmetic immediately before it is:

```
fld  qword [Pe]
call log10
fld  xword [0x5DC570]      ; 10.0
fmulp
fadd qword [SPL]
fld  xword [0x5DC550]      ; 3.0
fsubp                      ; SPL + 10*log10(Pe) - 3
fstp qword [SPLmax]
```

Both constants read as 80-bit extended: `0x5DC570` = `10.0`, `0x5DC550` = `3.0`. The block is
guarded on `SPL > 0` and `Pe > 0`. This is the only site in the calculation engine that writes
`SPLmax`, so there is no second, underated route.

## Cause

The relation was transcribed from the `winisd.exe` consistency-group STRINGS — a list of which
fields participate in each group — which name the members but carry no arithmetic. The `−3` is
in the code, not in the string table, so a formula reconstructed from the member list alone
cannot contain it. The registry entry then copied the schema's form.

## Fix

State the derating in all three places:

- `docs/design/WINISD_SCHEMA.md` §4 relation 16 → `SPLmax = SPL + 10·log₁₀(Pe) − 3`
- `fieldRegistry.ts:413` `formula:` → `SPLmax = SPL + 10·log₁₀(Pe) − 3`
- `provenance.ts:149` `formulaText:` → `SPLmax = SPL + 10 × log₁₀(Pe) − 3`

Applied 2026-08-17.

## Verification

`grep -rn "SPLmax = SPL" docs packages` returns no form lacking the `− 3` term, and the
registry string matches `driver.ts:312`.

## Scope note

`Pe` is solved from the same relation (`Pe` store at VA `0x460b31`, inputs `SPL`, `SPLmax`), so
its inverse carries the derating too: `Pe = 10^((SPLmax − SPL + 3)/10)`. Any inverse written
from the underated form is wrong by a factor of 2 in power.
