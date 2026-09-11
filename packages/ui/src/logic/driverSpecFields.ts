/** The ONE dispatch from a runtime spec-field name to the driver's typed accessor.
 *
 *  `SpecField` never appears as a public parameter on `OpenISDDriver` itself (human ruling
 *  2026-08-24, ENCAPSULATION_AND_LAYERING.md), so the driver editor's data-driven field table
 *  needs exactly one place that maps a name to a handle. Reading, writing and clearing all go
 *  through this one table: a handle carries `get`/`set`/`clear`, so a second and third switch
 *  over the same 55 names would be three tables free to disagree about which accessor a name
 *  means.
 *
 *  Returns null for a name the numeric table does not own, rather than asserting a type — which
 *  keeps the compiler proving the numeric reads, and is what a cast here would have switched
 *  off. */
import type { Field, OpenISDDriver } from '@openisd/design';

export function specFieldHandle(driver: OpenISDDriver, field: string): Field<number> | null {
  const d = driver;
  switch (field) {
    case 'Fs': return d.spec[d.section].Fs_hz;
    case 'Re': return d.spec[d.section].Re_ohm;
    case 'Le': return d.spec[d.section].Le_H;
    case 'fLe': return d.spec[d.section].fLe_hz;
    case 'KLe': return d.spec[d.section].KLe_H_sqrtHz;
    case 'Znom': return d.spec[d.section].Znom_ohm;
    case 'Qts': return d.spec[d.section].Qts;
    case 'Qes': return d.spec[d.section].Qes;
    case 'Qms': return d.spec[d.section].Qms;
    case 'Vas': return d.spec[d.section].Vas_m3;
    case 'Sd': return d.spec[d.section].Sd_m2;
    case 'BL': return d.spec[d.section].BL_Tm;
    case 'Mms': return d.spec[d.section].Mms_kg;
    case 'Cms': return d.spec[d.section].Cms_m_per_N;
    case 'Rms': return d.spec[d.section].Rms_kg_per_s;
    case 'Xmax': return d.spec[d.section].Xmax_m;
    case 'Xlim': return d.spec[d.section].Xlim_m;
    case 'SPL': return d.spec[d.section].SPL_dB;
    case 'Pe': return d.spec[d.section].Pe_W;
    case 'Dd': return d.spec[d.section].Dd_m;
    case 'EBP': return d.spec[d.section].EBP_hz;
    case 'numVC': return d.spec[d.section].numVC;
    case 'Dia': return d.spec[d.section].Dia_m;
    case 'Vd': return d.spec[d.section].Vd_m3;
    case 'no': return d.spec[d.section].no;
    case 'SPLmax': return d.spec[d.section].SPLmax_dB;
    case 'SPLmaxLF': return d.spec[d.section].SPLmaxLF_dB;
    case 'USPL': return d.spec[d.section].USPL_dB;
    case 'alfaVC': return d.spec[d.section].alfaVC_per_K;
    case 'Rt': return d.spec[d.section].Rt_K_per_W;
    case 'Ct': return d.spec[d.section].Ct_J_per_K;
    case 'gamma': return d.spec[d.section].gamma_m_per_s2_A;
    case 'Rme': return d.spec[d.section].Rme_kg_per_s;
    case 'Mpow': return d.spec[d.section].Mpow_N_per_sqrtW;
    case 'Mcost': return d.spec[d.section].Mcost_kg_per_s;
    case 'Gloss': return d.spec[d.section].Gloss;
    case 'c': return d.spec[d.section].c_m_per_s;
    case 'roo': return d.spec[d.section].roo_kg_per_m3;
    case 'Vcd': return d.spec[d.section].Vcd_m;
    case 'Hg': return d.spec[d.section].Hg_m;
    case 'Hc': return d.spec[d.section].Hc_m;
    case 'freq_low_hz': return d.spec[d.section].freq_low_hz;
    case 'freq_high_hz': return d.spec[d.section].freq_high_hz;
    case 'power_peak_W': return d.spec[d.section].power_peak_W;
    case 'weight_kg': return d.spec[d.section].weight_kg;
    case 'Thick': return d.spec[d.section].Thick_m;
    case 'Depth': return d.spec[d.section].Depth_m;
    case 'MagDepth': return d.spec[d.section].MagDepth_m;
    case 'Magnet': return d.spec[d.section].Magnet_m;
    case 'Basket': return d.spec[d.section].Basket_m;
    case 'Outer': return d.spec[d.section].Outer_m;
    case 'OuterX': return d.spec[d.section].OuterX_m;
    case 'OuterY': return d.spec[d.section].OuterY_m;
    case 'DVol': return d.spec[d.section].DVol_m3;
    default: return null;
  }
}
