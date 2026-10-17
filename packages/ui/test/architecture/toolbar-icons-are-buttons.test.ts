import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const SHELL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalShell.vue');

// bugs/BUG_20261017_ui-toolbar-icons-no-accessible-name.md: a clickable div cannot be reached by
// keyboard or named by a screen reader.
describe('architecture — desktop toolbar icons are buttons', () => {
  it('no toolbar icon is a clickable div', () => {
    const tags = readFileSync(SHELL, 'utf8').match(/<div\b[^>]*>/g) ?? [];
    const offences = tags.filter(t => /class="[^"]*\btb-btn\b/.test(t) && /@click\b/.test(t));
    expect(offences).toEqual([]);
  });

  it('every toolbar button has a short accessible name', () => {
    const buttons = (readFileSync(SHELL, 'utf8').match(/<button\b[^>]*>/g) ?? []).filter(t => /class="[^"]*\btb-btn\b/.test(t));
    expect(buttons.length).toBe(8);
    expect(buttons.filter(t => !/\baria-label="[^"]+"/.test(t))).toEqual([]);
  });
});
