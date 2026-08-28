/**
 * BoxTypeDiagram.vue is the shared box-illustration component extracted out of
 * OriginalShell.vue so a New Project wizard can reuse the same SVG art without
 * duplicating markup. Vue-mounting isn't available in this workspace (no
 * @vue/test-utils, no jsdom — `packages/ui`'s vitest project runs in `environment:
 * 'node'`, per /home/john/work/winisd/openisd/vitest.config.ts), so this test
 * verifies the component the way it can be verified statically: it parses the SFC
 * with the same `@vue/compiler-sfc` Vite itself uses, and asserts each `boxType`
 * branch renders the one distinguishing SVG primitive that makes that box type
 * visually different from every other — the exact markup that lived inline in
 * OriginalShell.vue before extraction.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from '@vue/compiler-sfc';

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPONENT_PATH = join(UI_PKG, 'src', 'ui', 'components', 'BoxTypeDiagram.vue');

function templateSource(): string {
  const raw = readFileSync(COMPONENT_PATH, 'utf8');
  const { descriptor } = parse(raw);
  assert.ok(descriptor.template, 'BoxTypeDiagram.vue must have a <template> block');
  return descriptor.template!.content;
}

describe('BoxTypeDiagram.vue', () => {
  it('renders the sealed box: a solid rear wall with no port opening', () => {
    const tpl = templateSource();
    const svg = /<svg[^>]*id="og-box-diagram-sealed"[^>]*>[\s\S]*?<\/svg>/.exec(tpl)?.[0];
    assert.ok(svg, 'no svg with id="og-box-diagram-sealed" found');
    assert.match(svg!, /viewBox="0 30 200 240"/);
    // The driver cutaway + magnet block, verbatim from the box it was extracted from.
    assert.match(svg!, /path d="M160,110 L130,130 L130,170 L160,190"/);
    assert.match(svg!, /rect x="110" y="140" width="20" height="20"/);
  });

  it('renders the vented box: a rear port slot the sealed box does not have', () => {
    const tpl = templateSource();
    const svg = /<svg[^>]*id="og-box-diagram-vented"[^>]*>[\s\S]*?<\/svg>/.exec(tpl)?.[0];
    assert.ok(svg, 'no svg with id="og-box-diagram-vented" found');
    // The two parallel port lines that make a vented box visually distinct from sealed.
    assert.match(svg!, /line x1="160" y1="200" x2="100" y2="200"/);
    assert.match(svg!, /line x1="160" y1="230" x2="100" y2="230"/);
  });

  it('renders the PR box: two driver cutaways (main + passive radiator)', () => {
    const tpl = templateSource();
    const svg = /<svg[^>]*id="og-box-diagram-passive-radiator"[^>]*>[\s\S]*?<\/svg>/.exec(tpl)?.[0];
    assert.ok(svg, 'no svg with id="og-box-diagram-passive-radiator" found');
    const cutaways = svg!.match(/path d="M160,\d+ L130,\d+ L130,\d+ L160,\d+"/g) ?? [];
    assert.equal(cutaways.length, 2, 'PR box must show two driver-shaped cutaways');
  });

  it('renders the bandpass4 box: a divider wall splitting front/rear chambers', () => {
    const tpl = templateSource();
    const svg = /<svg[^>]*id="og-box-diagram-bandpass4"[^>]*>[\s\S]*?<\/svg>/.exec(tpl)?.[0];
    assert.ok(svg, 'no svg with id="og-box-diagram-bandpass4" found');
    assert.match(svg!, /line x1="100" y1="40" x2="100" y2="110"/);
    assert.match(svg!, /line x1="100" y1="190" x2="100" y2="260"/);
  });

  it('renders the bandpass6 box: the extra front-chamber port slot bandpass4 lacks', () => {
    const tpl = templateSource();
    const svg = /<svg[^>]*id="og-box-diagram-bandpass6"[^>]*>[\s\S]*?<\/svg>/.exec(tpl)?.[0];
    assert.ok(svg, 'no svg with id="og-box-diagram-bandpass6" found');
    assert.match(svg!, /viewBox="0 30 200 240"/);
    assert.match(svg!, /line x1="40" y1="70" x2="80" y2="70"/);
    assert.match(svg!, /line x1="40" y1="100" x2="80" y2="100"/);
  });

  it('renders the ABC box: its own taller viewBox and dual-baffle path shape', () => {
    const tpl = templateSource();
    const svg = /<svg[^>]*id="og-box-diagram-abc"[^>]*>[\s\S]*?<\/svg>/.exec(tpl)?.[0];
    assert.ok(svg, 'no svg with id="og-box-diagram-abc" found');
    assert.match(svg!, /viewBox="0 15 200 270"/);
    assert.match(svg!, /M 100,20 L 100,140 M 75,140 L 125,140 M 100,180 L 100,280 M 75,180 L 125,180/);
  });

  it('gates each svg on the boxType prop, not on some other condition', () => {
    const tpl = templateSource();
    for (const [id, type] of [
      ['og-box-diagram-sealed', 'sealed'],
      ['og-box-diagram-vented', 'vented'],
      ['og-box-diagram-passive-radiator', 'box-passive-radiator'],
      ['og-box-diagram-bandpass4', 'bandpass4'],
      ['og-box-diagram-bandpass6', 'bandpass6'],
      ['og-box-diagram-abc', 'abc'],
    ] as const) {
      const svgOpenTag = new RegExp(`<svg[^>]*id="${id}"[^>]*>`).exec(tpl)?.[0];
      assert.ok(svgOpenTag, `no svg with id="${id}" found`);
      assert.match(svgOpenTag!, new RegExp(`boxType === '${type}'`),
        `${id} must be gated on boxType === '${type}'`);
    }
  });
});
