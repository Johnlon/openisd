import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', '..', 'src');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  (function walk(current: string) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts') || name.endsWith('.vue')) out.push(full);
    }
  })(dir);
  return out;
}

function rel(f: string): string {
  return relative(UI_SRC, f);
}

describe('architecture — no native confirm()', () => {
  it('no confirm( or .confirm( call under packages/ui/src', () => {
    const files = filesUnder(UI_SRC);
    const offences: string[] = [];

    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match confirm( or .confirm( as actual calls, not in comments or strings mentioning it
        // Skip lines that are comments or just mention the word
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) continue;
        // Match actual call patterns: confirm( or .confirm( or globalThis.confirm(
        if (/\bconfirm\s*\(/.test(line) || /\.\s*confirm\s*\(/.test(line)) {
          offences.push(`${rel(f)}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    if (offences.length > 0) {
      console.error('Native confirm() calls found:');
      for (const o of offences) console.error(`  ${o}`);
    }
    expect(offences).toEqual([]);
  });
});