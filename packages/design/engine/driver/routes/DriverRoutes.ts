import {ADVANCED_ROUTES, KLE_ROUTES, ZNOM_ROUTES} from './advancedRoutes.js';
import {NO_ROUTES, QES_FROM_NO_ROUTES, SPL_FROM_NO_ROUTES, USPL_ROUTES, VAS_ROUTES} from './efficiencyRoutes.js';
import {MAGNET_ROUTES, SD_DD_ROUTES, SD_FROM_VD_ROUTES, VD_ROUTES, XMAX_ROUTES} from './geometryRoutes.js';
import {
  CMS_SD_ROUTES,
  FS_ROUTES,
  MMS_FROM_FS_CMS_ROUTES,
  MOTOR_ROUTES,
  Q_ROUTES,
  RMS_QMS_MMS_ROUTES,
} from './smallSignalRoutes.js';
import type {DriverRoute} from './SolveRoute.js';

/**
 * The driver's 54 routes in the order one pass runs them. The order is the data: it decides which
 * route fills a quantity when several could (WinISD's own site order, FINDING-027/028), so a
 * route is never moved without a case in test/driver-solver-characterization.test.ts failing.
 */
export const DRIVER_ROUTES: readonly DriverRoute[] = Object.freeze([
  ...SD_DD_ROUTES,              // 1
  ...Q_ROUTES,                  // 2
  ...FS_ROUTES,                 // 3
  ...MMS_FROM_FS_CMS_ROUTES,    // 3b
  ...CMS_SD_ROUTES,             // 4a
  ...NO_ROUTES,                 // 4b
  ...VAS_ROUTES,                // 4c
  ...RMS_QMS_MMS_ROUTES,        // 5
  ...MOTOR_ROUTES,              // 6
  ...XMAX_ROUTES,               // 7
  ...SD_FROM_VD_ROUTES,         // 8
  ...VD_ROUTES,                 // 9
  ...MAGNET_ROUTES,             // 9b
  ...QES_FROM_NO_ROUTES,        // 10
  ...SPL_FROM_NO_ROUTES,        // 11
  ...USPL_ROUTES,               // 12
  ...ADVANCED_ROUTES,           // 13
  ...ZNOM_ROUTES,               // 14
  ...KLE_ROUTES,                // 24
]);
