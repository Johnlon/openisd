import {describe,it,expect} from 'vitest';
import {VIEW_INDEX,ViewSkin,ViewKind} from '../fixtures/viewIndex.js';
import type {ViewEntry} from '../fixtures/viewIndex.js';
import {viewChangeProblems} from '../fixtures/viewChangeGuard.js';
import {BASELINE_VIEW_IDS} from '../fixtures/viewBaseline.js';
import {REMOVED_VIEWS} from '../fixtures/viewRemoved.js';

const fake=(id:string,decision:ViewEntry['decision']):ViewEntry=>({id,skin:ViewSkin.Phone,kind:ViewKind.Dialog,owner:'x',reach:'x',decision});
const ruling={kind:'ruling',by:'John',date:'2026-11-09',ref:'QO1'} as const;
describe('view change guard',()=>{
  it('passes for the live index against the frozen baseline',()=>{
    expect(viewChangeProblems(VIEW_INDEX,BASELINE_VIEW_IDS,REMOVED_VIEWS)).toEqual([]);
  });
  it('fails a new view that has no ruling',()=>{
    const index=[...VIEW_INDEX,fake('phone/fake',{kind:'baseline'})];
    expect(viewChangeProblems(index,BASELINE_VIEW_IDS,REMOVED_VIEWS)).toEqual(['added without a ruling: phone/fake']);
  });
  it('accepts a new view that carries a ruling',()=>{
    expect(viewChangeProblems([...VIEW_INDEX,fake('phone/fake',ruling)],BASELINE_VIEW_IDS,REMOVED_VIEWS)).toEqual([]);
  });
  it('fails a removed baseline view with no removed row',()=>{
    const index=VIEW_INDEX.slice(1);
    expect(viewChangeProblems(index,BASELINE_VIEW_IDS,REMOVED_VIEWS)).toEqual(['removed without a removed row: '+VIEW_INDEX[0].id]);
  });
  it('accepts a removal that has a removed row with a ruling',()=>{
    const row={id:VIEW_INDEX[0].id,by:'John',date:'2026-11-09',ref:'QO1'};
    expect(viewChangeProblems(VIEW_INDEX.slice(1),BASELINE_VIEW_IDS,[...REMOVED_VIEWS,row])).toEqual([]);
  });
  it('fails a removed row with no ruling, or for a view still present',()=>{
    const id=VIEW_INDEX[0].id;
    expect(viewChangeProblems(VIEW_INDEX.slice(1),BASELINE_VIEW_IDS,[...REMOVED_VIEWS,{id,by:'',date:'',ref:''}])).toEqual(['removed row without a ruling: '+id]);
    expect(viewChangeProblems(VIEW_INDEX,BASELINE_VIEW_IDS,[...REMOVED_VIEWS,{id,by:'J',date:'d',ref:'r'}])).toEqual(['listed as removed but still in the index: '+id]);
  });
  it('keeps the baseline free of duplicates',()=>{
    expect(BASELINE_VIEW_IDS.filter((id,i)=>BASELINE_VIEW_IDS.indexOf(id)!==i)).toEqual([]);
  });
});
