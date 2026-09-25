/**
 * `OpenISDDriver` is a SUPERSET of a `.wdr`: every row WinISD writes has a home in the OpenISD
 * model, and a key with nowhere to go is a hole. Two closed loops pin it — the OID record
 * survives its object, and the `.wdr` text survives its format.
 *
 * `c` and `roo` are not exempted. They look like environment constants but WinISD offers both for
 * editing on the driver and saves what you type, so they are driver fields like any other.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver} from '../../domain/openisdDomain.js';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {Engine} from '@openisd/design/engine';
import {openIsdDriverToWinIsdDriver} from '../../domain/driverYmlToOpenisdAndWdr.js';
import type {Calculated, Entered, Readable} from '../../domain/cell.js';
import type {CellState} from '../../winisd/cellState.js';

/** The field reads `value` and carries the `.wdr` provenance `state`. */
function assertReads<T>(field: Readable<T | null> & Entered & Calculated, value: T | null, state: CellState, message?: string): void {
    assert.equal(field.value, value, message);
    assert.equal(field.entered, state === 'entered', message);
    assert.equal(field.calculated, state === 'calculated', message);
}

const scraped = <T, >(value: T) => ({value});
const spec = (read_value: number) => ({state: 'E' as const, value: read_value, origin: 'manual', readings: {manual: {read_value}}});

/** Every `.wdr` row entered at its own distinct value, in the record's own schema names
 *  (`Fs_hz`, `Vas_m3`, …) — one explicit entry per row, so a field renamed on either side is a
 *  build error right here. `VCCon` (a wiring string) and `numVC` (a coil count 1..4) are entered
 *  separately — the two rows a distinct-numeric-value literal cannot take. `Xlim` has no `.wdr`
 *  key, so it is not part of the coverage check (its slot-10 mark is pinned in the writer tests). */
function recordWithEveryKeyEntered(): { record: object } {
    const woofer: Record<string, unknown> = {
        Qts: spec(100), Znom_ohm: spec(101), Fs_hz: spec(102), Pe_W: spec(103), SPL_dB: spec(104),
        Re_ohm: spec(105), Le_H: spec(106), fLe_hz: spec(107), KLe_H_sqrtHz: spec(108),
        BL_Tm: spec(109), Xmax_m: spec(110), Cms_m_per_N: spec(111), Qms: spec(112), Qes: spec(113),
        Rms_kg_per_s: spec(114), Mms_kg: spec(115), Sd_m2: spec(116), Vas_m3: spec(117),
        Dia_m: spec(118), Vd_m3: spec(119), no: spec(120), Dd_m: spec(121), EBP_hz: spec(122),
        Hc_m: spec(123), Hg_m: spec(124), SPLmax_dB: spec(125), SPLmaxLF_dB: spec(126),
        USPL_dB: spec(127), alfaVC_per_K: spec(128), Rt_K_per_W: spec(129), Ct_J_per_K: spec(130),
        gamma_m_per_s2_A: spec(131), Rme_kg_per_s: spec(132), Mpow_N_per_sqrtW: spec(133),
        Mcost_kg_per_s: spec(134), Gloss: spec(135), c_m_per_s: spec(136), roo_kg_per_m3: spec(137),
        Thick_m: spec(138), Depth_m: spec(139), MagDepth_m: spec(140), Magnet_m: spec(141),
        Basket_m: spec(142), Outer_m: spec(143), Vcd_m: spec(144), DVol_m3: spec(145),
    };
    woofer.VCCon = spec(2);
    woofer.numVC = spec(2);

    const record = {
        uuid: {value: '00000000-0000-4000-8000-000000000000'},
        manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
        provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
        sku: {value: 'ACME-WIDGET', grounds: [{origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET'}]},
        driver_type: scraped('woofer'),
        data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
        authoritative: {value: 'manufacturer_datasheet'},
        quality: {
            confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
            parse_errors: [], cross_source_only: [],
        },
        specs: {woofer},
    };
    return {record};
}

describe('every .wdr field has a home in the OpenISD model', () => {
    it('record → json → oid → json → oid is a closed loop', () => {
        // Building the driver resolves it (fills calculated fields, writes consistency findings
        // into the record); rebuilding from that resolved record must reproduce it exactly.
        const {record} = recordWithEveryKeyEntered();
        const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
        const resolved = driver.cloneDriver();

        const again = OpenISDDriver.fromConformingRecord(resolved, new Engine());
        if (Array.isArray(again)) throw new Error(`resolved record does not conform: ${again.join(', ')}`);

        assert.deepEqual(again.cloneDriver(), resolved);
    });

    it('driver → wdr → driver is a closed loop', () => {
        const {record} = recordWithEveryKeyEntered();
        const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);

        const wdr1 = openIsdDriverToWinIsdDriver(driver, []);
        const wdr2 = WinISDDriver.fromWdrIni(wdr1.toWdrIni());

        for (const [key, cell] of wdr1.rows()) {
            assert.deepEqual(wdr2.cell(key), cell, key);
        }
    });

    it('c and roo round-trip like any other entered field', () => {
        // Synthetic values on purpose — only "survives unchanged" matters.
        const record = {
            uuid: {value: '00000000-0000-4000-8000-000000000000'},
            manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
            provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
            sku: {value: 'ACME-WIDGET', grounds: [{origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET'}]},
            driver_type: scraped('woofer'),
            data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
            authoritative: {value: 'manufacturer_datasheet'},
            quality: {
                confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
                parse_errors: [], cross_source_only: [],
            },
            specs: {woofer: {c_m_per_s: spec(111111), roo_kg_per_m3: spec(222222)}},
        };
        const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);

        const wdr = openIsdDriverToWinIsdDriver(driver, []);
        assert.equal(wdr.cell('c').state, 'entered');
        assert.equal(wdr.cell('c').value, '111111');
        assert.equal(wdr.cell('roo').state, 'entered');
        assert.equal(wdr.cell('roo').value, '222222');
    });

    it('c and roo, unentered, read as the reference-environment values', () => {
        // The engine's `solveConsistencyGroup` fills c/roo from the air model when unset, marked
        // `calculated` — no stored constant anywhere.
        const {c: refC, rho: refRho} = new Engine().solveEnvironment({}).values;
        const record = {
            uuid: {value: '00000000-0000-4000-8000-000000000000'},
            manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
            provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
            sku: {value: 'ACME-WIDGET', grounds: [{origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET'}]},
            driver_type: scraped('woofer'),
            data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
            authoritative: {value: 'manufacturer_datasheet'},
            quality: {
                confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
                parse_errors: [], cross_source_only: [],
            },
            specs: {woofer: {}},
        };
        const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);

        const wdr = openIsdDriverToWinIsdDriver(driver, []);
        assert.equal(wdr.cell('c').state, 'calculated');
        assert.equal(Number(wdr.cell('c').value), refC);
        assert.equal(wdr.cell('roo').state, 'calculated');
        assert.equal(Number(wdr.cell('roo').value), refRho);
    });

    it('entered then cleared c/roo: entered reads back, cleared reverts to the reference value', () => {
        const {c: refC, rho: refRho} = new Engine().solveEnvironment({}).values;
        const record = {
            uuid: {value: '00000000-0000-4000-8000-000000000000'},
            manufacturer: scraped(''), brand: scraped(''), model: scraped(''),
            provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
            sku: {value: '', grounds: [{origin: 'manufacturer_datasheet', reading: ''}]},
            driver_type: scraped('woofer'),
            data_sources: {value: {}},
            authoritative: {value: 'manual'},
            quality: {
                confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
                parse_errors: [], cross_source_only: [],
            },
            specs: {woofer: {}},
        };
        const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
        const section = driver.specs;

        section.c_m_per_s.set(400);
        section.roo_kg_per_m3.set(1.5);
        assertReads(section.c_m_per_s, 400, 'entered');
        assertReads(section.roo_kg_per_m3, 1.5, 'entered');

        section.c_m_per_s.clear();
        section.roo_kg_per_m3.clear();
        assertReads(section.c_m_per_s, refC, 'calculated');
        assertReads(section.roo_kg_per_m3, refRho, 'calculated');

        const wdr = openIsdDriverToWinIsdDriver(driver, []);
        assert.equal(wdr.cell('c').state, 'calculated');
        assert.equal(Number(wdr.cell('c').value), refC);
        assert.equal(wdr.cell('roo').state, 'calculated');
        assert.equal(Number(wdr.cell('roo').value), refRho);
    });
});

describe('every spec field supports get/set/get/clear/get — clear() actually clears, never throws', () => {
    // Regression guard: `clear()` on a driver's spec field used to throw unconditionally
    // ("this section always exists once constructed") even though the field's own getter already
    // treats an absent key as not-available — the throw's justification was contradicted by the
    // three lines of code right above it. Fixed in project.ts; this pins the fix for every
    // numeric spec field plus VCCon, so a future re-add of that throw fails here immediately.
    function freshSection() {
        const record = {
            uuid: {value: '00000000-0000-4000-8000-000000000000'},
            manufacturer: scraped(''), brand: scraped(''), model: scraped(''),
            provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
            sku: {value: '', grounds: [{origin: 'manufacturer_datasheet', reading: ''}]},
            driver_type: scraped('woofer'),
            data_sources: {value: {}},
            authoritative: {value: 'manual'},
            quality: {
                confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
                parse_errors: [], cross_source_only: [],
            },
            specs: {woofer: {}},
        };
        const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
        return driver.specs;
    }

    // `numVC`, `VCCon`, `c_m_per_s` and `roo_kg_per_m3` are excluded here — all four have a
    // documented calculated default when unset (`numVC`/`VCCon`: `docs/spec/SPEC_ENGINE.md:424`,
    // "numVC=1, VCCon=1"; `c_m_per_s`/`roo_kg_per_m3`: the live air model at reference conditions,
    // `engine/air.ts`'s `airFor`), so "not-available when unset" does not hold for them. Each gets
    // its own test below instead.
    const NUMERIC_FIELD_NAMES = [
        'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
        'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
        'SPL_dB', 'Pe_W', 'Dd_m', 'EBP_hz', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
        'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
        'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss',
        'Vcd_m', 'Hg_m', 'Hc_m', 'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m',
        'Outer_m', 'DVol_m3',
    ] as const;

    for (const [i, name] of NUMERIC_FIELD_NAMES.entries()) {
        it(`${name}: get=not-available, set=allowed, get=new value, clear=allowed, get=not-available`, () => {
            const section = freshSection();
            const field = section[name];
            const testValue = 100 + i;

            assertReads(field, null, 'not-available',
                `${name} must start not-available on a fresh section`);

            field.set(testValue);
            assertReads(field, testValue, 'entered',
                `${name} must read back exactly what was just set`);

            field.clear();
            assertReads(field, null, 'not-available',
                `${name} must revert to not-available after clear() — clear() must not throw`);
        });
    }

    it('numVC: get=calculated default 1, set=allowed, get=new value, clear=allowed, get=calculated default 1', () => {
        const section = freshSection();

        assertReads(section.numVC, 1, 'calculated',
            "numVC must start at WinISD's own documented default (1) on a fresh section, not absent");

        section.numVC.set(2);
        assertReads(section.numVC, 2, 'entered',
            'numVC must read back exactly what was just set');

        section.numVC.clear();
        assertReads(section.numVC, 1, 'calculated',
            'numVC must revert to the calculated default 1 after clear() — clear() must not throw');
    });

    it('VCCon: get=calculated default parallel, set=allowed, get=new value, clear=allowed, get=calculated default parallel', () => {
        const section = freshSection();

        assertReads(section.VCCon, 'parallel', 'calculated',
            "VCCon must start at WinISD's own documented default (parallel) on a fresh section, not absent");

        section.VCCon.set('series');
        assertReads(section.VCCon, 'series', 'entered',
            'VCCon must read back exactly what was just set');

        section.VCCon.clear();
        assertReads(section.VCCon, 'parallel', 'calculated',
            'VCCon must revert to the calculated default parallel after clear() — clear() must not throw');
    });

    it('c_m_per_s: get=calculated air-model default, set=allowed, get=new value, clear=allowed, get=calculated default again', () => {
        const section = freshSection();
        const referenceC = new Engine().solveEnvironment({}).values.c;

        assertReads(section.c_m_per_s, referenceC, 'calculated',
            'c_m_per_s must start at the live reference-air speed of sound on a fresh section, not absent');

        section.c_m_per_s.set(340);
        assertReads(section.c_m_per_s, 340, 'entered',
            'c_m_per_s must read back exactly what was just set');

        section.c_m_per_s.clear();
        assertReads(section.c_m_per_s, referenceC, 'calculated',
            'c_m_per_s must revert to the calculated reference-air default after clear() — clear() must not throw');
    });

    it('roo_kg_per_m3: get=calculated air-model default, set=allowed, get=new value, clear=allowed, get=calculated default again', () => {
        const section = freshSection();
        const referenceRho = new Engine().solveEnvironment({}).values.rho;

        assertReads(section.roo_kg_per_m3, referenceRho, 'calculated',
            'roo_kg_per_m3 must start at the live reference-air density on a fresh section, not absent');

        section.roo_kg_per_m3.set(1.25);
        assertReads(section.roo_kg_per_m3, 1.25, 'entered',
            'roo_kg_per_m3 must read back exactly what was just set');

        section.roo_kg_per_m3.clear();
        assertReads(section.roo_kg_per_m3, referenceRho, 'calculated',
            'roo_kg_per_m3 must revert to the calculated reference-air default after clear() — clear() must not throw');
    });
});
