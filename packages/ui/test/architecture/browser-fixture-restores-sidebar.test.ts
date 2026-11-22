/**
 * T633: a dragged sidebar width must not leak into the next browser test. `resetApp` restores the
 * 200 px default by dragging the splitter, as a user does, never by writing stored state.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures.ts');
const text = readFileSync(FIXTURES, 'utf8');
const start = text.indexOf('async function restoreSidebarWidth(');
const body = text.slice(start, text.indexOf('\n}\n', start));

describe('the browser fixture restores the sidebar width', () => {
  it('defines restoreSidebarWidth', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('calls it from resetApp', () => {
    const reset = text.slice(text.indexOf('function resetApp'));
    expect(reset.slice(0, reset.indexOf('\n}\n'))).toContain('await restoreSidebarWidth(page);');
  });

  it('acts through the splitter with the mouse, not stored state', () => {
    expect(body).toContain("page.locator('.split-v')");
    expect(body).toContain('page.mouse.down()');
    expect(body).toContain('page.mouse.move(0,');
    expect(body).toContain('page.mouse.up()');
    expect(body).not.toMatch(/localStorage|sessionStorage|evaluate|addInitScript/);
  });
});
