/**
 * Shared scaffolding for the shape gates that walk the whole app's shipped source with
 * ts-morph — `architecture-no-forwards.test.ts` and `architecture-engine-parameter-ratchet.test.ts`.
 * Parsing ~30k lines is the expensive part; each gate parses once and asks the tree.
 */
import * as path from 'node:path';
import * as url from 'node:url';
import {Project} from 'ts-morph';

export const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
export const repoRoot = path.resolve(packageRoot, '..', '..');

/** The app's shipped TypeScript: the design package's domain and engine, and the UI's source.
 *  Tests, build output and `.vue` files (their script blocks are not TypeScript modules to
 *  ts-morph) are outside what these gates look at. */
export function shippedSource(): Project {
  const project = new Project({skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true});
  project.addSourceFilesAtPaths([
    path.join(packageRoot, 'domain', '**', '*.ts'),
    path.join(packageRoot, 'engine', '**', '*.ts'),
    path.join(packageRoot, 'fields', '**', '*.ts'),
    path.join(repoRoot, 'packages', 'ui', 'src', '**', '*.ts'),
  ]);
  return project;
}

export function relPath(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

/** A ratchet: the gate passes on exactly the recorded baseline. A site not in it is a new
 *  offence; a baselined site that no longer exists must be struck from the list, so the
 *  baseline only ever shrinks. */
export function ratchet(found: readonly string[], baseline: ReadonlySet<string>): {added: string[]; gone: string[]} {
  const seen = new Set(found);
  return {
    added: found.filter(k => !baseline.has(k)).sort(),
    gone: [...baseline].filter(k => !seen.has(k)).sort(),
  };
}
