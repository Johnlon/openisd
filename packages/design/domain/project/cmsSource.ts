import {CompatSwitch} from './compatSwitch.js';
import type {OpenISDProject} from './openISDProject.js';

/** Which Cms a datasheet that states both Cms and Vas is solved with (WinISD option "Cms from Vas"). */
export type CmsSource =
    | {readonly kind: 'VasWins'}
    | {readonly kind: 'StatedCmsWins'};

/** The one place the "Cms from Vas" switch is read: ticked is WinISD's way, Vas wins. */
export function cmsSourceOf(project: OpenISDProject): CmsSource {
    return CompatSwitch.CMS_FROM_VAS.of(project).value
        ? {kind: 'VasWins'}
        : {kind: 'StatedCmsWins'};
}
