export interface DriverSolverQuantities {
    Fs_hz?: number; Re_ohm?: number; Znom_ohm?: number; Le_H?: number; fLe_hz?: number;
    KLe_H_sqrtHz?: number; Qes?: number; Qms?: number; Qts?: number; Vas_m3?: number;
    Sd_m2?: number; Dd_m?: number; BL_Tm?: number; Mms_kg?: number; Cms_m_per_N?: number;
    Rms_kg_per_s?: number; EBP_hz?: number; Xmax_m?: number; Vd_m3?: number; Hc_m?: number;
    Hg_m?: number; Pe_W?: number; no?: number; SPLref_dB?: number; SPL_dB?: number;
    USPL_dB?: number; SPLmax_dB?: number; SPLmaxLF_dB?: number; Rme_kg_per_s?: number;
    Mpow_N_per_sqrtW?: number; Mcost_kg_per_s?: number; gamma_m_per_s2_A?: number;
    Gloss?: number; Vcd_m?: number; Depth_m?: number; MagDepth_m?: number;
    Magnet_m?: number; DVol_m3?: number; c_m_per_s?: number; roo_kg_per_m3?: number;
    Re_terminal_ohm?: number; BL_terminal_Tm?: number; numVC?: number;
    wiring?: import('./types.js').Wiring;
};

export interface PrSolverQuantities {
    addedMass_kg?: number;
    tuning_hz?: number;
    Vb_m3?: number;
    prMmd_kg?: number;
    prSd_m2?: number;
    prCms_m_per_N?: number;
    prNum?: number;
}

export interface VentSolverQuantities {
    tuning_hz?: number;
    length_m?: number;
    Vb_m3?: number;
    area_m2?: number;
    endCorrection_m?: number;
}
