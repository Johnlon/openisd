/**
 * The Pages workflows (15 Oct 2026: a release ran release.yml twice, 2 s apart, and both Pages
 * deployments failed). What they pin: a release runs the workflow from its release event only, not
 * also from the v-tag push; every deploy shares the `pages` group and queues; the deploy step is
 * retried once.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const workflow = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../../.github/workflows/${name}`, import.meta.url)), 'utf8');

describe('release.yml', () => {
  it('runs from the release event, not from the tag push', () => {
    const text = workflow('release.yml');
    assert.match(text, /release:\n\s+types: \[published, edited\]/);
    assert.doesNotMatch(text, /^\s+push:/m);
  });

  it('calls deploy.yml and sets no concurrency group of its own, which would deadlock the called one', () => {
    const text = workflow('release.yml');
    assert.match(text, /uses: \.\/\.github\/workflows\/deploy\.yml/);
    assert.doesNotMatch(text, /^concurrency:/m);
  });
});

describe('deploy.yml', () => {
  it('queues every deploy in one pages group without cancelling a running one', () => {
    assert.match(workflow('deploy.yml'), /concurrency:\n\s+group: pages\n\s+cancel-in-progress: false/);
  });

  it('retries the Pages deployment once', () => {
    const text = workflow('deploy.yml');
    assert.match(text, /id: deployment\n\s+uses: actions\/deploy-pages@v4\n\s+continue-on-error: true/);
    assert.match(text, /id: retry\n\s+if: steps\.deployment\.outcome == 'failure'\n\s+uses: actions\/deploy-pages@v4/);
  });
});

describe('the callers of deploy.yml', () => {
  // A called workflow gets none of the repo's secrets unless its caller passes them: without this the
  // site deploy keys arrive empty and test.openisd.app / snapshots.openisd.app never publish (T413).
  it.each(['build.yml', 'release.yml'])('%s passes its secrets to deploy.yml', name => {
    assert.match(workflow(name), /uses: \.\/\.github\/workflows\/deploy\.yml\n\s+secrets: inherit\n/);
  });
});

describe('every workflow', () => {
  const names = readdirSync(fileURLToPath(new URL('../../../../.github/workflows', import.meta.url))).filter((n) =>
    n.endsWith('.yml'),
  );

  it('installs nothing with apt or Playwright system-dependency installers (T752: the saved test machine has them)', () => {
    for (const name of names) {
      const text = workflow(name);
      assert.doesNotMatch(text, /apt-get/, `${name} runs apt-get`);
      assert.doesNotMatch(text, /playwright install --with-deps/, `${name} runs playwright install --with-deps`);
      assert.doesNotMatch(text, /install-deps/, `${name} runs install-deps`);
    }
  });

  it('suite.yml names a real image digest, not the T752 placeholder', () => {
    assert.doesNotMatch(workflow('suite.yml'), /REPLACE_WITH_CI_IMAGE_DIGEST/);
  });
});
