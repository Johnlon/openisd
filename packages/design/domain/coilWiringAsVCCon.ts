/**
 * schemaVersion 4 → 5 (QO941; John, QO942.c54: "the project already had a connection setting", c56: "project name to be same
 * as driver", QO946.c18: "migration is just to rename the field", c23: "only the key name changes"): the project's saved
 * `wiring` key is named `VCCon` from here on, its value ("series" or "parallel") kept exactly as saved. The driver's own
 * `VCCon` is untouched. `coilWiring` (added on 15 Nov 2026 on the test site only, never released) also becomes `VCCon`
 * and, where a project has both, it wins: it was chosen by the user for the coils. On a parsed JSON value, before the
 * strict schema reads it, at every depth: a session, or any record holding a `driverEmbedding`.
 */
type PlainRecord = Record<string, unknown>;

function isRecord(v: unknown): v is PlainRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isWiring(v: unknown): v is 'series' | 'parallel' {
    return v === 'series' || v === 'parallel';
}

/** One project state: a record with a `driverEmbedding`. */
function stateWithCoilWiringAsVCCon(state: PlainRecord): PlainRecord {
    const embedding = state.driverEmbedding;
    if (!isRecord(embedding)) return state;
    const {coilWiring, wiring, ...rest} = embedding;
    const next: PlainRecord = {...rest};
    if (isWiring(coilWiring)) next.VCCon = coilWiring;
    else if (isWiring(wiring)) next.VCCon = wiring;
    return {...state, driverEmbedding: next};
}

/** `value` with every project state's `wiring` named `VCCon`. `value` is not changed. */
export function withCoilWiringAsVCCon(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withCoilWiringAsVCCon);
    if (!isRecord(value)) return value;
    const here = isRecord(value.driverEmbedding) ? stateWithCoilWiringAsVCCon(value) : value;
    return Object.fromEntries(Object.entries(here).map(([key, v]) => [key, key === 'driverEmbedding' ? v : withCoilWiringAsVCCon(v)]));
}
