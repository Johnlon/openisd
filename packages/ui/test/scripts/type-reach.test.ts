/**
 * `vitest --changed` follows the import graph, and type-only imports are erased before it looks: a test whose fixtures
 * are object literals of a record shape never imports the changed file at run time, so changing the shape reached none
 * of them (T815: an index-row shape change broke persistence and ui/logic fixtures nobody ran). The unit gate
 * (scripts/land/unit-changed.sh) therefore also runs every test that names a type whose declaration the change touched.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {changedLinesOfDiff, changedTypeNames, exportedTypeBlocks, testsNaming} from '../../../../scripts/lib/typeReach.mjs';

const source = [
  "import type {X} from './x';",          // 1
  'export interface IndexRow {',          // 2
  '  id: string;',                        // 3
  '  size: number;',                      // 4
  '}',                                    // 5
  '',                                     // 6
  "export type Kind = 'a' | 'b';",        // 7
  'export const LIMIT = 3;',              // 8
  'export enum Mode {',                   // 9
  '  On,',                                // 10
  '}',                                    // 11
].join('\n');

describe('exportedTypeBlocks', () => {
  it('finds each exported interface, type alias and enum with its line range', () => {
    assert.deepEqual(exportedTypeBlocks(source), [
      {name: 'IndexRow', start: 2, end: 6},
      {name: 'Kind', start: 7, end: 7},
      {name: 'Mode', start: 9, end: 11},
    ]);
  });
});

describe('changedTypeNames', () => {
  it('names a type when a changed line is inside its body, not only on its first line', () => {
    assert.deepEqual(changedTypeNames(source, [4]), ['IndexRow']);
  });
  it('names nothing when the change is in a constant or an import', () => {
    assert.deepEqual(changedTypeNames(source, [1, 8]), []);
  });
  it('names every type a change spans', () => {
    assert.deepEqual(changedTypeNames(source, [3, 10]), ['IndexRow', 'Mode']);
  });
});

describe('changedLinesOfDiff', () => {
  it('reads the new-file line numbers of every hunk of a zero-context diff', () => {
    const diff = '@@ -3,0 +4,2 @@ x\n+a\n+b\n@@ -9 +11 @@\n-c\n+d\n@@ -20,2 +22,0 @@\n-e\n-f\n';
    assert.deepEqual(changedLinesOfDiff(diff), [4, 5, 11, 22, 23]);
  });
});

describe('testsNaming', () => {
  const files = [
    {path: 'packages/persistence/test/a.test.ts', text: "const row: IndexRow = {id: '1'};"},
    {path: 'packages/ui/test/logic/b.test.ts', text: 'const unrelated = 1; // IndexRows are plural'},
    {path: 'packages/ui/test/logic/c.test.ts', text: "import type {IndexRow} from '../x';"},
  ];
  it('lists the files that name a type as a whole word, and no others', () => {
    assert.deepEqual(testsNaming(['IndexRow'], files), ['packages/persistence/test/a.test.ts', 'packages/ui/test/logic/c.test.ts']);
  });
  it('lists nothing for no names', () => {
    assert.deepEqual(testsNaming([], files), []);
  });
});
