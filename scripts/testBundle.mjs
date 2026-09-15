/**
 * testBundle.mjs — the browser suite's small catalogue, cut from the tracked production one.
 *
 * `selectIndexRows` is pure (rows in, rows out) so a test can call it with no filesystem;
 * `scripts/test-bundle.mjs` is the CLI that reads the tracked indexes and record files under
 * packages/ui/public/ and writes the selection for playwright's vite to serve. No corpus access
 * anywhere — CI has no `winisd_drivers` checkout, and the tracked artifacts are what it has.
 */

/**
 * The rows of `rows` whose `path` is in `paths`, verbatim and in index order. Paths that name no
 * row here are returned as `unmatched` so the caller can check them against the other index —
 * a path is a driver or a radiator, and the CLI holds both indexes.
 * @template {{ path: string }} Row
 * @param {readonly Row[]} rows
 * @param {readonly string[]} paths
 * @returns {{ rows: Row[]; unmatched: string[] }}
 */
export function selectIndexRows(rows, paths) {
  const wanted = new Set(paths);
  const selected = rows.filter(row => wanted.has(row.path));
  const found = new Set(selected.map(row => row.path));
  return { rows: selected, unmatched: paths.filter(p => !found.has(p)) };
}

/**
 * Both indexes cut to `paths`. Throws on an empty selection and on any path neither index
 * carries: a suite whose fixture list has drifted must fail here, naming the path, not later as a
 * picker that lists nothing.
 * @template {{ path: string }} DriverRow
 * @template {{ path: string }} RadiatorRow
 * @param {readonly DriverRow[]} driverRows
 * @param {readonly RadiatorRow[]} radiatorRows
 * @param {readonly string[]} paths
 * @returns {{ driverRows: DriverRow[]; radiatorRows: RadiatorRow[] }}
 */
export function selectCatalogue(driverRows, radiatorRows, paths) {
  if (paths.length === 0) throw new Error('test bundle: no record paths selected — a suite run against no drivers proves nothing');
  const drivers = selectIndexRows(driverRows, paths);
  const radiators = selectIndexRows(radiatorRows, drivers.unmatched);
  if (radiators.unmatched.length > 0) {
    throw new Error(`test bundle: not in the tracked indexes — ${radiators.unmatched.join(', ')}. ` +
      'Rebuild them with scripts/bundle-drivers.mjs, or fix packages/ui/test/fixtures/test-bundle-paths.json.');
  }
  return { driverRows: drivers.rows, radiatorRows: radiators.rows };
}
