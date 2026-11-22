/**
 * BUG_20261018_box-advanced-buttons-under-44: the phone Box tab's sheet buttons (alignment Cancel/Accept,
 * box losses Reset/OK) are PhoneButton, the one phone button (PhoneRowSizes.BUTTON_PX tall). A scoped
 * `.mob-btn` rule in the tab would win over the shared one and make them 40 px again.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse} from '@vue/compiler-sfc';
import {NodeTypes, type TemplateChildNode} from '@vue/compiler-core';

const SFC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'mobile', 'MobileBoxTab.vue');
const {descriptor} = parse(readFileSync(SFC, 'utf8'));

function tags(nodes: TemplateChildNode[]): {tag: string, text: string, cls: string}[] {
  return nodes.flatMap(n => {
    if (n.type !== NodeTypes.ELEMENT) return [];
    const cls = n.props.find(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'class');
    const text = n.children.map(c => (c.type === NodeTypes.TEXT ? c.content : '')).join('').trim();
    return [{tag: n.tag, text, cls: cls?.type === NodeTypes.ATTRIBUTE ? cls.value?.content ?? '' : ''}, ...tags(n.children)];
  });
}

describe('MobileBoxTab sheet buttons', () => {
  it('Cancel, Accept, Reset and OK are PhoneButton', () => {
    assert.ok(descriptor.template?.ast, 'MobileBoxTab.vue has a template');
    const all = tags(descriptor.template.ast.children);
    for (const text of ['Cancel', 'Accept', 'Reset', 'OK']) {
      const found = all.filter(t => t.text === text);
      assert.ok(found.length > 0, `a ${text} button`);
      for (const t of found) assert.equal(t.tag, 'PhoneButton', `${text} is a PhoneButton`);
    }
    assert.deepEqual(all.filter(t => t.cls.split(' ').includes('mob-btn')), [], 'no hand-made .mob-btn element');
  });

  it('has no scoped .mob-btn rule of its own', () => {
    for (const style of descriptor.styles) assert.doesNotMatch(style.content, /\.mob-btn\b/);
  });
});
