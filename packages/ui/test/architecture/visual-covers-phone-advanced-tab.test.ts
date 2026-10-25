import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const SCREENS = join(dirname(fileURLToPath(import.meta.url)), '..', 'visual', 'screens.ts');

describe('architecture: the visual pictures cover the phone Advanced tab', () => {
  it("screens.ts takes a mobile 'tab-advanced' picture", () => {
    expect(readFileSync(SCREENS, 'utf8')).toContain("VisualSkin.MOBILE, 'tab-advanced'");
  });
});
