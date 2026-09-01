/**
 * `WinISDProject.fromWprIni` — reading a `.wpr`. RAW only: box-type comes back as WinISD's own
 * numeric code, un-mapped to any OpenISD box kind; no engine formula runs here. The `[Driver]`
 * block comes back as its own `.wdr` text — the same text `OpenISDDriver.fromWdrText()` already
 * reads, not a second driver parser (QO67). Reading keeps every key the file states, whether or
 * not this class knows the key — a foreign key survives a round trip.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDProject } from '@openisd/design/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SEALED_SMALL = join(here, 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');
const PASSIVE_RADIATOR = join(here, 'fixtures', 'winisd-parity', 'goldens', 'passive-radiator.wpr');

describe('fromWprIni — sealed-small.wpr golden', () => {
  const wpr = WinISDProject.fromWprIni(readFileSync(SEALED_SMALL, 'utf8'));

  it('reads the raw, un-mapped BType', () => assert.equal(wpr.number('Box', 'BType'), 0));
  it('reads [Box] Vr as a number', () => assert.equal(wpr.number('Box', 'Vr'), 0.02));
  it('reads [ProjectInfo] fields', () => {
    assert.equal(wpr.value('ProjectInfo', 'Creator'), 'winisd_research overnight harness');
    assert.equal(wpr.value('ProjectInfo', 'CreateDate'), '20260813');
  });
  it('reads the [Driver] block as its own .wdr text, readable by OpenISDDriver.fromWdrText', () => {
    assert.match(wpr.driverWdrText(), /^\[Driver\]/);
    assert.match(wpr.driverWdrText(), /Fs=37\.2/);
  });
  it('returns the file unchanged from toWpr() — reading is not a rewrite', () => {
    assert.equal(wpr.toWpr(), readFileSync(SEALED_SMALL, 'utf8'));
  });
});

describe('fromWprIni — passive-radiator.wpr golden', () => {
  const wpr = WinISDProject.fromWprIni(readFileSync(PASSIVE_RADIATOR, 'utf8'));
  it('reads the raw PassiveRadiator section', () => {
    assert.equal(wpr.number('Box', 'BType'), 4);
    assert.ok((wpr.number('PassiveRadiator', 'Sd') ?? 0) > 0);
    assert.ok((wpr.number('PassiveRadiator', 'Vas') ?? 0) > 0);
  });
});

describe('fromWprIni — keys the file does not carry are absent, never fabricated', () => {
  it('a key missing from [Box] is undefined, not 0', () => {
    const wpr = WinISDProject.fromWprIni('[ProjectInfo]\n\n[Driver]\n[Box]\nBType=0\n');
    assert.equal(wpr.number('Box', 'Vr'), undefined);
  });
  it('BType is undefined when [Box] has no BType key', () => {
    const wpr = WinISDProject.fromWprIni('[ProjectInfo]\n\n[Driver]\n[Box]\nVr=0.02\n');
    assert.equal(wpr.number('Box', 'BType'), undefined);
  });
});

describe('fromWprIni — every key the file states is kept, known to this class or not', () => {
  it('a key nothing consumes still reads back — nothing is silently destroyed', () => {
    const wpr = WinISDProject.fromWprIni('[Box]\nBType=1\ncrosscalc_of_the_future=7\n');
    assert.equal(wpr.value('Box', 'crosscalc_of_the_future'), '7');
  });
  it('vent provenance (crosscalc) survives a read — the key the old reader dropped', () => {
    const wpr = WinISDProject.fromWprIni('[VentRear]\nNum=1\ndia1=0.05\ncrosscalc=0\n');
    assert.equal(wpr.number('VentRear', 'crosscalc'), 0);
  });
});
