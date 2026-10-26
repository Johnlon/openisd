// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * The phone skin's unit chip (fill, left edge, weight, colour) is drawn only by UnitToggle.vue, so
 * every unit looks the same on every phone page (bugs/BUG_20261023_phone-unit-buttons-differ.md,
 * John 23 Oct: "the units on box are grey and while on other pahes"). A phone shell or a phone rule in
 * style.css that styles a unit class's look is a second chip that drifts.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const MOBILE_SHELLS = join(UI_SRC, 'ui', 'shells', 'mobile');
const UNIT_TOGGLE = join(UI_SRC, 'ui', 'components', 'UnitToggle.vue');
const LOOK = /(^|[;\s])(background|border-left|border-radius|font-weight|color)\s*:/;
const UNIT_CLASS = /\.[\w-]*unit[\w-]*/;

function vueFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...vueFiles(full));
    else if (name.endsWith('.vue')) out.push(full);
  }
  return out;
}

function lookRules(text: string, phoneOnly: boolean): string[] {
  const out: string[] = [];
  for (const rule of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = (rule[1] ?? '').trim();
    const body = rule[2] ?? '';
    if (!UNIT_CLASS.test(selector) || !LOOK.test(body)) continue;
    if (phoneOnly && !/\bmob/.test(selector)) continue;
    out.push(selector);
  }
  return out;
}

describe('architecture — the phone unit chip belongs to UnitToggle', () => {
  it('fixed units are white and switchable units are grey', () => {
    const source = readFileSync(UNIT_TOGGLE, 'utf8');
    const fixed = source.match(/\.app-root-mobile span\.unit-label\s*\{([^}]*)\}/)?.[1] ?? '';
    const toggle = source.match(/\.app-root-mobile span\.unit-label\.unit-toggle\s*\{([^}]*)\}/)?.[1] ?? '';
    const empty = source.match(/\.app-root-mobile span\.unit-label:empty\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(fixed, 'UnitToggle must define the fixed unit label style').not.toBe('');
    expect(fixed).toMatch(/\bbackground\s*:\s*#fff\b/);
    expect(toggle, 'UnitToggle must define a separate switchable unit style').not.toBe('');
    expect(toggle).toMatch(/\bbackground\s*:\s*#efefef\b/);
    expect(empty).toMatch(/\bbackground\s*:\s*transparent\b/);
  });

  it('no phone shell and no phone rule in style.css styles a unit class look', () => {
    const offences: string[] = [];
    for (const f of vueFiles(MOBILE_SHELLS)) {
      for (const selector of lookRules(readFileSync(f, 'utf8'), false)) offences.push(`${relative(UI_SRC, f)}: ${selector}`);
    }
    for (const selector of lookRules(readFileSync(join(UI_SRC, 'style.css'), 'utf8'), true)) offences.push(`style.css: ${selector}`);
    expect(offences).toEqual([]);
  });
});
