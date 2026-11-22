/**
 * The text browser storage holds for a project: one compact line, no `dq_calculated` (the load
 * works it out again), everything else exactly as the project states it.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import {OpenISDProject} from '../../../domain/project/openISDProject.js';
import {NULL_GUID} from '../../../domain/project/nullDriverId.js';
import {compactedStoredText} from '../../../domain/project/projectSerialization.js';
import {WinIsdProjectConverter} from '../../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const wprText = readFileSync(join(here, '..', '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');

function project(): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wprText);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

/** `text` as JSON with every `dq_calculated` removed, for comparing what is stored. */
function withoutDq(text: string): unknown {
  return JSON.parse(text, (key: string, value: unknown): unknown => (key === 'dq_calculated' ? undefined : value));
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

function loaded(text: string): OpenISDProject {
  const p = OpenISDProject.fromOwprText(text, engine);
  if (Array.isArray(p)) throw new Error('refused: ' + p.join('; '));
  return p;
}

describe('OpenISDProject.toStoredText', () => {
  it('is one compact line with no dq_calculated', () => {
    const text = project().toStoredText();
    expect(text).not.toContain('\n');
    expect(text).not.toContain('dq_calculated');
    expect(text.length).toBeLessThan(project().toOwprText().length / 2);
  });

  it('reads back equal to the project minus dq_calculated', () => {
    const original = project();
    const back = loaded(original.toStoredText());
    expect(withoutDq(back.toOwprText())).toEqual(withoutDq(original.toOwprText()));
  });

  // BUG_20261013_project-driver-uuid-reminted-on-read: the embedded driver keeps the id it was stored with.
  it('is the same text, byte for byte, after a load and a store', () => {
    const text = project().toStoredText();
    expect(loaded(text).toStoredText()).toBe(text);
  });

  it('holds the null GUID as the embedded driver id', () => {
    expect(jsonAt(project().toStoredText(), 'saved', 'driverEmbedding', 'device', 'uuid', 'value')).toBe(NULL_GUID);
  });

  it('normalises an old text with a random embedded driver id to the null GUID on read', () => {
    const idPath = ['driverEmbedding', 'device', 'uuid'];
    const old = project().toStoredText().replaceAll(NULL_GUID, 'ed26036f-a592-4e91-b4cb-f6b6031fa003');
    expect(old).not.toContain(NULL_GUID);
    const back = loaded(old).toStoredText();
    expect(jsonAt(back, 'saved', ...idPath, 'value')).toBe(NULL_GUID);
    expect(jsonAt(back, 'edited', ...idPath, 'value')).toBe(NULL_GUID);
  });

  it('keeps the edited state', () => {
    const p = project();
    p.name.set('renamed');
    const back = loaded(p.toStoredText());
    expect(back.isModified()).toBe(true);
    expect(back.name.value).toBe('renamed');
  });
});

describe('compactedStoredText', () => {
  it('rewrites a pretty .owpr text as the stored text', () => {
    const p = project();
    expect(compactedStoredText(p.toOwprText())).toBe(compactedStoredText(p.toStoredText()));
    expect(JSON.parse(compactedStoredText(p.toOwprText()) ?? '')).toEqual(JSON.parse(p.toStoredText()));
  });

  it('is the same text for a text already stored', () => {
    const stored = project().toStoredText();
    expect(compactedStoredText(stored)).toBe(stored);
  });

  it.each(['', 'not json', '[]', '{}', '{"saved": 3}', 'null'])('is null for %j, which is not a project', text => {
    expect(compactedStoredText(text)).toBeNull();
  });

  it('leaves a text whose project the schema does not accept as it was, for the repo to report', () => {
    const text = compactedStoredText('{"saved": {}}');
    expect(text).not.toBeNull();
    expect(text).toContain('"saved"');
  });

  it('textWithId() still gives a JSON object the id, first and with nothing else changed, when the strict read refuses it (QO315: never refuse data we can fix)', () => {
    expect(OpenISDProject.textWithId('{"a": 1}', 'some-id', engine)).toBe('{"id":"some-id","a":1}');
    expect(OpenISDProject.textWithId('{"id":"old","a": 1}', 'some-id', engine)).toBe('{"id":"some-id","a":1}');
  });

  it('textWithId() is null for text that is not a JSON object', () => {
    expect(OpenISDProject.textWithId('[1]', 'some-id', engine)).toBeNull();
    expect(OpenISDProject.textWithId('not json', 'some-id', engine)).toBeNull();
  });
});
