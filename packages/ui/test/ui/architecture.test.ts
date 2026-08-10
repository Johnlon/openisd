/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/app-shell/spec.md?html
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const COMPOSABLES_DIRS = [join(UI_SRC, 'logic'), join(UI_SRC, 'db')];
const SHELLS_DIR = join(UI_SRC, 'ui', 'shells');

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  function recurse(current: string) {
    const list = readdirSync(current);
    for (const file of list) {
      const fullPath = join(current, file);
      const stat = statSync(fullPath);
      if (stat && stat.isDirectory()) {
        recurse(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.vue')) {
        results.push(fullPath);
      }
    }
  }
  recurse(dir);
  return results;
}

describe('UI Architecture Boundaries', () => {
  it('composables have no UI/view component dependency (.vue)', () => {
    const files: string[] = [];
    for (const dir of COMPOSABLES_DIRS) {
      const list = readdirSync(dir).filter(f => f.endsWith('.ts'));
      for (const f of list) {
        files.push(join(dir, f));
      }
    }
    assert.ok(files.length > 0, 'No composables found to test');
    
    // Composables must not import .vue view components
    const forbiddenVueImport = /from\s+['"][^'"]*\.vue['"]/;
    
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      assert.ok(
        !forbiddenVueImport.test(text),
        `Composable ${f} imports a .vue view component — logic must stay decoupled from presentation`
      );
    }
  });

  it('skins / shells are independent and do not cross-import each other', () => {
    const classicFiles = getAllFiles(join(SHELLS_DIR, 'classic'));
    const originalFiles = getAllFiles(join(SHELLS_DIR, 'original'));

    assert.ok(classicFiles.length > 0, 'No classic skin files found to test');
    assert.ok(originalFiles.length > 0, 'No original skin files found to test');

    const importsOriginal = /from\s+['"][^'"]*\/original\/[^'"]*['"]/;
    const importsClassic = /from\s+['"][^'"]*\/classic\/[^'"]*['"]/;

    for (const file of classicFiles) {
      const text = readFileSync(file, 'utf8');
      const relPath = file.substring(UI_SRC.length + 1);
      assert.ok(
        !importsOriginal.test(text),
        `Classic shell file ${relPath} imports from original shell — skins must remain decoupled`
      );
    }

    for (const file of originalFiles) {
      const text = readFileSync(file, 'utf8');
      const relPath = file.substring(UI_SRC.length + 1);
      assert.ok(
        !importsClassic.test(text),
        `Original shell file ${relPath} imports from classic shell — skins must remain decoupled`
      );
    }
  });
});
