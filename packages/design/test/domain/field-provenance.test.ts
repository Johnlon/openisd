/**
 * A field states its own provenance letter — `E` entered, `C` calculated, `N` absent — so no
 * reader combines the `entered`/`calculated` flags for itself (John, 2026-09-28: "if a field
 * deserves an attribute or behaviour then give it to the field").
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {absentCell, calculatedCell, enteredCell, ReadableFieldImpl} from '../../domain/cell.js';

describe('Readable.provenance', () => {
  it('E when a person entered the value', () => {
    assert.equal(new ReadableFieldImpl(() => enteredCell('x', 1)).provenance, 'E');
  });

  it('C when the solver derived it', () => {
    assert.equal(new ReadableFieldImpl(() => calculatedCell('x', 1)).provenance, 'C');
  });

  it('N when the field is absent', () => {
    assert.equal(new ReadableFieldImpl(() => absentCell<number>('x')).provenance, 'N');
  });
});
