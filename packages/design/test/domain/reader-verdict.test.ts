/**
 * The `reads` contract (winisd_tools brain/DESIGN_20261007_sheet_reader.md): a datasheet reading
 * keeps every reader's read, and openisd derives reader agreement from them. Nothing about
 * agreement is stored. Agreement is the corroboration formula, `readingsAgree`: two reads agree
 * when |a-b| < precision(a) + precision(b) + 0.01·max(|a|,|b|).
 */
import {describe, expect, it} from 'vitest';
import {ReaderAgreement, readerVerdict} from '../../domain/corroboration.js';
import type {ReaderReads} from '../../domain/corroboration.js';
import {Reader} from '../../domain/reader.js';

const read = (value: number | null, literal: string, precision: number | null = 0.05) =>
  ({actual_reading: literal, read_value: value, read_precision: value === null ? null : precision});

describe('Reader — the closed set of readers, by wire value', () => {
  it('has the five wire values of the contract', () => {
    expect(Reader.ALL.map(r => r.value)).toEqual(
      ['text_layer', 'type3_decode', 'pymupdf4llm', 'ocr_tesseract', 'ocr_rapidocr']);
  });
  it('refuses ocr_pymupdf4llm: winisd_tools dropped that reader', () => {
    expect(() => Reader.parse('ocr_pymupdf4llm')).toThrow();
  });
  it('parse is the one string-to-member boundary, and refuses an unknown reader', () => {
    expect(Reader.parse('ocr_rapidocr')).toBe(Reader.OCR_RAPIDOCR);
    expect(() => Reader.parse('tea_leaves')).toThrow();
  });
  it('the two OCR readers are OCR; the three text readers are not', () => {
    expect(Reader.ALL.filter(r => r.isOcr).map(r => r.value)).toEqual(['ocr_tesseract', 'ocr_rapidocr']);
  });
});

describe('readerVerdict — agreement derived from reads', () => {
  it('A — text layer and OCR disagree: DISAGREE, naming the pair, verified', () => {
    const reads: ReaderReads = {
      type3_decode: read(3.9, '3.9 Tm'),
      ocr_tesseract: read(3.6, '3.6 Tm'),
      ocr_rapidocr: read(3.9, '3.9 Tm'),
    };
    const verdict = readerVerdict(reads);
    expect(verdict.agreement).toBe(ReaderAgreement.Disagree);
    expect(verdict.unverified).toBe(false);
    expect(verdict.disagreeing).toEqual(['type3_decode', 'ocr_tesseract']);
  });

  it('B — OCR only, all agree: AGREE but unverified', () => {
    const verdict = readerVerdict({
      ocr_tesseract: read(8.3, '8.3 N/A'),
      ocr_rapidocr: read(8.3, '8.3 N/A'),
    });
    expect(verdict.agreement).toBe(ReaderAgreement.Agree);
    expect(verdict.unverified).toBe(true);
    expect(verdict.disagreeing).toBeNull();
  });

  it('names the readers that gave a number, in reader order, and leaves out a read with no number', () => {
    const verdict = readerVerdict({
      ocr_rapidocr: read(8.3, '8.3'), ocr_tesseract: read(8.3, '8.3'), type3_decode: read(null, '—'),
    });
    expect(verdict.numbered).toEqual(['ocr_tesseract', 'ocr_rapidocr']);
  });

  it('C — text layer only: SINGLE, verified', () => {
    const verdict = readerVerdict({text_layer: read(3.9, '3.9 Tm')});
    expect(verdict.agreement).toBe(ReaderAgreement.Single);
    expect(verdict.unverified).toBe(false);
  });

  it('a single OCR read is SINGLE and unverified', () => {
    const verdict = readerVerdict({ocr_tesseract: read(3.9, '3.9 Tm')});
    expect(verdict.agreement).toBe(ReaderAgreement.Single);
    expect(verdict.unverified).toBe(true);
  });

  it('a read with no number is not a side: one number beside one empty cell is SINGLE', () => {
    const verdict = readerVerdict({text_layer: read(3.9, '3.9 Tm'), ocr_tesseract: read(null, '—')});
    expect(verdict.agreement).toBe(ReaderAgreement.Single);
    expect(verdict.unverified).toBe(false);
  });

  it('John\'s examples: 7.4 vs 7.47 agree (0.07 < 0.1297); 5 vs 5.7 disagree (0.7 > 0.607)', () => {
    expect(readerVerdict({text_layer: read(7.4, '7.4', 0.05), ocr_tesseract: read(7.47, '7.47', 0.005)}).agreement)
      .toBe(ReaderAgreement.Agree);
    expect(readerVerdict({text_layer: read(5, '5', 0.5), ocr_tesseract: read(5.7, '5.7', 0.05)}).agreement)
      .toBe(ReaderAgreement.Disagree);
  });

  it('every pair must agree: two that match and a third that matches neither is DISAGREE', () => {
    const verdict = readerVerdict({
      text_layer: read(10, '10', 0.005),
      pymupdf4llm: read(10, '10', 0.005),
      ocr_rapidocr: read(12, '12', 0.005),
    });
    expect(verdict.agreement).toBe(ReaderAgreement.Disagree);
    expect(verdict.disagreeing).toEqual(['text_layer', 'ocr_rapidocr']);
  });
});
