
/** A dragged frequency-band selection on a chart — `OpenISDProject#dragRange`'s stored shape.
 *  Never persisted (see that getter's own comment). */
export interface DragRange {
    readonly fLo: number;
    readonly fHi: number;
}
