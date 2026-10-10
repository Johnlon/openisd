/**
 * A project saved while chambers stored Qicl in their losses still loads. WinISD has one Qicl
 * (`Qiclfr`) stored at the Box level. We migrate any chamber `Qicl` up to `box[type].Qiclfr`,
 * dropping front and rear `losses.Qicl` losslessly without error.
 */
function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function migrateChamberQicl(project: unknown): void {
    if (!isRecord(project)) return;
    const box = isRecord(project.box) ? project.box : null;
    if (box === null) return;
    for (const type of ['bandpass4', 'bandpass6', 'abc']) {
        const typeBox = isRecord(box[type]) ? box[type] : null;
        if (typeBox === null) continue;
        const rear = isRecord(typeBox.rear) ? typeBox.rear : null;
        const rearLosses = rear !== null && isRecord(rear.losses) ? rear.losses : null;
        const front = isRecord(typeBox.front) ? typeBox.front : null;
        const frontLosses = front !== null && isRecord(front.losses) ? front.losses : null;

        const rearQicl = rearLosses !== null && typeof rearLosses.Qicl === 'number' ? rearLosses.Qicl : undefined;
        const frontQicl = frontLosses !== null && typeof frontLosses.Qicl === 'number' ? frontLosses.Qicl : undefined;

        if (typeBox.Qiclfr === undefined) {
            const val = rearQicl ?? frontQicl;
            typeBox.Qiclfr = val ?? 100;
        }

        if (frontLosses !== null) delete frontLosses.Qicl;
        if (rearLosses !== null) delete rearLosses.Qicl;
    }
}

/** `session`, parsed from JSON text and not yet validated, with legacy chamber Qicl moved to
 *  `box[type].Qiclfr` in both saved and edited projects. Changes `session` in place. */
export function withoutFrontQicl(session: unknown): unknown {
    if (!isRecord(session)) return session;
    migrateChamberQicl(session.saved);
    migrateChamberQicl(session.edited);
    return session;
}
