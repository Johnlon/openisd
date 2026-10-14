// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names.

/**
 * John's ruling (12 Oct 2026, T058): a backup MUST ALWAYS take place before a write that removes
 * or replaces a stored key. This gate keeps a future repo from bypassing it.
 *
 * In `src/repos`, a call to `set` or `remove` on a key-value storage must be one of:
 *   - inside the function handed to `StorageBackup.guard` (backed up first);
 *   - in a module whose whole job is the store itself (the stamped store, the backup, the log,
 *     the opening of the store), which the stamped store and backup guard stand behind;
 *   - an ordinary save of the repo's own data, counted below. The count is a ratchet: it cannot
 *     rise, so a new unguarded write fails; it must fall when one is guarded.
 * `remove` is never an ordinary save.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Node, Project as TsProject, SyntaxKind} from 'ts-morph';

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Modules that ARE the guarded store: they write storage as their one job. */
const STORE_MODULES: ReadonlySet<string> = new Set(['stampedStore.ts', 'storageBackup.ts', 'storageLog.ts', 'storeGate.ts']);

/** Ordinary saves of a repo's own data (never a removal), per module. A ratchet. */
const ORDINARY_SAVES: ReadonlyMap<string, number> = new Map<string, number>([
  ['appSettingsRepo.ts', 1], // save Options
  ['prefsRepo.ts', 2], // favourites
  ['projectRepo.ts', 1], // open sessions; project saves go through backup.write (T075)
  ['savedEntries.ts', 1], // save a My Drivers / My Passive Radiators entry
  ['viewStateRepo.ts', 1], // save the view
]);

interface Site { readonly file: string; readonly line: number; readonly call: string; }

function unguardedWrites(): Site[] {
  const project = new TsProject({tsConfigFilePath: join(PACKAGE, 'tsconfig.json'), skipAddingFilesFromTsConfig: true});
  project.addSourceFilesAtPaths(join(PACKAGE, 'src', 'repos', '*.ts'));
  const sites: Site[] = [];
  for (const file of project.getSourceFiles()) {
    if (STORE_MODULES.has(basename(file.getFilePath()))) continue;
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      if (!Node.isPropertyAccessExpression(callee)) continue;
      const verb = callee.getName();
      if (verb !== 'set' && verb !== 'remove') continue;
      const receiverType = callee.getExpression().getType().getText();
      if (!/KeyValueStorage|ListableStorage/.test(receiverType)) continue;
      const guarded = call.getAncestors().some(ancestor => {
        if (!Node.isCallExpression(ancestor)) return false;
        const outer = ancestor.getExpression();
        return Node.isPropertyAccessExpression(outer) && outer.getName() === 'guard';
      });
      if (guarded) continue;
      sites.push({file: basename(file.getFilePath()), line: call.getStartLineNumber(), call: `${callee.getText()}(…)`});
    }
  }
  return sites;
}

describe('every write that removes or replaces a stored key goes through the backup guard', () => {
  const sites = unguardedWrites();

  it('no removal is unguarded', () => {
    const removals = sites.filter(s => s.call.endsWith('.remove(…)'));
    assert.deepEqual(removals, [], 'Wrap the removal in backup.guard(() => …): a backup must always come first.');
  });

  it('unguarded sets are only the ordinary saves counted here, and no more', () => {
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.file, (counts.get(s.file) ?? 0) + 1);
    const found = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
    const allowed = [...ORDINARY_SAVES.entries()].sort(([a], [b]) => a.localeCompare(b));
    assert.deepEqual(found, allowed, `Unguarded storage.set calls: ${JSON.stringify(sites)}. A write that replaces a stored key goes in backup.guard; an ordinary save is counted in ORDINARY_SAVES.`);
  });
});
