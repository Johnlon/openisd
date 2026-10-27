import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join,relative,basename,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parse as parseSfc} from '@vue/compiler-sfc';
import {parse as parseDom,NodeTypes,type RootNode,type TemplateChildNode} from '@vue/compiler-dom';
export interface SourceSurface {id:string;path:string;line:number;title:string;condition:string;kind:string;mobile:string;href?:string}
export interface MobileSourceInventory {surfaces:SourceSurface[];documents:SourceSurface[];links:SourceSurface[];sourceHash:string;files:number}
function filesUnder(path:string):string[]{
  if(!existsSync(path))return [];
  return readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.name.startsWith('.')?[]:entry.isDirectory()?filesUnder(join(path,entry.name)):[join(path,entry.name)]);
}
export function discoverMobileSources(root:string):MobileSourceInventory {
  const surfaces:SourceSurface[]=[],documents:SourceSurface[]=[],links:SourceSurface[]=[];
  const hash=createHash('sha256'),occurrences=new Map<string,number>();
  const sourceFiles=[...filesUnder(join(root,'packages/ui/src')).filter(path=>/\.(vue|ts|css)$/.test(path)&&!path.includes('/shells/original/')),
    ...['packages/ui/index.html','packages/ui/about/index.html','packages/ui/install/index.html','packages/ui/public/about/refresh/index.html'].map(path=>join(root,path)).filter(existsSync)];
  function record(collection:SourceSurface[],row:Omit<SourceSurface,'id'>):void{
    const signature=JSON.stringify([row.path,row.title,row.condition,row.kind,row.href]);
    const key=createHash('sha256').update(signature).digest('hex').slice(0,16),count=occurrences.get(key)??0;
    occurrences.set(key,count+1);collection.push({id:row.kind+'-'+key+'-'+count,...row});
  }
  for(const file of sourceFiles){
    const path=relative(root,file).replaceAll('\\','/'),source=readFileSync(file,'utf8');hash.update(path+'\0'+source+'\0');
    const mobile=path.includes('/shells/mobile/')?'mobile':'shared: branch applicability must be reconciled';
    if(path.endsWith('.css'))continue;
    if(path.endsWith('.ts')){
      source.split('\n').forEach((line,index)=>{
        if(/createElement\(['"]dialog|setAttribute\(['"]role['"],\s*['"](?:dialog|alertdialog)|innerHTML\s*=|window\.(?:alert|prompt|confirm)\(/.test(line))record(surfaces,{path,line:index+1,title:'DOM-created or browser UI — '+basename(path),condition:line.trim().slice(0,220),kind:'imperative-ui',mobile});
      });continue;
    }
    let tree:RootNode,offset=0;
    if(path.endsWith('.vue')){
      const parsed=parseSfc(source,{filename:path});if(parsed.errors.length)throw new Error(path+': cannot inventory invalid SFC');
      if(!parsed.descriptor.template)continue;
      tree=parseDom(parsed.descriptor.template.content);offset=parsed.descriptor.template.loc.start.line-1;
    }else tree=parseDom(source);
    function walk(node:RootNode|TemplateChildNode):void{
      if(node.type===NodeTypes.ELEMENT){
        const attrs:Record<string,string>={};let condition='',href='';
        for(const prop of node.props){
          if(prop.type===NodeTypes.ATTRIBUTE){attrs[prop.name]=prop.value?.content??'';if(prop.name==='href')href=prop.value?.content??'';}
          else{
            const expression=prop.exp?.type===NodeTypes.SIMPLE_EXPRESSION?prop.exp.content:'';
            if(['if','else-if','else','show'].includes(prop.name))condition+=prop.name+':'+expression+' ';
            if(prop.name==='bind'&&prop.arg?.type===NodeTypes.SIMPLE_EXPRESSION&&prop.arg.content==='href')href='expression: '+expression;
          }
        }
        const title=attrs['aria-label']||attrs.title||attrs.id||attrs.class||node.tag;
        const role=attrs.role??'',classes=attrs.class??'';
        const namedSurface=/(?:popup|popover|flyout|modal|scrim|sheet|menu|backdrop|overlay|tooltip)/i.test(classes+' '+node.tag)||['dialog','alertdialog','menu','listbox','tooltip'].includes(role);
        const native=attrs.title!==undefined||(['input','select'].includes(node.tag)&&['file','color'].includes(attrs.type??''));
        if(condition||namedSurface||native)record(surfaces,{path,line:offset+node.loc.start.line,title,condition:condition.replace(/^(?:if|else-if|show):/,'').trim(),kind:native&&!condition&&!namedSurface?'native-ui':namedSurface?'surface-root':'conditional-branch',mobile});
        if(href)record(links,{path,line:offset+node.loc.start.line,title:node.loc.source.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,120)||title,condition,kind:href.startsWith('expression:')?'dynamic-link':'link',mobile,href});
        for(const child of node.children)walk(child);
      }else if(node.type===NodeTypes.ROOT)for(const child of node.children)walk(child);
    }
    walk(tree);
    if(path.endsWith('.html'))record(surfaces,{path,line:1,title:basename(file)==='index.html'?path.replace('/index.html',''):basename(file),condition:'standalone document',kind:'standalone-page',mobile:'mobile/browser'});
  }
  const repositoryDocs=execFileSync('rg',['--files','-g','*.md','-g','*.rst','-g','*.adoc','-g','*.txt','-g','*.pdf','-g','*.html'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).map(path=>join(root,path));
  const docs=[...new Set([...filesUnder(join(root,'docs')),...repositoryDocs])].sort();
  for(const file of docs){
    const path=relative(root,file).replaceAll('\\','/'),bytes=readFileSync(file);hash.update(path+'\0').update(bytes).update('\0');
    const text=/\.(md|txt|html)$/.test(path)?bytes.toString('utf8'):'';
    const title=/^#\s+(.+)$/m.exec(text)?.[1]??/<title>([^<]+)/i.exec(text)?.[1]??basename(file);
    record(documents,{path,line:1,title,condition:'repository documentation; not an app-navigation page',kind:['.md','.html','.txt','.pdf'].includes(extname(file))?'documentation':'documentation-asset',mobile:'documentation'});
  }
  return {surfaces,documents,links,sourceHash:hash.digest('hex'),files:sourceFiles.length};
}
