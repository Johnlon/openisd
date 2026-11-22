/** A stored port count the domain will honour: a whole number of at least one port. */
export function isPortCount(v: number): boolean {
    return Number.isInteger(v) && v >= 1;
}
