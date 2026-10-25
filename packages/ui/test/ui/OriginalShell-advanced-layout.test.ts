/**
 * BUG_20261019_desktop-advanced-winisd-bugs-group-cut: the desktop Advanced tab stacks the air fields over the
 * standard options in one left column, so the Compatibility box beside them fits a 1280 px window.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse} from '@vue/compiler-sfc';
import {NodeTypes, type ElementNode, type TemplateChildNode} from '@vue/compiler-core';

const SFC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalShell.vue');

function classes(n: ElementNode): string[] {
  return n.props.flatMap(p => (p.type === NodeTypes.ATTRIBUTE && p.name === 'class' && p.value ? p.value.content.split(' ') : []));
}

function findByClass(nodes: TemplateChildNode[], cls: string): ElementNode | null {
  for (const n of nodes) {
    if (n.type !== NodeTypes.ELEMENT) continue;
    if (classes(n).includes(cls)) return n;
    const inner = findByClass(n.children, cls);
    if (inner) return inner;
  }
  return null;
}

function childClasses(n: ElementNode): string[][] {
  return n.children.flatMap(c => (c.type === NodeTypes.ELEMENT ? [classes(c)] : []));
}

describe('OriginalShell desktop Advanced tab', () => {
  it('puts the air fields over the standard options, beside the Compatibility box', () => {
    const {descriptor} = parse(readFileSync(SFC, 'utf8'));
    assert.ok(descriptor.template?.ast, 'OriginalShell.vue has a template');
    const row = findByClass(descriptor.template.ast.children, 'adv-two-col');
    assert.ok(row, 'the .adv-two-col element');
    assert.deepEqual(childClasses(row), [['adv-left-col'], ['sim-options-box']]);
    const left = findByClass(row.children, 'adv-left-col');
    assert.ok(left, 'the .adv-left-col element');
    assert.deepEqual(childClasses(left), [['adv-air-fields'], ['checkbox-col']]);
  });
});
