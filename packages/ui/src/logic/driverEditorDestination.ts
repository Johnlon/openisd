export type DriverEditorTab = 'General' | 'Parameters' | 'Advanced' | 'Dimensions';

const DIMENSIONS = new Set(['Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m', 'Outer_m',
  'OuterX_m', 'OuterY_m', 'weight_kg', 'Vcd_m', 'DVol_m3']);
const ADVANCED = new Set(['alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'SPLmaxLF_dB', 'SPLmax_dB',
  'Rme_kg_per_s', 'gamma_m_per_s2_A', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'EBP_hz', 'Gloss',
  'c_m_per_s', 'roo_kg_per_m3']);

/** The editor tab that displays a driver-spec field. */
export function driverEditorTabFor(field: string): DriverEditorTab {
  if (field === 'brand' || field === 'model') return 'General';
  if (DIMENSIONS.has(field)) return 'Dimensions';
  if (ADVANCED.has(field)) return 'Advanced';
  return 'Parameters';
}
