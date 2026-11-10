// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
/**
 * John, 10 Nov 2026: "I need the test to fail if all screens are not checked; if new screens are added or
 * popups then they must be auto included". Every component under packages/ui/src that imports the common
 * field must be in SURFACES (fixtures/fieldLayoutSurfaces.ts), mapped to screens the field layout gate walks,
 * or marked known with a bug file. A new screen or popup fails here the day it is added.
 */
import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';
import {SURFACES} from '../fixtures/fieldLayoutSurfaces.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');
const SPEC = readFileSync(join(HERE, '..', 'ui', 'field-layout-rules.browser.spec.ts'), 'utf8');
const COMMON_FIELDS = /from\s+'[^']*\/(UIField|UIFixedField|UISettlingField|UIFieldBody|NumInput)\.vue'/;
const THE_FIELD_FILES = new Set(['UIField', 'UIFixedField', 'UISettlingField', 'UIFieldBody', 'NumInput'].map(n => join('ui', 'components', `${n}.vue`)));

function vueFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? vueFiles(join(dir, entry.name)) : entry.name.endsWith('.vue') ? [join(dir, entry.name)] : []);
}

const DRAWERS = vueFiles(UI_SRC).map(file => relative(UI_SRC, file)).filter(file => !THE_FIELD_FILES.has(file) && COMMON_FIELDS.test(readFileSync(join(UI_SRC, file), 'utf8'))).sort();

describe('every screen with a number box is in the field layout gate', () => {
  it('lists every component that draws a common field', () => {
    expect(DRAWERS.filter(file => SURFACES[file] === undefined), 'a component draws number boxes and the layout gate does not list it').toEqual([]);
  });
  it('lists no component that is gone or draws no common field', () => {
    expect(Object.keys(SURFACES).filter(file => !DRAWERS.includes(file))).toEqual([]);
  });
  it('maps each walked component to screens the spec opens', () => {
    const walkedByTemplate = (id: string): boolean => SPEC.includes(id) || SPEC.includes(id.replace(/\S+$/, '${tab}'));
    const missing = Object.entries(SURFACES).flatMap(([file, s]) => s.kind === 'walked' ? s.screens.filter(id => !walkedByTemplate(id) && !/ every tab$/.test(id)).map(id => `${file}: ${id}`) : []);
    expect(missing).toEqual([]);
  });
  it('gives each known component an existing bug file', () => {
    const bugs = [...new Set(Object.values(SURFACES).flatMap(s => s.kind === 'known' ? [s.bug] : []))];
    expect(bugs.filter(bug => !existsSync(join(HERE, '..', '..', '..', '..', 'bugs', `${bug}.md`)))).toEqual([]);
  });
});
