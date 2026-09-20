import type {Field, OpenISDDriver} from '@openisd/design';
import type {NumSpecField} from './appState.js';

const NUM_SPEC_FIELD_SET: ReadonlySet<string> = new Set<NumSpecField>([
  'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
  'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
  'SPL_dB', 'Pe_W', 'Dd_m', 'EBP_hz', 'numVC', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
  'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss', 'c_m_per_s', 'roo_kg_per_m3',
  'Vcd_m', 'Hg_m', 'Hc_m', 'freq_low_hz', 'freq_high_hz', 'power_peak_W', 'weight_kg',
  'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m', 'Outer_m', 'OuterX_m',
  'OuterY_m', 'DVol_m3',
]);

export function isNumSpecField(field: string): field is NumSpecField {
  return NUM_SPEC_FIELD_SET.has(field);
}

export function specFieldHandle(driver: OpenISDDriver, field: NumSpecField): Field<number> {
  return driver.spec[driver.section][field];
}
