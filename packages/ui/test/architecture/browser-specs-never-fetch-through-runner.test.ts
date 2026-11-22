/**
 * F55 / T407: `route.fetch()` sends a request through the test runner's pooled connection to the
 * suite's server, and under load that connection was reset ("read ECONNRESET", "socket hang up"),
 * failing cloud-sync-activity at random. A browser spec or fixture never fetches through the
 * runner: it fulfils from what it holds (an emulator, a file on disk) or lets the browser load it.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const TEST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function sources(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'architecture' ? [] : sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('browser specs never fetch through the test runner', () => {
  it('no spec or fixture calls route.fetch()', () => {
    const offenders = sources(TEST_DIR).filter(path => /\broute\.fetch\(/.test(readFileSync(path, 'utf8').replace(/\/\/[^\n]*/g, '')));
    expect(offenders).toEqual([]);
  });
});
