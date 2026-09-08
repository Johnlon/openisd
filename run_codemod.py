import os
import re

field_map = {
    'Fs': 'Fs_hz',
    'Re': 'Re_ohm',
    'Le': 'Le_H',
    'fLe': 'fLe_hz',
    'KLe': 'KLe_H_sqrtHz',
    'Znom': 'Znom_ohm',
    'Qts': 'Qts',
    'Qes': 'Qes',
    'Qms': 'Qms',
    'Vas': 'Vas_m3',
    'Sd': 'Sd_m2',
    'BL': 'BL_Tm',
    'Mms': 'Mms_kg',
    'Cms': 'Cms_m_per_N',
    'Rms': 'Rms_kg_per_s',
    'Xmax': 'Xmax_m',
    'Xlim': 'Xlim_m',
    'SPL': 'SPL_dB',
    'Pe': 'Pe_W',
    'Dia': 'Dia_m',
    'Dd': 'Dd_m',
    'DVol': 'DVol_m3',
    'Thick': 'Thick_m',
    'Depth': 'Depth_m',
    'MagDepth': 'MagDepth_m',
    'Magnet': 'Magnet_m',
    'Basket': 'Basket_m',
    'Outer': 'Outer_m',
    'OuterX': 'OuterX_m',
    'OuterY': 'OuterY_m',
    'Vd': 'Vd_m3',
    'weight': 'weight_kg',
    'Hc': 'Hc_m',
    'Hg': 'Hg_m',
    'Vcd': 'Vcd_m',
    'AddedMass': 'addedMass_kg'
}

files_to_check = []
for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or 'build' in root or 'model' in root:
        continue
    for f in files:
        if f.endswith('.ts') or f.endswith('.vue') or f.endswith('.mjs') or f.endswith('.mts'):
            files_to_check.append(os.path.join(root, f))

# First, collect all possible variables that hold a driver (e.g. `driver.Fs()`, `drv.Fs()`, `d.Fs()`)
# Instead of guessing the variable name, we can match `\.([A-Z][a-z0-9A-Z]*)` and check if it's in the field map.

def replace_calls(content):
    for field, mapped in field_map.items():
        # X() -> spec[section].mapped.get().value
        # Actually it's just `spec[section].mapped.get().value`?
        # But wait! The UI binds `driver.spec[driver.section]` to `spec`.
        # So we can't blindly replace `.Fs()` with `.spec[section].Fs_hz.get().value`.
        # If the code says `driver.Fs()`, it should become `driver.spec[driver.section].Fs_hz.get().value`.
        
        # 1. driver.Fs() -> driver.spec[driver.section].Fs_hz.get().value
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.{field}\(\)', rf'\1.spec[\1.section].{mapped}.get().value', content)
        
        # 2. driver.FsCell() -> driver.spec[driver.section].Fs_hz
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.{field}Cell\(\)', rf'\1.spec[\1.section].{mapped}', content)
        
        # 3. driver.enterFs(v) -> driver.spec[driver.section].Fs_hz.set(v)
        # Using a non-greedy match for arguments because there could be nested parens... actually usually simple
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.enter{field}\(([^)]+)\)', rf'\1.spec[\1.section].{mapped}.set(\2)', content)
        
        # 4. driver.clearFs() -> driver.spec[driver.section].Fs_hz.clear()
        content = re.sub(rf'\b([a-zA-Z0-9_]+)\.clear{field}\(\)', rf'\1.spec[\1.section].{mapped}.clear()', content)
        
    # Also replace any lingering imports of '@openisd/model' with '@openisd/design'
    content = content.replace("'@openisd/model'", "'@openisd/design'")
    content = content.replace('"@openisd/model"', "'@openisd/design'")
    return content

for filepath in files_to_check:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        orig = content
        content = replace_calls(content)
        
        if orig != content:
            print(f"Modifying {filepath}")
            with open(filepath, 'w') as f:
                f.write(content)
    except Exception as e:
        print(f"Error on {filepath}: {e}")

