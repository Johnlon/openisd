/**
 * A project saved while every chamber stored its own Qicl still loads. WinISD has one Qicl
 * (`Qiclfr`), the rear chamber's, and the sweep never read a front chamber's, so the front value
 * is dropped, with no number changed and nothing to report.
 */
function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function dropFrontQicl(project: unknown): void {
    if (!isRecord(project)) return;
    const box = project.box;
    if (!isRecord(box)) return;
    for (const type of ['bandpass4', 'bandpass6', 'abc']) {
        const bp = box[type];
        if (!isRecord(bp)) continue;
        const front = bp.front;
        if (!isRecord(front)) continue;
        const losses = front.losses;
        if (isRecord(losses) && 'Qicl' in losses) {
            Reflect.deleteProperty(losses, 'Qicl');
        }
    }
}

/** `session`, parsed from JSON text and not yet validated, with every front chamber's Qicl removed
 *  from both the saved and the edited project. Changes `session` in place. */
export function withoutFrontQicl(session: unknown): unknown {
    if (!isRecord(session)) return session;
    dropFrontQicl(session.saved);
    dropFrontQicl(session.edited);
    dropFrontQicl(session);
    return session;
}
