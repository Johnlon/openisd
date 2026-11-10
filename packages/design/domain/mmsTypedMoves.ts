/** THE rule for a typed Mms, on drivers and passive radiators alike (T744, QO509): the typed Mms stands in the box and the charts,
 *  and the stated figures returned here are dropped in the same write and worked out again: Fs (from Mms and Cms), and Qms when Rms
 *  is stated. Nothing moves while Cms is unknown. To change which figure is worked out again, change only this function. */
export function mmsTypedMoves(cmsKnown: boolean, rmsEntered: boolean): ('Fs_hz' | 'Qms')[] {
    if (!cmsKnown) return [];
    return ['Fs_hz', ...(rmsEntered ? ['Qms' as const] : [])];
}
