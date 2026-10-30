// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one. Name the defect, then repair it (put the file in the tsconfig
// program), or STOP and report. Never exclude the file to make this pass.

/**
 * EVERY .ts FILE UNDER packages/design IS IN THE DESIGN TYPESCRIPT PROGRAM.
 *
 * `npm run typecheck` checks only the files `packages/design/tsconfig.json` selects. A file left
 * out is not type-checked, and type-aware lint cannot parse it under the project service. Before
 * this gate, `winisd/bridge.ts` (the embedded-V8 entry) and two config files were out of the
 * program unnoticed.
 */
import {describe, expect, it} from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as url from 'node:url';
import ts from 'typescript';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const NOT_SOURCE = new Set(['node_modules', 'build', 'dist']);

/** Every .ts file under `dir`, skipping dependency and build output folders. */
function sourceFilesOnDisk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!NOT_SOURCE.has(entry.name)) found.push(...sourceFilesOnDisk(full));
    } else if (entry.name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

/** The files the tsconfig at `configPath` selects. */
function programFiles(configPath: string): Set<string> {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  return new Set(parsed.fileNames.map(name => path.normalize(name)));
}

/** The .ts files under `root` that the tsconfig at `configPath` does not select. */
function filesOutsideProgram(root: string, configPath: string): string[] {
  const program = programFiles(configPath);
  return sourceFilesOnDisk(root).filter(file => !program.has(path.normalize(file))).sort();
}

describe('every design source file is type-checked', () => {
  it('names a file the tsconfig include misses', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsprogram-'));
    fs.mkdirSync(path.join(dir, 'a'));
    fs.mkdirSync(path.join(dir, 'b'));
    fs.writeFileSync(path.join(dir, 'a', 'x.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'b', 'y.ts'), 'export const y = 1;\n');
    const config = path.join(dir, 'tsconfig.json');
    fs.writeFileSync(config, JSON.stringify({include: ['a/**/*.ts']}));
    expect(filesOutsideProgram(dir, config)).toEqual([path.join(dir, 'b', 'y.ts')]);
    fs.rmSync(dir, {recursive: true});
  });

  it('packages/design/tsconfig.json selects every .ts file under packages/design', () => {
    expect(filesOutsideProgram(packageRoot, path.join(packageRoot, 'tsconfig.json'))).toEqual([]);
  });
});
