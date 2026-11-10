import type {ChartingSource} from '../../engine/index.js';
import {TYPED_CMS, TYPED_MMS} from './chartingSources.js';

/** The Cms or Mms a user typed, as the stated figures read now. */
export interface StatedChainFigures {
    readonly Cms_m_per_N: number | null;
    readonly Mms_kg: number | null;
}

/** The one Cms or Mms the user typed last in this project, so the charts use it as typed (T744, QO530). Nothing is saved: a reloaded file has none,
 *  and the "Cms from Vas" option decides. It counts only while the box still holds exactly that value, so a draft that was discarded
 *  (its value never reached the project) or a value since changed by other means counts for nothing. */
export class TypedFigure {
    #last: {readonly figure: 'Cms' | 'Mms'; readonly value: number} | null = null;

    typedCms(value: number): void {
        this.#last = {figure: 'Cms', value};
    }

    typedMms(value: number): void {
        this.#last = {figure: 'Mms', value};
    }

    /** A figure that leaves the typed one no longer last (Vas, Sd typed) clears it. */
    clear(): void {
        this.#last = null;
    }

    /** The source the typed figure imposes on `stated`, or `fallback` when none is typed or the box no longer holds it. */
    over(fallback: ChartingSource, stated: StatedChainFigures): ChartingSource {
        const last = this.#last;
        if (last === null) return fallback;
        switch (last.figure) {
            case 'Cms': return stated.Cms_m_per_N === last.value ? TYPED_CMS : fallback;
            case 'Mms': return stated.Mms_kg === last.value ? TYPED_MMS : fallback;
        }
    }
}
