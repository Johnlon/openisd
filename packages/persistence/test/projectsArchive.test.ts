import {describe, expect, test} from 'vitest';
import {buildProjectsArchive, parseProjectsArchive} from '../src/repos/projectsArchive.js';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

describe('projectsArchive', () => {
  const engine = createEngine();

  test('round trips projects', () => {
    const p1 = ProjectBuilder.empty(engine);
    p1.name.set('Synthetic 1');
    const p2 = ProjectBuilder.empty(engine);
    p2.name.set('Synthetic 2');

    const bytes = buildProjectsArchive([p1, p2]);
    const parsed = parseProjectsArchive(bytes, engine);
    
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    expect(parsed.projects.length).toBe(2);
    
    expect(parsed.projects[0].name.value).toBe('Synthetic 1');
    expect(parsed.projects[1].name.value).toBe('Synthetic 2');
  });

  test('refuses bad file', () => {
    const badBytes = new TextEncoder().encode('not json');
    const parsed = parseProjectsArchive(badBytes, engine);
    expect(parsed.kind).toBe('failed');
    if (parsed.kind !== 'failed') return;
    expect(parsed.reason).toBeDefined();
  });
});
