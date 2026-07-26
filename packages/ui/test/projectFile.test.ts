/**
 * Project name ↔ file name equivalence.
 *
 * The FILE NAME is the source of truth for a project's name: opening `glob 3.owpr`
 * must yield the project name `glob 3`, and saving the project `glob 3` must suggest
 * `glob 3.owpr`. That round trip is the contract — a name the user can type and a
 * file name they can read must be the same string, spaces and all.
 *
 * The only characters a project name loses on the way to disk are the ones an OS filename
 * genuinely cannot hold (`<>:"/\|?*`, control chars, trailing dot/space). Nothing else is
 * "sanitised" — the historic `[^\w.-]+ → _` rule silently turned `glob 3` into `glob_3`,
 * breaking the equivalence on the most ordinary name there is.
 */
import { describe, it, expect } from 'vitest';
import {
  PROJECT_EXT, projectNameFromFilename, projectFilename, copyOfName, uniqueName,
} from '../src/utils/projectFile.js';

describe('projectNameFromFilename — the file name names the project', () => {
  it('strips the full .owpr suffix', () => {
    expect(projectNameFromFilename('glob3.owpr')).toBe('glob3');
  });

  it('KEEPS spaces — "glob 3.owpr" is the project "glob 3", not "glob_3"', () => {
    expect(projectNameFromFilename('glob 3.owpr')).toBe('glob 3');
  });

  it('accepts a bare .json project too (a file the user renamed)', () => {
    expect(projectNameFromFilename('glob3.json')).toBe('glob3');
  });

  it('takes the basename — a Windows or POSIX path never leaks into the name', () => {
    expect(projectNameFromFilename('C:\\tmp\\glob 3.owpr')).toBe('glob 3');
    expect(projectNameFromFilename('/mnt/c/tmp/glob 3.owpr')).toBe('glob 3');
  });

  it('matches the suffix case-insensitively (Windows file systems are not case-sensitive)', () => {
    expect(projectNameFromFilename('Glob3.OWPR')).toBe('Glob3');
  });

  it('keeps interior dots — only the trailing project extension is the extension', () => {
    expect(projectNameFromFilename('v1.2 tuning.owpr')).toBe('v1.2 tuning');
  });

  it('a file with no recognised extension names the project verbatim', () => {
    expect(projectNameFromFilename('glob3')).toBe('glob3');
  });
});

describe('projectFilename — the project name names the file', () => {
  it('appends the project extension', () => {
    expect(projectFilename('glob3')).toBe('glob3' + PROJECT_EXT);
  });

  it('preserves spaces', () => {
    expect(projectFilename('glob 3')).toBe('glob 3.owpr');
  });

  it('replaces ONLY characters a filename cannot hold', () => {
    expect(projectFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j.owpr');
  });

  it('drops control characters and trailing dots/spaces (illegal on Windows)', () => {
    expect(projectFilename('bad\u0007name. ')).toBe('bad_name.owpr');
  });

  it('falls back to "design" when the name is empty or all-illegal', () => {
    expect(projectFilename('')).toBe('design.owpr');
    expect(projectFilename('   ')).toBe('design.owpr');
    expect(projectFilename('///')).toBe('design.owpr');
  });
});

describe('round trip — a legal name survives name → file → name unchanged', () => {
  for (const name of ['glob', 'glob 3', 'v1.2 tuning', 'SEAS L19 - sealed 12L', "John's box"]) {
    it(`"${name}"`, () => {
      expect(projectNameFromFilename(projectFilename(name))).toBe(name);
    });
  }
});

describe('copyOfName / uniqueName — copying a project', () => {
  it('prepends "Copy of"', () => {
    expect(copyOfName('glob')).toBe('Copy of glob');
  });

  it('copying a copy names it from the CURRENT project, so it never nests unboundedly', () => {
    expect(copyOfName('Copy of glob')).toBe('Copy of Copy of glob');   // only if the copy IS the open project
  });

  it('uniqueName leaves a free name alone', () => {
    expect(uniqueName('Copy of glob', [])).toBe('Copy of glob');
    expect(uniqueName('Copy of glob', ['glob'])).toBe('Copy of glob');
  });

  it('uniqueName suffixes a taken name, and keeps counting', () => {
    expect(uniqueName('Copy of glob', ['Copy of glob'])).toBe('Copy of glob (2)');
    expect(uniqueName('Copy of glob', ['Copy of glob', 'Copy of glob (2)'])).toBe('Copy of glob (3)');
  });
});
