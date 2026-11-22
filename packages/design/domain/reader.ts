/**
 * The readers a datasheet cell can be read by (winisd_tools sheet-reader contract). The wire
 * values are the contract; `Reader.parse` is the one string-to-member boundary.
 */
const _readerValues = ['text_layer', 'type3_decode', 'pymupdf4llm', 'ocr_tesseract', 'ocr_rapidocr'] as const;
export const READER_VALUES = _readerValues;
export type ReaderValue = typeof _readerValues[number];

export class Reader {
    private constructor(readonly value: ReaderValue, readonly isOcr: boolean) {}

    static readonly TEXT_LAYER = new Reader('text_layer', false);
    static readonly TYPE3_DECODE = new Reader('type3_decode', false);
    static readonly PYMUPDF4LLM = new Reader('pymupdf4llm', false);
    static readonly OCR_TESSERACT = new Reader('ocr_tesseract', true);
    static readonly OCR_RAPIDOCR = new Reader('ocr_rapidocr', true);

    static readonly ALL: readonly Reader[] = [
        Reader.TEXT_LAYER, Reader.TYPE3_DECODE, Reader.PYMUPDF4LLM,
        Reader.OCR_TESSERACT, Reader.OCR_RAPIDOCR,
    ];

    /** The reader with this wire value; throws on one that is not a reader. */
    static parse(value: string): Reader {
        const found = Reader.ALL.find(r => r.value === value);
        if (found === undefined) throw new Error(`unknown reader '${value}'`);
        return found;
    }
}
