/**
 * `openisdFields.ts` — the OpenISD field table, keyed by the canonical `<name>_<unit>` schema
 * name (`Fs_hz`, `Vas_m3`, `Re_ohm`, …). Each entry carries the WinISD `.wdr` INI key when the
 * field has one. Display text (labels, units) lives in the UI's field registry
 * (`packages/ui/src/logic/fields/fieldRegistry.ts`), never here.
 *
 * This module is a STANDALONE sibling of `domain/` and `winisd/`: it imports neither, so both
 * can import it without a cycle (`domain/openisdSchema.ts` imports the `.wdr` codec from
 * `winisd/`, and `winisd/bridge.ts` imports the domain — this table must not sit in either).
 *
 * `OpenIsdFieldKey` — the key union — is derived from this table via `keyof`. Whether a field is
 * WinISD-calculable (its `.wdr` parstate C-vs-E mark) is NOT in this table: the `.wdr` codec
 * writes each row's mark explicitly (`driverYmlToOpenisdAndWdr.ts`'s `wdrRow` calls), so the flag
 * lives beside the row it marks, not in a list that can drift from it.
 *
 * `Xlim_m` IS in this table but has no `wdr`: it is a real openisd spec field (record, domain,
 * UI) yet WinISD's `.wdr` writer has no `Xlim=` line — the value crosses as a parstate mark
 * alone — so there is no row name for it.
 *
 * Why this shape: `KLe` was once spelled `Le2`, `alfaVC` was `tc`, and hand-maintained copies
 * disagreed with each other about which fields even have a `.wdr` key (`c`/`roo`/`alfaVC`/`no`
 * were claimed `wdr`-less in one copy and written to `.wdr` in the other). A rename is now one
 * line here and every reader follows.
 */
export interface FieldDef {
    /** The WinISD `.wdr` INI key. Absent when the field is never written to a `.wdr`. */
    wdr?: string;
}

export const OPENISD_FIELDS = {
    Qts: {wdr: 'Qts'},
    Znom_ohm: {wdr: 'Znom'},
    Fs_hz: {wdr: 'Fs'},
    Pe_W: {wdr: 'Pe'},
    SPL_dB: {wdr: 'SPL'},
    Re_ohm: {wdr: 'Re'},
    Le_H: {wdr: 'Le'},
    fLe_hz: {wdr: 'fLe'},
    KLe_H_sqrtHz: {wdr: 'KLe'},
    BL_Tm: {wdr: 'BL'},
    Xmax_m: {wdr: 'Xmax'},
    Cms_m_per_N: {wdr: 'Cms'},
    Qms: {wdr: 'Qms'},
    Qes: {wdr: 'Qes'},
    Rms_kg_per_s: {wdr: 'Rms'},
    Mms_kg: {wdr: 'Mms'},
    Sd_m2: {wdr: 'Sd'},
    Vas_m3: {wdr: 'Vas'},
    Dia_m: {wdr: 'Dia'},
    Vd_m3: {wdr: 'Vd'},
    no: {wdr: 'no'},
    Dd_m: {wdr: 'Dd'},
    EBP_hz: {wdr: 'EBP'},
    numVC: {wdr: 'numVC'},
    Hc_m: {wdr: 'Hc'},
    Hg_m: {wdr: 'Hg'},
    SPLmax_dB: {wdr: 'SPLmax'},
    SPLmaxLF_dB: {wdr: 'SPLmaxLF'},
    USPL_dB: {wdr: 'USPL'},
    alfaVC_per_K: {wdr: 'alfaVC'},
    Rt_K_per_W: {wdr: 'Rt'},
    Ct_J_per_K: {wdr: 'Ct'},
    gamma_m_per_s2_A: {wdr: 'gamma'},
    Rme_kg_per_s: {wdr: 'Rme'},
    Mpow_N_per_sqrtW: {wdr: 'Mpow'},
    Mcost_kg_per_s: {wdr: 'Mcost'},
    Gloss: {wdr: 'Gloss'},
    VCCon: {wdr: 'VCCon'},
    c_m_per_s: {wdr: 'c'},
    roo_kg_per_m3: {wdr: 'roo'},
    Thick_m: {wdr: 'Thick'},
    Depth_m: {wdr: 'Depth'},
    MagDepth_m: {wdr: 'MagDepth'},
    Magnet_m: {wdr: 'Magnet'},
    Basket_m: {wdr: 'Basket'},
    Outer_m: {wdr: 'Outer'},
    Vcd_m: {wdr: 'Vcd'},
    DVol_m3: {wdr: 'DVol'},

    // Identity/attribution metadata (never a Thiele/Small quantity, never written to a `.wdr`).
    manufacturer: {},
    brand: {},
    model: {},
    providedBy: {},
    added: {},
    comment: {},
    // Xlim_m is a real openisd spec field (record, domain, UI) but has NO `.wdr` key — WinISD's
    // writer has no `Xlim=` line, the value crosses as a parstate mark alone. Hence no `wdr`.
    Xlim_m: {},
    // The remaining openisd spec fields — none is a `.wdr` row, so none carries `wdr`.
    freq_low_hz: {},
    freq_high_hz: {},
    power_peak_W: {},
    weight_kg: {},
    OuterX_m: {},
    OuterY_m: {},
    // The passive-radiator tuning pair — its own schema (a PR is a different device), so no `wdr`
    // and not a driver spec field. The UI's PR group is derived from these keys.
    tuning_hz: {},
    addedMass_kg: {},
} as const satisfies Record<string, FieldDef>;

export type OpenIsdFieldKey = keyof typeof OPENISD_FIELDS;

/** The field-table keys that carry a `.wdr` row name — the 48 fields a `.wdr` writes. The codec
 *  keys its read and write rows by these, deriving each row's `.wdr` name from the FieldDef, so a
 *  row name can never drift from this table. */
export type WdrFieldKey = {
    [K in keyof typeof OPENISD_FIELDS]: (typeof OPENISD_FIELDS)[K] extends { wdr: string } ? K : never;
}[keyof typeof OPENISD_FIELDS];