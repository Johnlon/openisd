import {z} from 'zod';
import {WINISD_BOX_LOSSES} from '../boxDefaults.js';

/**
 * A project saved while every chamber stored its own Qicl still loads. WinISD has one Qicl
 * (`Qiclfr`), stored at the box level and read for the rear chamber. The chamber value moves to
 * `box[type].Qiclfr`, the rear's before the front's, unless a `Qiclfr` is already stored, and WinISD's
 * default when neither is; no chamber `Qicl` is left.
 *
 * Works in place: a Zod record parse returns a copy, so a move made on it never reaches the
 * session the schema then reads (BUG_20261009_retired-field-reset-notice-on-every-load).
 */
type PlainRecord = Record<string, unknown>;

function isRecord(v: unknown): v is PlainRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const TWO_CHAMBER_TYPES = ['bandpass4', 'bandpass6', 'abc'];

function qiclOf(chamber: unknown): number | undefined {
    if (!isRecord(chamber) || !isRecord(chamber.losses)) return undefined;
    const parsed = z.number().safeParse(chamber.losses.Qicl);
    return parsed.success ? parsed.data : undefined;
}

function dropQicl(chamber: unknown): void {
    if (isRecord(chamber) && isRecord(chamber.losses)) Reflect.deleteProperty(chamber.losses, 'Qicl');
}

function moveInProject(project: unknown): void {
    if (!isRecord(project) || !isRecord(project.box)) return;
    for (const type of TWO_CHAMBER_TYPES) {
        const typeBox = project.box[type];
        if (!isRecord(typeBox)) continue;
        const qicl = qiclOf(typeBox.rear) ?? qiclOf(typeBox.front);
        if (typeBox.Qiclfr === undefined) typeBox.Qiclfr = qicl ?? WINISD_BOX_LOSSES.Qicl;
        dropQicl(typeBox.rear);
        dropQicl(typeBox.front);
    }
}

/** `session`, parsed from JSON text and not yet validated, with every chamber Qicl moved to its
 *  box's `Qiclfr` in both the saved and the edited project. Changes `session` in place. */
export function withMovedChamberQicl(session: unknown): unknown {
    if (!isRecord(session)) return session;
    moveInProject(session.saved);
    moveInProject(session.edited);
    moveInProject(session);
    return session;
}
