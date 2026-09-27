
/** The frequency grid a sweep runs over — the only thing about a sweep `OpenISDProject` does not
 *  already know about itself; everything else `SweepParams` needs comes off the project's own
 *  record. */
export interface FrequencyGrid {
    fmin?: number;
    fmax?: number;
    N?: number;
}
