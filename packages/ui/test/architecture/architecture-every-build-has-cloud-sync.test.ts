// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// A red result IS the finding. Name the defect and repair it, or STOP and report. Never loosen,
// exempt or delete this test to make it pass. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * Every build is the same app (John, 29 Oct 2026: "you dont make diffetne builds of the app").
 * The Google client id decides whether cloud sync is built in, so it lives in the repo, read by
 * every build (Vite reads packages/ui/.env), and never comes from a CI-only variable.
 * Bug: bugs/BUG_20261029_preview-builds-hide-cloud-sync.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(__dirname, '..', '..', '..', '..');

describe('every build has cloud sync', () => {
  it('packages/ui/.env holds the public Google client id', () => {
    const env = readFileSync(join(REPO, 'packages', 'ui', '.env'), 'utf8');
    expect(env).toMatch(/^VITE_GOOGLE_CLIENT_ID=\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/m);
  });

  it('only the browser suite build, `--mode test`, starts without the client id', () => {
    const env = readFileSync(join(REPO, 'packages', 'ui', '.env.test'), 'utf8');
    expect(env).toMatch(/^VITE_GOOGLE_CLIENT_ID=$/m);
    const config = readFileSync(join(REPO, 'playwright.config.js'), 'utf8');
    expect(config).toMatch(/BUILD_TEST_APP = `[^`]*vite build --mode test /);
  });

  it('no workflow sets the client id, so CI builds the same app as a local build', () => {
    for (const wf of ['build.yml', 'suite.yml', 'deploy.yml', 'release.yml']) {
      const text = readFileSync(join(REPO, '.github', 'workflows', wf), 'utf8');
      expect(text, wf).not.toMatch(/VITE_GOOGLE_CLIENT_ID/);
    }
  });
});
