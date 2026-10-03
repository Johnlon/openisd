import {Relation} from './Relation.js';
import {TAU} from './constants.js';

export const Q_PARALLEL = Object.freeze(new Relation('Qts = Qes·Qms/(Qes+Qms)', 'Qts', Object.freeze(['Qts', 'Qes', 'Qms']),
  (v) => v.Qes! * v.Qms! / (v.Qes! + v.Qms!)));
export const FS_FROM_MASS_AND_COMPLIANCE = Object.freeze(new Relation('Fs = 1/(2π·√(Mms·Cms))', 'Fs_hz', Object.freeze(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']),
  (v) => 1 / (TAU * Math.sqrt(v.Mms_kg! * v.Cms_m_per_N!))));
export const RMS_FROM_Q = Object.freeze(new Relation('Rms = 2π·Fs·Mms/Qms', 'Rms_kg_per_s', Object.freeze(['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms']),
  (v) => TAU * v.Fs_hz! * v.Mms_kg! / v.Qms!));
export const QES_FROM_MOTOR = Object.freeze(new Relation('Qes = 2π·Fs·Mms·Re/Bl²', 'Qes', Object.freeze(['Qes', 'Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm']),
  (v) => TAU * v.Fs_hz! * v.Mms_kg! * v.Re_ohm! / (v.BL_Tm! * v.BL_Tm!)));
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
/** ρ and c are the driver's OWN resolved air, never a fixed reference constant. */
export const VAS_FROM_COMPLIANCE = Object.freeze(new Relation('Vas = ρ·c²·Sd²·Cms', 'Vas_m3', Object.freeze(['Vas_m3', 'Cms_m_per_N', 'Sd_m2', 'roo_kg_per_m3', 'c_m_per_s']),
  (v) => v.roo_kg_per_m3! * v.c_m_per_s! * v.c_m_per_s! * v.Sd_m2! * v.Sd_m2! * v.Cms_m_per_N!));
export const EBP_FROM_Q = Object.freeze(new Relation('EBP = Fs/Qes', 'EBP_hz', Object.freeze(['EBP_hz', 'Fs_hz', 'Qes']),
  (v) => v.Fs_hz! / v.Qes!));

/** The relations the consistency check reports, in report order. */
export const DRIVER_RELATIONS: readonly Relation[] = Object.freeze([
  Q_PARALLEL,
  FS_FROM_MASS_AND_COMPLIANCE,
  RMS_FROM_Q,
  QES_FROM_MOTOR,
  RME_FROM_MOTOR,
  RME_FROM_MOTIONAL,
  DD_FROM_SD,
  MPOW_FROM_MOTOR,
  MPOW_FROM_RME,
  GAMMA_FROM_MOTOR,
  VD_FROM_EXCURSION,
  VAS_FROM_COMPLIANCE,
  EBP_FROM_Q,
]);
