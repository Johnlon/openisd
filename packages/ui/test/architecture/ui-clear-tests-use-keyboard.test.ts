import {readdirSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const UI_TESTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui');

describe('architecture — UI clear tests use a user deletion gesture', () => {
  it('reserves direct empty fill for the explicit input-event regression', () => {
    const directEmptyFills = readdirSync(UI_TESTS).sort()
      .filter(file => file.endsWith('.browser.spec.ts'))
      .flatMap(file => {
        const source = readFileSync(join(UI_TESTS, file), 'utf8');
        return [...source.matchAll(/\.fill\(\s*(['"])\1\s*\)/g)].map(() => file);
      });

    expect(directEmptyFills).toEqual(['sealed-triple.browser.spec.ts']);
    expect(readFileSync(join(UI_TESTS, 'sealed-triple.browser.spec.ts'), 'utf8'))
      .toContain("test('an input event with an empty value also hands the Fsc entry to Volume'");
  });
});
