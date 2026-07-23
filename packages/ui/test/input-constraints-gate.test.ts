/**
 * MECHANICAL GATE — no unconstrained numeric inputs (POST_MORTEM 2026-07-23).
 *
 * Class of faults prevented: a numeric entry field that accepts values outside its
 * schema bounds (e.g. negative volumes/frequencies), because it was added as a raw
 * <input type="number"> with no binding to the field registry's constraints.
 *
 * The rule (DEVELOPMENT.md §8 "Numeric entry constraints"): every numeric input is either
 *   - a <NumInput> (which enforces registry/prop bounds itself), or
 *   - a raw <input type="number"> carrying `v-limits` (registry bounds, a scaled variant,
 *     or bare v-limits adopting its own native min/max attrs).
 * A numeric input with neither is a defect. This test makes the rule mechanical: it scans
 * every .vue source and fails on any offender, so the class cannot ship again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');

// NumInput.vue's own inner <input> IS the enforcement point — exempt by design.
const EXEMPT_FILES = new Set(['components/NumInput.vue']);

function vueFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...vueFiles(p));
    else if (name.endsWith('.vue')) out.push(p);
  }
  return out;
}

/** All `<input … type="number" …>` tags in a source string that carry no v-limits. */
export function unconstrainedNumberInputs(source: string): string[] {
  const tags = source.match(/<input\b[^>]*>/g) ?? [];
  return tags.filter((t) => /type="number"/.test(t) && !/v-limits/.test(t));
}

describe('mechanical gate — numeric inputs are schema-constrained', () => {
  it('the detector actually detects (self-test on a synthetic offender)', () => {
    const bad = '<div><input type="number" v-model="x"></div>';
    const good = '<div><input type="number" v-limits="limits(\'Vb\')" v-model="x"></div>';
    expect(unconstrainedNumberInputs(bad)).toHaveLength(1);
    expect(unconstrainedNumberInputs(good)).toHaveLength(0);
  });

  it('no .vue source contains a raw type="number" input without v-limits', () => {
    const offenders: string[] = [];
    for (const file of vueFiles(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (EXEMPT_FILES.has(rel)) continue;
      for (const tag of unconstrainedNumberInputs(readFileSync(file, 'utf8'))) {
        offenders.push(`${rel}: ${tag.slice(0, 100)}`);
      }
    }
    expect(offenders, 'unconstrained numeric input(s) — bind NumInput field=… or add v-limits '
      + '(DEVELOPMENT.md §8 "Numeric entry constraints"):\n' + offenders.join('\n')).toEqual([]);
  });
});
