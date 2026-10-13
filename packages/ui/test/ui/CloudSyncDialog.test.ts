import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {compileTemplate, parse} from '@vue/compiler-sfc';

const UI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPONENTS_DIR = join(UI_PKG, 'src', 'ui', 'components');

function parseSfc(fileName: string) {
  const filePath = join(COMPONENTS_DIR, fileName);
  const raw = readFileSync(filePath, 'utf8');
  const {descriptor} = parse(raw);
  return {raw, descriptor};
}

describe('T090 — Cloud sync dialog, badge, and icons', () => {
  describe('ToolbarIcon.vue (step 1)', () => {
    it('imports SyncGlyph and adds the five glyph names without retyping them', () => {
      const {descriptor} = parseSfc('ToolbarIcon.vue');
      assert.ok(descriptor.scriptSetup, 'ToolbarIcon must have <script setup>');
      const script = descriptor.scriptSetup.content;
      assert.match(script, /import\s+type\s*\{\s*SyncGlyph\s*\}\s*from/);
      assert.match(script, /SyncGlyph/);
      // Must not retype the strings in script
      assert.doesNotMatch(script, /'cloudOff'/);
      assert.doesNotMatch(script, /'cloudBusy'/);
      assert.doesNotMatch(script, /'cloudDone'/);
      assert.doesNotMatch(script, /'cloudSlash'/);
      assert.doesNotMatch(script, /'cloudAlert'/);
    });

    it('renders branches for all five SyncGlyph names', () => {
      const {descriptor} = parseSfc('ToolbarIcon.vue');
      assert.ok(descriptor.template, 'ToolbarIcon must have <template>');
      const tpl = descriptor.template.content;
      assert.match(tpl, /name === 'cloudOff'/);
      assert.match(tpl, /name === 'cloudBusy'/);
      assert.match(tpl, /name === 'cloudDone'/);
      assert.match(tpl, /name === 'cloudSlash'/);
      assert.match(tpl, /name === 'cloudAlert'/);
    });
  });

  describe('CloudSyncBadge.vue (step 2)', () => {
    it('declares props with SyncDisplay and maps SyncTone to CSS vars exhaustively', () => {
      const {descriptor} = parseSfc('CloudSyncBadge.vue');
      assert.ok(descriptor.scriptSetup, 'CloudSyncBadge must have <script setup>');
      const script = descriptor.scriptSetup.content;
      assert.match(script, /SyncDisplay/);
      assert.match(script, /Record<\s*SyncTone\s*,\s*string\s*>/);
      assert.match(script, /--mut/);
      assert.match(script, /--acc/);
      assert.match(script, /--good/);
      assert.match(script, /--acc2/);
      assert.match(script, /--bad/);
    });

    it('renders ToolbarIcon with display.glyph, numeric badge when not null, and emits tap', () => {
      const {descriptor} = parseSfc('CloudSyncBadge.vue');
      assert.ok(descriptor.template, 'CloudSyncBadge must have <template>');
      const tpl = descriptor.template.content;
      assert.match(tpl, /ToolbarIcon/);
      assert.match(tpl, /display\.glyph/);
      assert.match(tpl, /display\.badge/);
      assert.match(tpl, /display\.tooltip/);
      assert.match(tpl, /display\.tap/);
    });
  });

  describe('CloudSyncDialog.vue (step 3)', () => {
    it('accepts model prop of type SyncDialogModel', () => {
      const {descriptor} = parseSfc('CloudSyncDialog.vue');
      assert.ok(descriptor.scriptSetup, 'CloudSyncDialog must have <script setup>');
      const script = descriptor.scriptSetup.content;
      assert.match(script, /SyncDialogModel/);
    });

    it('has zero hard-coded English text nodes in template (all text comes from model fields)', () => {
      const {descriptor} = parseSfc('CloudSyncDialog.vue');
      assert.ok(descriptor.template, 'CloudSyncDialog must have <template>');
      const res = compileTemplate({
        source: descriptor.template.content,
        id: 'CloudSyncDialog',
        filename: 'CloudSyncDialog.vue',
      });
      assert.ok(res.ast, 'Template compilation must return AST');

      interface AstNode {
        type?: number;
        content?: string;
        children?: unknown[];
        branches?: unknown[];
      }

      function isAstNode(val: unknown): val is AstNode {
        return typeof val === 'object' && val !== null;
      }

      // Recursively find literal text nodes (NodeTypes.TEXT === 2)
      function findTextNodes(node: unknown): string[] {
        if (!isAstNode(node)) return [];
        if (node.type === 2 && typeof node.content === 'string') {
          const trimmed = node.content.trim();
          return trimmed ? [trimmed] : [];
        }
        const texts: string[] = [];
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            texts.push(...findTextNodes(child));
          }
        }
        if (Array.isArray(node.branches)) {
          for (const branch of node.branches) {
            texts.push(...findTextNodes(branch));
          }
        }
        return texts;
      }

      const hardcodedTexts = findTextNodes(res.ast);
      assert.deepEqual(
        hardcodedTexts,
        [],
        `Dialog template must have no hard-coded text nodes, but found: ${JSON.stringify(hardcodedTexts)}`,
      );
    });

    it('renders conflicts section with v-if on conflicts length', () => {
      const {descriptor} = parseSfc('CloudSyncDialog.vue');
      assert.ok(descriptor.template, 'CloudSyncDialog must have <template>');
      const tpl = descriptor.template.content;
      assert.match(tpl, /conflicts\.length/);
    });

    it('routes Disconnect through ConfirmDialog using model.disconnectConfirm', () => {
      const {descriptor} = parseSfc('CloudSyncDialog.vue');
      assert.ok(descriptor.scriptSetup, 'CloudSyncDialog must have <script setup>');
      const script = descriptor.scriptSetup.content;
      assert.match(script, /ConfirmDialog/);
      assert.match(script, /disconnectConfirm/);

      assert.ok(descriptor.template, 'CloudSyncDialog must have <template>');
      const tpl = descriptor.template.content;
      assert.match(tpl, /<ConfirmDialog/);
    });

    it('declares emits for connect, syncNow, reconnect, disconnect, openConflict', () => {
      const {descriptor} = parseSfc('CloudSyncDialog.vue');
      assert.ok(descriptor.scriptSetup, 'CloudSyncDialog must have <script setup>');
      const script = descriptor.scriptSetup.content;
      assert.match(script, /connect/);
      assert.match(script, /syncNow/);
      assert.match(script, /reconnect/);
      assert.match(script, /disconnect/);
      assert.match(script, /openConflict/);
    });
  });
});
