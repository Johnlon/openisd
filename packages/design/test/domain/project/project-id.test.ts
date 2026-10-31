/**
 * A project's durable id (John, QO312): every project carries a required id in its stored and
 * `.owpr` text, read back as its identity, and never written to a `.wpr`.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import {OpenISDProject} from '../../../domain/project/openISDProject.js';
import {ProjectBuilder} from '../../../domain/openisdTransforms.js';
import {WinIsdProjectConverter} from '../../../domain/winIsdProjectConverter.js';
import type {AppContext} from '../../../domain/appContext.js';
import {realAppContext} from '../../../domain/appContext.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const wprText = readFileSync(join(here, '..', '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');

function counting(prefix: string): AppContext {
  let count = 0;
  return {...realAppContext, newId: () => `${prefix}-${++count}`};
}

function fromWpr(): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wprText);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

function loaded(text: string, appContext?: AppContext): OpenISDProject {
  const p = OpenISDProject.fromOwprText(text, engine, appContext);
  if (Array.isArray(p)) throw new Error('refused: ' + p.join('; '));
  return p;
}

/** `text` parsed as JSON, and the value at `path` inside it (undefined when a step is not an object). */
function jsonAt(text: string, ...path: string[]): unknown {
  let node: unknown = JSON.parse(text);
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = Object.entries(node).find(([k]) => k === key)?.[1];
  }
  return node;
}

/** `text` parsed as a JSON object, to be edited by a test. */
function jsonObject(text: string): Record<string, unknown> {
  const node: unknown = JSON.parse(text);
  if (typeof node !== 'object' || node === null || Array.isArray(node)) throw new Error('not an object');
  return Object.fromEntries(Object.entries(node));
}

describe('a project id', () => {
  it('is the first field of the stored text and of the .owpr text, and is the project identity', () => {
    const p = fromWpr();
    expect(Object.keys(jsonObject(p.toStoredText()))[0]).toBe('id');
    expect(jsonAt(p.toStoredText(), 'id')).toBe(p.uuid());
    expect(jsonAt(p.toOwprText(), 'id')).toBe(p.uuid());
  });

  it('is read back from the text as the identity, so a load keeps it', () => {
    const p = fromWpr();
    expect(loaded(p.toStoredText()).uuid()).toBe(p.uuid());
    expect(loaded(p.toOwprText()).uuid()).toBe(p.uuid());
  });

  it('is minted for a new project and for a .wpr import, a different one each time', () => {
    const ids = new Set([fromWpr().uuid(), fromWpr().uuid(), ProjectBuilder.empty(engine).uuid(), ProjectBuilder.empty(engine).uuid()]);
    expect(ids.size).toBe(4);
  });

  it('is never written to a .wpr', () => {
    const p = fromWpr();
    const {value} = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(p);
    expect(JSON.stringify(value)).not.toContain(p.uuid());
  });

  it('is minted once for an older text that has none, from the injected AppContext', () => {
    const older = jsonObject(fromWpr().toStoredText());
    delete older.id;
    const p = loaded(JSON.stringify(older), counting('old'));
    expect(p.uuid()).toMatch(/^old-\d+$/);
    expect(jsonAt(p.toStoredText(), 'id')).toBe(p.uuid());
  });

  it('can be replaced, which a second copy of an already open or stored file does', () => {
    const p = fromWpr();
    const before = p.uuid();
    p.assignNewId();
    expect(p.uuid()).not.toBe(before);
    expect(jsonAt(p.toStoredText(), 'id')).toBe(p.uuid());
  });

  it('is added to a stored text by textWithId, first, in the canonical order, on one line', () => {
    const older = jsonObject(fromWpr().toStoredText());
    delete older.id;
    expect(OpenISDProject.textWithId(JSON.stringify(older), 'the-id', engine)).toBe(JSON.stringify({id: 'the-id', ...older}));
  });

  it('is added to an indented .owpr text by textWithId, keeping the indent', () => {
    const p = fromWpr();
    const older = jsonObject(p.toOwprText());
    delete older.id;
    const text = OpenISDProject.textWithId(JSON.stringify(older, null, 2), 'the-id', engine);
    expect(text).toBe(JSON.stringify({id: 'the-id', ...older}, null, 2));
  });

  it('textWithId answers null for a text that is not a project session', () => {
    expect(OpenISDProject.textWithId('not json', 'x', engine)).toBeNull();
    expect(OpenISDProject.textWithId('[]', 'x', engine)).toBeNull();
  });
});
