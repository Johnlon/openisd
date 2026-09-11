const fs = require('fs');

const solverStr = fs.readFileSync('packages/design/engine/solver.ts', 'utf8');

// I will write a regex to find all `setVal('xyz', val)` and rewrite them.
// Wait, the new pattern is:
// if (!xyz.entered) xyz.setCalculated(val);
// else { const diff = Math.abs(xyz.value - val); if (diff > 0.01) xyz.setDq(["..."]); else xyz.setDq(); }

let newSolver = solverStr;

newSolver = newSolver.replace(/const setVal = \[\s\S]*?\n    \};\n/m, '');

// Replace `r.XYZ` with `XYZ.value`
// We only want to replace it for valid keys.
const names = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms',
  'Qts', 'Vas_m3', 'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s',
  'EBP_hz', 'Xmax_m', 'Vd_m3', 'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB',
  'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB', 'Rme_kg_per_s', 'Mpow_N_per_sqrtW',
  'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m', 'Depth_m', 'MagDepth_m',
  'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3', 'Re_terminal_ohm',
  'BL_terminal_Tm', 'numVC', 'wiring', 'addedMass_kg', 'tuning_hz', 'Vb_m3',
  'prMmd_kg', 'prSd_m2', 'prCms_m_per_N', 'prNum', 'length_m', 'area_m2',
  'endCorrection_m', 'VCCon'
];

for (const name of names) {
  newSolver = newSolver.replaceAll(`r.${name}`, `${name === 'wiring' ? 'VCCon' : name}.value`);
  // also replace r['XYZ']
  newSolver = newSolver.replaceAll(`r['${name}']`, `${name === 'wiring' ? 'VCCon' : name}.value`);
}

// Replace driverC(r) -> driverC(c_m_per_s, roo_kg_per_m3)
// Wait, driverC needs to be updated too.
// I will just use a pro subagent, this string manipulation is too complex to get right on the first try without tests.
