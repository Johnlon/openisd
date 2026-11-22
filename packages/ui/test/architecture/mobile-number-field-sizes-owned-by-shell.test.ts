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

    // One contract file, one source for every token: the design's classic row sizes and standard columns.
    expect(sizeContract).toMatch(/PhoneRowSizes\.CLASSIC\.cssVars\(\)/);
    expect(sizeContract).toMatch(/PhoneRowColumns\.STANDARD\.cssVars\(\)/);
    // The shell root supplies every token, the default label column included, to everything below it.
    expect(shell).toMatch(/import \{phoneClassicFieldVars\} from '\.\/phoneClassicFieldVars\.js'/);
    expect(shell).toMatch(/class="mobile-root"\s+:style="\[phoneClassicFieldVars,/);
    // A classic page takes the same tokens from the same file, minus the label column: the page's own measure is the only writer of it.
    expect(sizeContract).toMatch(/phoneClassicPageVars[\s\S]*PhoneRowSizes\.CLASSIC\.cssVars\(\)[\s\S]*PhoneRowColumns\.STANDARD\.cssVarsWithoutLabelColumn\(\)/);
    expect(pageFrame).toMatch(/import \{phoneClassicPageVars\} from '\.\/phoneClassicFieldVars\.js'/);
    expect(pageFrame).toMatch(/class="mob-classic"\s+:style="phoneClassicPageVars"/);
    expect(pageFrame).not.toMatch(/cssVars\(\)|\bphoneClassicFieldVars\b(?!\.js)/);
  });
});
