import type {ChartingSource} from '../../engine/index.js';

/** Datasheet states both Cms and Vas: the Cms from Vas is charted (WinISD's way). */
export const VAS_WINS: ChartingSource = Object.freeze({kind: 'VasWins'});
/** Datasheet states both Cms and Vas: the stated Cms is charted. */
export const STATED_CMS_WINS: ChartingSource = Object.freeze({kind: 'StatedCmsWins'});
/** The user typed a Cms: the charts use it, and Vas, if stated, is the one that disagrees. */
export const TYPED_CMS: ChartingSource = Object.freeze({kind: 'TypedCms'});
/** The user typed an Mms: the charts use it with Fs, and Vas, if stated, is the one that disagrees. */
export const TYPED_MMS: ChartingSource = Object.freeze({kind: 'TypedMms'});
