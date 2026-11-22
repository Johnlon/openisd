// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE. See
// architecture-engine-has-no-ui-dependency.test.ts for the two permitted responses when it is red.
//
// Browsers define `crypto.randomUUID` only in a secure context: https, or localhost. A bare call
// throws "crypto.randomUUID is not a function" on any plain-http host, which is how the app hung on
// its loading screen at http://lap:4000 (BUG_20261013_app-hangs-on-plain-http-host). `newUuid()` in
// packages/design/domain/newUuid.ts guards the call and falls back; it is the only place allowed
// to name `crypto.randomUUID`.
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const REPO = resolve(__dirname, '../../..');
const ALLOWED = 'packages/design/domain/newUuid.ts';

describe('architecture: crypto.randomUUID is called only through newUuid()', () => {
  it('no source file outside newUuid.ts calls crypto.randomUUID', () => {
    // Every tracked source file of every package: `src/` trees plus the design package's own folders.
    const files = execFileSync('git', ['ls-files', '--', 'packages'], {cwd: REPO, encoding: 'utf8'})
      .split('\n')
      .filter(f => /\.(ts|vue|mts)$/.test(f) && !f.endsWith('.d.ts') && !/\/(test|node_modules|dist)\//.test(f) && f !== ALLOWED);
    assert.ok(files.some(f => f === 'packages/ui/src/main.ts'), 'the file list reaches the UI entry point');
    const offenders = files.filter(f => /\bcrypto\s*\.\s*randomUUID\s*\(/.test(readFileSync(resolve(REPO, f), 'utf8')));
    assert.deepEqual(offenders, [], `bare crypto.randomUUID() in: ${offenders.join(', ')}; call newUuid() from @openisd/design`);
  });
});
