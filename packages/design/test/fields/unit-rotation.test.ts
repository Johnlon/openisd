/**
 * `parseUnitRotation` reads the stored unit choices at the load boundary. The store is keyed by
 * the field itself (`NumberField.value`); a save written before that keyed it by a short name
 * ('Vb', 'Fb', 'EBP_hz', ...). Those choices carry over to the field's own key; anything it
 * cannot read is dropped, never an error (repair, not reset).
 */
import {describe, expect, it} from 'vitest';
import {NumberField, parseUnitRotation} from '../../fields/index.js';

describe('parseUnitRotation', () => {
  it('a legacy key carries the chosen unit over to its field: stored {Vb: cuft} shows the box volume in cu ft', () => {
    const rotation = parseUnitRotation({Vb: 'cuft'});
    expect(NumberField.BOX_VB_L.unitTokenFor(rotation)).toBe('cuft');
    expect(rotation).toEqual({[NumberField.BOX_VB_L.value]: 'cuft'});
  });

  it('carries every short-named field over, not only the box volume', () => {
    const rotation = parseUnitRotation({Fb: 'kHz', prVas: 'cuft', ventL: 'in', advTemp: 'degC'});
    expect(NumberField.BOX_FB_HZ.unitTokenFor(rotation)).toBe('kHz');
    expect(NumberField.PR_VAS_L.unitTokenFor(rotation)).toBe('cuft');
    expect(NumberField.VENT_L_CM.unitTokenFor(rotation)).toBe('in');
    expect(NumberField.ADV_TEMP_K.unitTokenFor(rotation)).toBe('degC');
  });

  it('keeps a choice already stored under the field key, and prefers it over a legacy one', () => {
    const rotation = parseUnitRotation({[NumberField.BOX_VB_L.value]: 'cuin', Vb: 'cuft'});
    expect(rotation).toEqual({[NumberField.BOX_VB_L.value]: 'cuin'});
  });

  it('drops an unknown key, a unit outside the field\'s group and a non-string value without throwing', () => {
    expect(parseUnitRotation({noSuchKey: 'cuft', Vb: 'kHz', Fb: 3, cursorHz: 'kHz'})).toEqual({});
  });

  it('reads anything that is not a plain object as no choices', () => {
    expect(parseUnitRotation(undefined)).toEqual({});
    expect(parseUnitRotation('Vb')).toEqual({});
    expect(parseUnitRotation(['cuft'])).toEqual({});
  });
});
