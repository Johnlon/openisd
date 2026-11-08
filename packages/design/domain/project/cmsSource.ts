import type {CmsSource} from '../../engine/index.js';
import {CompatSwitch} from './compatSwitch.js';
import type {OpenISDProject} from './openISDProject.js';

export type {CmsSource};

/** The one place the "Cms from Vas" switch is read: ticked is WinISD's way, Vas wins. */
export function cmsSourceOf(project: OpenISDProject): CmsSource {
    return CompatSwitch.CMS_FROM_VAS.of(project).value
        ? {kind: 'VasWins'}
        : {kind: 'StatedCmsWins'};
}
