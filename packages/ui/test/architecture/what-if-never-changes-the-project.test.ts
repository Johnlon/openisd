/**
 * The What-if? code reaches the project only through its What-if layer
 * (docs/design/STATE_MODEL.md rule 3): it opens one (`beginWhatIf`), resets it (`resetWhatIf`)
 * and ends it (`cancelWhatIf`). It never saves, reverts or discards the project's own edits —
 * `.save()`, `.cancel()` or `resetProjectToGround` would change the project the What-if must
 * leave alone.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

const WHAT_IF_FILES: readonly string[] = [
  'hooks/sheetSession.ts',
  'hooks/OriginalWhatIf-hooks.ts',
  'hooks/MobileSheet-hooks.ts',
  'ui/shells/original/OriginalWhatIf.vue',
  'ui/shells/mobile/MobileWhatIfSheet.vue',
];

const PROJECT_WRITES: readonly RegExp[] = [/\.save\(\)/, /\.cancel\(\)/, /resetProjectToGround/];

describe('What-if? never changes the project', () => {
  it.each(WHAT_IF_FILES)('%s never saves, reverts or discards the project', (file) => {
    const text = readFileSync(join(UI_SRC, file), 'utf8');
    for (const write of PROJECT_WRITES) expect(text).not.toMatch(write);
  });

  it('closing the What-if? session ends the What-if layer in Learn mode', () => {
    const text = readFileSync(join(UI_SRC, 'hooks/sheetSession.ts'), 'utf8');
    expect(text).toMatch(/case 'whatIfLayer':\s*project\.value\.cancelWhatIf\(\);/);
  });

  it('the Tune branch never calls beginWhatIf, and the Learn branch always does before a write', () => {
    const text = readFileSync(join(UI_SRC, 'hooks/sheetSession.ts'), 'utf8');
    const setMatch = text.match(/function set\(field: SheetField, v: number\): void \{([\s\S]*?)\n  \}/);
    expect(setMatch).not.toBeNull();
    const setBody = setMatch![1];
    const projectBranch = setBody.match(/case 'project':([\s\S]*?)case 'whatIfLayer':/);
    expect(projectBranch).not.toBeNull();
    expect(projectBranch![1]).not.toMatch(/beginWhatIf/);
    const whatIfBranch = setBody.match(/case 'whatIfLayer':([\s\S]*?)return;/);
    expect(whatIfBranch).not.toBeNull();
    expect(whatIfBranch![1]).toMatch(/beginWhatIf\(\)[\s\S]*write\(/);
  });
});

