import os
import re

field_map = {'Fs': 'Fs_hz', 'Re': 'Re_ohm', 'Le': 'Le_H', 'fLe': 'fLe_hz', 'KLe': 'KLe_H_sqrtHz', 'Znom': 'Znom_ohm', 'Qts': 'Qts', 'Qes': 'Qes', 'Qms': 'Qms', 'Vas': 'Vas_m3', 'Sd': 'Sd_m2', 'BL': 'BL_Tm', 'Mms': 'Mms_kg', 'Cms': 'Cms_m_per_N', 'Rms': 'Rms_kg_per_s', 'Xmax': 'Xmax_m', 'Xlim': 'Xlim_m', 'SPL': 'SPL_dB', 'Pe': 'Pe_W', 'Dd': 'Dd_m', 'EBP': 'EBP_hz', 'numVC': 'numVC', 'VCCon': 'VCCon', 'Dia': 'Dia_m', 'Vd': 'Vd_m3', 'no': 'no', 'SPLmax': 'SPLmax_dB', 'SPLmaxLF': 'SPLmaxLF_dB', 'USPL': 'USPL_dB', 'alfaVC': 'alfaVC_per_K', 'Rt': 'Rt_K_per_W', 'Ct': 'Ct_J_per_K', 'gamma': 'gamma_m_per_s2_A', 'Rme': 'Rme_kg_per_s', 'Mpow': 'Mpow_N_per_sqrtW', 'Mcost': 'Mcost_kg_per_s', 'Gloss': 'Gloss', 'c': 'c_m_per_s', 'roo': 'roo_kg_per_m3', 'Vcd': 'Vcd_m', 'Hg': 'Hg_m', 'Hc': 'Hc_m', 'freq_low_hz': 'freq_low_hz', 'freq_high_hz': 'freq_high_hz', 'power_peak_W': 'power_peak_W', 'weight_kg': 'weight_kg', 'Thick': 'Thick_m', 'Depth': 'Depth_m', 'MagDepth': 'MagDepth_m', 'Magnet': 'Magnet_m', 'Basket': 'Basket_m', 'Outer': 'Outer_m', 'OuterX': 'OuterX_m', 'OuterY': 'OuterY_m', 'DVol': 'DVol_m3'}

files_to_check = []
for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or 'build' in root or 'model' in root:
        continue
    for f in files:
        if f.endswith('.ts') or f.endswith('.vue') or f.endswith('.mjs') or f.endswith('.mts'):
            files_to_check.append(os.path.join(root, f))

def replace_calls(content):
    for field, mapped in field_map.items():
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.{field}\(\)', rf'\1.spec[\1.section].{mapped}.get().value', content)
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.{field}Cell\(\)', rf'\1.spec[\1.section].{mapped}', content)
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.enter{field}\(([^)]+)\)', rf'\1.spec[\1.section].{mapped}.set(\2)', content)
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.clear{field}\(\)', rf'\1.spec[\1.section].{mapped}.clear()', content)
        
    return content

for filepath in files_to_check:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        orig = content
        content = replace_calls(content)
        
        # Replace driver.empty() with fromConformingRecord... Wait, let's just do it manually for those tests
        
        if orig != content:
            print(f"Modifying {filepath}")
            with open(filepath, 'w') as f:
                f.write(content)
    except Exception as e:
        pass
