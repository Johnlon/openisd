import {VAS_FROM_CMS_SD_ROUTE} from './efficiencyRoutes.js';
import {
  CMS_SD_ROUTES,
  FS_FROM_MASS_CMS_ROUTE,
  MMS_FROM_FS_CMS_ROUTES,
  RMS_QMS_MMS_ROUTES,
} from './smallSignalRoutes.js';
import type {DriverRoute} from './SolveRoute.js';

/**
 * The routes among a passive radiator's Fs, Qms, Vas, Sd, Mms, Cms and Rms: those whose target
 * and inputs are all among the seven. Same routes, same relative order as `DRIVER_ROUTES`.
 */
export const RADIATOR_ROUTES: readonly DriverRoute[] = Object.freeze([
  FS_FROM_MASS_CMS_ROUTE,
  ...MMS_FROM_FS_CMS_ROUTES,
  ...CMS_SD_ROUTES,
  VAS_FROM_CMS_SD_ROUTE,
  ...RMS_QMS_MMS_ROUTES,
]);
