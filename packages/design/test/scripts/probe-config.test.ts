// BUG_20261022_probe-route-never-builds-test-app: the probe config must pick up zz-foo.spec.ts as well as
// zz-foo.browser.spec.ts, and its documented route must go through test-browser.sh (which builds the app).
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {minimatch} from 'minimatch';

const REPO = resolve(__dirname, '../../../..');

describe('probe config', () => {
  it('testMatch matches both .spec.ts and .browser.spec.ts probes', async () => {
    const loaded: unknown = await import(resolve(REPO, 'scripts/playwright.probe.config.mjs'));
    assert.ok(typeof loaded === 'object' && loaded !== null && 'default' in loaded);
    const config = loaded.default;
    assert.ok(typeof config === 'object' && config !== null && 'testMatch' in config);
    const raw = config.testMatch;
    const globs = typeof raw === 'string'
      ? [raw]
      : Array.isArray(raw)
        ? raw.filter((glob): glob is string => typeof glob === 'string')
        : [];
    for (const name of ['build/tmp/zz-x.spec.ts', 'build/tmp/zz-x.browser.spec.ts']) {
      assert.ok(globs.some((g) => minimatch(name, g)), `${name} not matched by ${globs.join(',')}`);
    }
  });

  it('the documented probe route is test-browser.sh, never bare playwright', () => {
    const doc = readFileSync(resolve(REPO, '.claude/rules/ui-test-fixtures.md'), 'utf8');
    assert.match(doc, /bash scripts\/test-browser\.sh -c scripts\/playwright\.probe\.config\.mjs/);
    assert.doesNotMatch(doc, /`npx playwright test -c scripts\/playwright\.probe/);
  });
});
