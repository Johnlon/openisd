/**
 * How authoritative a document role is, LOWER = more authoritative (D10, ported verbatim from
 * `winisd_tools/scrapers/scrapers/lib/record_registries.py`'s `source_rank`/`_SOURCE_RANK`).
 *
 * Ordered most-authoritative first: a manufacturer's own datasheet outranks its product page,
 * which outranks its listing page; the same three tiers repeat for a distributor's copies, which
 * all rank below the manufacturer's own; `manual` (a hand-entered value) sorts last of the named
 * roles — it is not a published document at all.
 *
 * Used only as tier 3 of `selectOrigin` (D9) — after impossible readings are excluded and a
 * strict majority is checked — never to override either of those.
 */
const RANKED_ROLES: readonly string[] = Object.freeze([
    'manufacturer_datasheet',
    'manufacturer_product_page',
    'manufacturer_listing_page',
    'distributor_datasheet',
    'distributor_product_page',
    'distributor_listing_page',
    'manual',
]);

/** `role`'s rank, or one past `manual` when `role` names none of the ranked roles — an unranked
 *  role degrades to "least authoritative" rather than silently jumping the queue. */
export function sourceRank(role: string): number {
    const index = RANKED_ROLES.indexOf(role);
    return index === -1 ? RANKED_ROLES.length : index;
}
