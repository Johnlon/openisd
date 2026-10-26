import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const MOBILE_SHELL = join(UI_SRC, 'ui', 'shells', 'mobile', 'MobileShell.vue');
const CLASSIC_PAGE = join(UI_SRC, 'ui', 'shells', 'mobile', 'PhoneClassicPage.vue');
const SIZE_CONTRACT = join(UI_SRC, 'ui', 'shells', 'mobile', 'phoneClassicFieldVars.ts');

describe('architecture — mobile classic number-field sizing has one shared contract', () => {
  it('applies the same design tokens to the shell and classic surfaces, including sibling overlays', () => {
    const shell = readFileSync(MOBILE_SHELL, 'utf8');
    const pageFrame = readFileSync(CLASSIC_PAGE, 'utf8');
    const sizeContract = readFileSync(SIZE_CONTRACT, 'utf8');

    expect(sizeContract).toMatch(/PhoneRowSizes\.CLASSIC\.cssVars\(\)/);
    expect(sizeContract).toMatch(/PhoneRowColumns\.STANDARD\.cssVars\(\)/);
    expect(shell).toMatch(/import \{phoneClassicFieldVars\} from '\.\/phoneClassicFieldVars\.js'/);
    expect(shell).toMatch(/class="mobile-root"\s+:style="\[phoneClassicFieldVars,/);
    expect(pageFrame).toMatch(/import \{phoneClassicFieldVars\} from '\.\/phoneClassicFieldVars\.js'/);
    expect(pageFrame).toMatch(/class="mob-classic"\s+:style="phoneClassicFieldVars"/);
  });
});
