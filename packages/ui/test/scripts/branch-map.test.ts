import {describe,it,expect} from 'vitest';
import {fileURLToPath} from 'node:url';
import {discoverMobileSources,SourceSkin} from '../../../../scripts/mobile-surface-discovery.js';
import {VIEW_INDEX} from '../fixtures/viewIndex.js';
import {DESKTOP_BRANCH_MAP,PHONE_BRANCH_MAP,SHARED_BRANCH_MAP,BRANCH_MAP} from '../fixtures/branchMap/index.js';
import type {BranchMap} from '../fixtures/branchMap/index.js';

const repoRoot=fileURLToPath(new URL('../../../../',import.meta.url));
const scanned=discoverMobileSources(repoRoot).surfaces;
const viewIds=new Set(VIEW_INDEX.map(view=>view.id));
const has=(map:BranchMap,id:string):boolean=>Object.hasOwn(map,id);
const unmapped=(skin:SourceSkin,map:BranchMap):string[]=>scanned.filter(s=>s.skin===skin&&!has(map,s.id)).map(s=>s.id+' '+s.path+':'+s.line);
const stale=(map:BranchMap):string[]=>Object.keys(map).filter(id=>!scanned.some(s=>s.id===id));
const badViews=(map:BranchMap):string[]=>Object.entries(map).flatMap(([id,m])=>m.kind==='notAView'?(m.reason===''?[id+' empty reason']:[]):viewIds.has(m.view)?[]:[id+' -> '+m.view]);

describe('branch map',()=>{
  it('maps every Desktop-skin scanned branch',()=>{expect(unmapped(SourceSkin.Desktop,DESKTOP_BRANCH_MAP)).toEqual([]);});
  // filled in step 3b
  it.fails('maps every Phone-skin scanned branch',()=>{expect(unmapped(SourceSkin.Phone,PHONE_BRANCH_MAP)).toEqual([]);});
  // filled in step 3c
  it.fails('maps every Shared scanned branch',()=>{expect(unmapped(SourceSkin.Shared,SHARED_BRANCH_MAP)).toEqual([]);});
  it('has no key that is not a scanned branch, in any map',()=>{
    expect([...stale(DESKTOP_BRANCH_MAP),...stale(PHONE_BRANCH_MAP),...stale(SHARED_BRANCH_MAP)]).toEqual([]);
  });
  it('names only views that exist in the view index',()=>{expect(badViews(BRANCH_MAP)).toEqual([]);});
  it('keeps each skin map to its own skin',()=>{
    const skinOf=new Map(scanned.map(s=>[s.id,s.skin]));
    const wrong=(map:BranchMap,skin:SourceSkin)=>Object.keys(map).filter(id=>skinOf.get(id)!==skin);
    expect([...wrong(DESKTOP_BRANCH_MAP,SourceSkin.Desktop),...wrong(PHONE_BRANCH_MAP,SourceSkin.Phone),...wrong(SHARED_BRANCH_MAP,SourceSkin.Shared)]).toEqual([]);
  });
});
