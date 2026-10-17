/**
 * John, 17 Oct 2026: "no backdoor in UI testing". The test build publishes one thing to the page, the
 * scripted update host that stands in for a service worker. It publishes no app state, and no browser
 * spec reaches the published object except the update-host fixture.
 */
import {describe, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const UI = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOKS = join(UI, 'src', 'logic', 'testHooks.ts');
const THIS_TEST = 'packages/ui/test/architecture/no-back-door-into-app-state.test.ts';

function filesMentioning(pattern: string): string[] {
  try {
    return execFileSync('git', ['grep', '-l', '-E', pattern, '--', 'packages/ui/src', 'packages/ui/test'], {cwd: join(UI, '..', '..'), encoding: 'utf8'})
      .split('\n').filter(line => line !== '' && line !== THIS_TEST).sort();
  } catch {
    return [];
  }
}

describe('the test build gives the specs no way into the app state', () => {
  it('publishes only the scripted update host', () => {
    const text = readFileSync(HOOKS, 'utf8');
    const members = [...text.matchAll(/^ {2}(\w+): /gm)].map(m => m[1]);
    expect(members).toEqual(['updateHost']);
    expect(text).not.toMatch(/appState|presentationState/);
  });

  it('is read by the update-host fixture and by nothing else in the specs', () => {
    expect(filesMentioning('openisdTestHooks').filter(f => f.startsWith('packages/ui/test/')))
      .toEqual(['packages/ui/test/fixtures/updateHost.ts']);
  });

  it('is installed by the composition root and named only in testHooks.ts', () => {
    expect(filesMentioning('TEST_HOOKS_KEY')).toEqual(['packages/ui/src/logic/testHooks.ts']);
  });
});
