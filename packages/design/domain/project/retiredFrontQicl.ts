/**
 * A project saved while chambers stored Qicl in their losses still loads. WinISD has one Qicl
 * (`Qiclfr`) stored at the Box level. We migrate any chamber `Qicl` up to `box[type].Qiclfr`,
 * dropping front and rear `losses.Qicl` losslessly without error.
 */
import {z} from 'zod';

const recordSchema = z.record(z.string(), z.unknown());

/** The record at `key`, or null when `parent` has no record there. */
function recordAt(parent: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const found = recordSchema.safeParse(parent[key]);
    return found.success ? found.data : null;
}

function migrateChamberQicl(project: unknown): void {
    const root = recordSchema.safeParse(project);
    if (!root.success) return;
    const box = recordAt(root.data, 'box');
    if (box === null) return;
    for (const type of ['bandpass4', 'bandpass6', 'abc']) {
        const typeBox = recordAt(box, type);
        if (typeBox === null) continue;
        const rear = recordAt(typeBox, 'rear');
        const rearLosses = rear === null ? null : recordAt(rear, 'losses');
        const front = recordAt(typeBox, 'front');
        const frontLosses = front === null ? null : recordAt(front, 'losses');

        const rearQicl = rearLosses !== null && typeof rearLosses.Qicl === 'number' ? rearLosses.Qicl : undefined;
        const frontQicl = frontLosses !== null && typeof frontLosses.Qicl === 'number' ? frontLosses.Qicl : undefined;

        if (typeBox.Qiclfr === undefined) {
            const val = rearQicl ?? frontQicl;
            typeBox.Qiclfr = val ?? 100;
        }

        if (frontLosses !== null) Reflect.deleteProperty(frontLosses, 'Qicl');
        if (rearLosses !== null) Reflect.deleteProperty(rearLosses, 'Qicl');
    }
}

/** `session`, parsed from JSON text and not yet validated, with legacy chamber Qicl moved to
 *  `box[type].Qiclfr` in both saved and edited projects. Changes `session` in place. */
export function withoutFrontQicl(session: unknown): unknown {
    const root = recordSchema.safeParse(session);
    if (!root.success) return session;
    migrateChamberQicl(root.data.saved);
    migrateChamberQicl(root.data.edited);
    return session;
}
