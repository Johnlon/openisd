/**
 * A project saved while every chamber stored its own Qicl still loads. WinISD has one Qicl
 * (`Qiclfr`), the rear chamber's, and the sweep never read a front chamber's, so the front value
 * is dropped, with no number changed and nothing to report.
 */
import {z} from 'zod';

const recordSchema = z.record(z.string(), z.unknown());

/** The record at `key`, or null when `parent` has no record there. */
function recordAt(parent: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const found = recordSchema.safeParse(parent[key]);
    return found.success ? found.data : null;
}

function dropFrontQicl(project: unknown): void {
    const root = recordSchema.safeParse(project);
    if (!root.success) return;
    const box = recordAt(root.data, 'box');
    if (box === null) return;
    for (const type of ['bandpass4', 'bandpass6', 'abc']) {
        const chambers = recordAt(box, type);
        const front = chambers === null ? null : recordAt(chambers, 'front');
        const losses = front === null ? null : recordAt(front, 'losses');
        if (losses !== null) Reflect.deleteProperty(losses, 'Qicl');
    }
}

/** `session`, parsed from JSON text and not yet validated, with every front chamber's Qicl removed
 *  from both the saved and the edited project. Changes `session` in place. */
export function withoutFrontQicl(session: unknown): unknown {
    const root = recordSchema.safeParse(session);
    if (!root.success) return session;
    dropFrontQicl(root.data.saved);
    dropFrontQicl(root.data.edited);
    return session;
}
