import data from './approvedJoinedPaint.json' with {type:'json'};
export type ApprovedPaint=Record<string,string|number>;
export interface ApprovedCataloguePaint {control:ApprovedPaint;unit:ApprovedPaint|null;spinner:ApprovedPaint|null;model:ApprovedPaint|null;label:{family:string;size:string;weight:string;lineHeight:string;colour:string;align:string}|null}
export interface ApprovedUnit {field?:string|null;symbol:string|null;toggle:boolean;paint:ApprovedPaint}
/** Independent snapshot of selected build v20261027T1419Z; never refreshed from the app under test. */
const reference:{catalogue:Record<string,ApprovedCataloguePaint>;screens:Record<string,ApprovedUnit[]>}=data;
export function approvedCataloguePaint(id:string):ApprovedCataloguePaint{const value=reference.catalogue[id];if(!value)throw new Error('Missing approved catalogue paint '+id);return value;}
export function approvedUnits(skin:string,screen:string):readonly ApprovedUnit[]{const units=reference.screens[skin+'/'+screen];if(!units)throw new Error('Missing approved units '+skin+'/'+screen);return units;}
export function requiredPaint(paint:ApprovedPaint|null,name:string):ApprovedPaint{if(paint===null)throw new Error('Missing approved '+name);return paint;}
