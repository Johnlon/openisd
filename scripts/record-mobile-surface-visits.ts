import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
interface Attachment {name:string;body?:string}
interface Result {status:string;duration:number;attachments:Attachment[]}
interface Spec {title:string;tests:{results:Result[]}[]}
interface Suite {suites?:Suite[];specs?:Spec[]}
interface Report extends Suite {stats?:{duration:number;expected:number;unexpected:number}}
const root=fileURLToPath(new URL('../',import.meta.url)),reportPath=process.argv[2]??join(root,'build/pw-report.json');
const report:Report=JSON.parse(readFileSync(reportPath,'utf8'));
const visitsPath=join(root,'build/ui-manifest/mobile-visits.json');
const visits:Record<string,object>=existsSync(visitsPath)?JSON.parse(readFileSync(visitsPath,'utf8')):{};
let recorded=0;
function walk(suite:Suite):void{
 for(const spec of suite.specs??[])for(const test of spec.tests)for(const result of test.results){
  if(!spec.title.startsWith('manifest visit: '))continue;
  const id=spec.title.slice('manifest visit: '.length).split(' — ')[0];
  const attachment=result.attachments.find(item=>item.name==='mobile-surface-visit');
  const detail:unknown=attachment?.body?JSON.parse(Buffer.from(attachment.body,'base64').toString('utf8')):null;
  recorded++;visits[id]={status:result.status,testDurationMs:result.duration,detail,report:reportPath};
 }
 for(const child of suite.suites??[])walk(child);
}
walk(report);if(!recorded)throw new Error('No manifest evidence in report');
mkdirSync(join(root,'build/ui-manifest'),{recursive:true});
writeFileSync(join(root,'build/ui-manifest/mobile-visits.json'),JSON.stringify(visits,null,2));
writeFileSync(join(root,'build/ui-manifest/mobile-run.json'),JSON.stringify({report:reportPath,stats:report.stats,visited:Object.keys(visits).length},null,2));
console.log(JSON.stringify({recorded,totalVisited:Object.keys(visits).length,stats:report.stats}));
