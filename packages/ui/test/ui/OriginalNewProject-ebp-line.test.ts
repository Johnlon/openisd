/**
 * BUG_20261019_desktop-wizard-ebp-no-space-after-colon: wizard step 3's EBP line reads
 * "Efficiency Bandwidth Product (EBP): 78.9". Vue drops whitespace between two elements when it holds a
 * line break, so the label and the value must be separated by a space Vue keeps.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse} from '@vue/compiler-sfc';
import {NodeTypes, type ElementNode, type TemplateChildNode} from '@vue/compiler-core';

const SFC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalNewProject.vue');

function findByClass(nodes: TemplateChildNode[], cls: string): ElementNode | null {
  for (const n of nodes) {
    if (n.type !== NodeTypes.ELEMENT) continue;
    if (n.props.some(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'class' && p.value?.content.split(' ').includes(cls))) return n;
    const inner = findByClass(n.children, cls);
    if (inner) return inner;
  }
  return null;
}

describe('OriginalNewProject step 3 EBP line', () => {
  it('keeps a space between "Efficiency Bandwidth Product (EBP):" and the value', () => {
    const {descriptor} = parse(readFileSync(SFC, 'utf8'));
    assert.ok(descriptor.template?.ast, 'OriginalNewProject.vue has a template');
    const row = findByClass(descriptor.template.ast.children, 'ebp-row');
    assert.ok(row, 'the .ebp-row element');
    const kinds = row.children.map(c => (c.type === NodeTypes.ELEMENT ? c.tag : c.type === NodeTypes.TEXT ? `text:${c.content}` : String(c.type)));
    assert.deepEqual(kinds, ['span', 'text: ', 'strong']);
  });
});
