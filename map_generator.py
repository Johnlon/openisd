fields = """Fs_hz Re_ohm Le_H fLe_hz KLe_H_sqrtHz Znom_ohm Qts Qes Qms Vas_m3 Sd_m2 BL_Tm Mms_kg Cms_m_per_N Rms_kg_per_s Xmax_m Xlim_m SPL_dB Pe_W Dd_m EBP_hz numVC VCCon Dia_m Vd_m3 no SPLmax_dB SPLmaxLF_dB USPL_dB alfaVC_per_K Rt_K_per_W Ct_J_per_K gamma_m_per_s2_A Rme_kg_per_s Mpow_N_per_sqrtW Mcost_kg_per_s Gloss c_m_per_s roo_kg_per_m3 Vcd_m Hg_m Hc_m freq_low_hz freq_high_hz power_peak_W weight_kg Thick_m Depth_m MagDepth_m Magnet_m Basket_m Outer_m OuterX_m OuterY_m DVol_m3""".split()

import re

field_map = {}
for f in fields:
    # the old accessor is typically the prefix before the first underscore, OR if it doesn't have an underscore, the whole word.
    # Exception: freq_low_hz -> freq_low_hz, power_peak_W -> power_peak_W
    # Actually, in the old model, what were they called?
    # Let's look at the errors: EBPCell, numVCCell, VCConCell, noCell, SPLmaxCell, SPLmaxLFCell, USPLCell, alfaVCCell, RtCell, CtCell, gammaCell, RmeCell, MpowCell, McostCell, GlossCell, cCell, rooCell, freq_low_hzCell, freq_high_hzCell, power_peak_WCell, weight_kgCell
    if f in ['freq_low_hz', 'freq_high_hz', 'power_peak_W', 'weight_kg']:
        key = f
    elif f == 'SPL_dB':
        key = 'SPL'
    elif f == 'SPLmax_dB':
        key = 'SPLmax'
    elif f == 'SPLmaxLF_dB':
        key = 'SPLmaxLF'
    elif f == 'USPL_dB':
        key = 'USPL'
    elif f == 'alfaVC_per_K':
        key = 'alfaVC'
    elif f == 'Rt_K_per_W':
        key = 'Rt'
    elif f == 'Ct_J_per_K':
        key = 'Ct'
    elif f == 'gamma_m_per_s2_A':
        key = 'gamma'
    elif f == 'Rme_kg_per_s':
        key = 'Rme'
    elif f == 'Mpow_N_per_sqrtW':
        key = 'Mpow'
    elif f == 'Mcost_kg_per_s':
        key = 'Mcost'
    elif f == 'c_m_per_s':
        key = 'c'
    elif f == 'roo_kg_per_m3':
        key = 'roo'
    elif f == 'EBP_hz':
        key = 'EBP'
    elif f == 'Cms_m_per_N':
        key = 'Cms'
    elif f == 'Rms_kg_per_s':
        key = 'Rms'
    else:
        key = f.split('_')[0]
        
    field_map[key] = f

print(field_map)
