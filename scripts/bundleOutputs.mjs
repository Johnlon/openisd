import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

/**
 * Parse repeatable exact catalogue path selectors.
 * @param {readonly string[]} argv
 * @returns {Set<string>}
 */
export function onlyRecordPathsFromArgs(argv) {
  const selected = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--only-record') continue;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error('--only-record requires an exact brand/sku path');
    }
    const parts = value.split('/');
    if (parts.length !== 2 || parts.some(part => !/^[a-z0-9][a-z0-9._-]*$/i.test(part)) || parts.includes('.') || parts.includes('..')) {
      throw new Error(`invalid --only-record path ${value}; expected one exact brand/sku path`);
    }
    selected.add(value);
    index += 1;
  }
  return selected;
}

/** Select exact source files without validating unrelated corpus records. */
export function filesForSelectedPaths(rawFiles, selectedPaths, recordPathOf) {
  if (selectedPaths.size === 0) return rawFiles;
  const byPath = new Map(rawFiles.map(file => [recordPathOf(file), file]));
  const missing = [...selectedPaths].filter(path => !byPath.has(path));
  if (missing.length > 0) throw new Error(`selected path(s) not found in corpus: ${missing.join(', ')}`);
  return [...selectedPaths].sort().map(path => byPath.get(path));
}

/** Merge one selected refresh into an existing full index, preserving untouched rows and their order. */
function mergeSelectedRows(existingRows, selectedPaths, replacementRows) {
  if (!Array.isArray(existingRows)) throw new Error('existing bundle index must be an array');
  const replacementByPath = new Map(replacementRows.map(row => [row.path, row]));
  if (replacementByPath.size !== replacementRows.length) throw new Error('selected bundle rows contain duplicate paths');
  for (const path of replacementByPath.keys()) {
    if (!selectedPaths.has(path)) throw new Error(`replacement index row is not selected: ${path}`);
  }
  const result = [];
  const placed = new Set();
  for (const row of existingRows) {
    if (!selectedPaths.has(row.path)) {
      result.push(row);
      continue;
    }
    const replacement = replacementByPath.get(row.path);
    if (replacement !== undefined) {
      result.push(replacement);
      placed.add(row.path);
    }
  }
  for (const row of [...replacementRows].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!placed.has(row.path)) result.push(row);
  }
  return result;
}

/**
 * Write a full bundle or a selected set of record files.
 * Selected refreshes still write complete indexes from the caller's full-corpus scan, preserve
 * every unselected record byte-for-byte, and remove the full-build stamp so a later normal run
 * cannot mistake the partial bundle for a complete one.
 *
 * @param {{
 *   publicRoot: string,
 *   stampFile: string,
 *   records: readonly {path: string, record: unknown}[],
 *   driverRows: readonly unknown[],
 *   radiatorRows: readonly unknown[],
 *   selectedPaths: ReadonlySet<string>,
 *   fingerprint: string,
 * }} args
 * @returns {number}
 */
export function applyBundleOutputs({
  publicRoot,
  stampFile,
  records,
  driverRows,
  radiatorRows,
  selectedPaths,
  fingerprint,
}) {
  const recordsByPath = new Map(records.map(item => [item.path, item]));
  const missing = [...selectedPaths].filter(path => !recordsByPath.has(path));
  if (missing.length > 0) {
    throw new Error(`selected path(s) not in the validated bundle records: ${missing.join(', ')}`);
  }

  const recordsRoot = join(publicRoot, 'drivers');
  let driverIndex = driverRows;
  let radiatorIndex = radiatorRows;
  if (selectedPaths.size > 0) {
    const existingDrivers = JSON.parse(readFileSync(join(publicRoot, 'drivers-index.json'), 'utf8'));
    const existingRadiators = JSON.parse(readFileSync(join(publicRoot, 'passive-radiators-index.json'), 'utf8'));
    driverIndex = mergeSelectedRows(existingDrivers, selectedPaths, driverRows);
    radiatorIndex = mergeSelectedRows(existingRadiators, selectedPaths, radiatorRows);
  }
  if (selectedPaths.size === 0) rmSync(recordsRoot, {recursive: true, force: true});
  const pathsToWrite = selectedPaths.size === 0 ? records.map(item => item.path) : [...selectedPaths];
  for (const path of pathsToWrite) {
    const item = recordsByPath.get(path);
    if (item === undefined) throw new Error(`validated record disappeared during bundle write: ${path}`);
    const outputPath = join(recordsRoot, `${path}.json`);
    mkdirSync(dirname(outputPath), {recursive: true});
    writeFileSync(outputPath, JSON.stringify(item.record));
  }

  writeFileSync(join(publicRoot, 'drivers-index.json'), JSON.stringify(driverIndex));
  writeFileSync(join(publicRoot, 'passive-radiators-index.json'), JSON.stringify(radiatorIndex));
  if (selectedPaths.size > 0) {
    rmSync(stampFile, {force: true});
  } else {
    mkdirSync(dirname(stampFile), {recursive: true});
    writeFileSync(stampFile, `${fingerprint}\n`);
  }
  return pathsToWrite.length;
}
