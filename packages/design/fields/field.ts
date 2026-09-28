/**
 * The field registry: every field OpenISD has, enumerated once, each carrying what it IS —
 * the band an entered value must fall in and the decimal places it is meaningful to. Static,
 * and separate from any domain object holding a VALUE for one: `OpenISDDriver.specs` holds a
 * value per field, this holds the fields themselves (John, 2026-09-28).
 *
 * A Java-style enum, the same shape as `LossMode` (`engine/lossMode.ts`): private constructor,
 * one static member per field, `ALL` built by reflection so a member cannot be left out of it.
 * Members are SCREAMING_UPPER_CASE, as every `static readonly` in this codebase is
 * (John, 2026-09-28).
 *
 * No `parse()`, unlike `LossMode` and `Chip`: their wire values are stored in a project and
 * come back as strings, so they need a string→member door. A field NAME is never stored and
 * never arrives from outside — a caller names the member.
 *
 * Bounds are in SI/model space, never display space, matching how `NumInput.vue` validates: a
 * field labelled °C or mm still states its band in K or m.
 *
 * NOT yet folded in: `PHYSICAL_RANGE` (`engine/physicalRange.ts`) and `FIELD_FLOOR`
 * (`domain/driver/openIsdDriverSpec.ts`) state bands for these same quantities a second and
 * third time, and contradict the numbers below for nine fields. Every value here is carried
 * over from `uiFields.ts` VERBATIM, so building this registry changed no behaviour; each
 * contradiction is a separate decision, recorded in
 * bugs/BUG_20260928_three_tables_disagree_on_field_validity.md.
 */
import {MAX_SUPPORTED_TEMP_K, MIN_SUPPORTED_TEMP_K} from '../engine/index.js';
import type {FieldLimits} from './filterLimits.js';
import {
  FILTER_BW_LIMITS, FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_ORDER_LIMITS, FILTER_Q_LIMITS,
  FILTER_T_LIMITS,
} from './filterLimits.js';

export class Field {
  private constructor(
    /** The field's name — the only thing that crosses a boundary (a UI row's id, a test's pin). */
    readonly value: string,
    /** The band an entered value must fall in, in SI/model units. */
    readonly limits: FieldLimits,
    /** Fixed decimal places the field's base unit is meaningful to. */
    readonly precision: number,
  ) {}

  // ── Box ───────────────────────────────────────────────────────────────────────────────────
  static readonly BOX_VB_L = new Field('box_Vb_l', Object.freeze({min: 0.0001, max: 100}), 2);
  static readonly BOX_VF_L = new Field('box_Vf_l', Object.freeze({min: 0.0001, max: 100}), 2);
  static readonly BOX_FB_HZ = new Field('box_Fb_hz', Object.freeze({min: 0, max: 1000}), 2);
  static readonly BOX_RESONANCE_HZ =
    new Field('box_Resonance_hz', Object.freeze({min: 0, max: 20000}), 2);
  static readonly BOX_REARRESONANCE_HZ =
    new Field('box_RearResonance_hz', Object.freeze({min: 0, max: 20000}), 2);
  static readonly BOX_FRC_HZ = new Field('box_Frc_hz', Object.freeze({min: 0, max: 20000}), 2);

  // ── Vent ──────────────────────────────────────────────────────────────────────────────────
  static readonly VENT_COUNT = new Field('vent_Count', Object.freeze({min: 1, max: 4}), 0);
  static readonly VENT_D_CM = new Field('vent_D_cm', Object.freeze({min: 0.001, max: 2}), 2);
  static readonly VENT_W_CM = new Field('vent_W_cm', Object.freeze({min: 0.001, max: 2}), 2);
  static readonly VENT_H_CM = new Field('vent_H_cm', Object.freeze({min: 0.001, max: 2}), 2);
  static readonly VENT_L_CM = new Field('vent_L_cm', Object.freeze({min: 0.001, max: 10}), 2);
  static readonly VENT_CROSSAREA_M2 =
    new Field('vent_CrossArea_m2', Object.freeze({min: 0, max: 10}), 4);
  static readonly VENT_1STPORTRESONANCE_HZ =
    new Field('vent_1stPortResonance_hz', Object.freeze({min: 0, max: 20000}), 2);

  // ── Passive radiator ──────────────────────────────────────────────────────────────────────
  static readonly PR_SD_CM2 = new Field('pr_Sd_cm2', Object.freeze({min: 0.0001, max: 10}), 2);
  static readonly PR_XMAX_MM = new Field('pr_Xmax_mm', Object.freeze({min: 0, max: 0.5}), 2);
  static readonly PR_NUM = new Field('pr_Num', Object.freeze({min: 1, max: 16}), 0);
  static readonly PR_MADD_G = new Field('pr_Madd_g', Object.freeze({min: 0, max: 5000}), 3);
  static readonly PR_FP_HZ = new Field('pr_Fp_hz', Object.freeze({min: 1, max: 1000}), 2);
  static readonly PR_VAS_L = new Field('pr_Vas_l', Object.freeze({min: 0.00001, max: 100}), 2);
  static readonly PR_FS_HZ = new Field('pr_Fs_hz', Object.freeze({min: 1, max: 1000}), 2);
  static readonly PR_QMS = new Field('pr_Qms', Object.freeze({min: 0.1, max: 100}), 3);
  static readonly PR_FSMASS_HZ = new Field('pr_FsMass_hz', Object.freeze({min: 0, max: 1000}), 2);

  // ── Signal ────────────────────────────────────────────────────────────────────────────────
  static readonly SIGNAL_PIN_W =
    new Field('signal_Pin_W', Object.freeze({min: 0.01, max: 100000}), 2);
  static readonly SIGNAL_DRIVEV_V =
    new Field('signal_DriveV_V', Object.freeze({min: 0.01, max: 1000}), 2);
  static readonly SIGNAL_RS_OHM = new Field('signal_Rs_ohm', Object.freeze({min: 0, max: 1000}), 3);
  static readonly SIGNAL_DISTANCE_M =
    new Field('signal_Distance_m', Object.freeze({min: 0, max: 100}), 3);
  static readonly SIGNAL_ANGLE_RAD =
    new Field('signal_Angle_rad', Object.freeze({min: 0, max: 3.1416}), 4);
  static readonly SIGNAL_GENHZ_HZ =
    new Field('signal_GenHz_hz', Object.freeze({min: 1, max: 20000}), 2);

  // ── Losses ────────────────────────────────────────────────────────────────────────────────
  static readonly LOSS_QL = new Field('loss_Ql', Object.freeze({min: 0.1, max: 1000}), 2);
  static readonly LOSS_QA = new Field('loss_Qa', Object.freeze({min: 0.1, max: 1000}), 2);
  static readonly LOSS_QP = new Field('loss_Qp', Object.freeze({min: 0.1, max: 1000}), 2);

  // ── Advanced ──────────────────────────────────────────────────────────────────────────────
  static readonly ADV_TEMP_K = new Field(
    'adv_Temp_K', Object.freeze({min: MIN_SUPPORTED_TEMP_K, max: MAX_SUPPORTED_TEMP_K}), 2);
  static readonly ADV_HUMIDITY_PCT =
    new Field('adv_Humidity_pct', Object.freeze({min: 0, max: 100}), 2);
  static readonly ADV_PRESSURE_KPA =
    new Field('adv_Pressure_kPa', Object.freeze({min: 1000, max: 200000}), 2);
  static readonly ADV_SOUNDVELOCITY_M_PER_S =
    new Field('adv_SoundVelocity_m_per_s', Object.freeze({min: 0, max: 1000}), 2);
  static readonly ADV_AIRDENSITY_KG_PER_M3 =
    new Field('adv_AirDensity_kg_per_m3', Object.freeze({min: 0, max: 10}), 5);

  // ── Driver ────────────────────────────────────────────────────────────────────────────────
  static readonly DRIVER_FS_HZ = new Field('driver_Fs_hz', Object.freeze({min: 1, max: 5000}), 2);
  static readonly DRIVER_QTS = new Field('driver_Qts', Object.freeze({min: 0, max: 5}), 3);
  static readonly DRIVER_QES = new Field('driver_Qes', Object.freeze({min: 0, max: 5}), 3);
  static readonly DRIVER_QMS = new Field('driver_Qms', Object.freeze({min: 0, max: 50}), 3);
  static readonly DRIVER_VAS_L = new Field('driver_Vas_l', Object.freeze({min: 0, max: 100}), 2);
  static readonly DRIVER_RE_OHM =
    new Field('driver_Re_ohm', Object.freeze({min: 0.01, max: 1000}), 3);
  static readonly DRIVER_LE_MH = new Field('driver_Le_mH', Object.freeze({min: 0, max: 0.1}), 3);
  static readonly DRIVER_MMS_G = new Field('driver_Mms_g', Object.freeze({min: 0, max: 10}), 2);
  static readonly DRIVER_SD_CM2 =
    new Field('driver_Sd_cm2', Object.freeze({min: 0.0001, max: 10}), 2);
  static readonly DRIVER_XMAX_MM = new Field('driver_Xmax_mm', Object.freeze({min: 0, max: 0.5}), 2);
  static readonly DRIVER_PE_W = new Field('driver_Pe_W', Object.freeze({min: 0, max: 100000}), 2);
  static readonly DRIVER_POWER_PEAK_W =
    new Field('driver_power_peak_W', Object.freeze({min: 0, max: 100000}), 2);
  static readonly DRIVER_BL_TM = new Field('driver_BL_Tm', Object.freeze({min: 0, max: 1000}), 3);
  static readonly DRIVER_CMS_MM_PER_N =
    new Field('driver_Cms_mm_per_N', Object.freeze({min: 0, max: 0.1}), 4);
  static readonly DRIVER_RMS_NS_PER_M =
    new Field('driver_Rms_Ns_per_m', Object.freeze({min: 0, max: 1000}), 4);
  static readonly DRIVER_DD_MM = new Field('driver_Dd_mm', Object.freeze({min: 0, max: 2}), 2);
  static readonly DRIVER_FLE_HZ = new Field('driver_fLe_hz', Object.freeze({min: 0, max: 100000}), 5);
  static readonly DRIVER_KLE_H_SQRTHZ =
    new Field('driver_KLe_H_sqrtHz', Object.freeze({min: 0, max: 10}), 6);
  static readonly DRIVER_HC_MM = new Field('driver_Hc_mm', Object.freeze({min: 0, max: 1}), 3);
  static readonly DRIVER_HG_MM = new Field('driver_Hg_mm', Object.freeze({min: 0, max: 1}), 3);
  static readonly DRIVER_VD_CM3 = new Field('driver_Vd_cm3', Object.freeze({min: 0, max: 100000}), 0);
  static readonly DRIVER_XLIM_MM = new Field('driver_Xlim_mm', Object.freeze({min: 0, max: 1}), 3);
  static readonly DRIVER_ETA0 = new Field('driver_Eta0', Object.freeze({min: 0, max: 100}), 4);
  static readonly DRIVER_USPL_DB = new Field('driver_USPL_dB', Object.freeze({min: 0, max: 200}), 2);
  static readonly DRIVER_SPL_DB = new Field('driver_SPL_dB', Object.freeze({min: 0, max: 200}), 2);
  static readonly DRIVER_NUMVC = new Field('driver_NumVC', Object.freeze({min: 1, max: 4}), 0);
  static readonly DRIVER_ALFAVC_PER_K =
    new Field('driver_AlfaVC_per_K', Object.freeze({min: 0, max: 0.1}), 4);
  static readonly DRIVER_RT_K_PER_W =
    new Field('driver_Rt_K_per_W', Object.freeze({min: 0, max: 1000}), 5);
  static readonly DRIVER_CT_J_PER_K =
    new Field('driver_Ct_J_per_K', Object.freeze({min: 0, max: 10000}), 5);
  static readonly DRIVER_EBP_HZ = new Field('driver_EBP_hz', Object.freeze({min: 0, max: 1000}), 2);
  static readonly DRIVER_SPLMAXLF_DB =
    new Field('driver_SPLmaxLF_dB', Object.freeze({min: 0, max: 200}), 2);
  static readonly DRIVER_SPLMAX_DB =
    new Field('driver_SPLmax_dB', Object.freeze({min: 0, max: 200}), 2);
  static readonly DRIVER_RME_NS_PER_M =
    new Field('driver_Rme_Ns_per_m', Object.freeze({min: 0, max: 1000}), 5);
  static readonly DRIVER_GAMMA = new Field('driver_Gamma', Object.freeze({min: 0, max: 100000}), 5);
  static readonly DRIVER_MPOW = new Field('driver_Mpow', Object.freeze({min: 0, max: 1000}), 5);
  static readonly DRIVER_MCOST_KG_PER_S =
    new Field('driver_Mcost_kg_per_s', Object.freeze({min: 0, max: 1000}), 5);
  static readonly DRIVER_GLOSS_PCT =
    new Field('driver_Gloss_pct', Object.freeze({min: 0, max: 100}), 4);
  static readonly DRIVER_THICK_MM =
    new Field('driver_Thick_mm', Object.freeze({min: 0, max: 0.3}), 2);
  static readonly DRIVER_DEPTH_MM = new Field('driver_Depth_mm', Object.freeze({min: 0, max: 5}), 2);
  static readonly DRIVER_MAGDEPTH_MM =
    new Field('driver_MagDepth_mm', Object.freeze({min: 0, max: 5}), 2);
  static readonly DRIVER_MAGNET_MM =
    new Field('driver_Magnet_mm', Object.freeze({min: 0, max: 5}), 2);
  static readonly DRIVER_BASKET_MM =
    new Field('driver_Basket_mm', Object.freeze({min: 0, max: 5}), 2);
  static readonly DRIVER_OUTER_MM = new Field('driver_Outer_mm', Object.freeze({min: 0, max: 5}), 2);
  static readonly DRIVER_VCD_MM = new Field('driver_Vcd_mm', Object.freeze({min: 0, max: 1}), 2);
  static readonly DRIVER_DVOL_CM3 = new Field('driver_Dvol_cm3', Object.freeze({min: 0, max: 1}), 2);
  static readonly DRIVER_ZNOM_OHM = new Field('driver_Znom_ohm', Object.freeze({min: 0, max: 64}), 0);
  static readonly DRIVER_C_M_PER_S =
    new Field('driver_c_m_per_s', Object.freeze({min: 0, max: 1000}), 2);
  static readonly DRIVER_ROO_KG_PER_M3 =
    new Field('driver_roo_kg_per_m3', Object.freeze({min: 0, max: 10}), 5);
  static readonly DRIVER_NDRIVERS =
    new Field('driver_nDrivers', Object.freeze({min: 1, max: 64}), 0);
  static readonly DRIVER_VCTEMPRISE_K =
    new Field('driver_VcTempRise_K', Object.freeze({min: 0, max: 500}), 2);
  static readonly DRIVER_ADDEDMASS_G =
    new Field('driver_AddedMass_g', Object.freeze({min: 0, max: 5}), 5);

  // ── Filters ───────────────────────────────────────────────────────────────────────────────
  static readonly FILTER_FC_HZ = new Field('filter_Fc_hz', FILTER_FC_LIMITS, 3);
  static readonly FILTER_Q = new Field('filter_Q', FILTER_Q_LIMITS, 3);
  static readonly FILTER_GAIN_DB = new Field('filter_Gain_dB', FILTER_GAIN_LIMITS, 3);
  static readonly FILTER_ORDER = new Field('filter_Order', FILTER_ORDER_LIMITS, 3);
  static readonly FILTER_T_S = new Field('filter_T_s', FILTER_T_LIMITS, 4);
  static readonly FILTER_BW_OCT = new Field('filter_BW_oct', FILTER_BW_LIMITS, 3);

  /** Every member, by reflection — a field declared above is in here without being listed
   *  again, so the two can never disagree. Declared last: a static initialiser reads only the
   *  members already evaluated above it. */
  static readonly ALL: readonly Field[] =
    Object.freeze(Object.values(Field).filter((v): v is Field => v instanceof Field));
}
