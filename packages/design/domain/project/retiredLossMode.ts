/**
 * Brings a project saved while the sealed-box loss model was a choice (`advanced.lossMode`,
 * retired 2026-10-05) up to the one model there is now: WinISD's lossy one, with Ql/Qa
 * controlling the losses.
 *
 * - 'lossless'           becomes Ql = Qa = the lossless limit in every loss slot, which is what
 *                        the lossy model reduces to, so the same numbers come out.
 * - 'conventional-lossy' becomes WinISD lossy with the project's own Ql/Qa.
 * - 'winisd-lossy'       needs nothing.
 *
 * The key is dropped in every case. A project whose numbers changed (the first two) is reported
 * as repaired, naming the key, so the user is told.
 */
import {LOSSLESS_Q} from '../../fields/losslessQ.js';
import type {OpenISDBoxJson, OpenISDProjectJson, OpenISDProjectSessionJson} from '../openisdSchema.js';
import type {FieldPath} from '../schemaRepair.js';

function losslessBox(box: OpenISDBoxJson): OpenISDBoxJson {
    const sealedLosses = <L extends {Ql: number; Qa: number}>(losses: L): L => ({...losses, Ql: LOSSLESS_Q, Qa: LOSSLESS_Q});
    const chamber = <C extends {losses: {Ql: number; Qa: number}}>(c: C): C => ({...c, losses: sealedLosses(c.losses)});
    return {
        ...box,
        sealed: {...box.sealed, losses: sealedLosses(box.sealed.losses)},
        vented: {...box.vented, chamber: chamber(box.vented.chamber)},
        bandpass4: {...box.bandpass4, rear: chamber(box.bandpass4.rear), front: chamber(box.bandpass4.front)},
        bandpass6: {...box.bandpass6, rear: chamber(box.bandpass6.rear), front: chamber(box.bandpass6.front)},
        abc: {...box.abc, rear: chamber(box.abc.rear), front: chamber(box.abc.front)},
        passiveRadiator: {...box.passiveRadiator, losses: sealedLosses(box.passiveRadiator.losses)},
    };
}

/** One project record without the retired key; the record unchanged when it never had it. */
function retiredFromProject(project: OpenISDProjectJson, where: 'saved' | 'edited'): {project: OpenISDProjectJson; repaired: FieldPath[]} {
    const {lossMode, ...advanced} = project.advanced;
    if (lossMode === undefined) return {project, repaired: []};
    switch (lossMode) {
        case 'winisd-lossy':
            return {project: {...project, advanced}, repaired: []};
        case 'lossless':
            return {project: {...project, advanced, box: losslessBox(project.box)}, repaired: [[where, 'advanced', 'lossMode']]};
        case 'conventional-lossy':
            return {project: {...project, advanced}, repaired: [[where, 'advanced', 'lossMode']]};
    }
}

/** `session` with the retired loss-model key turned into Ql/Qa and dropped, and the fields it
 *  changed the numbers for. */
export function retireLossMode(session: OpenISDProjectSessionJson): {session: OpenISDProjectSessionJson; repaired: FieldPath[]} {
    const saved = retiredFromProject(session.saved, 'saved');
    const edited = session.edited === null ? null : retiredFromProject(session.edited, 'edited');
    return {
        session: {...session, saved: saved.project, edited: edited === null ? null : edited.project},
        repaired: [...saved.repaired, ...(edited === null ? [] : edited.repaired)],
    };
}
