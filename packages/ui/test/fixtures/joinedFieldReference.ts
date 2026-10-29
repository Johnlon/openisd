import geometry from './approvedJoinedGeometry.json' with {type:'json'};
import type {IntrinsicNumber,ApprovedGeometry} from './compactFieldContract.js';
/** Frozen from the user-selected build; never derived from the current app under test. */
const reference:{geometry:Record<string,ApprovedGeometry[]>}=geometry;
export function approvedFieldContext(name:string,intrinsic:readonly IntrinsicNumber[]){
 const rows=reference.geometry[name];if(!rows)throw new Error('Missing approved field geometry '+name);
 return {intrinsic,geometry:rows};
}
