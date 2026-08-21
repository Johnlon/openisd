/**
 * Filter parity for the `driver_type` wire contract.
 *
 * winisd_tools' `scrapers/tests/test_driver_type_enum_parity.py` proves the two
 * enums hold the same VALUES. That is not enough: it says nothing about whether
 * the UI can actually filter on each value. A member can exist in both enums and
 * still fall through classifyTypes() to the name/T-S heuristics, which is exactly
 * what happened to `passive-radiator`, `amt` and `mid-woofer` when the dt
 * comparisons were written as bare string literals.
 *
 * These tests close that gap: every DriverType member must yield chips, and every
 * chip it yields must be one the filter bar actually renders.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { DriverType, Chip } from '../../src/driverType.js';
import { classifyTypes } from '../../src/db/driverRepo.js';
import { DRIVER_TYPES } from '../../src/logic/driverLibrary.js';

const CHIP_VALUES = new Set(Chip.ALL.map(c => c.value));
const chipValues = (dt: DriverType) => dt.chips.map(c => c.value);

describe('driver_type -> chip projection', () => {
  it('reflects every declared member into ALL', () => {
    // ALL is built by reflection, so a member declared after it would be missed.
    const declared = Object.values(DriverType).filter(v => v instanceof DriverType);
    assert.equal(DriverType.ALL.length, declared.length,
      'DriverType.ALL is not the full member set — is it still the LAST static field?');
    assert.equal(Chip.ALL.length, Object.values(Chip).filter(v => v instanceof Chip).length,
      'Chip.ALL is not the full member set — is it still the LAST static field?');
  });

  it('maps every DriverType member to chips the filter bar renders', () => {
    for (const dt of DriverType.ALL) {
      for (const c of dt.chips) {
        assert.ok(CHIP_VALUES.has(c.value), `DriverType.${dt.value} maps to unknown chip "${c.value}"`);
        assert.ok(Chip.ALL.includes(c), `DriverType.${dt.value} maps to a non-member Chip "${c.value}"`);
      }
    }
    assert.deepEqual(DRIVER_TYPES, Chip.ALL, 'the filter bar renders something other than the Chip enum');
  });

  it('gives every member except unclassified a non-empty chip collection', () => {
    for (const dt of DriverType.ALL) {
      if (dt === DriverType.Unclassified) continue;
      assert.ok(dt.chips.length > 0,
        `DriverType.${dt.value} projects to NO chips — it can never be filtered for`);
    }
  });

  it('never emits the derived `unclassified` chip', () => {
    // A driver is unclassified when its chip collection is EMPTY (isUnclassified in
    // useDriverLibrary). Emitting the chip as well would double-count it.
    for (const dt of DriverType.ALL) {
      assert.ok(!dt.chips.includes(Chip.Unclassified),
        `DriverType.${dt.value} emits the derived Unclassified chip`);
    }
  });

  it('gives every member a display label and every chip a label and tooltip', () => {
    for (const dt of DriverType.ALL) assert.ok(dt.display.length, `DriverType.${dt.value} has no display label`);
    for (const c of Chip.ALL) {
      assert.ok(c.label.length, `Chip.${c.value} has no label`);
      assert.ok(c.title.length, `Chip.${c.value} has no tooltip`);
    }
  });

  it('serialises members to their wire value', () => {
    assert.equal(String(DriverType.PassiveRadiator), 'passive_radiator');
    assert.equal(JSON.stringify(DriverType.MidWoofer), '"mid-woofer"');
    assert.equal(String(Chip.FullRange), 'fullrange');
  });
});

describe('classifyTypes honours every canonical driver_type', () => {
  it('classifies each member from its wire value alone, with no name or T/S help', () => {
    for (const dt of DriverType.ALL) {
      if (dt === DriverType.Unclassified) continue;
      const got = classifyTypes(null, null, '', dt.value);
      assert.deepEqual([...got.types].sort(), [...chipValues(dt)].sort(),
        `driver_type "${dt.value}" did not classify from its wire value — the projection has drifted from the enum`);
      assert.equal(got.canonical, dt.display);
    }
  });

  it('round-trips every member through parse', () => {
    for (const dt of DriverType.ALL) assert.equal(DriverType.parse(dt.value), dt);
  });

  it('takes the leading token of a compound value and ignores qualifiers', () => {
    const got = classifyTypes(null, null, '', `${DriverType.Subwoofer.value}, automotive`);
    assert.deepEqual([...got.types].sort(), [...chipValues(DriverType.Subwoofer)].sort());
  });

  it('falls back to the name when driver_type is absent or not canonical', () => {
    // 'fullrange' is NOT a DriverType value ('full-range' is) — an off-contract
    // record must not classify off it; the name is what carries it.
    assert.equal(DriverType.parse('fullrange'), null);
    assert.equal(classifyTypes(null, null, '', 'fullrange').types.length, 0);
    assert.ok(classifyTypes(null, null, 'Tang Band W5-1880 5in fullrange', 'fullrange')
      .types.includes(Chip.FullRange.value));
  });

  it('reports unclassified as an empty chip collection', () => {
    assert.deepEqual(classifyTypes(null, null, '', DriverType.Unclassified.value).types, []);
    assert.deepEqual(classifyTypes(null, null, '').types, []);
  });
});

// ---------------------------------------------------------------------------------
// Source gate — the defect this whole file exists because of.
// ---------------------------------------------------------------------------------

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const ENUM_FILE = join(UI_SRC, 'driverType.ts');

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

describe('no raw driver_type string literals in comparisons', () => {
  it('compares against DriverType members, never the wire string', () => {
    // Shape-based, not prose-based: it matches an EQUALITY OPERATOR next to the
    // literal, so comments, docs and data tables that merely name a value are not
    // touched. A hit means the compiler has been cut out of the contract — the
    // comparison survives a value change and no rename can find it.
    const offences: string[] = [];
    for (const file of sourceFiles(UI_SRC)) {
      if (file === ENUM_FILE) continue;
      const text = readFileSync(file, 'utf8');
      for (const value of SCANNED) {
        const re = new RegExp(`(?:[=!]==?\\s*['"\`]${value}['"\`])|(?:['"\`]${value}['"\`]\\s*[=!]==?)`, 'g');
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          if (re.test(line)) offences.push(`${relative(UI_SRC, file)}:${i + 1}  ${line.trim()}`);
          re.lastIndex = 0;
        });
      }
    }
    assert.deepEqual(offences, [],
      'raw driver_type literal compared instead of a DriverType member:\n' + offences.join('\n'));
  });
});
