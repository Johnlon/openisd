/**
 * `parseWprRaw` — raw `.wpr` section/key/value extraction (PLAN_QO60_LAYERING_REMEDIATION.md
 * objective 2, PLAN_USEDESIGNIO_REMEDIATION.md objective 2). RAW only: box-type comes back as
 * WinISD's own numeric code, un-mapped to any OpenISD box kind; no engine formula runs here.
 * The `[Driver]` block is returned as its own `.wdr` text — the same text `OpenISDDriver.
 * fromWdrText()` already reads, not a second driver parser (QO67).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseWprRaw } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SEALED_SMALL = join(here, '..', 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');
const PASSIVE_RADIATOR = join(here, '..', 'fixtures', 'winisd-parity', 'goldens', 'passive-radiator.wpr');

describe('parseWprRaw — sealed-small.wpr golden', () => {
  const raw = parseWprRaw(readFileSync(SEALED_SMALL, 'utf8'));

  it('extracts the raw, un-mapped BType', () => assert.equal(raw.bType, 0));
  it('extracts [Box] Vr as a number', () => assert.equal(raw.box.Vr, 0.02));
  it('extracts [ProjectInfo] fields', () => {
    assert.equal(raw.projectInfo.creator, 'winisd_research overnight harness');
    assert.equal(raw.projectInfo.createDate, '20260813');
  });
  it('extracts the [Driver] block as its own .wdr text, readable by OpenISDDriver.fromWdrText', () => {
    assert.match(raw.driverWdrText, /^\[Driver\]/);
    assert.match(raw.driverWdrText, /Fs=37\.2/);
  });
});

describe('parseWprRaw — passive-radiator.wpr golden', () => {
  const raw = parseWprRaw(readFileSync(PASSIVE_RADIATOR, 'utf8'));
  it('extracts the raw PassiveRadiator section', () => {
    assert.equal(raw.bType, 4);
    assert.ok(raw.passiveRadiator.Sd != null && raw.passiveRadiator.Sd > 0);
    assert.ok(raw.passiveRadiator.Vas != null && raw.passiveRadiator.Vas > 0);
  });
});

describe('parseWprRaw — keys the file does not carry are absent, never fabricated', () => {
  it('a key missing from [Box] is undefined, not 0', () => {
    const text = '[ProjectInfo]\n\n[Driver]\n[Box]\nBType=0\n';
    const raw = parseWprRaw(text);
    assert.equal(raw.box.Vr, undefined);
  });
  it('BType is undefined when [Box] has no BType key', () => {
    const text = '[ProjectInfo]\n\n[Driver]\n[Box]\nVr=0.02\n';
    const raw = parseWprRaw(text);
    assert.equal(raw.bType, undefined);
  });
});
