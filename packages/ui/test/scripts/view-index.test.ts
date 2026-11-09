import {describe,it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {VIEW_INDEX,ViewSkin} from '../fixtures/viewIndex.js';
import {MOBILE_SURFACES} from '../fixtures/mobileSurfaceManifest.js';
import {DESKTOP_SURFACES} from '../fixtures/desktopSurfaceManifest.js';

const repoRoot=fileURLToPath(new URL('../../../../',import.meta.url));

describe('view index',()=>{
  it('has unique ids',()=>{
    const ids=VIEW_INDEX.map(view=>view.id);
    expect(ids.filter((id,i)=>ids.indexOf(id)!==i)).toEqual([]);
  });
  it('names an existing owner file for every view',()=>{
    expect(VIEW_INDEX.filter(view=>!existsSync(repoRoot+view.owner)).map(view=>view.id)).toEqual([]);
  });
  it('carries every mobile surface with skin Phone',()=>{
    for(const surface of MOBILE_SURFACES){
      const view=VIEW_INDEX.find(entry=>entry.id===surface.id);
      expect(view?.skin,surface.id).toBe(ViewSkin.Phone);
    }
  });
  it('carries every desktop surface with skin Desktop',()=>{
    for(const surface of DESKTOP_SURFACES){
      const view=VIEW_INDEX.find(entry=>entry.id===surface.id);
      expect(view?.skin,surface.id).toBe(ViewSkin.Desktop);
    }
  });
  it('has no baseline entries beyond the two manifests',()=>{
    expect(VIEW_INDEX.filter(view=>view.decision.kind==='baseline').length).toBe(MOBILE_SURFACES.length+DESKTOP_SURFACES.length);
  });
  it('carries every non-baseline entry with a ruling that names a task',()=>{
    expect(VIEW_INDEX.filter(view=>view.decision.kind==='ruling'&&view.decision.ref==='').map(view=>view.id)).toEqual([]);
  });
});
