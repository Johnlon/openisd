// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
// "Make it pass" is not one of the two: loosening a threshold, widening an exclude, raising a
// ceiling, renaming so a matcher stops firing, or deleting this test are one act under different
// names — making the red go away instead of making the code right. After ANY edit to this file,
// break what it guards and watch it fail, or it is not known to test anything. See AGENTS.md
// "Every architecture test exists to catch the AI".

/**
 * Coverage is only worth anything if it cannot be gamed. Three ways to game it, three checks:
 *
 *   1. An ignore comment (v8 / c8 / istanbul) hides a line from the report. Zero allowed in packages/.
 *   2. Editing the coverage configs: lowering a threshold, turning perFile off, excluding a file,
 *      narrowing include. The literal shape of both configs is pinned here (parsed with ts-morph).
 *   3. Suppressing the checkers instead of fixing the code: eslint-disable, @ts-expect-error,
 *      @ts-ignore, @ts-nocheck. Counted per package against a ceiling that only goes down.
 *
 * The ignore-comment patterns are built by concatenation so this file does not contain the
 * literal strings and cannot match itself; the file is also excluded by path from every count.
 */
import {describe, expect, it} from 'vitest';
import {Node, Project, SyntaxKind, type ObjectLiteralExpression} from 'ts-morph';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '..');
const SELF = 'packages/design/test/architecture-no-coverage-gaming.test.ts';

function trackedUnderPackages(): string[] {
  return execFileSync('git', ['ls-files', 'packages'], {cwd: repoRoot, encoding: 'utf8'})
    .split('\n')
    .filter((f) => f !== '' && f !== SELF);
}

interface Hit {file: string; line: number; text: string}

function scan(files: readonly string[], pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(path.join(repoRoot, file), 'utf8');
    } catch {
      continue; // tracked but removed from disk in this tree; nothing to scan
    }
    text.split('\n').forEach((line, i) => {
      if (pattern.test(line)) hits.push({file, line: i + 1, text: line.trim().slice(0, 100)});
    });
  }
  return hits;
}

const fmt = (h: Hit): string => `${h.file}:${h.line}  ${h.text}`;

// Built by concatenation so the literal strings never appear in this file.
const IGNORE_COMMENT = new RegExp(`\\b(${'v' + '8'}|${'c' + '8'}|${'istan' + 'bul'})\\s+${'ig' + 'nore'}\\b`);

describe('coverage cannot be gamed', () => {
  it('can see the tracked files it is meant to guard', () => {
    const files = trackedUnderPackages();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('packages/design/vitest.coverage.config.ts');
    expect(files).toContain('packages/ui/vitest.coverage.config.ts');
  });

  it('has no coverage-ignore comment anywhere under packages/', () => {
    const hits = scan(trackedUnderPackages(), IGNORE_COMMENT);
    expect(
      hits.map(fmt),
      'A coverage-ignore comment hides a line from the report. Remove the comment and write the test that covers the line. Never keep it, never hide it under another spelling.',
    ).toEqual([]);
  });
});

function configObject(rel: string): ObjectLiteralExpression {
  const project = new Project({skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true});
  const source = project.addSourceFileAtPath(path.join(repoRoot, rel));
  const call = source
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((c) => c.getExpression().getText() === 'defineConfig');
  const arg = call?.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) throw new Error(`${rel}: expected defineConfig({...})`);
  return arg;
}

function child(obj: ObjectLiteralExpression, key: string): ObjectLiteralExpression | undefined {
  const prop = obj.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  const init = prop.getInitializer();
  return init && Node.isObjectLiteralExpression(init) ? init : undefined;
}

function stringList(obj: ObjectLiteralExpression, key: string): string[] | undefined {
  const prop = obj.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  const init = prop.getInitializer();
  if (!init || !Node.isArrayLiteralExpression(init)) return undefined;
  return init.getElements().map((e) => (Node.isStringLiteral(e) ? e.getLiteralText() : `<non-literal ${e.getText()}>`));
}

function coverageOf(rel: string): ObjectLiteralExpression {
  const test = child(configObject(rel), 'test');
  const coverage = test && child(test, 'coverage');
  if (!coverage) throw new Error(`${rel}: test.coverage object not found`);
  return coverage;
}

const CONFIG_FIX =
  'Do not edit the coverage config to make a run pass. Write the test that covers the code. Changing this shape is John\'s decision.';

describe('the coverage configs keep their literal shape', () => {
  it('design: perFile and 100 on all four, include engine+domain, no exclude', () => {
    const rel = 'packages/design/vitest.coverage.config.ts';
    const coverage = coverageOf(rel);
    const thresholds = child(coverage, 'thresholds');
    const actual: Record<string, string> = {};
    for (const key of ['perFile', 'statements', 'branches', 'functions', 'lines']) {
      const prop = thresholds?.getProperty(key);
      actual[key] = prop && Node.isPropertyAssignment(prop) ? (prop.getInitializer()?.getText() ?? '<none>') : '<missing>';
    }
    expect(
      actual,
      `${rel}: coverage.thresholds must be perFile true and 100 for statements, branches, functions, lines. ${CONFIG_FIX}`,
    ).toEqual({perFile: 'true', statements: '100', branches: '100', functions: '100', lines: '100'});
    expect(stringList(coverage, 'include'), `${rel}: coverage.include must be exactly engine/** and domain/**. ${CONFIG_FIX}`)
      .toEqual(['engine/**/*.ts', 'domain/**/*.ts']);
    expect(coverage.getProperty('exclude') !== undefined, `${rel}: coverage.exclude must not exist. ${CONFIG_FIX}`).toBe(false);
  });

  it('ui: include src, exactly two excludes each with a reason, json-summary, no thresholds', () => {
    const rel = 'packages/ui/vitest.coverage.config.ts';
    const coverage = coverageOf(rel);
    expect(stringList(coverage, 'include'), `${rel}: coverage.include must be exactly src/**/*.ts. ${CONFIG_FIX}`)
      .toEqual(['src/**/*.ts']);
    expect(stringList(coverage, 'exclude'), `${rel}: coverage.exclude must be exactly src/main.ts and src/types.ts. ${CONFIG_FIX}`)
      .toEqual(['src/main.ts', 'src/types.ts']);

    const exclude = coverage.getProperty('exclude');
    const list = exclude && Node.isPropertyAssignment(exclude) ? exclude.getInitializer() : undefined;
    const elements = list && Node.isArrayLiteralExpression(list) ? list.getElements() : [];
    for (const element of elements) {
      const reasons = element.getLeadingCommentRanges().map((r) => r.getText().replace(/^\/\/\s*/, '').trim());
      expect(
        reasons.some((r) => r.length > 0),
        `${rel}:${element.getStartLineNumber()}  exclude ${element.getText()} needs a reason comment on the line above.`,
      ).toBe(true);
    }

    const reporter = coverage.getProperty('reporter');
    const reporterText = reporter && Node.isPropertyAssignment(reporter) ? (reporter.getInitializer()?.getText() ?? '') : '';
    expect(
      reporterText.includes("'json-summary'"),
      `${rel}: coverage.reporter must contain 'json-summary'; scripts/coverage-ratchet.mjs reads it.`,
    ).toBe(true);
    expect(
      coverage.getProperty('thresholds') !== undefined,
      `${rel}: coverage.thresholds must not exist; scripts/coverage-ratchet.mjs is the threshold. ${CONFIG_FIX}`,
    ).toBe(false);
  });
});

const CEILING_MESSAGE =
  'The ceiling only goes down. Remove the suppression comment and fix the code it hides. When you remove one, lower the constant here. Raising a ceiling is John\'s decision, never the agent\'s.';

const CHECKED_EXT = /\.(ts|vue|mjs)$/;
const ESLINT_DISABLE = /eslint-disable/;
const TS_DIRECTIVE = /@ts-(expect-error|ignore|nocheck)/;

const CEILINGS: ReadonlyArray<{pkg: string; eslintDisable: number; tsDirective: number}> = [
  {pkg: 'design', eslintDisable: 4, tsDirective: 4},
  {pkg: 'persistence', eslintDisable: 0, tsDirective: 0},
  {pkg: 'ui', eslintDisable: 13, tsDirective: 0},
];

describe('suppression comments stay under their ceilings', () => {
  const files = trackedUnderPackages().filter((f) => CHECKED_EXT.test(f));
  for (const ceiling of CEILINGS) {
    const own = files.filter((f) => f.startsWith(`packages/${ceiling.pkg}/`));
    it(`${ceiling.pkg}: eslint-disable at most ${ceiling.eslintDisable}`, () => {
      const hits = scan(own, ESLINT_DISABLE);
      expect(hits.length, `${ceiling.pkg} has ${hits.length} eslint-disable, ceiling ${ceiling.eslintDisable}. ${CEILING_MESSAGE}\n${hits.map(fmt).join('\n')}`)
        .toBeLessThanOrEqual(ceiling.eslintDisable);
    });
    it(`${ceiling.pkg}: ts-expect-error / ts-ignore / ts-nocheck at most ${ceiling.tsDirective}`, () => {
      const hits = scan(own, TS_DIRECTIVE);
      expect(hits.length, `${ceiling.pkg} has ${hits.length} ts directives, ceiling ${ceiling.tsDirective}. ${CEILING_MESSAGE}\n${hits.map(fmt).join('\n')}`)
        .toBeLessThanOrEqual(ceiling.tsDirective);
    });
  }
});
