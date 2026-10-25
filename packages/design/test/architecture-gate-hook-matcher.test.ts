// The PreToolUse gate hook in .claude/settings.json starts run_gates.py, which costs about 0.7 s and
// 4-5 processes per call. With matcher `*` it ran on every Read and Grep of every session, which the
// load audit of 20 Oct 2026 measured as hundreds of gate processes at peak
// (BUG_20261020_gate-hook-runs-on-every-tool-call). The matcher names only the tools a gate checks:
// this repo's gates.py (Bash and its EDIT_TOOLS) and the workspace gates.py (Bash, Monitor).
// John agreed the change on QO287.
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const REPO = resolve(__dirname, '../../..');
const WORKSPACE_GATE_TOOLS = ['Bash', 'Monitor'];

function field(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== 'object') return undefined;
  const value: unknown = Reflect.get(obj, key);
  return value;
}

function gateHookMatchers(): string[] {
  const settings: unknown = JSON.parse(readFileSync(resolve(REPO, '.claude/settings.json'), 'utf8'));
  const pre: unknown = field(field(settings, 'hooks'), 'PreToolUse');
  const entries: readonly unknown[] = Array.isArray(pre) ? pre : [];
  const found: string[] = [];
  for (const entry of entries) {
    const matcher = field(entry, 'matcher');
    if (typeof matcher === 'string' && JSON.stringify(entry).includes('run_gates.py')) found.push(matcher);
  }
  return found;
}

function repoGateTools(): string[] {
  const gates = readFileSync(resolve(REPO, 'gates.py'), 'utf8');
  const edit = /^EDIT_TOOLS = \(([^)]*)\)/m.exec(gates);
  assert.ok(edit, 'gates.py declares EDIT_TOOLS');
  return ['Bash', ...[...edit[1].matchAll(/"(\w+)"/g)].map(m => m[1])];
}

describe('architecture: the gate hook runs only on the tools a gate checks', () => {
  it('the matcher is not `*` and names every gated tool', () => {
    const matchers = gateHookMatchers();
    assert.equal(matchers.length, 1, 'exactly one PreToolUse hook runs run_gates.py');
    const matcher = matchers[0];
    assert.notEqual(matcher, '*', 'matcher `*` runs the gates on every Read and Grep');
    const named = matcher.split('|');
    const missing = [...repoGateTools(), ...WORKSPACE_GATE_TOOLS].filter(t => !named.includes(t));
    assert.deepEqual(missing, [], `gated tools missing from the matcher: ${missing.join(', ')}`);
  });
});
