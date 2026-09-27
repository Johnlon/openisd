/** A quantity usable as a substitution input: stated, finite and positive. */
export function positive(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
