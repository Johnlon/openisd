/**
 * A vent's tuning and length state one fact, so a project states at most one of them as entered.
 * A file that marks both entered (hand-edited or foreign-written) keeps the tuning entered and
 * loses the length entry, so the solver calculates the length from it (QO178). Applies to the
 * vented box, the bandpass4 front vent, and both vents of bandpass6 and ABC; the ABC
 * connecting vent has no tuning.
 */
import type {OpenISDProjectJson, OpenISDProjectSessionJson, SpecEntryJson} from '../openisdSchema.js';
import type {FieldPath} from '../schemaRepair.js';

interface TuningSide {readonly tuning_goal_hz?: SpecEntryJson | undefined}
interface LengthSide {readonly length_m?: SpecEntryJson | undefined}

const isEntered = (entry: SpecEntryJson | undefined): boolean => entry !== undefined && entry.state === 'E';

/** `vent` without its length entry when `chamber` and `vent` both state an entered value. */
function pairResolved<V extends LengthSide>(chamber: TuningSide, vent: V): {vent: V; dropped: boolean} {
    if (!isEntered(chamber.tuning_goal_hz) || !isEntered(vent.length_m)) return {vent, dropped: false};
    return {vent: {...vent, length_m: undefined}, dropped: true};
}

function resolvedProject(project: OpenISDProjectJson, where: 'saved' | 'edited'): {project: OpenISDProjectJson; repaired: FieldPath[]} {
    const {box} = project;
    const repaired: FieldPath[] = [];
    const note = (dropped: boolean, ...path: string[]): void => { if (dropped) repaired.push([where, 'box', ...path]); };
    const vented = pairResolved(box.vented.chamber, box.vented.vent);
    const bp4Front = pairResolved(box.bandpass4.front, box.bandpass4.frontVent);
    const bp6Rear = pairResolved(box.bandpass6.rear, box.bandpass6.rearVent);
    const bp6Front = pairResolved(box.bandpass6.front, box.bandpass6.frontVent);
    const abcRear = pairResolved(box.abc.rear, box.abc.rearVent);
    const abcFront = pairResolved(box.abc.front, box.abc.frontVent);
    note(vented.dropped, 'vented', 'vent', 'length_m');
    note(bp4Front.dropped, 'bandpass4', 'frontVent', 'length_m');
    note(bp6Rear.dropped, 'bandpass6', 'rearVent', 'length_m');
    note(bp6Front.dropped, 'bandpass6', 'frontVent', 'length_m');
    note(abcRear.dropped, 'abc', 'rearVent', 'length_m');
    note(abcFront.dropped, 'abc', 'frontVent', 'length_m');
    if (repaired.length === 0) return {project, repaired};
    return {
        project: {
            ...project,
            box: {
                ...box,
                vented: {...box.vented, vent: vented.vent},
                bandpass4: {...box.bandpass4, frontVent: bp4Front.vent},
                bandpass6: {...box.bandpass6, rearVent: bp6Rear.vent, frontVent: bp6Front.vent},
                abc: {...box.abc, rearVent: abcRear.vent, frontVent: abcFront.vent},
            },
        },
        repaired,
    };
}

/** `session` with every vent pair that states both sides entered reduced to the tuning, and the
 *  length fields that lost their entry. */
export function singleEnteredVentPairs(session: OpenISDProjectSessionJson): {session: OpenISDProjectSessionJson; repaired: FieldPath[]} {
    const saved = resolvedProject(session.saved, 'saved');
    const edited = session.edited === null ? null : resolvedProject(session.edited, 'edited');
    return {
        session: {...session, saved: saved.project, edited: edited === null ? null : edited.project},
        repaired: [...saved.repaired, ...(edited === null ? [] : edited.repaired)],
    };
}
