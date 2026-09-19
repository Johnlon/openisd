/**
 * `fieldVocabulary.ts` — the OpenISD driver-field vocabulary, keyed by the canonical
 * `<name>_<unit>` schema name (`Fs_hz`, `Vas_m3`, `Re_ohm`, …). Each entry carries the field's
 * intrinsic identity: the rendered label and the WinISD `.wdr` INI key when it has one.
 *
 * This module is a STANDALONE sibling of `domain/` and `winisd/`: it imports neither, so both
 * can import it without a cycle (`domain/openisdSchema.ts` imports the `.wdr` codec from
 * `winisd/`, and `winisd/bridge.ts` imports the domain — the vocabulary must not sit in either).
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
    /** The `<label>` text the driver editor renders for this field. */
    ui_label: string;
    /** The WinISD `.wdr` INI key. Absent when the field is never written to a `.wdr`. */
    wdr?: string;
}

export const OPENISD_FIELDS = {
    Qts: {ui_label: 'Qts', wdr: 'Qts'},
    Znom_ohm: {ui_label: 'Znom', wdr: 'Znom'},
    Fs_hz: {ui_label: 'Fs', wdr: 'Fs'},
    Pe_W: {ui_label: 'Pe', wdr: 'Pe'},
    SPL_dB: {ui_label: 'SPL', wdr: 'SPL'},
    Re_ohm: {ui_label: 'Re', wdr: 'Re'},
    Le_H: {ui_label: 'Le', wdr: 'Le'},
    fLe_hz: {ui_label: 'fLe', wdr: 'fLe'},
    KLe_H_sqrtHz: {ui_label: 'KLe', wdr: 'KLe'},
    BL_Tm: {ui_label: 'BL', wdr: 'BL'},
    Xmax_m: {ui_label: 'Xmax', wdr: 'Xmax'},
    Cms_m_per_N: {ui_label: 'Cms', wdr: 'Cms'},
    Qms: {ui_label: 'Qms', wdr: 'Qms'},
    Qes: {ui_label: 'Qes', wdr: 'Qes'},
    Rms_kg_per_s: {ui_label: 'Rms', wdr: 'Rms'},
    Mms_kg: {ui_label: 'Mms', wdr: 'Mms'},
    Sd_m2: {ui_label: 'Sd', wdr: 'Sd'},
    Vas_m3: {ui_label: 'Vas', wdr: 'Vas'},
    Dia_m: {ui_label: 'Dia', wdr: 'Dia'},
    Vd_m3: {ui_label: 'Vd', wdr: 'Vd'},
    no: {ui_label: 'no', wdr: 'no'},
    Dd_m: {ui_label: 'Dd', wdr: 'Dd'},
    EBP_hz: {ui_label: 'EBP', wdr: 'EBP'},
    numVC: {ui_label: 'Voicecoils', wdr: 'numVC'},
    Hc_m: {ui_label: 'Hc', wdr: 'Hc'},
    Hg_m: {ui_label: 'Hg', wdr: 'Hg'},
    SPLmax_dB: {ui_label: 'SPLmax', wdr: 'SPLmax'},
    SPLmaxLF_dB: {ui_label: 'SPLmaxLF', wdr: 'SPLmaxLF'},
    USPL_dB: {ui_label: 'USPL', wdr: 'USPL'},
    alfaVC_per_K: {ui_label: 'AlfaVC', wdr: 'alfaVC'},
    Rt_K_per_W: {ui_label: 'R(t)', wdr: 'Rt'},
    Ct_J_per_K: {ui_label: 'C(t)', wdr: 'Ct'},
    gamma_m_per_s2_A: {ui_label: 'gamma', wdr: 'gamma'},
    Rme_kg_per_s: {ui_label: 'Rme', wdr: 'Rme'},
    Mpow_N_per_sqrtW: {ui_label: 'Mpow', wdr: 'Mpow'},
    Mcost_kg_per_s: {ui_label: 'Mcost', wdr: 'Mcost'},
    Gloss: {ui_label: 'Gloss', wdr: 'Gloss'},
    VCCon: {ui_label: 'Connection', wdr: 'VCCon'},
    c_m_per_s: {ui_label: 'c', wdr: 'c'},
    roo_kg_per_m3: {ui_label: 'roo', wdr: 'roo'},
    Thick_m: {ui_label: 'Basket Plate Thickness (Thick)', wdr: 'Thick'},
    Depth_m: {ui_label: 'Driver Depth (Depth)', wdr: 'Depth'},
    MagDepth_m: {ui_label: 'Magnet Depth (MagDepth)', wdr: 'MagDepth'},
    Magnet_m: {ui_label: 'Magnet Diameter (Magnet)', wdr: 'Magnet'},
    Basket_m: {ui_label: 'Basket Diameter (Basket)', wdr: 'Basket'},
    Outer_m: {ui_label: 'Outer Diameter (Outer)', wdr: 'Outer'},
    Vcd_m: {ui_label: 'Voice Coil Dia (Vcd)', wdr: 'Vcd'},
    DVol_m3: {ui_label: 'Driver Displacement Volume (DVol)', wdr: 'DVol'},

    // Identity/attribution metadata (never a Thiele/Small quantity, never written to a `.wdr`).
    manufacturer: {ui_label: 'Manufacturer'},
    brand: {ui_label: 'Brand'},
    model: {ui_label: 'Model'},
    providedBy: {ui_label: 'Data provided by'},
    added: {ui_label: 'Date added'},
    comment: {ui_label: 'Comment'},
    // Xlim_m is a real openisd spec field (record, domain, UI) but has NO `.wdr` key — WinISD's
    // writer has no `Xlim=` line, the value crosses as a parstate mark alone. Hence no `wdr`.
    Xlim_m: {ui_label: 'Xlim'},
    // The remaining openisd spec fields — none is a `.wdr` row, so none carries `wdr`.
    freq_low_hz: {ui_label: 'Frequency range low (freq_low_hz)'},
    freq_high_hz: {ui_label: 'Frequency range high (freq_high_hz)'},
    power_peak_W: {ui_label: 'Peak power (power_peak_W)'},
    weight_kg: {ui_label: 'Weight (weight_kg)'},
    OuterX_m: {ui_label: 'Outer dimension X (OuterX)'},
    OuterY_m: {ui_label: 'Outer dimension Y (OuterY)'},
    // The passive-radiator tuning pair — its own schema (a PR is a different device), so no `wdr`
    // and not a driver spec field. The UI's PR group is derived from these keys.
    tuning_hz: {ui_label: 'Target tuning (tuning_hz)'},
    addedMass_kg: {ui_label: 'Added mass to cone (addedMass_kg)'},
} as const satisfies Record<string, FieldDef>;

export type OpenIsdFieldKey = keyof typeof OPENISD_FIELDS;

/** The vocabulary keys that carry a `.wdr` row name — the 48 fields a `.wdr` writes. The codec
 *  keys its read and write rows by these, deriving each row's `.wdr` name from the FieldDef, so a
 *  row name can never drift from the vocabulary. */
export type WdrFieldKey = {
    [K in keyof typeof OPENISD_FIELDS]: (typeof OPENISD_FIELDS)[K] extends { wdr: string } ? K : never;
}[keyof typeof OPENISD_FIELDS];
