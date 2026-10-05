// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
// "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// deleting the test are one act under different names — making the red go away instead of making
// the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * The UI builds the engine in two places only: `logic/appState.ts`, the app's one engine, and
 * `logic/sweepWorker.ts`, whose thread cannot share it. Any other `createEngine(` or `new Engine(`
 * under `packages/ui/src` is a second engine beside the app's, with its own settings.
 * (`bugs/archive/BUG_20260927_ui_constructs_ten_more_engines_beside_the_one.md`.)
 *
 * Shape under test, via the TypeScript AST: a call to `createEngine`, or a `new Engine`
 * expression. The import is not banned: the engine's types and the text mappers import freely.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Node, Project as TsProject, SyntaxKind, type SourceFile} from 'ts-morph';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/** The files that may build an engine, relative to `packages/ui/src`. */
const ENGINE_BUILDERS = ['logic/appState.ts', 'logic/sweepWorker.ts'];

/** Where `file` builds an engine: one `line: text` entry per `createEngine(...)` or `new Engine(...)`. */
function engineConstructions(file: SourceFile): string[] {
  const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === 'createEngine');
  const news = file.getDescendantsOfKind(SyntaxKind.NewExpression)
    .filter((expr) => expr.getExpression().getText() === 'Engine');
  return [...calls, ...news].map((node: Node) => `${node.getStartLineNumber()}: ${node.getText().split('\n')[0]}`);
}

describe('one engine — the UI builds it in two places only', () => {
  it('only the app state and the sweep worker build an engine', () => {
    const project = new TsProject({skipAddingFilesFromTsConfig: true});
    project.addSourceFilesAtPaths(join(UI_SRC, '**', '*.ts'));
    const builders = project.getSourceFiles()
      .filter((file) => engineConstructions(file).length > 0)
      .map((file) => relative(UI_SRC, file.getFilePath()).split('\\').join('/'))
      .sort();
    assert.deepEqual(builders, ENGINE_BUILDERS);
  });

  it('sees both ways of building one', () => {
    const project = new TsProject({useInMemoryFileSystem: true});
    const file = project.createSourceFile('bad.ts',
      "const a = createEngine();\nconst b = new Engine({});\nconst c = engine.simulation;\n");
    assert.deepEqual(engineConstructions(file), ['1: createEngine()', '2: new Engine({})']);
  });
});
