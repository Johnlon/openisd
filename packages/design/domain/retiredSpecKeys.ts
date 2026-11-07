/**
 * Spec keys the driver model no longer has, removed from a parsed record before the strict schema
 * reads it, so a record saved while it had one still loads instead of being refused.
 *
 * `Dia_m`: Dd's old name. WinISD renamed it in 0.50alpha3, hides its box and writes Dia=0 in every
 * file it saves (QO398, John 3 Nov 2026).
 */
const RETIRED_SPEC_KEYS: readonly string[] = Object.freeze(['Dia_m']);

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One `specs` value with every retired key dropped from each of its sections. */
function specsWithout(specs: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(specs).map(([section, body]) => [section,
        isRecord(body) ? Object.fromEntries(Object.entries(body).filter(([key]) => !RETIRED_SPEC_KEYS.includes(key))) : body]));
}

/** `value`, parsed from JSON and not yet validated, as a copy with every retired spec key removed
 *  from every `specs` it holds at any depth: a device record, or a project with its driver and
 *  radiator records. `value` itself is not changed. */
export function withoutRetiredSpecKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withoutRetiredSpecKeys);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, v]) =>
        [key, key === 'specs' && isRecord(v) ? specsWithout(v) : withoutRetiredSpecKeys(v)]));
}
