/**
 * The pinned driver snapshot: the vendored fixtures and the committed bundle must hash to what
 * scripts/driver-snapshot.pin says. Only scripts/sync-driver-snapshot.sh writes either; a hand
 * edit or a half-committed refresh shows up here.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FIXTURES = join(REPO, 'packages', 'design', 'test', 'fixtures', 'driver-snapshot');
const PUBLIC = join(REPO, 'packages', 'ui', 'public');
const FIX = 'run bash scripts/sync-driver-snapshot.sh (the only reader of the live db) and commit the result';

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? filesUnder(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]);
}

const pinSchema = z.strictObject({
  winisd_drivers_commit: z.string(),
  fixtures: z.record(z.string(), z.string()),
  bundle_sha256: z.string(),
});

function readPin(): z.infer<typeof pinSchema> {
  const parsed = pinSchema.safeParse(JSON.parse(readFileSync(join(REPO, 'scripts', 'driver-snapshot.pin'), 'utf8')));
  if (!parsed.success) throw new Error(`driver-snapshot.pin is malformed (${parsed.error.message}): ${FIX}`);
  return parsed.data;
}

describe('driver snapshot pin', () => {
  const pin = readPin();

  it('names a 40-hex winisd_drivers commit', () => {
    assert.match(pin.winisd_drivers_commit, /^[0-9a-f]{40}$/, FIX);
  });

  it('pins exactly the vendored fixtures, each with its sha256', () => {
    assert.deepEqual(Object.keys(pin.fixtures).sort(), filesUnder(FIXTURES).sort(), FIX);
    for (const [file, hash] of Object.entries(pin.fixtures)) {
      assert.equal(sha256(join(FIXTURES, file)), hash, `${file} differs from the pin: ${FIX}`);
    }
  });

  it('pins the committed bundle under packages/ui/public', () => {
    const files = ['drivers-index.json', 'passive-radiators-index.json', ...filesUnder(join(PUBLIC, 'drivers'), 'drivers/')].sort();
    const text = files.map(f => `${f}\t${sha256(join(PUBLIC, f))}\n`).join('');
    assert.equal(createHash('sha256').update(text).digest('hex'), pin.bundle_sha256, `the bundle differs from the pin: ${FIX}`);
  });
});
