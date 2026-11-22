/** withMovedChamberQicl on hand-made, unvalidated session text: shapes the schema would refuse
 *  must pass through untouched, and a stored Qicl moves to the box's Qiclfr. */
import {describe, expect, it} from 'vitest';
import {withMovedChamberQicl} from '../../domain/project/movedChamberQicl.js';
import {WINISD_BOX_LOSSES} from '../../domain/boxDefaults.js';

describe('withMovedChamberQicl', () => {
  it('returns a non-object session as it was', () => {
    expect(withMovedChamberQicl(5)).toBe(5);
    expect(withMovedChamberQicl(null)).toBeNull();
    expect(withMovedChamberQicl([1])).toEqual([1]);
  });

  it('leaves a project with no box record alone', () => {
    const session = {saved: {box: 3}, edited: 'x'};
    expect(withMovedChamberQicl(session)).toEqual({saved: {box: 3}, edited: 'x'});
  });

  it('skips a box type that is not a record', () => {
    const session = {box: {abc: 7, bandpass4: null}};
    expect(withMovedChamberQicl(session)).toEqual({box: {abc: 7, bandpass4: null}});
  });

  it('moves the rear chamber Qicl before the front one and drops both', () => {
    const session = {box: {abc: {rear: {losses: {Qicl: 11, Ql: 1}}, front: {losses: {Qicl: 22}}}}};
    withMovedChamberQicl(session);
    expect(session).toEqual({box: {abc: {Qiclfr: 11, rear: {losses: {Ql: 1}}, front: {losses: {}}}}});
  });

  it('takes the front Qicl when the rear has none, and ignores a non-numeric one', () => {
    const session = {box: {
      bandpass4: {rear: {losses: {Qicl: 'x'}}, front: {losses: {Qicl: 33}}},
      bandpass6: {rear: {losses: 4}, front: 'nope'},
    }};
    withMovedChamberQicl(session);
    expect(session).toEqual({box: {
      bandpass4: {Qiclfr: 33, rear: {losses: {}}, front: {losses: {}}},
      bandpass6: {Qiclfr: WINISD_BOX_LOSSES.Qicl, rear: {losses: 4}, front: 'nope'},
    }});
  });

  it('keeps a Qiclfr already stored', () => {
    const session = {box: {abc: {Qiclfr: 5, rear: {losses: {Qicl: 9}}}}};
    withMovedChamberQicl(session);
    expect(session).toEqual({box: {abc: {Qiclfr: 5, rear: {losses: {}}}}});
  });
});
