/**
 * `readingJsonSchema` accepts the contract's `reads` (winisd_tools brain/DESIGN_20261007_sheet_reader.md,
 * "reads contract") and refuses what the contract forbids.
 */
import {describe, expect, it} from 'vitest';
import {readingJsonSchema} from '../../domain/openisdSchema.js';

const exampleA = {
  actual_reading: '3.9 Tm', read_value: 3.9, read_precision: 0.05,
  reads: {
    type3_decode: {actual_reading: '3.9 Tm', read_value: 3.9, read_precision: 0.05},
    ocr_tesseract: {actual_reading: '3.6 Tm', read_value: 3.6, read_precision: 0.05},
    ocr_rapidocr: {actual_reading: '3.9 Tm', read_value: 3.9, read_precision: 0.05},
  },
};
const exampleB = {
  actual_reading: '8.3 N/A', read_value: 8.3, read_precision: 0.05,
  reads: {
    ocr_tesseract: {actual_reading: '8.3 N/A', read_value: 8.3, read_precision: 0.05},
    ocr_rapidocr: {actual_reading: '8.3 N/A', read_value: 8.3, read_precision: 0.05},
    ocr_pymupdf4llm: {actual_reading: '8.3 N/A', read_value: 8.3, read_precision: 0.05},
  },
};
const exampleC = {
  actual_reading: '3.9 Tm', read_value: 3.9, read_precision: 0.05,
  reads: {text_layer: {actual_reading: '3.9 Tm', read_value: 3.9, read_precision: 0.05}},
};

describe('readingJsonSchema — reads', () => {
  for (const [name, example] of [['A (disagreement)', exampleA], ['B (OCR only)', exampleB], ['C (text layer only)', exampleC]] as const) {
    it(`accepts example ${name} unchanged`, () => {
      const parsed = readingJsonSchema.parse(example);
      expect(parsed).toEqual(example);
    });
  }

  it('a reading without reads (a product page, or a record from before) still parses', () => {
    expect(readingJsonSchema.parse({actual_reading: '3.9 Tm', read_value: 3.9})).toEqual({actual_reading: '3.9 Tm', read_value: 3.9});
  });

  it('accepts a read of a cell with no number: read_value and read_precision both null', () => {
    const empty = {...exampleC, reads: {...exampleC.reads, ocr_tesseract: {actual_reading: '—', read_value: null, read_precision: null}}};
    expect(readingJsonSchema.safeParse(empty).success).toBe(true);
  });

  it('refuses a reader it does not know', () => {
    const bad = {...exampleC, reads: {tea_leaves: exampleC.reads.text_layer}};
    expect(readingJsonSchema.safeParse(bad).success).toBe(false);
  });

  it('refuses an empty reads: a datasheet reading exists only because a reader produced a cell', () => {
    expect(readingJsonSchema.safeParse({...exampleC, reads: {}}).success).toBe(false);
  });

  it('refuses a read_precision beside a null read_value', () => {
    const bad = {...exampleC, reads: {text_layer: {actual_reading: '—', read_value: null, read_precision: 0.05}}};
    expect(readingJsonSchema.safeParse(bad).success).toBe(false);
  });

  it('refuses a stored agreement: nothing about agreement is stored', () => {
    expect(readingJsonSchema.safeParse({...exampleA, agreement: 'DISAGREE'}).success).toBe(false);
    const inRead = {...exampleC, reads: {text_layer: {...exampleC.reads.text_layer, agreement: 'AGREE'}}};
    expect(readingJsonSchema.safeParse(inRead).success).toBe(false);
  });
});
