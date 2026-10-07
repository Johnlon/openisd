/**
 * A driver.yml reading that carries `reads` (winisd_tools sheet-reader contract): the reads ride
 * into the record unchanged, and readers that disagree raise a DQ warning showing every candidate.
 * Agreement is derived here and never stored.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse, stringify} from 'yaml';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {createEngine} from '../../engine/index.js';

const engine = createEngine();
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus', 'dayton-ce28n-4.driver.yml');
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The record at `key` of `parent`, itself, not a copy: the test edits the document in place. */
function child(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const found = parent[key];
  if (!isRecord(found)) throw new Error(`expected a record at '${key}'`);
  return found;
}

const cell = (value: number, literal: string) => ({actual_reading: literal, read_value: value, read_precision: 0.5});

/** The Dayton driver.yml with `reads` added to the Fs_hz datasheet reading. */
function ymlWithFsReads(reads: Record<string, unknown>): string {
  const doc: unknown = parse(readFileSync(FIXTURE, 'utf8'));
  if (!isRecord(doc)) throw new Error('driver.yml is not a record');
  const fs = child(child(child(doc, 'specs'), 'woofer'), 'Fs_hz');
  child(child(fs, 'readings'), 'manufacturer_datasheet').reads = reads;
  return stringify(doc);
}

function convert(yml: string) {
  return new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(yml);
}

describe('driver.yml readings with reads', () => {
  it('readers that disagree raise a warning naming the field and showing every reader\'s read', () => {
    const {errors} = convert(ymlWithFsReads({
      type3_decode: cell(456, '456 Hz'),
      ocr_tesseract: cell(486, '486 Hz'),
      ocr_rapidocr: cell(456, '456 Hz'),
    }));
    const warning = errors.find(e => e.message.includes('readers disagree'));
    expect(warning?.level).toBe('warn');
    expect(warning?.field).toBe('woofer.Fs_hz');
    expect(warning?.message).toContain('manufacturer_datasheet');
    for (const shown of ['type3_decode=456 Hz', 'ocr_tesseract=486 Hz', 'ocr_rapidocr=456 Hz']) expect(warning?.message).toContain(shown);
  });

  it('readers that agree raise no warning, and the reads are kept in the record', () => {
    const {errors, openisd} = convert(ymlWithFsReads({
      text_layer: cell(456, '456 Hz'),
      ocr_tesseract: cell(456, '456 Hz'),
    }));
    expect(errors.filter(e => e.message.includes('readers disagree'))).toEqual([]);
    expect(openisd).toContain('text_layer');
    expect(openisd).toContain('ocr_tesseract');
  });

  it('no agreement is stored in the record', () => {
    const {openisd} = convert(ymlWithFsReads({text_layer: cell(456, '456 Hz'), ocr_tesseract: cell(486, '486 Hz')}));
    expect(openisd).not.toMatch(/"agreement"|\bAGREE\b|DISAGREE|\bSINGLE\b/);
  });

  it('an OCR-only reading raises a warning naming the OCR reader(s): no text layer confirmed it', () => {
    const {errors} = convert(ymlWithFsReads({ocr_tesseract: cell(456, '456 Hz'), ocr_rapidocr: cell(456, '456 Hz')}));
    const warning = errors.find(e => e.message.includes('no text layer'));
    expect(warning?.level).toBe('warn');
    expect(warning?.field).toBe('woofer.Fs_hz');
    expect(warning?.message).toContain('manufacturer_datasheet');
    expect(warning?.message).toContain('ocr_tesseract');
    expect(warning?.message).toContain('ocr_rapidocr');
    expect(errors.filter(e => e.message.includes('readers disagree'))).toEqual([]);
  });

  it('a single OCR read is flagged the same way', () => {
    const {errors} = convert(ymlWithFsReads({ocr_rapidocr: cell(456, '456 Hz')}));
    expect(errors.find(e => e.message.includes('no text layer'))?.message).toContain('ocr_rapidocr');
  });

  it('OCR readers that disagree raise both warnings', () => {
    const {errors} = convert(ymlWithFsReads({ocr_tesseract: cell(456, '456 Hz'), ocr_rapidocr: cell(486, '486 Hz')}));
    expect(errors.some(e => e.message.includes('readers disagree'))).toBe(true);
    expect(errors.some(e => e.message.includes('no text layer'))).toBe(true);
  });

  it('a text-layer read, alone or beside OCR, is not flagged unverified', () => {
    for (const reads of [{text_layer: cell(456, '456 Hz')}, {type3_decode: cell(456, '456 Hz'), ocr_tesseract: cell(456, '456 Hz')}]) {
      expect(convert(ymlWithFsReads(reads)).errors.filter(e => e.message.includes('no text layer'))).toEqual([]);
    }
  });

  it('a reading without reads converts exactly as before: no reader warning', () => {
    const {errors} = convert(readFileSync(FIXTURE, 'utf8'));
    expect(errors.filter(e => e.message.includes('readers disagree'))).toEqual([]);
  });
});
