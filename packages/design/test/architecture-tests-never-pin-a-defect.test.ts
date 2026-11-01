/**
 * A test asserts the RIGHT behaviour, never the current wrong one (John, 1 Nov 2026, on
 * bugs/BUG_20261030_parse-repairing-crashes-on-symbol-path.md: "this is criminal"). A defect we
 * cannot fix now is the right expectation under `it.fails`, which names its bug file.
 */
import {describe, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {repoRoot} from './architecture-gate-support.js';
import {defectPinFindings, type TestFile} from './architecture-defect-pin-scan.js';

describe('the scan flags a test that holds a defect in place', () => {
  const at = (text: string): readonly TestFile[] => [{path: 'x.test.ts', text}];

  it('flags it.fails and test.fails with no BUG_ file', () => {
    expect(defectPinFindings(at("it.fails('a thing', () => {});\ntest.fails('b', () => {});"))).toHaveLength(2);
  });
  it('accepts it.fails naming a BUG_ file in the title or on the next line', () => {
    expect(defectPinFindings(at("it.fails('a BUG_20261101_x', () => {});"))).toEqual([]);
    expect(defectPinFindings(at("it.fails(`${t}`, () => {});\n// BUG_20261101_x"))).toEqual([]);
  });
  it.each(['known defect', 'Known Bug', 'documents the bug', 'pins the bug', 'current (wrong)', 'asserts the throw'])('flags the phrase "%s"', (p) => {
    expect(defectPinFindings(at(`// ${p}`))).toHaveLength(1);
    expect(defectPinFindings(at(`// ${p} BUG_20261101_x`))).toEqual([]);
  });
});

describe('no test in packages/ pins a defect', () => {
  it('every it.fails names a BUG_ file and no test calls a defect "known"', () => {
    const own = ['architecture-defect-pin-scan.ts', 'architecture-tests-never-pin-a-defect.test.ts'];
    const paths = execFileSync('git', ['ls-files', 'packages/**/*.test.ts', 'packages/**/*.spec.ts', 'packages/**/test/**/*.ts'], {cwd: repoRoot, encoding: 'utf8'})
      .split('\n').filter((p) => p !== '' && !own.some((o) => p.endsWith(o)));
    const files = paths.map((path): TestFile => ({path, text: readFileSync(join(repoRoot, path), 'utf8')}));
    expect(defectPinFindings(files)).toEqual([]);
  });
});
