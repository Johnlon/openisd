import {describe, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withoutDerivedMarks as designReplacer} from '@openisd/design';
import {buildCatalogueBundle, withoutDerivedMarks, classifyRecord, selectKind} from '../../../../scripts/catalogueBundle.mjs';

const woofer = {specs: {woofer: {}}};
const both = {specs: {woofer: {}, tweeter: {}}};
const pr = {specs: {'passive-radiator': {}}};
const tweeterOnly = {specs: {tweeter: {}}};

describe('classifyRecord: what a record\'s specs hold decides where it goes', () => {
  it('woofer, and woofer plus tweeter, are drivers', () => {
    expect(classifyRecord(woofer)).toBe('driver');
    expect(classifyRecord(both)).toBe('driver');
  });
  it('a passive-radiator section is a passive radiator', () => {
    expect(classifyRecord(pr)).toBe('passiveRadiator');
  });
  it('neither section, no specs, or not an object is dropped', () => {
    for (const r of [tweeterOnly, {specs: {}}, {}, null, 'x', {specs: null}]) expect(classifyRecord(r)).toBeNull();
  });
});

describe('selectKind: the index lists exactly what the bundle holds', () => {
  const rows = [{uuid: 'w', path: 'a/w'}, {uuid: 't', path: 'a/t'}, {uuid: 'b', path: 'a/b'}];
  const records: Record<string, unknown> = {'a/w': woofer, 'a/t': tweeterOnly, 'a/b': both};
  const pick = selectKind(rows, 'driver', (row: {path: string}) => records[row.path]);

  it('keeps rows and records for the kind, drops the rest and names them', () => {
    expect(pick.rows.map((r: {uuid: string}) => r.uuid)).toEqual(['w', 'b']);
    expect(Object.keys(pick.records)).toEqual(['w', 'b']);
    expect(pick.dropped.map((r: {uuid: string}) => r.uuid)).toEqual(['t']);
  });
  it('drops a row whose record is of the other kind', () => {
    expect(selectKind([{uuid: 'p', path: 'a/p'}], 'driver', () => pr).rows).toEqual([]);
  });
});

describe('buildCatalogueBundle: data-quality marks are never written (QO414)', () => {
  it('leaves dq_calculated and dq_scraper out of every record it bundles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
    mkdirSync(join(dir, 'drivers', 'a'), {recursive: true});
    const marked = {specs: {woofer: {Fs_hz: {state: 'E', value: 30, dq_calculated: [{detail: 'x'}], dq_scraper: [{detail: 'y'}]}}}};
    writeFileSync(join(dir, 'drivers', 'a', 'w.json'), JSON.stringify(marked));
    writeFileSync(join(dir, 'drivers-index.json'), JSON.stringify([{uuid: 'w', path: 'a/w'}]));
    writeFileSync(join(dir, 'passive-radiators-index.json'), '[]');
    const {bundle} = buildCatalogueBundle(dir, 'b1');
    const text = JSON.stringify(bundle);
    expect(text).toContain('"Fs_hz"');
    expect(text).not.toMatch(/dq_calculated|dq_scraper/);
    expect(readFileSync(join(dir, 'drivers', 'a', 'w.json'), 'utf8')).toContain('dq_calculated');
  });
});

describe('the bundler\'s mark replacer is the design package\'s', () => {
  it('drops the same keys', () => {
    for (const key of ['dq_calculated', 'dq_scraper', 'value', 'readings']) expect(withoutDerivedMarks(key, 1)).toBe(designReplacer(key, 1));
  });
});
