// Copies the driver records the tests use from winisd_drivers/db into test-fixtures/db-import.
// Reads the db; writes only under test-fixtures/db-import. Runs in every local predev/prebuild;
// where the db is absent it fails, except under CI (GitHub sets CI=true), where the committed
// copies stand.
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = join(root, '..', 'winisd_drivers', 'db', 'datasheets');
const outDir = join(root, 'test-fixtures', 'db-import', 'datasheets');

const RECORDS = [
  'accuton/bd90-6-727/openisd.json',
  'accuton/bd90-6-727/driver.json',
  'dayton-audio/da215-8/openisd.json',
];

if (!existsSync(dbDir)) {
  if (process.env.CI !== 'true') throw new Error(`winisd_drivers db missing: ${dbDir}`);
  console.log('CI: no winisd_drivers db, keeping committed test fixtures');
  process.exit(0);
}

for (const rel of RECORDS) {
  const from = join(dbDir, rel);
  if (!existsSync(from)) throw new Error(`db record missing: ${from}`);
  const to = join(outDir, rel);
  mkdirSync(dirname(to), {recursive: true});
  copyFileSync(from, to);
  console.log(`imported ${rel}`);
}
