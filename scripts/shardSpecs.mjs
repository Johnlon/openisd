/**
 * shardSpecs.mjs: splits the browser spec files into shards of about equal measured time.
 *
 * Longest file first, each into the shard with the least time so far. A file with no measured time
 * counts as the median, so a new spec is never lost and lands somewhere sensible. Every file goes to
 * exactly one shard; ties break by name, so the split is the same on every machine.
 *
 * @param {readonly string[]} files spec paths relative to the test dir, e.g. "ui/num-input.browser.spec.ts"
 * @param {Readonly<Record<string, number>>} durations measured busy time per file, in ms
 * @param {number} shards how many shards
 * @returns {string[][]} the files of each shard, shard 1 first
 */
export function shardSpecs(files, durations, shards) {
  if (!Number.isInteger(shards) || shards < 1) throw new Error(`shards must be a whole number of at least 1, not ${shards}`);
  const known = Object.values(durations).sort((a, b) => a - b);
  const median = known.length === 0 ? 1 : known[Math.floor(known.length / 2)];
  const timeOf = file => durations[file] ?? median;
  const ordered = [...files].sort((a, b) => timeOf(b) - timeOf(a) || (a < b ? -1 : a > b ? 1 : 0));
  const bins = Array.from({length: shards}, () => ({files: [], time: 0}));
  for (const file of ordered) {
    const bin = bins.reduce((least, b) => (b.time < least.time ? b : least));
    bin.files.push(file);
    bin.time += timeOf(file);
  }
  return bins.map(b => b.files);
}

/**
 * Busy time per spec file from Playwright JSON reports (the shards' build/pw-report-<n>.json).
 *
 * @param {readonly unknown[]} reports parsed reports
 * @returns {Record<string, number>} ms per file, files in name order
 */
export function durationsOf(reports) {
  /** @type {Map<string, number>} */
  const total = new Map();
  const walk = suite => {
    for (const child of suite.suites ?? []) walk(child);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) total.set(spec.file, (total.get(spec.file) ?? 0) + (result.duration ?? 0));
      }
    }
  };
  for (const report of reports) for (const suite of report.suites ?? []) walk(suite);
  return Object.fromEntries([...total].sort(([a], [b]) => (a < b ? -1 : 1)).map(([file, ms]) => [file, Math.round(ms)]));
}
