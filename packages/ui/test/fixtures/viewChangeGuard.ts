import type {ViewEntry} from './viewIndex.js';
/** A view that was taken out of the app, with the ruling that allowed it. */
export interface RemovedView {readonly id:string;readonly by:string;readonly date:string;readonly ref:string}
/** Why the index and the frozen baseline disagree. Empty means the index changed only with a decision. */
export function viewChangeProblems(index:readonly ViewEntry[],baselineIds:readonly string[],removed:readonly RemovedView[]):string[] {
  const baseline=new Set(baselineIds),present=new Set(index.map(view=>view.id)),removedIds=new Set(removed.map(row=>row.id));
  const added=index.filter(view=>!baseline.has(view.id)&&view.decision.kind!=='ruling').map(view=>'added without a ruling: '+view.id);
  const gone=baselineIds.filter(id=>!present.has(id)&&!removedIds.has(id)).map(id=>'removed without a removed row: '+id);
  const unruled=removed.filter(row=>row.by===''||row.date===''||row.ref==='').map(row=>'removed row without a ruling: '+row.id);
  const stillThere=removed.filter(row=>present.has(row.id)).map(row=>'listed as removed but still in the index: '+row.id);
  return [...added,...gone,...unruled,...stillThere];
}
