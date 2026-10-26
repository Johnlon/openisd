import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const MOBILE_SHELL = join(UI_SRC, 'ui', 'shells', 'mobile', 'MobileShell.vue');
const CLASSIC_PAGE = join(UI_SRC, 'ui', 'shells', 'mobile', 'PhoneClassicPage.vue');

describe('architecture — mobile number-field sizes belong to the app shell', () => {
  it('provides the classic field tokens to every mobile page and overlay from one owner', () => {
    const shell = readFileSync(MOBILE_SHELL, 'utf8');
    const pageFrame = readFileSync(CLASSIC_PAGE, 'utf8');

    expect(shell).toMatch(/PhoneRowSizes\.CLASSIC\.cssVars\(\)/);
    expect(shell).toMatch(/PhoneRowColumns\.STANDARD\.cssVars\(\)/);
    expect(shell).toMatch(/class="mobile-root"\s+:style="\[fieldVars,/);
    expect(pageFrame).not.toMatch(/PhoneRowSizes|PhoneRowColumns|sizeVars/);
  });
});
