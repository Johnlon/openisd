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
 * THE ENGINE HAS ONE DOOR: `packages/design/engine/index.ts`, which exports `Engine` and the
 * types its own method signatures name. Nothing else.
 *
 * `index.ts` alone does not enforce that. A caller can walk straight past it with a relative
 * path — `../engine/sweep.js`, `@openisd/design/engine/air.js` — and reach any function inside.
 * Every module in there still exports its functions, so the door is only a door if something
 * checks that people use it.
 *
 * This is that check (John Lonergan, 2026-08-27: "add an arch test to ensure no ../ imports that
 * violate the export enforcement").
 *
 * It is a TEXT search on purpose: an import specifier IS a string, and what is being tested is
 * which string was written, not which symbol it resolves to.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

/** Every source file in the repo's packages, excluding build output and dependencies. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx|vue|mts|cts)$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(path.join(repoRoot, 'packages'));
  return out;
}

/** Every module specifier a file imports or re-exports from. */
function specifiersIn(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(m => m[1]!);
}

/** Where a relative specifier lands, so a path INTO the engine can be recognised however it is
 *  spelled — `../engine/sweep.js`, `./engine/air.js`, `../../design/engine/driver.js`. */
function resolvedFrom(file: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  return path.resolve(path.dirname(file), spec);
}

const engineDir = path.join(packageRoot, 'engine');
const engineDoor = path.join(engineDir, 'index.ts');

/** Is this specifier reaching a module INSIDE the engine that is not its door? */
function bypassesTheDoor(file: string, spec: string): boolean {
  // The package-name form: only `@openisd/design/engine` is a door. A deeper subpath is not.
  if (spec.startsWith('@openisd/design/engine/')) return true;
  if (spec === '@openisd/design/engine') return false;

  const landed = resolvedFrom(file, spec);
  if (!landed) return false;
  const withoutExt = landed.replace(/\.js$/, '');
  const inEngine = withoutExt === engineDir || withoutExt.startsWith(engineDir + path.sep);
  if (!inEngine) return false;

  const isDoor = withoutExt === engineDir
    || withoutExt === engineDoor.replace(/\.ts$/, '')
    || withoutExt === path.join(engineDir, 'index');
  return !isDoor;
}

describe('the engine is reachable only through its door', () => {
  it('no file outside packages/design/engine imports an engine module directly', () => {
    const offences: string[] = [];

    for (const file of sourceFiles()) {
      // A file INSIDE the engine may import its siblings — that is the implementation talking
      // to itself, which the door exists to hide, not to prevent.
      if (file.startsWith(engineDir + path.sep)) continue;

      for (const spec of specifiersIn(file)) {
        if (!bypassesTheDoor(file, spec)) continue;
        const rel = path.relative(repoRoot, file);
        offences.push(
          `${rel} imports '${spec}'\n` +
          `    http://localhost:8000/openisd/${rel.split(path.sep).join('/')}`);
      }
    }

    expect(offences, [
      "The engine exports ONE thing: the `Engine` class, plus the types its own method",
      "signatures name (packages/design/engine/index.ts). Reaching past that door with a",
      "relative path or a deep subpath gets at a function that is meant to be internal, and",
      "the export list stops meaning anything. Import `@openisd/design/engine` and call a",
      "method on `Engine`. If Engine does not offer what you need, that is a MISSING METHOD —",
      "add it there rather than reaching around it.",
    ].join(' ')).toEqual([]);
  });

  it('the door exports Engine, and no loose functions', () => {
    const door = fs.readFileSync(engineDoor, 'utf8');

    expect(door).toMatch(/export\s*\{\s*Engine\s*\}/);
    // `export *` would re-open everything the door exists to close — and is banned outright
    // anyway (QO86).
    expect(door).not.toMatch(/export\s*\*/);

    // Every VALUE export must be Engine or LossMode (a class whose statics ARE the modes, so a
    // caller cannot pass one without it). Anything else is a loose function escaping.
    const valueExports = [...door.matchAll(/^export \{([^}]*)\}/gm)]
      .flatMap(m => m[1]!.split(',').map(s => s.trim()))
      .filter(Boolean);
    expect(valueExports.sort()).toEqual(['Engine', 'LossMode']);
  });

  it('can actually see the repo it is meant to guard', () => {
    // A gate that silently scans nothing passes forever.
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(50);
    expect(files.some(f => f.includes(path.join('packages', 'ui')))).toBe(true);
    expect(files.some(f => f.includes(path.join('packages', 'design')))).toBe(true);
  });

  it('recognises a bypass however it is spelled', () => {
    // Non-vacuity: the gate is proved able to catch each shape, rather than trusted to.
    const someDomainFile = path.join(packageRoot, 'domain', 'project.ts');
    expect(bypassesTheDoor(someDomainFile, '../engine/sweep.js')).toBe(true);
    expect(bypassesTheDoor(someDomainFile, '@openisd/design/engine/air.js')).toBe(true);

    // ...and to let the door itself through.
    expect(bypassesTheDoor(someDomainFile, '../engine/index.js')).toBe(false);
    expect(bypassesTheDoor(someDomainFile, '@openisd/design/engine')).toBe(false);
    expect(bypassesTheDoor(someDomainFile, './cell.js')).toBe(false);
  });
});
