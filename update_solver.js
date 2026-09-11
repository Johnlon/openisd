const fs = require('fs');

const quantities = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms',
  'Qts', 'Vas_m3', 'Sd_m2', 'Dd_m', 'BL_Tm', 'Re_terminal_ohm', 'BL_terminal_Tm', 
  'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3', 'Hc_m', 'Hg_m',
  'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB', 
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 
  'Vcd_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3'
];

let signature = quantities.map(q => `  ${q}: SolverField,`).join('\n');
signature += `\n  numVC: SolverField,\n  wiring: SolverField<'series' | 'parallel'>`;

console.log("export function solveConsistencyGroup(\n" + signature + "\n) {");
