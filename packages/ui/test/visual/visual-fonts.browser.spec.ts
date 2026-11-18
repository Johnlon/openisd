import type {CDPSession, Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {SCREENS} from './screens.js';

/**
 * Every glyph of every screen in the visual set is drawn in a font the app carries (John, 2026-11-15: "the fonts are
 * 100pc baked into the app why would they diff?"). Chrome reports, per element, the platform font that drew each run of
 * text (CDP `CSS.getPlatformFontsForNode`); a font that is not a web font from our own @font-face rules is a system font,
 * which looks different on Windows, macOS, Android and Linux and makes the pictures depend on the machine.
 * The walk covers elements and their ::before/::after boxes. Canvas text is covered by the chart-font record in visual.browser.spec.ts.
 */

interface CdpNode {
  readonly nodeId: number;
  readonly nodeName: string;
  readonly nodeType: number;
  readonly attributes: readonly string[];
  readonly children: readonly CdpNode[];
  readonly pseudoElements: readonly CdpNode[];
  readonly shadowRoots: readonly CdpNode[];
  readonly contentDocument: CdpNode | null;
}

interface PlatformFont {readonly familyName: string; readonly postScriptName: string; readonly isCustomFont: boolean; readonly glyphCount: number}

/** One element drawn, wholly or partly, in a font that is not bundled. */
export interface SystemFontUse {readonly element: string; readonly text: string; readonly characters: string; readonly font: string; readonly glyphs: number}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function parseNode(value: unknown): CdpNode {
  if (!isRecord(value) || typeof value['nodeId'] !== 'number' || typeof value['nodeName'] !== 'string' || typeof value['nodeType'] !== 'number') throw new Error('CDP sent a node of an unknown shape');
  const list = (key: string): CdpNode[] => { const items = value[key]; return Array.isArray(items) ? items.map(parseNode) : []; };
  const attributes = value['attributes'];
  const content = value['contentDocument'];
  return {
    nodeId: value['nodeId'], nodeName: value['nodeName'], nodeType: value['nodeType'],
    attributes: Array.isArray(attributes) ? attributes.map(String) : [],
    children: list('children'), pseudoElements: list('pseudoElements'), shadowRoots: list('shadowRoots'),
    contentDocument: content === undefined ? null : parseNode(content),
  };
}

function parseFonts(value: unknown): PlatformFont[] {
  if (!isRecord(value) || !Array.isArray(value['fonts'])) throw new Error('CDP sent fonts of an unknown shape');
  return value['fonts'].map(font => {
    if (!isRecord(font) || typeof font['isCustomFont'] !== 'boolean') throw new Error('CDP sent a font of an unknown shape');
    return {familyName: String(font['familyName']), postScriptName: String(font['postScriptName']), isCustomFont: font['isCustomFont'], glyphCount: Number(font['glyphCount'])};
  });
}

function selectorOf(node: CdpNode): string {
  const get = (name: string): string => { const at = node.attributes.indexOf(name); return at < 0 ? '' : node.attributes[at + 1] ?? ''; };
  const classes = get('class').trim().split(/\s+/).filter(c => c !== '').join('.');
  const id = get('id');
  return `${node.nodeName.toLowerCase()}${id === '' ? '' : `#${id}`}${classes === '' ? '' : `.${classes}`}`;
}

const NOT_TEXT = new Set(['SCRIPT', 'STYLE', 'HEAD', 'NOSCRIPT', 'CANVAS']);

/** The elements on the page (pseudo-elements included) that draw any glyph in a font that is not one of the app's own. */
export async function systemFontUses(page: Page): Promise<SystemFontUse[]> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const root = parseNode((await cdp.send('DOM.getDocument', {depth: -1, pierce: true})).root);
    const found: SystemFontUse[] = [];
    const visit = async (node: CdpNode, path: readonly string[]): Promise<void> => {
      const isBox = node.nodeType === 1 || node.nodeName.startsWith('::');
      const here = isBox ? [...path, selectorOf(node)] : path;
      // A parent's report includes its children's text: only an element with a text node of its own (or a ::before/::after) is asked.
      const ownText = node.children.some(child => child.nodeType === 3) || node.nodeName.startsWith('::') || /^(INPUT|TEXTAREA|SELECT)$/.test(node.nodeName);
      if (isBox && ownText && !NOT_TEXT.has(node.nodeName)) {
        const fonts = parseFonts(await cdp.send('CSS.getPlatformFontsForNode', {nodeId: node.nodeId}));
        for (const font of fonts.filter(f => !f.isCustomFont)) {
          const html = await cdp.send('DOM.getOuterHTML', {nodeId: node.nodeId}).then(r => r.outerHTML, () => '');
          const text = html.replace(/<[^>]*>/g, '').trim().slice(0, 60);
          const characters = Array.from(new Set(Array.from(text).filter(c => (c.codePointAt(0) ?? 0) > 127))).map(c => `${c} U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`).join(' ');
          found.push({element: here.slice(-3).join(' > '), text, characters, font: font.familyName || font.postScriptName, glyphs: font.glyphCount});
        }
      }
      for (const child of [...node.pseudoElements, ...node.shadowRoots, ...node.children, ...(node.contentDocument === null ? [] : [node.contentDocument])]) await visit(child, here);
    };
    await visit(root, []);
    return found;
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

for (const screen of SCREENS) {
  test(`visual fonts ${screen.skin.name} ${screen.name}: every glyph is drawn in a bundled font`, async ({page, browserLog}) => {
    // At the test server's address, not the release address: the developer protocol this reads fonts through fetches the stylesheets again from the address itself.
    await screen.openOnServer(page);
    await page.evaluate(() => document.fonts.ready);
    browserLog.reset();
    const uses = await systemFontUses(page);
    expect(uses.map(use => `${screen.skin.name} ${screen.name}: ${use.element} "${use.text}" [${use.characters || 'ASCII only'}] drawn by ${use.font} (${use.glyphs} glyphs)`), 'elements drawn in a system font').toEqual([]);
  });
}
