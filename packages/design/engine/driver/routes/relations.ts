import {Relation} from './Relation.js';
import {TAU} from './constants.js';
import {referenceEfficiency, splAt283V, splFromEfficiency} from '../../efficiency.js';

export const Q_PARALLEL = Object.freeze(new Relation('Qts = Qes·Qms/(Qes+Qms)', 'Qts', Object.freeze(['Qts', 'Qes', 'Qms']),
  (v) => v.Qes! * v.Qms! / (v.Qes! + v.Qms!)));
export const FS_FROM_MASS_AND_COMPLIANCE = Object.freeze(new Relation('Fs = 1/(2π·√(Mms·Cms))', 'Fs_hz', Object.freeze(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']),
  (v) => 1 / (TAU * Math.sqrt(v.Mms_kg! * v.Cms_m_per_N!))));
export const RMS_FROM_Q = Object.freeze(new Relation('Rms = 2π·Fs·Mms/Qms', 'Rms_kg_per_s', Object.freeze(['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms']),
  (v) => TAU * v.Fs_hz! * v.Mms_kg! / v.Qms!));
export const QES_FROM_MOTOR = Object.freeze(new Relation('Qes = 2π·Fs·Mms·Re/Bl²', 'Qes', Object.freeze(['Qes', 'Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm']),
  (v) => TAU * v.Fs_hz! * v.Mms_kg! * v.Re_ohm! / (v.BL_Tm! * v.BL_Tm!)));
/** A compliance read from Vas, Sd and the air is a few percent off the one the motor was built with; BL goes as its
 *  inverse square root, so 5% of BL is a datasheet's own scatter (the W5-1138SMF's typed BL sits 1.8% under it). */
const BL_FROM_QES_TOLERANCE = 0.05;
/** The BL the circuit's damping runs on: the one Fs, Qes, Re and the compliance imply, so a typed BL that
 *  disagrees with them is marked beside the Qes it contradicts. */
export const BL_FROM_QES = Object.freeze(new Relation('Bl = √(Re/(2π·Fs·Qes·Cms))', 'BL_Tm', Object.freeze(['BL_Tm', 'Re_ohm', 'Fs_hz', 'Qes', 'Cms_m_per_N']),
  (v) => Math.sqrt(v.Re_ohm! / (TAU * v.Fs_hz! * v.Qes! * v.Cms_m_per_N!)), BL_FROM_QES_TOLERANCE, true));
export const RME_FROM_MOTOR = Object.freeze(new Relation('Rme = Bl²/Re', 'Rme_kg_per_s', Object.freeze(['Rme_kg_per_s', 'BL_Tm', 'Re_ohm']),
  (v) => v.BL_Tm! * v.BL_Tm! / v.Re_ohm!));
export const RME_FROM_MOTIONAL = Object.freeze(new Relation('Rme = 2π·Fs·Mms/Qes', 'Rme_kg_per_s', Object.freeze(['Rme_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qes']),
  (v) => TAU * v.Fs_hz! * v.Mms_kg! / v.Qes!));
export const DD_FROM_SD = Object.freeze(new Relation('Dd = 2·√(Sd/π)', 'Dd_m', Object.freeze(['Dd_m', 'Sd_m2']),
  (v) => 2 * Math.sqrt(v.Sd_m2! / Math.PI)));
export const MPOW_FROM_MOTOR = Object.freeze(new Relation('Mpow = Bl/√Re', 'Mpow_N_per_sqrtW', Object.freeze(['Mpow_N_per_sqrtW', 'BL_Tm', 'Re_ohm']),
  (v) => v.BL_Tm! / Math.sqrt(v.Re_ohm!)));
export const MPOW_FROM_RME = Object.freeze(new Relation('Mpow = √Rme', 'Mpow_N_per_sqrtW', Object.freeze(['Mpow_N_per_sqrtW', 'Rme_kg_per_s']),
  (v) => Math.sqrt(v.Rme_kg_per_s!)));
export const GAMMA_FROM_MOTOR = Object.freeze(new Relation('gamma = Bl/Mms', 'gamma_m_per_s2_A', Object.freeze(['gamma_m_per_s2_A', 'BL_Tm', 'Mms_kg']),
  (v) => v.BL_Tm! / v.Mms_kg!));
export const VD_FROM_EXCURSION = Object.freeze(new Relation('Vd = Sd·Xmax', 'Vd_m3', Object.freeze(['Vd_m3', 'Sd_m2', 'Xmax_m']),
  (v) => v.Sd_m2! * v.Xmax_m!));
/** The sheets never print the air their Vas was worked out in, and ρ·c² = γ·p depends on the pressure alone: the app's
 *  20 °C, 30 % RH, 101325 Pa gives 141855 Pa. The 619 catalogue records that print Vas, Cms and Sd to within 2 % of
 *  their own value imply ρ·c² from 138.8 kPa (1.18 kg/m³ at 343 m/s, a common convention: 79 records sit in 138 to
 *  140) to about 144 kPa, median 141.6 kPa. 2.5 % either side of the app's (pressure 98.8 to 103.9 kPa) takes in
 *  both ends and is added to the printed digits' own rounding; a sheet further out than that contradicts itself. */
const VAS_AIR_TOLERANCE = 0.025;
/** ρ and c are the driver's OWN resolved air, never a fixed reference constant. */
export const VAS_FROM_COMPLIANCE = Object.freeze(new Relation('Vas = ρ·c²·Sd²·Cms', 'Vas_m3', Object.freeze(['Vas_m3', 'Cms_m_per_N', 'Sd_m2', 'roo_kg_per_m3', 'c_m_per_s']),
  (v) => v.roo_kg_per_m3! * v.c_m_per_s! * v.c_m_per_s! * v.Sd_m2! * v.Sd_m2! * v.Cms_m_per_N!, VAS_AIR_TOLERANCE));
export const EBP_FROM_Q = Object.freeze(new Relation('EBP = Fs/Qes', 'EBP_hz', Object.freeze(['EBP_hz', 'Fs_hz', 'Qes']),
  (v) => v.Fs_hz! / v.Qes!));

/** η₀ from Fs/Vas/Qes (rel 14), c the driver's own resolved air. Ports the scraper's deleted `no`
 *  consistency rule (winisd_tools BUG_20260823_f4-deleted-semantic-dq-range-calc-marks-no-longer-stamped). */
export const NO_FROM_VAS = Object.freeze(new Relation('no = 4π²·Fs³·Vas/(c³·Qes)', 'no', Object.freeze(['no', 'Fs_hz', 'Vas_m3', 'Qes', 'c_m_per_s']),
  (v) => referenceEfficiency(v.Fs_hz!, v.Vas_m3!, v.Qes!, v.c_m_per_s!)));

/** A maker's stated sensitivity is measured on the cone's response, averaged over a band of the maker's choosing, and is
 *  not the T/S efficiency's own number. On the 660 catalogue records that print it at 1 W / 1 m beside Fs, Vas and Qes,
 *  the stated figure sits a median 1.2 dB from the efficiency's, 2.8 dB at the 90th percentile. 2 % of the predicted dB
 *  (1.8 dB at 90 dB), added to every figure's printed rounding, leaves about one record in seven of those marked; it
 *  marks a 2.83 V figure on a 4 ohm driver taken as the 1 W one (SB Acoustics SB23NRXS45-4: 92 dB against 89.3 implied)
 *  and leaves the same figure read at its own 2.83 V (88.15 dB at 1 W) unmarked (QO962, 20 Nov 2026). */
const SENSITIVITY_FROM_EFFICIENCY_TOLERANCE = 0.02;
/** The 1 W / 1 m sensitivity the efficiency implies, against a stated SPL. Only a stated SPL: one the engine worked out
 *  from a stated USPL is that USPL's disagreement, which `USPL_FROM_EFFICIENCY` reports. */
export const SPL_FROM_EFFICIENCY = Object.freeze(new Relation('SPL = 10·log₁₀(ρ·c/(2π·p_ref²)) + 10·log₁₀(no)', 'SPL_dB',
  Object.freeze(['SPL_dB', 'no', 'roo_kg_per_m3', 'c_m_per_s']),
  (v) => splFromEfficiency(v.no!, v.roo_kg_per_m3!, v.c_m_per_s!), SENSITIVITY_FROM_EFFICIENCY_TOLERANCE, true));
/** The 2.83 V / 1 m sensitivity the efficiency implies into Re, against a stated USPL. */
export const USPL_FROM_EFFICIENCY = Object.freeze(new Relation('USPL = 10·log₁₀(ρ·c/(2π·p_ref²)) + 10·log₁₀(no) + 10·log₁₀(2.83²/Re)', 'USPL_dB',
  Object.freeze(['USPL_dB', 'no', 'Re_ohm', 'roo_kg_per_m3', 'c_m_per_s']),
  (v) => splAt283V(splFromEfficiency(v.no!, v.roo_kg_per_m3!, v.c_m_per_s!), v.Re_ohm!), SENSITIVITY_FROM_EFFICIENCY_TOLERANCE, true));

/** The relations the consistency check reports, in report order. */
export const DRIVER_RELATIONS: readonly Relation[] = Object.freeze([
  Q_PARALLEL,
  FS_FROM_MASS_AND_COMPLIANCE,
  RMS_FROM_Q,
  QES_FROM_MOTOR,
  BL_FROM_QES,
  RME_FROM_MOTOR,
  RME_FROM_MOTIONAL,
  DD_FROM_SD,
  MPOW_FROM_MOTOR,
  MPOW_FROM_RME,
  GAMMA_FROM_MOTOR,
  VD_FROM_EXCURSION,
  VAS_FROM_COMPLIANCE,
  EBP_FROM_Q,
  NO_FROM_VAS,
  SPL_FROM_EFFICIENCY,
  USPL_FROM_EFFICIENCY,
]);
