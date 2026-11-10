import {STATED_CMS_WINS, VAS_WINS} from '../../engine/index.js';
import type {ChartingSource} from '../../engine/index.js';
import {CompatSwitch} from './compatSwitch.js';
import type {OpenISDProject} from './openISDProject.js';

export type {ChartingSource};

/** The one place the "Cms from Vas" switch is read: ticked is WinISD's way, Vas wins. */
export function cmsSourceOf(project: OpenISDProject): ChartingSource {
    return CompatSwitch.CMS_FROM_VAS.of(project).value
        ? VAS_WINS
        : STATED_CMS_WINS;
}
