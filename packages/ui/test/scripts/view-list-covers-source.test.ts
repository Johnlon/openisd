/**
 * Code against list (John, 10 Nov 2026, board: "I need the test to fail if all screens are not checked; if new
 * screens are added or popups then they must be auto included"; "if the agent forgets to add a row then it goes
 * out of date"): every view or popup the source defines that holds a number box or a dropdown is reached from an
 * entry of the view manifests. A source file is reached when a manifest entry's owner file is it or imports it,
 * however deep. A new popup with a box that no manifest entry owns fails here.
 */
import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse as parseSfc} from '@vue/compiler-sfc';
import {parse as parseDom, NodeTypes, type TemplateChildNode, type RootNode} from '@vue/compiler-dom';
import {discoverMobileSources, type SourceSurface} from '../../../../scripts/mobile-surface-discovery.js';
import {MOBILE_SURFACES} from '../fixtures/mobileSurfaceManifest.js';
import {DESKTOP_SURFACES} from '../fixtures/desktopSurfaceManifest.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
/** A tag that is a number box or a dropdown: the common fields, a bare select or an input. */
const BOX_TAG = /^(UIField|UIFieldBody|UIPickField|NumInput|select|input)$/;

function importsOf(path: string): string[] {
  const source = readFileSync(join(ROOT, path), 'utf8');
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)].flatMap(match => {
    const base = resolve(dirname(join(ROOT, path)), match[1]);
    const found = [base, base + '.vue', base + '.ts', base.replace(/\.js$/, '.ts')].find(candidate => existsSync(candidate) && /\.(vue|ts)$/.test(candidate));
    return found === undefined ? [] : [relative(ROOT, found)];
  });
}

/** Every file an owner file reaches through imports. */
function reachedFrom(owners: readonly string[]): ReadonlySet<string> {
  const reached = new Set<string>(owners);
  const queue = [...owners];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (!existsSync(join(ROOT, path))) continue;
    for (const imported of importsOf(path)) if (!reached.has(imported)) { reached.add(imported); queue.push(imported); }
  }
  return reached;
}

function holdsBox(surface: SourceSurface): boolean {
  if (!surface.path.endsWith('.vue')) return false;
  const template = parseSfc(readFileSync(join(ROOT, surface.path), 'utf8'), {filename: surface.path}).descriptor.template;
  if (template === null) return false;
  const offset = template.loc.start.line - 1;
  const has = (node: TemplateChildNode | RootNode): boolean => node.type === NodeTypes.ELEMENT ? BOX_TAG.test(node.tag) || node.children.some(has) : node.type === NodeTypes.ROOT && node.children.some(has);
  const find = (node: TemplateChildNode | RootNode): boolean => {
    if (node.type === NodeTypes.ELEMENT) return (offset + node.loc.start.line === surface.line && has(node)) || node.children.some(find);
    return node.type === NodeTypes.ROOT && node.children.some(find);
  };
  return find(parseDom(template.content));
}

/** One line per source view or popup holding a box that no manifest entry reaches. */
function viewsMissingFromList(ownerFiles: readonly string[]): string[] {
  const reached = reachedFrom(ownerFiles);
  const missing = discoverMobileSources(ROOT).surfaces.filter(surface => !reached.has(surface.path) && holdsBox(surface));
  return [...new Set(missing.map(surface => `${surface.title} in ${surface.path} is not on the view list`))];
}

const OWNERS = [...new Set([...MOBILE_SURFACES.map(surface => surface.owner), ...DESKTOP_SURFACES.map(surface => surface.owner)])];

describe('the view manifests cover the source', () => {
  it('every view or popup with a number box or dropdown is on the view list', () => {
    expect(viewsMissingFromList(OWNERS)).toEqual([]);
  });

  it('goes red when a real entry is removed from the list', () => {
    const entry = MOBILE_SURFACES.find(surface => surface.id === 'menu-optionsmodal' || surface.owner.endsWith('OptionsModal.vue'));
    if (entry === undefined) throw new Error('the Options entry is gone from the phone list');
    const others = OWNERS.filter(owner => owner !== entry.owner && !DESKTOP_SURFACES.some(surface => surface.owner === entry.owner));
    expect(viewsMissingFromList(others).filter(line => line.includes(entry.owner)).length).toBeGreaterThan(0);
  });
});
