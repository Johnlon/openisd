/**
 * The `driver_type` wire strings are compared nowhere in the UI source: every comparison is
 * against a `DriverType` member, never the wire string. A raw comparison survives a value change
 * and no rename can find it (the defect that made `passive-radiator`, `amt` and `mid-woofer` fall
 * through `chipsOf()`).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';
import {DriverType} from '@openisd/design/filter';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
// driverType.ts lives in @openisd/model now, outside the UI_SRC tree this gate scans —
// ENUM_FILE no longer needs a self-exclusion, but sourceFiles() below is UI_SRC-only.

// 'woofer' and 'unclassified' are deliberately NOT scanned: they collide with the
// chip ids of the same spelling, where comparing a raw string is legitimate. Every
// other canonical value is unambiguous — a comparison against it is always the bug.
const SCANNED = DriverType.ALL
  .filter(d => d !== DriverType.Woofer && d !== DriverType.Unclassified)
  .map(d => d.value);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (full.endsWith('.ts') || full.endsWith('.vue')) out.push(full);
  }
  return out;
}

/**
 * A comparison against a BOX TYPE, which is not this gate's business.
 *
 * `'passive-radiator'` names two unrelated things: a driver_type (a driver that IS a passive
 * radiator, ruling D7) and a box type (an enclosure loaded by one, John's canon 2026-08-28).
 * The scan below matches text, so it cannot tell which is meant — see
 * bugs/BUG_20260828_driver_type_gate_cannot_tell_a_box_type_comparison_from_a_driver_type_one.md.
 *
 * This matches IDENTIFIERS ONLY — the name of the expression being compared — never a comment,
 * a docstring or a string literal, per the global rule's stated exception for a check that
 * cannot be written as a pure shape. It narrows WHICH comparisons the gate judges; it never
 * weakens the judgement itself, which the non-vacuity test below pins.
 */
const BOX_TYPE_OPERAND = /\b(?:box|boxType|selectedBox)(?:\.value)?\s*[=!]==?\s*['"`]/;

/** Every `driver_type` wire-string comparison in the UI source, as `file:line  text`. */
function wireStringComparisons(): string[] {
  const offences: string[] = [];
  for (const file of sourceFiles(UI_SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const value of SCANNED) {
      const re = new RegExp(`(?:[=!]==?\\s*['"\`]${value}['"\`])|(?:['"\`]${value}['"\`]\\s*[=!]==?)`, 'g');
      text.split('\n').forEach((line, i) => {
        if (re.test(line) && !BOX_TYPE_OPERAND.test(line)) {
          offences.push(`${relative(UI_SRC, file)}:${i + 1}  ${line.trim()}`);
        }
        re.lastIndex = 0;
      });
    }
  }
  return offences;
}

describe('no raw driver_type string literals in comparisons', () => {
  it('compares against DriverType members, never the wire string', () => {
    // Shape-based, not prose-based: it matches an EQUALITY OPERATOR next to the
    // literal, so comments, docs and data tables that merely name a value are not
    // touched. A hit means the compiler has been cut out of the contract — the
    // comparison survives a value change and no rename can find it.
    const offences = wireStringComparisons();
    assert.deepEqual(offences, [],
      'raw driver_type literal compared instead of a DriverType member:\n' + offences.join('\n'));
  });

  it('still catches a driver_type wire-string comparison — the box-type skip is not a blanket pass', () => {
    // Non-vacuity. The skip above keys on the OPERAND's name, so a driver-type comparison is
    // still judged; without this, narrowing the gate could quietly become disabling it.
    const driverTypeLine = `if (driverType === 'passive-radiator') { /* … */ }`;
    const boxTypeLine = `if (selectedBox === 'passive-radiator') { /* … */ }`;
    const re = new RegExp(`(?:[=!]==?\\s*['"\`]passive-radiator['"\`])`, 'g');

    assert.ok(re.test(driverTypeLine), 'the equality scan must match a driver_type comparison');
    re.lastIndex = 0;
    assert.ok(!BOX_TYPE_OPERAND.test(driverTypeLine),
      'a driver_type comparison must NOT be skipped as a box-type one');
    assert.ok(BOX_TYPE_OPERAND.test(boxTypeLine),
      'a box-type comparison must be recognised as out of this gate\'s scope');
  });
});
