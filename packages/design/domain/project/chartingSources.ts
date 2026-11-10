import type {ChartingSource} from '../../engine/index.js';

/** Datasheet states both Cms and Vas: the Cms from Vas is charted (WinISD's way). */
export const VAS_WINS: ChartingSource = Object.freeze({kind: 'VasWins'});
/** Datasheet states both Cms and Vas: the stated Cms is charted. */
export const STATED_CMS_WINS: ChartingSource = Object.freeze({kind: 'StatedCmsWins'});
