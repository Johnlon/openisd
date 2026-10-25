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
  return JSON.parse(text, (key: string, value: unknown): unknown => (key === 'dq_calculated' || key === 'uuid' ? undefined : value));
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

  it('is the same length every time the same project is stored, whatever id the driver is read with', () => {
    const original = project();
    const sizes = new Set<number>();
    let text = original.toStoredText();
    for (let round = 0; round < 5; round++) {
      sizes.add(new TextEncoder().encode(text).length);
      text = loaded(text).toStoredText();
      sizes.add(new TextEncoder().encode(project().toStoredText()).length);
    }
    expect([...sizes]).toHaveLength(1);
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
});
