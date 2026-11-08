import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverMobileSources,SourceSkin} from '../../../../scripts/mobile-surface-discovery.js';
import {MOBILE_SURFACES,MobileRoute} from '../fixtures/mobileSurfaceManifest.js';
import {mobileSurfaceFlow,MobileFlowChapter} from '../fixtures/mobileSurfaceFlow.js';
import {mobileSurfaceIdentity} from '../fixtures/mobileSurfaceIdentity.js';
import {mobileVisualFlow} from '../fixtures/mobileVisualFlow.js';
import {DESKTOP_SURFACES} from '../fixtures/desktopSurfaceManifest.js';

interface SourceIndex {sources:string[];documents:string[];links:string[]}
function stringArray(value:unknown):value is string[]{return Array.isArray(value)&&value.every((item:unknown)=>typeof item==='string');}
function loadIndex():SourceIndex{
  const index:unknown=JSON.parse(readFileSync(new URL('../fixtures/mobileSurfaceSourceIndex.json',import.meta.url),'utf8'));
  if(typeof index!=='object'||index===null||!('sources' in index)||!('documents' in index)||!('links' in index)||!stringArray(index.sources)||!stringArray(index.documents)||!stringArray(index.links))throw new Error('Invalid surface source index');
  return {sources:index.sources,documents:index.documents,links:index.links};
}
describe('mobile surface manifest',()=>{
  it('keeps desktop views independent and records relationships without demanding one-to-one counterparts',()=>{
    expect(new Set(DESKTOP_SURFACES.map(surface=>surface.id)).size).toBe(DESKTOP_SURFACES.length);
    expect(DESKTOP_SURFACES.every(surface=>surface.id.startsWith('desktop/'))).toBe(true);
    const vented=DESKTOP_SURFACES.filter(surface=>surface.relatedMobileIds.includes('box-vented'));
    expect(vented.map(surface=>surface.id)).toEqual(expect.arrayContaining(['desktop/enclosure/vented/box-tab','desktop/enclosure/vented/vents-tab']));
    const ids=new Set(MOBILE_SURFACES.map(surface=>surface.id));
    expect(DESKTOP_SURFACES.flatMap(surface=>surface.relatedMobileIds).filter(id=>!ids.has(id))).toEqual([]);
    const root=fileURLToPath(new URL('../../../../',import.meta.url));
    expect(DESKTOP_SURFACES.filter(surface=>!existsSync(join(root,surface.owner))).map(surface=>surface.id)).toEqual([]);
  });

  it('organises the illustrated catalogue by the user tasks, including both import workflows',()=>{
    const flow=mobileVisualFlow(MOBILE_SURFACES);
    expect(flow.map(section=>section.title)).toEqual(['Project Creation Wizard','Manage Projects','Project Views','Manage Drivers','Settings and Cloud','Help and Recovery','Shared Interactions']);
    const ids=flow.flatMap(section=>section.groups.flatMap(group=>group.surfaces.map(surface=>surface.id)));
    expect(ids.slice().sort()).toEqual(MOBILE_SURFACES.map(surface=>surface.id).sort());
    const projects=flow.find(section=>section.title==='Manage Projects');
    const drivers=flow.find(section=>section.title==='Manage Drivers');
    expect(projects?.groups.flatMap(group=>group.surfaces.map(surface=>surface.id))).toEqual(expect.arrayContaining(['project-import','exports','menu-projects']));
    expect(drivers?.groups.flatMap(group=>group.surfaces.map(surface=>surface.id))).toEqual(expect.arrayContaining(['driver-import','driver-export','menu-manage-drivers']));
  });

  it('names views by task, parent and variant while preserving their original evidence aliases',()=>{
    const identities=MOBILE_SURFACES.map(mobileSurfaceIdentity);
    expect(new Set(identities.map(identity=>identity.path)).size).toBe(MOBILE_SURFACES.length);
    expect(identities.map(identity=>identity.legacyId)).toEqual(MOBILE_SURFACES.map(surface=>surface.id));
    expect(identities.filter(identity=>!/^([a-z0-9]+(?:-[a-z0-9]+)*\/)+[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.path))).toEqual([]);
    const identityOf=(id:string)=>identities.find(identity=>identity.legacyId===id)?.path;
    expect(identityOf('losses-abc-Front')).toBe('enclosure/abc/losses/front');
    expect(identityOf('editor-parameters')).toBe('driver/editor/parameters');
    expect(identityOf('menu-diagnosticsmodal')).toBe('help/diagnostics/overview');
    expect(identityOf('wizard-sealed-4')).toBe('projects/new/closed-box/enclosure-details');
    expect(identityOf('chart-data')).toBe('results/charts/data-table');
    expect(identityOf('native-keyboard')).toBe('shared/browser/keyboard-and-selection');
    expect(identities.filter(identity=>identity.path.includes('modal')||identity.path.includes('menu-')||identity.path.includes('.vue'))).toEqual([]);
  });

  it('presents the app journey in order, retaining every minor popup exactly once',()=>{
    const flow=mobileSurfaceFlow(MOBILE_SURFACES);
    expect(flow.map(chapter=>chapter.id)).toEqual([MobileFlowChapter.Start,MobileFlowChapter.Driver,MobileFlowChapter.Box,MobileFlowChapter.Signal,MobileFlowChapter.Results,MobileFlowChapter.Settings,MobileFlowChapter.Help,MobileFlowChapter.Shared]);
    const ids=flow.flatMap(chapter=>chapter.groups.flatMap(group=>group.surfaces.map(surface=>surface.id)));
    expect(ids.slice().sort()).toEqual(MOBILE_SURFACES.map(surface=>surface.id).sort());
    const chapterOf=(id:string)=>flow.find(chapter=>chapter.groups.some(group=>group.surfaces.some(surface=>surface.id===id)))?.id;
    expect(chapterOf('wizard-sealed-1')).toBe(MobileFlowChapter.Start);
    expect(chapterOf('driver-rename')).toBe(MobileFlowChapter.Driver);
    expect(chapterOf('losses-abc-Front')).toBe(MobileFlowChapter.Box);
    expect(chapterOf('filter-allpass')).toBe(MobileFlowChapter.Signal);
    expect(chapterOf('what-if-sealed')).toBe(MobileFlowChapter.Results);
    expect(chapterOf('cloud-confirm')).toBe(MobileFlowChapter.Settings);
    expect(chapterOf('refresh')).toBe(MobileFlowChapter.Help);
    expect(chapterOf('native-keyboard')).toBe(MobileFlowChapter.Shared);
    expect(flow[2].groups.find(group=>group.surfaces.some(surface=>surface.id==='box-abc'))?.surfaces.map(surface=>surface.id)).toEqual(['box-abc','losses-abc-Rear','losses-abc-Front']);
  });
  it('requires a deliberate place in the journey for a newly declared surface',()=>{
    expect(()=>mobileSurfaceFlow([...MOBILE_SURFACES,{...MOBILE_SURFACES[0],id:'new-unplaced-popup'}])).toThrow('new-unplaced-popup');
  });

  it('keeps new source popups/conditional branches, docs and links from escaping the published inventory',()=>{
    const report=discoverMobileSources(fileURLToPath(new URL('../../../../',import.meta.url))),index=loadIndex();
    expect(report.surfaces.map(surface=>surface.id).sort()).toEqual(index.sources);
    expect(report.documents.map(surface=>surface.path).sort()).toEqual(index.documents);
    expect(report.links.map(surface=>surface.id).sort()).toEqual(index.links);
  });
  it('declares desktop PR, current-driver information and editor-help surfaces',()=>{
    const ids=DESKTOP_SURFACES.map(surface=>surface.id);
    expect(ids).toEqual(expect.arrayContaining(['desktop/enclosure/passive-radiator/select','desktop/enclosure/passive-radiator/save','desktop/enclosure/passive-radiator/data-quality','desktop/driver/current/info','desktop/driver/editor/help/overview']));
    expect(ids.filter(id=>id.startsWith('desktop/driver/editor/help/'))).toHaveLength(9);
  });

  it('has unique IDs and real source owners for every declared surface',()=>{
    expect(new Set(MOBILE_SURFACES.map(surface=>surface.id)).size).toBe(MOBILE_SURFACES.length);
    const root=fileURLToPath(new URL('../../../../',import.meta.url));
    expect(MOBILE_SURFACES.filter(surface=>!existsSync(join(root,surface.owner))).map(surface=>surface.id)).toEqual([]);
  });
  it('lists every enclosure page and every Driver Editor tab',()=>{
    expect(MOBILE_SURFACES.filter(surface=>surface.route===MobileRoute.Tab&&surface.box).map(surface=>surface.box).sort()).toEqual(['abc','bandpass4','bandpass6','box-passive-radiator','sealed','vented']);
    expect(MOBILE_SURFACES.filter(surface=>surface.route===MobileRoute.Editor).map(surface=>surface.parameter)).toEqual(['General','Parameters','Advanced','Dimensions']);
  });

  describe('stable source keys and skins',()=>{
    function scan(files:Record<string,string>){
      const root=mkdtempSync(join(tmpdir(),'surface-keys-'));
      try{
        for(const [path,text] of Object.entries(files)){mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),text);}
        return discoverMobileSources(root).surfaces;
      }finally{rmSync(root,{recursive:true,force:true});}
    }
    const FILE='packages/ui/src/ui/Keys.vue';
    const target='<div class="panel" id="a"><div v-if="flag" aria-label="Target"></div></div>';
    const keyOf=(rows:ReturnType<typeof scan>,condition:string)=>rows.filter(row=>row.condition===condition).map(row=>row.id);
    it('keeps a key when the branch moves down the file',()=>{
      const before=scan({[FILE]:'<template><div>'+target+'<p v-if="other">x</p></div></template>'});
      const after=scan({[FILE]:'<template><div><p v-if="other">x</p>\n\n'+target+'</div></template>'});
      expect(keyOf(after,'flag')).toEqual(keyOf(before,'flag'));
      expect(keyOf(before,'flag')).toHaveLength(1);
    });
    it('keeps a key when an identical-looking branch is inserted above in another named parent',()=>{
      const before=scan({[FILE]:'<template><div>'+target+'</div></template>'});
      const twin='<div class="other-panel"><div v-if="flag" aria-label="Target"></div></div>';
      const after=scan({[FILE]:'<template><div>'+twin+target+'</div></template>'});
      const original=keyOf(before,'flag')[0];
      expect(keyOf(after,'flag')).toContain(original);
      expect(new Set(keyOf(after,'flag')).size).toBe(2);
    });
    it('changes the key when the condition changes',()=>{
      const before=scan({[FILE]:'<template>'+target+'</template>'});
      const after=scan({[FILE]:'<template>'+target.replace('flag','flag2')+'</template>'});
      expect(keyOf(after,'flag2')).not.toEqual(keyOf(before,'flag'));
    });
    it('scans the desktop shell and tags every record with its skin',()=>{
      const rows=scan({
        'packages/ui/src/ui/shells/original/Desk.vue':'<template><div v-if="d">x</div></template>',
        'packages/ui/src/ui/shells/mobile/Ph.vue':'<template><div v-if="p">x</div></template>',
        [FILE]:'<template><div v-if="s">x</div></template>'});
      const skinOf=(condition:string)=>rows.find(row=>row.condition===condition)?.skin;
      expect(skinOf('d')).toBe(SourceSkin.Desktop);
      expect(skinOf('p')).toBe(SourceSkin.Phone);
      expect(skinOf('s')).toBe(SourceSkin.Shared);
    });
  });
  it('discovers minor and nested popups, anonymous conditional branches, links and documentation',()=>{
    const root=mkdtempSync(join(tmpdir(),'mobile-surfaces-'));
    try{
      mkdirSync(join(root,'packages/ui/src/ui'),{recursive:true});mkdirSync(join(root,'docs/manual'),{recursive:true});
      writeFileSync(join(root,'packages/ui/src/ui/Example.vue'),`<template><div v-if="open" class="small-popover"><div v-if="more" role="dialog" aria-label="Minor details"></div></div><div v-if="secret">anonymous conditional content</div><a href="/about/">Docs</a></template>`);
      writeFileSync(join(root,'docs/manual/help.md'),'# Help');
      mkdirSync(join(root,'bugs/archive'),{recursive:true});
      writeFileSync(join(root,'bugs/archive/closed.md'),'# Historical closed bug');
      writeFileSync(join(root,'packages/ui/README.md'),'# Package guide');
      const report=discoverMobileSources(root);
      expect(report.surfaces.map(surface=>surface.condition)).toEqual(expect.arrayContaining(['open','more','secret']));
      expect(report.surfaces.map(surface=>surface.title)).toContain('Minor details');
      expect(report.documents.map(surface=>surface.path)).toContain('docs/manual/help.md');
      expect(report.documents.map(surface=>surface.path)).not.toContain('bugs/archive/closed.md');
      expect(report.documents.map(surface=>surface.path)).toContain('packages/ui/README.md');
      expect(report.links.map(surface=>surface.href)).toContain('/about/');
    }finally{rmSync(root,{recursive:true,force:true});}
  });
});
