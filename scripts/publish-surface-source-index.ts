import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {discoverMobileSources} from './mobile-surface-discovery.js';
const root=fileURLToPath(new URL('../',import.meta.url)),found=discoverMobileSources(root);
const index={sources:found.surfaces.map(row=>row.id).sort(),documents:found.documents.map(row=>row.path).sort(),links:found.links.map(row=>row.id).sort()};
writeFileSync(fileURLToPath(new URL('../packages/ui/test/fixtures/mobileSurfaceSourceIndex.json',import.meta.url)),JSON.stringify(index,null,2)+'\n');
const count=(skin:string)=>found.surfaces.filter(row=>row.skin===skin).length;
console.log(JSON.stringify({total:index.sources.length,phone:count('phone'),shared:count('shared'),desktop:count('desktop'),unique:new Set(index.sources).size,ordinalSuffixed:index.sources.filter(id=>/-\d+-\d+$/.test(id)).length,links:index.links.length}));
