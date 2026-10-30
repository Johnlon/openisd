import {describe, expect, test, vi} from 'vitest';
import {buildProjectsArchive, parseProjectsArchive} from '../../domain/project/projectsArchive.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '@openisd/design/engine';

describe('projectsArchive', () => {
  const engine = createEngine();
  const readProject = (text: string) => OpenISDProject.fromOwprText(text, engine);

  test('round trips projects', () => {
    const p1 = ProjectBuilder.empty(engine);
    p1.name.set('Synthetic 1');
    const p2 = ProjectBuilder.empty(engine);
    p2.name.set('Synthetic 2');

    const bytes = buildProjectsArchive([p1, p2]);
    const parsed = parseProjectsArchive(bytes, readProject);
    
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    expect(parsed.projects.length).toBe(2);
    
    expect(parsed.projects[0].name.value).toBe('Synthetic 1');
    expect(parsed.projects[1].name.value).toBe('Synthetic 2');
  });

  test('refuses bad file', () => {
    const badBytes = new TextEncoder().encode('not json');
    const parsed = parseProjectsArchive(badBytes, readProject);
    expect(parsed.kind).toBe('failed');
    if (parsed.kind !== 'failed') return;
    expect(parsed.reason).toBeDefined();
  });
});

describe('parseProjectsArchive: refusals', () => {
  const never = vi.fn((_text: string): OpenISDProject | string[] => ['unused']);

  test('bytes that are not valid UTF-8 are refused as such, not as bad JSON', () => {
    const invalid = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
    expect(parseProjectsArchive(invalid, never)).toEqual({kind: 'failed', reason: 'not valid UTF-8'});
    expect(never).not.toHaveBeenCalled();
  });

  test.each([
    ['null', 'null', 'not a project archive'],
    ['an array', '[1]', 'not a project archive'],
    ['no version', '{"projects":[]}', 'not a project archive'],
    ['another version', '{"version":2,"projects":[]}', 'unsupported version: 2'],
    ['projects not a list', '{"version":1,"projects":4}', 'archive is malformed'],
    ['a project without text', '{"version":1,"projects":[{"text":3}]}', 'archive is malformed'],
    ['a project that is not an object', '{"version":1,"projects":[5]}', 'archive is malformed'],
  ])('%s', (_name, text, reason) => {
    expect(parseProjectsArchive(text, never)).toEqual({kind: 'failed', reason});
    expect(never).not.toHaveBeenCalled();
  });

  test('names the first problem of a project that will not read', () => {
    const read = vi.fn((_text: string): OpenISDProject | string[] => ['bad field', 'second']);
    const result = parseProjectsArchive('{"version":1,"projects":[{"text":"abc"}]}', read);
    expect(result).toEqual({kind: 'failed', reason: 'could not parse a project: bad field'});
    expect(read).toHaveBeenCalledWith('abc');
  });
});
