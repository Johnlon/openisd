/**
 * T728: on the desktop project list the cloud sync mark sits in the row's action column, under the ⋯ and
 * above the optional save floppy, not after the project name.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse} from '@vue/compiler-sfc';
import {NodeTypes, type ElementNode, type TemplateChildNode} from '@vue/compiler-core';

const SFC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalProjectList.vue');

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

function childClasses(n: ElementNode): string[] {
  return n.children.flatMap(c => (c.type === NodeTypes.ELEMENT ? [classes(c)[0] ?? ''] : []));
}

describe('OriginalProjectList row action column', () => {
  const {descriptor} = parse(readFileSync(SFC, 'utf8'));
  const ast = descriptor.template?.ast;

  it('holds the ⋯, then the cloud mark, then the save floppy', () => {
    assert.ok(ast, 'OriginalProjectList.vue has a template');
    const actions = findByClass(ast.children, 'project-row-actions');
    assert.ok(actions, 'the .project-row-actions element');
    assert.deepEqual(childClasses(actions), ['row-menu-btn', 'project-sync-mark', 'row-save-btn']);
  });

  it('has no cloud mark after the project name', () => {
    assert.ok(ast, 'OriginalProjectList.vue has a template');
    const identity = findByClass(ast.children, 'project-identity');
    assert.ok(identity, 'the .project-identity element');
    assert.equal(findByClass(identity.children, 'project-sync-mark'), null);
  });
});
