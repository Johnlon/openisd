// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
// "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// deleting the test are one act under different names — making the red go away instead of making
// the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * A test file names the object it tests and sits in the folder of that object's layer
 * (TESTING_STRATEGY.md "Where a test goes", "Naming"; John, 2026-10-04: "test files aligned to
 * specific concerns and not a mixed up jumble").
 *
 * Checked over every package's test tree:
 *   - a browser spec lives in `packages/ui/test/ui/`;
 *   - a design test sits in a layer folder, never loose at `packages/design/test/` (the
 *     `architecture-*` gates are the only top-level files);
 *   - a UI test sits in one of the UI layer folders;
 *   - no file name is a ticket, bug, layer or grab-bag word instead of an object.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TEST_ROOTS = ['packages/design/test', 'packages/persistence/test', 'packages/ui/test'];
const TEST_FILE = /\.(test|browser\.spec)\.ts$/;
const UI_FOLDERS = ['architecture', 'diagnostics', 'fixtures', 'hooks', 'logic', 'scripts', 'ui'];
/** Words that name a ticket, a bug, a layer or a grab-bag — never an object under test. */
const NOT_AN_OBJECT = /(^|[-_.])(app|stubs?|hardening|misc|characteri[sz]ation|bugs?|qo\d+|regression)\.(test|browser\.spec)\.ts$|^(original|mobile)-skin\.|(^|[-_.])(bug|qo\d+|regression)[-_.]/i;

function testFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : testFilesUnder(path);
    return TEST_FILE.test(name) ? [relative(REPO, path).split(sep).join('/')] : [];
  });
}

/** The offences for one repo-relative test path; empty when it is named and placed right. */
export function placementOffences(path: string): string[] {
  const offences: string[] = [];
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (name.endsWith('.browser.spec.ts') && !path.startsWith('packages/ui/test/ui/')) {
    offences.push(`${path}: a browser spec belongs in packages/ui/test/ui/`);
  }
  if (path.startsWith('packages/design/test/') && !path.slice('packages/design/test/'.length).includes('/')
      && !name.startsWith('architecture-')) {
    offences.push(`${path}: a design test belongs in the folder of its layer (engine/, domain/, fields/, chart/, winisd/...)`);
  }
  if (path.startsWith('packages/ui/test/')) {
    const folder = path.slice('packages/ui/test/'.length).split('/')[0]!;
    if (!UI_FOLDERS.includes(folder)) offences.push(`${path}: a UI test belongs in one of ${UI_FOLDERS.join(', ')}`);
  }
  if (NOT_AN_OBJECT.test(name)) offences.push(`${path}: name the object under test, not a ticket, bug, layer or grab-bag`);
  return offences;
}

describe('test files name their object and sit in its layer folder', () => {
  it('every test file in the repo passes', () => {
    const offences = TEST_ROOTS.flatMap(root => testFilesUnder(join(REPO, root))).flatMap(placementOffences);
    assert.deepEqual(offences, []);
  });

  it('the gate can fail', () => {
    assert.equal(placementOffences('packages/ui/test/logic/driver-editor.browser.spec.ts').length, 1);
    assert.equal(placementOffences('packages/design/test/domain.test.ts').length, 1);
    assert.equal(placementOffences('packages/ui/test/stuff/x.test.ts').length, 1);
    assert.equal(placementOffences('packages/ui/test/ui/app.browser.spec.ts').length, 1);
    assert.equal(placementOffences('packages/ui/test/ui/original-skin.browser.spec.ts').length, 1);
    assert.equal(placementOffences('packages/design/test/engine/hardening.test.ts').length, 1);
    assert.equal(placementOffences('packages/design/test/engine/bug-123-vent.test.ts').length, 1);
    assert.equal(placementOffences('packages/design/test/domain/voice-coil-wiring.test.ts').length, 0);
    assert.equal(placementOffences('packages/design/test/domain/project-app-settings-changed.test.ts').length, 0);
  });
});
