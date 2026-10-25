import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');

function vueFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...vueFiles(full));
    else if (name.endsWith('.vue')) out.push(full);
  }
  return out;
}

describe('architecture — the unit label underline belongs to UnitToggle', () => {
  it('no other .vue file styles a unit class with text-decoration or uses unit-cyc', () => {
    const offences: string[] = [];
    for (const f of vueFiles(UI_SRC)) {
      if (f.endsWith('UnitToggle.vue')) continue;
      const text = readFileSync(f, 'utf8');
      if (/\bunit-cyc\b/.test(text)) offences.push(`${relative(UI_SRC, f)}: unit-cyc`);
      for (const rule of text.matchAll(/([^{}]*unit[^{}]*)\{([^{}]*)\}/g)) {
        const selector = rule[1] ?? '';
        const body = rule[2] ?? '';
        if (/\.[\w-]*unit[\w-]*/.test(selector) && /text-decoration/.test(body)) offences.push(`${relative(UI_SRC, f)}: ${selector.trim()}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
