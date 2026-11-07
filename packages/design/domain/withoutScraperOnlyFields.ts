/** The record without what the scraper's `driver.json` carries and the app's model does not: the
 *  top-level `discontinued` flag and `quality.cross_references` (QO395, John 4 Nov 2026). The
 *  bridge reads them and drops them. A record that has neither comes back with the same content. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function withoutScraperOnlyFields(record: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const rest = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'discontinued'));
    const {quality} = rest;
    if (!isPlainRecord(quality)) return rest;
    return {...rest, quality: Object.fromEntries(Object.entries(quality).filter(([key]) => key !== 'cross_references'))};
}
