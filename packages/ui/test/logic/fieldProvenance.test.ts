import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {Calculated, Entered, Readable} from '@openisd/design';
import {provenanceOf, provenanceOfEntry} from '../../src/logic/fieldProvenance.js';

function cell(entered: boolean, calculated: boolean): Readable<number | null> & Entered & Calculated {
  return {name: 'x', value: entered || calculated ? 1 : null, dq: [], entered, calculated};
}

function entry(entered: boolean): Readable<number | null> & Entered {
  return {name: 'x', value: entered ? 1 : null, dq: [], entered};
}

describe('provenanceOf — a field that can be entered or calculated', () => {
  it('E when entered', () => assert.equal(provenanceOf(cell(true, false)), 'E'));
  it('C when calculated', () => assert.equal(provenanceOf(cell(false, true)), 'C'));
  it('N when neither', () => assert.equal(provenanceOf(cell(false, false)), 'N'));
});

describe('provenanceOfEntry — a field with no Calculated: it can never show C', () => {
  it('E when entered', () => assert.equal(provenanceOfEntry(entry(true)), 'E'));
  it('N when not entered', () => assert.equal(provenanceOfEntry(entry(false)), 'N'));
});
