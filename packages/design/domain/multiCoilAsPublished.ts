/**
 * schemaVersion 3 → 4 (QO908 V4): a multi-coil driver's Re and BL, stored per coil in version 3,
 * become the published figures for the measured wiring (QO900 R1). On a parsed JSON value, before
 * the strict schema reads it, at every depth: a driver record, or a project or session holding one.
 *
 * For each spec section with 2 or more coils:
 *   - VCCon entered: Re and BL multiplied back. Version 3 split series as Re/N, BL/N and parallel
 *     as Re·N, BL; so series is Re·N, BL·N and parallel Re/N, BL unchanged. A value's precision is
 *     kept: the printed figure's own.
 *   - VCCon calculated: version 3's parallel default, never stated. Re and BL stay; VCCon is
 *     removed, so the wiring reads as unknown.
 * A section with fewer than 2 coils, or with no VCCon, keeps its Re and BL.
 *
 * Every section, after that: VCCon becomes its name (QO914, #514): an entered 1 → "parallel",
 * 2 → "series", any other number → absent (unknown); its precision goes, a wiring being a name.
 * A calculated VCCon was version 3's default, never stated: it goes, single coil included
 * (QO906.c4: defaulted entries disappear). A not-available VCCon is kept.
 */

type PlainRecord = Record<string, unknown>;

function isRecord(v: unknown): v is PlainRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Version 3's VCCon number for series. */
const SERIES = 2;
/** Version 3's VCCon number for parallel. */
const PARALLEL = 1;

/** `section` with version 3's numeric VCCon as version 4's named one (QO914). */
function withNamedWiring(section: PlainRecord): PlainRecord {
    const vcCon = section.VCCon;
    if (!isRecord(vcCon) || vcCon.state === 'N') return section;
    const {VCCon: _numeric, ...rest} = section;
    void _numeric;
    if (vcCon.state !== 'E') return rest;
    if (vcCon.value === SERIES) return {...rest, VCCon: {state: 'E', value: 'series'}};
    if (vcCon.value === PARALLEL) return {...rest, VCCon: {state: 'E', value: 'parallel'}};
    return rest;
}

/** `entry` with its value times `factor`, or `entry` unchanged when it holds no number. */
function scaled(entry: unknown, factor: number): unknown {
    if (!isRecord(entry) || typeof entry.value !== 'number') return entry;
    return {...entry, value: entry.value * factor};
}

function asPublishedSection(section: PlainRecord): PlainRecord {
    const numVC = isRecord(section.numVC) ? section.numVC.value : undefined;
    if (typeof numVC !== 'number' || numVC < 2) return section;
    const vcCon = section.VCCon;
    if (!isRecord(vcCon)) return section;
    if (vcCon.state === 'C') {
        const {VCCon: _default, ...rest} = section;
        void _default;
        return rest;
    }
    if (vcCon.state !== 'E') return section;
    if (vcCon.value === SERIES) return {...section, Re_ohm: scaled(section.Re_ohm, numVC), BL_Tm: scaled(section.BL_Tm, numVC)};
    if (vcCon.value === PARALLEL) return {...section, Re_ohm: scaled(section.Re_ohm, 1 / numVC)};
    return section;
}

/** The spec sections of `specs` as published. Keys absent from a section stay absent. */
function asPublishedSpecs(specs: PlainRecord): PlainRecord {
    return Object.fromEntries(Object.entries(specs).map(([key, section]) =>
        [key, isRecord(section) ? withNamedWiring(withoutUndefined(asPublishedSection(section))) : section]));
}

/** `scaled` keeps an absent Re or BL absent rather than writing the key with no value. */
function withoutUndefined(section: PlainRecord): PlainRecord {
    return Object.fromEntries(Object.entries(section).filter(([, v]) => v !== undefined));
}

/** `value` with every driver record's multi-coil Re and BL as published. `value` is not changed. */
export function withMultiCoilAsPublished(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withMultiCoilAsPublished);
    if (!isRecord(value)) return value;
    if (isRecord(value.specs) && 'model' in value) return {...value, specs: asPublishedSpecs(value.specs)};
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, withMultiCoilAsPublished(v)]));
}
