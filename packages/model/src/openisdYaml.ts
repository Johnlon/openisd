/**
 * `openisd.yml` / `.owdr` read/write (ARCHITECTURE.md AD-8 Step 3).
 *
 * READ is solid: any valid YAML matching OpenISDRecord's shape parses correctly,
 * regardless of which side wrote it — YAML syntax doesn't care about key order.
 *
 * WRITE is a first cut, NOT yet verified byte-identical to the Python side's canonical
 * serialisation. The Python writer (`model_driver.py:1338-1365`, `canonical_yaml()`) has
 * its own dialect — a `_KEY_PRIORITY`-driven key sort, flow-style (`[a, b, c]`) for
 * certain keys, and it OMITS an empty `dq: []` entirely rather than writing it. None of
 * that is replicated here yet. This writer emits every field, block-style, in the order
 * OpenISDRecord's TS interface declares them (which mirrors MetaFile's Python field
 * order) — a REASONABLE canonical order, not a verified-identical one. Two files holding
 * the same record, one written by each language, are not guaranteed to diff clean yet.
 * Needs its own pass reading `_KEY_PRIORITY`/`_FLOW_LIST_KEYS` before that claim can be
 * made — flagged here rather than silently assumed.
 */
import { parse, stringify } from 'yaml';
import type { OpenISDRecord } from './openisdRecord.js';

/** Parse `openisd.yml`/`.owdr` text into an OpenISDRecord. Throws on invalid YAML; does
 *  NOT yet validate the result against the schema (no runtime shape-check — trusts the
 *  caller, matching how `Driver.fromWdr` trusts its own parse today). */
export function fromYaml(text: string): OpenISDRecord {
  return parse(text) as OpenISDRecord;
}

/** Serialise an OpenISDRecord to `openisd.yml`/`.owdr` text. See the file header — not
 *  yet byte-identical to the Python writer's canonical dialect. */
export function toYaml(record: OpenISDRecord): string {
  return stringify(record, { sortMapEntries: false });
}
