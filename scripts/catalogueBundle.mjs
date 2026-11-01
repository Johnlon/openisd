/**
 * catalogueBundle.mjs — the build's one catalogue file, `catalogue.json`.
 *
 * Source: a catalogue directory laid out as packages/ui/public/ (drivers-index.json,
 * passive-radiators-index.json, drivers/<path>.json), which stays in the repo as it is. Output:
 *   {build, driverRows, passiveRadiatorRows, drivers: {<uuid>: record}, passiveRadiators: {<uuid>: record}}
 * read by packages/persistence/src/repos/catalogueBundle.ts. A record is kept by what its `specs`
 * hold (John, 1 Nov 2026): a woofer section makes it a driver, a passive-radiator section a
 * passive radiator, neither means it is dropped, and its index row with it, so the index lists
 * exactly what the bundle holds.
 */
import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

/** 'driver' | 'passiveRadiator' | null (dropped) for one record. */
export function classifyRecord(record) {
  const specs = record !== null && typeof record === 'object' ? record.specs : undefined;
  if (specs === null || typeof specs !== 'object') return null;
  if ('passive-radiator' in specs) return 'passiveRadiator';
  if ('woofer' in specs) return 'driver';
  return null;
}

/** Pure: keep the rows whose record is of `kind`. Returns the kept rows, the records by uuid, and the dropped rows. */
export function selectKind(rows, kind, recordOfRow) {
  const keptRows = [];
  const records = {};
  const dropped = [];
  for (const row of rows) {
    const record = recordOfRow(row);
    if (classifyRecord(record) === kind) { keptRows.push(row); records[row.uuid] = record; }
    else dropped.push(row);
  }
  return {rows: keptRows, records, dropped};
}

/** The bundle object and its counts, from a catalogue directory. */
export function buildCatalogueBundle(dir, build) {
  const read = (rel) => JSON.parse(readFileSync(join(dir, rel), 'utf8'));
  const recordOfRow = (row) => read(`drivers/${row.path}.json`);
  const drivers = selectKind(read('drivers-index.json'), 'driver', recordOfRow);
  const radiators = selectKind(read('passive-radiators-index.json'), 'passiveRadiator', recordOfRow);
  return {
    bundle: {build, driverRows: drivers.rows, passiveRadiatorRows: radiators.rows, drivers: drivers.records, passiveRadiators: radiators.records},
    counts: {drivers: drivers.rows.length, passiveRadiators: radiators.rows.length, dropped: drivers.dropped.length + radiators.dropped.length},
  };
}

/** Writes `<root>/catalogue.json` into a built site and removes the per-record files and indexes it replaces. */
export function writeBuiltCatalogue(root, build) {
  const {bundle, counts} = buildCatalogueBundle(root, build);
  writeFileSync(join(root, 'catalogue.json'), JSON.stringify(bundle));
  for (const f of ['drivers-index.json', 'passive-radiators-index.json']) rmSync(join(root, f), {force: true});
  if (existsSync(join(root, 'drivers'))) rmSync(join(root, 'drivers'), {recursive: true});
  console.log(`catalogue.json: ${counts.drivers} drivers, ${counts.passiveRadiators} passive radiators written, ${counts.dropped} dropped (no woofer or passive-radiator section)`);
  return counts;
}
