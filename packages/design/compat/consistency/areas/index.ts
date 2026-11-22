import type {CompatArea} from '../harness.js';
import {ABC_AREA} from './abc.js';
import {ADVANCED_AREA} from './advanced.js';
import {BANDPASS4_AREA} from './bandpass4.js';
import {BANDPASS6_AREA} from './bandpass6.js';
import {DRIVER_AREA} from './driver.js';
import {ENVIRONMENT_AREA} from './environment.js';
import {FILTERS_AREA} from './filters.js';
import {PR_AREA} from './pr.js';
import {SEALED_AREA} from './sealed.js';
import {SIGNAL_AREA} from './signal.js';
import {VENTED_AREA} from './vented.js';
import {VENTS_AREA} from './vents.js';

export const AREAS: readonly CompatArea[] = Object.freeze([
  PR_AREA, SEALED_AREA, VENTED_AREA, BANDPASS4_AREA, BANDPASS6_AREA, ABC_AREA, VENTS_AREA,
  DRIVER_AREA, SIGNAL_AREA, ADVANCED_AREA, ENVIRONMENT_AREA, FILTERS_AREA,
]);
