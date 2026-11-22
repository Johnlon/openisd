/** Data-quality marks are worked out live and shown on screen, never stored (QO414). The one `JSON.stringify`
 *  replacer that leaves them out of text OpenISD writes. */
export function withoutDerivedMarks(key: string, value: unknown): unknown {
    return key === 'dq_calculated' || key === 'dq_scraper' ? undefined : value;
}
