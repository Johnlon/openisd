/**
 * `.wdr` (read by `WinISDDriver.fromWdrIni`) -> an `OpenISDDeviceJson` record. Split out of
 * `openisdSchema.ts` (that file declares data shapes only) — this is logic: reading WinISD's
 * fixed 48-row structure into the record's spec entries, with WinISD's own coercion rules for
 * `VCCon` and `numVC`.
 */
import {WinISDDriver} from '../winisd/index.js';
import {newUuid} from './newUuid.js';
import type {DriverError} from '../engine/index.js';
import type {DriverSpecsSection, OpenISDDeviceJson, SpecEntryJson} from './openisdSchema.js';

/**
 * `.wdr` (read by `WinISDDriver.fromWdrIni`) -> an `OpenISDDeviceJson` record.
 * Decision table (ParState mark × value in file):
 *
 *   E + 0        → entered, value 0  (warn on export — may be a failed scrape)
 *   E + nonzero  → entered, value
 *   C + any      → nothing  (derived, never stored; re-derived from entered fields)
 *   N + 0        → nothing
 *   N + nonzero  → entered, value
 *   key absent   → nothing
 *
 * `Xlim` is excluded even when marked entered: its cell always carries an empty value
 * (`WinISDDriver`'s own doc — `.wdr` has no key for it), so there is no real number to store.
 *
 * There is no source document, so every field this record can source is marked `manual`
 * (`SourceRole.MANUAL` — "a hand-entered value", `record_registries.py`).
 *
 * `authoritative` is required by the schema below but has no honest value for a `.wdr` import:
 * there is no document to name, and `manual` is barred from `data_sources` in the format this
 * field describes (winisd_tools `model_driver.py`). `openisd` is the pipeline's own role,
 * declared for exactly this case (`record_registries.py`: "a record's own provenance"). This is
 * a placeholder, not a considered choice — `authoritative`'s future is unsettled (John,
 * 2026-09-01: "it's total crap").
 */
/**
 * /**
 * `VCCon` as a record entry, read on PRESENCE rather than on its ParState mark.
 *
 * WinISD writes no instruction to slot 46, so it leaves `N` there while the `VCCon=` row still
 * states a wiring — 520 of the 524 corpus files (`drivers/mysamples/PARSTATE-FINDINGS.md`). Reading
 * this row on its mark, as every other row is read, loses every series wiring in the corpus.
 *
 * `1` and `2` are the whole encoding. Anything else is read as `1`, parallel, with the number the
 * file carried kept as `actual_reading`. A warning is pushed — NOT a `dq_calculated` mark on the
 * record; coercion is a parse event and the record stays clean.
 */
function wdrVCConEntry(
    cell: { value: string },
    warnings: DriverError[],
): SpecEntryJson | undefined {
    const raw = cell.value.trim();
    if (raw.length === 0) return undefined;
    const stated = Number(raw);
    if (!isFinite(stated)) return undefined;

    if (stated === 1 || stated === 2) {
        return {
            state: 'E', value: stated,
            origin: 'manual',
            readings: {manual: {actual_reading: raw, read_value: stated}},
        };
    }
    // Out of range for the two-position dropdown WinISD's own UI offers (1 parallel, 2 series)
    // — not a value a human could have entered, so it is omitted rather than coerced into an
    // entered fact. The slot then reads as absence, which the driver's own `resolve()` fills
    // with `calcVCCon()`'s default as a 'C' entry, the same way an absent key is filled (John,
    // 2026-09-05: "when reading back a zero or absent then it should recorded as C in openisd
    // and the default calculated 1 comes thru").
    warnings.push({
        level: 'warn', field: 'VCCon',
        message: `VCCon=${stated} is not 1 (parallel) or 2 (series) — omitted, reads as the calculated default`,
    });
    return undefined;
}

/**
 * `numVC` coil count must be integer 1..4. Outside that, read as 1.
 * Coercion is a parse event — warning emitted, no dq_calculated on the record.
 */
function wdrNumVCEntry(
    cell: { value: string },
    warnings: DriverError[],
): SpecEntryJson {
    const stated = Number(cell.value);
    if (Number.isInteger(stated) && stated >= 1 && stated <= 4) {
        return {
            state: 'E', value: stated,
            origin: 'manual',
            readings: {manual: {actual_reading: cell.value, read_value: stated}},
        };
    }
    warnings.push({
        level: 'warn', field: 'numVC',
        message: `numVC=${stated} is not a coil count between 1 and 4 — read as 1`,
    });
    return {
        state: 'E', value: 1,
        origin: 'manual',
        readings: {manual: {actual_reading: cell.value, read_value: 1}},
    };
}

/** Read the `.wdr` row `wdrKey` into the record's spec entries, under `schemaKey`. C (derived) is
 *  always skipped; N (blank) is skipped unless it carries a non-zero value (3rd-party writers
 *  have broken parstate); VCCon reads strictly on presence. */
function readSpecEntryInto(
    entries: Record<string, SpecEntryJson>,
    wdr: WinISDDriver,
    schemaKey: keyof DriverSpecsSection,
    wdrKey: string,
    warnings: DriverError[],
): void {
    const cell = wdr.cell(wdrKey);
    const numValue = Number(cell.value);
    const shouldImport =
        cell.state === 'entered'
        || (cell.state === 'not-available' && isFinite(numValue) && numValue !== 0)
        || wdrKey === 'VCCon';
    if (!shouldImport) return;
    if (wdrKey === 'VCCon') {
        const entry = wdrVCConEntry(cell, warnings);
        if (entry) entries[schemaKey] = entry;
    } else if (wdrKey === 'numVC') {
        entries[schemaKey] = wdrNumVCEntry(cell, warnings);
    } else {
        entries[schemaKey] = {
            state: 'E', value: numValue,
            origin: 'manual',
            readings: {manual: {actual_reading: cell.value, read_value: numValue}},
        };
    }
}

export function winISDDriverToOpenISDDeviceJson(wdr: WinISDDriver):
    { record: OpenISDDeviceJson; warnings: DriverError[] } {

    const warnings: DriverError[] = [];
    const named = (text: string | undefined) => text && text.length > 0 ? text : 'n/a';
    const brand = named(wdr.headerField('brand'));
    const model = named(wdr.headerField('model'));
    const manufacturer = named(wdr.headerField('manufacturer'));

    const specEntries: Record<string, SpecEntryJson> = {};
    // THE FIXED 48-ROW STRUCTURE, each row read explicitly into its schema key — no row list, no
    // key map: the calls below ARE the rows, and each names the schema entry it is stored under
    // and the `.wdr` row it is read from.
    readSpecEntryInto(specEntries, wdr, 'Qts', 'Qts', warnings);
    readSpecEntryInto(specEntries, wdr, 'Znom_ohm', 'Znom', warnings);
    readSpecEntryInto(specEntries, wdr, 'Fs_hz', 'Fs', warnings);
    readSpecEntryInto(specEntries, wdr, 'Pe_W', 'Pe', warnings);
    readSpecEntryInto(specEntries, wdr, 'SPL_dB', 'SPL', warnings);
    readSpecEntryInto(specEntries, wdr, 'Re_ohm', 'Re', warnings);
    readSpecEntryInto(specEntries, wdr, 'Le_H', 'Le', warnings);
    readSpecEntryInto(specEntries, wdr, 'fLe_hz', 'fLe', warnings);
    readSpecEntryInto(specEntries, wdr, 'KLe_H_sqrtHz', 'KLe', warnings);
    readSpecEntryInto(specEntries, wdr, 'BL_Tm', 'BL', warnings);
    readSpecEntryInto(specEntries, wdr, 'Xmax_m', 'Xmax', warnings);
    readSpecEntryInto(specEntries, wdr, 'Cms_m_per_N', 'Cms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Qms', 'Qms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Qes', 'Qes', warnings);
    readSpecEntryInto(specEntries, wdr, 'Rms_kg_per_s', 'Rms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Mms_kg', 'Mms', warnings);
    readSpecEntryInto(specEntries, wdr, 'Sd_m2', 'Sd', warnings);
    readSpecEntryInto(specEntries, wdr, 'Vas_m3', 'Vas', warnings);
    readSpecEntryInto(specEntries, wdr, 'Dia_m', 'Dia', warnings);
    readSpecEntryInto(specEntries, wdr, 'Vd_m3', 'Vd', warnings);
    readSpecEntryInto(specEntries, wdr, 'no', 'no', warnings);
    readSpecEntryInto(specEntries, wdr, 'Dd_m', 'Dd', warnings);
    readSpecEntryInto(specEntries, wdr, 'EBP_hz', 'EBP', warnings);
    readSpecEntryInto(specEntries, wdr, 'numVC', 'numVC', warnings);
    readSpecEntryInto(specEntries, wdr, 'Hc_m', 'Hc', warnings);
    readSpecEntryInto(specEntries, wdr, 'Hg_m', 'Hg', warnings);
    readSpecEntryInto(specEntries, wdr, 'SPLmax_dB', 'SPLmax', warnings);
    readSpecEntryInto(specEntries, wdr, 'SPLmaxLF_dB', 'SPLmaxLF', warnings);
    readSpecEntryInto(specEntries, wdr, 'USPL_dB', 'USPL', warnings);
    readSpecEntryInto(specEntries, wdr, 'alfaVC_per_K', 'alfaVC', warnings);
    readSpecEntryInto(specEntries, wdr, 'Rt_K_per_W', 'Rt', warnings);
    readSpecEntryInto(specEntries, wdr, 'Ct_J_per_K', 'Ct', warnings);
    readSpecEntryInto(specEntries, wdr, 'gamma_m_per_s2_A', 'gamma', warnings);
    readSpecEntryInto(specEntries, wdr, 'Rme_kg_per_s', 'Rme', warnings);
    readSpecEntryInto(specEntries, wdr, 'Mpow_N_per_sqrtW', 'Mpow', warnings);
    readSpecEntryInto(specEntries, wdr, 'Mcost_kg_per_s', 'Mcost', warnings);
    readSpecEntryInto(specEntries, wdr, 'Gloss', 'Gloss', warnings);
    readSpecEntryInto(specEntries, wdr, 'VCCon', 'VCCon', warnings);
    readSpecEntryInto(specEntries, wdr, 'c_m_per_s', 'c', warnings);
    readSpecEntryInto(specEntries, wdr, 'roo_kg_per_m3', 'roo', warnings);
    readSpecEntryInto(specEntries, wdr, 'Thick_m', 'Thick', warnings);
    readSpecEntryInto(specEntries, wdr, 'Depth_m', 'Depth', warnings);
    readSpecEntryInto(specEntries, wdr, 'MagDepth_m', 'MagDepth', warnings);
    readSpecEntryInto(specEntries, wdr, 'Magnet_m', 'Magnet', warnings);
    readSpecEntryInto(specEntries, wdr, 'Basket_m', 'Basket', warnings);
    readSpecEntryInto(specEntries, wdr, 'Outer_m', 'Outer', warnings);
    readSpecEntryInto(specEntries, wdr, 'Vcd_m', 'Vcd', warnings);
    readSpecEntryInto(specEntries, wdr, 'DVol_m3', 'DVol', warnings);

    // Optional: present only when the header line is non-blank, so a `.wdr` that never states
    // one produces no field — not an empty string standing in for "unstated"
    // (bugs/archive/BUG_20260903_wdr_reader_drops_providedby_comment_dateadded_on_every_round_trip.md).
    const stated = (text: string | undefined) =>
        text && text.length > 0 ? {value: text} : undefined;
    const providedBy = stated(wdr.headerField('providedBy'));
    const comment = stated(wdr.headerField('comment'));
    const added = stated(wdr.headerField('dateAdded'));

    // A driver-only `.wdr` has no field for OID's `driver_type` — WinISD's format never had one
    // to lose. `[DRIVERTYPE ...]` in `Comment=` is OpenISD's own tag for it (same mechanism as
    // `[DQ]`/`[ENV]`; see
    // bugs/archive/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md).
    // A file with no tag — every real WinISD file — falls back to `woofer`, today's behaviour.
    const record: OpenISDDeviceJson = {
        uuid: {value: newUuid()},
        quality: {
            confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
            parse_errors: [], cross_source_only: [],
        },
        manufacturer: {value: manufacturer},
        brand: {value: brand},
        model: {value: model},
        sku: {value: model, grounds: [{origin: 'manual', reading: model}]},
        driver_type: {value: 'woofer'},
        data_sources: {value: {}},
        authoritative: {value: 'openisd'},
        ...(providedBy ? {provided_by: providedBy} : {}),
        ...(comment ? {comment} : {}),
        ...(added ? {added} : {}),
        specs: {woofer: specEntries},
    };
    return {record, warnings};
}
